import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { CheckPlagiarismBody, HumanizeTextBody } from "@workspace/api-zod";
import { compareDocuments } from "../lib/winnow";
import { analyseTextPlagiarism, computeReadabilityScores } from "../lib/textAnalysis";
import { recordUsage } from "../lib/apiCost";
import { trackUsage, enforceLimit } from "../lib/usageTracker";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { detectAIScore, humanizeTextOnce } from "../lib/aiDetection";
import { searchAllAcademicSources } from "../lib/academicSources";
import { runOpenSourcePlagiarismCheck } from "../lib/openSourceSearch";

const router = Router();

// Stop-words used for cosine similarity (mirrors textAnalysis.ts corpus logic)
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","as","is","was","are",
  "were","be","been","being","have","has","had","do","does","did","will","would","could","should","may",
  "might","shall","that","this","these","those","it","its","which","who","what","when","where","how","if",
  "then","than","so","yet","both","not","no","nor","any","each","few","more","most","other","some","such",
  "all","also","just","into","over","after","before","about","up","out","can","now","like","only","same",
  "too","very","one","two","three","four","five","i","we","you","they","he","she","our","their","your",
  "his","her","my","its","used","using","study","paper","research","results","show","shows","showed",
  "article","journal","found","finding","analysis","data","however","whereas","while","thus","therefore",
]);

/**
 * Compute TF-based cosine similarity between two text strings.
 * Returns a percentage (0–100). This is the same algorithm used in
 * textAnalysis.ts — the result is directly comparable to the local corpus score.
 */
function computeCosineSimilarity(text1: string, text2: string): number {
  const tokenize = (t: string) =>
    t.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  if (!tokens1.length || !tokens2.length) return 0;

  const buildTF = (tokens: string[]) => {
    const tf = new Map<string, number>();
    for (const w of tokens) tf.set(w, (tf.get(w) ?? 0) + 1);
    return tf;
  };

  const tf1 = buildTF(tokens1);
  const tf2 = buildTF(tokens2);
  const vocab = new Set([...tf1.keys(), ...tf2.keys()]);

  let dot = 0, mag1 = 0, mag2 = 0;
  for (const w of vocab) {
    const v1 = tf1.get(w) ?? 0;
    const v2 = tf2.get(w) ?? 0;
    dot += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }

  return (mag1 === 0 || mag2 === 0) ? 0 : (dot / (Math.sqrt(mag1) * Math.sqrt(mag2))) * 100;
}

/**
 * Extract the most distinctive / content-rich phrases from the text.
 * Used to build multi-angle queries so all 13 databases are searched
 * against representative samples from beginning, middle, and key concepts.
 */
function extractQueryPhrases(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const queries: string[] = [];

  // Opening (first 40 words — usually abstract/intro — most search-relevant)
  if (words.length > 0) queries.push(words.slice(0, 40).join(" "));

  // Middle section (avoids overlap with opening query)
  if (words.length > 80) {
    const mid = Math.floor(words.length / 2);
    queries.push(words.slice(mid - 18, mid + 18).join(" "));
  }

  // Extract technically-distinctive tokens (long, non-stop words) for a concept query
  const techTokens = words
    .filter(w => w.length > 7 && !STOP_WORDS.has(w.toLowerCase()) && /^[a-zA-Z]/.test(w))
    .slice(0, 12);
  if (techTokens.length >= 4) queries.push(techTokens.join(" "));

  return queries;
}

/**
 * Query all 13 live academic databases with multiple representative phrases
 * extracted from the submitted text, then compute REAL cosine similarity
 * between the submitted text and each returned paper abstract.
 *
 * This is the same corpus the AI Paper Writer reads from — so if a paper was
 * used as a source for writing, it will appear here as a match.
 */
async function fetchLiveAcademicMatches(
  text: string,
): Promise<Array<{ url: string; title: string; authors: string; year: number; similarity: number; matchedText?: string; sourceType: string }>> {
  try {
    const queries = extractQueryPhrases(text);

    // Fan out to all 13 databases with each phrase, collect unique papers by DOI/URL
    const seenKeys = new Set<string>();
    const allPapers: Awaited<ReturnType<typeof searchAllAcademicSources>> = [];

    await Promise.all(
      queries.map(async (q) => {
        try {
          const papers = await Promise.race<Awaited<ReturnType<typeof searchAllAcademicSources>>>([
            searchAllAcademicSources(q, 6, undefined),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 7000)),
          ]);
          for (const p of papers) {
            const key = p.doi ?? p.url ?? p.title;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allPapers.push(p);
            }
          }
        } catch { /* non-fatal per query */ }
      }),
    );

    // Score each paper against the submitted text using real cosine similarity
    const scored = allPapers
      .filter(p => p.abstract && p.abstract.length > 60)
      .map(p => ({
        url: p.doi ? `https://doi.org/${p.doi}` : p.url,
        title: p.title,
        authors: p.authors,
        year: p.year,
        similarity: Math.round(computeCosineSimilarity(text, p.abstract!) * 10) / 10,
        matchedText: p.abstract!.slice(0, 120),
        sourceType: "academic-live" as const,
      }))
      .filter(p => p.similarity > 1) // only papers with measurable vocabulary overlap
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return scored;
  } catch {
    return [];
  }
}

/**
 * Plagiarism + AI Detection.
 *
 * AI scoring now uses the SAME GPT-4o-mini + burstiness model as the
 * Humanizer tool, so the numbers shown here are directly comparable to what
 * the Humanizer reports after it processes the text.
 *
 * Plagiarism scoring layers two signals:
 *  1. Local cosine-similarity against ACADEMIC_CORPUS (fast, always available)
 *  2. Live database query against 13 real academic databases (async, non-blocking)
 *     returning real paper titles and DOI links users can actually verify.
 */
router.post("/plagiarism/check", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const quota = await enforceLimit(req.userId!, "plagiarism");
    if (!quota.allowed) {
      send("error", {
        message: `You've used all ${quota.limit} plagiarism checks for this month on your ${quota.plan} plan. Upgrade to Pro or use Pay-As-You-Go.`,
      });
      return res.end();
    }
    const body = CheckPlagiarismBody.parse(req.body);
    const text = body.text;

    send("step", { id: "tokenise", message: "Tokenising document and building word frequency map…", status: "running" });

    const localAnalysisPromise = Promise.resolve(analyseTextPlagiarism(text));
    const readabilityPromise = Promise.resolve(computeReadabilityScores(text));

    send("step", { id: "tokenise", message: "Document tokenised", status: "done" });
    send("step", { id: "ai-detect", message: "Detecting AI-generated patterns — lexical diversity & sentence flow…", status: "running" });
    send("step", { id: "plag-scan", message: "Scanning against academic corpus for plagiarism sources…", status: "running" });

    const [
      { plagiarismScore, matchedWords, sourceMatches },
      { score: aiScore, indicators: aiIndicators, burstiness, stdDev },
      readability,
      liveMatches,
      openSourceResult,
    ] = await Promise.all([
      localAnalysisPromise,
      detectAIScore(text, "plagiarism-check").then(r => { send("step", { id: "ai-detect", message: `AI detection complete — score: ${r.score >= 0 ? r.score + "%" : "unavailable"}`, status: "done" }); return r; }),
      readabilityPromise,
      fetchLiveAcademicMatches(text),
      runOpenSourcePlagiarismCheck(text).then(r => { send("step", { id: "plag-scan", message: `Plagiarism scan complete — ${r.totalSentencesChecked} sentences checked`, status: "done" }); return r; }),
    ]);

    const sentenceList = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
    const aiSections = sentenceList
      .filter((sentence) => {
        const lower = sentence.toLowerCase();
        return /furthermore|moreover|in conclusion|it is (important|worth|essential)|this (paper|essay|study)|one (important|key|significant)|facilitate|utilize|demonstrate/.test(lower);
      })
      .slice(0, 4)
      .map((sentence) => {
        const startIndex = text.indexOf(sentence);
        const wordCount = sentence.split(/\s+/).length;
        const sentenceScore = Math.min(60 + (wordCount > 20 ? 15 : 0) + aiIndicators.length * 5, 95);
        return { text: sentence, score: sentenceScore, startIndex, endIndex: startIndex + sentence.length };
      });

    const localPlagiarismSources = sourceMatches
      .filter((s) => s.similarity > 5)
      .slice(0, 2)
      .map((s) => ({
        url: `https://scholar.google.com/search?q=${encodeURIComponent(s.label)}`,
        similarity: s.similarity,
        matchedText: s.matchedWords.slice(0, 12).join(", "),
        title: s.label,
        live: false,
        sourceType: "academic-local",
      }));

    const livePlagiarismSources = liveMatches.map((m) => ({
      url: m.url,
      similarity: m.similarity,
      matchedText: m.matchedText ?? `${m.authors}, ${m.year}`,
      title: m.title,
      authors: m.authors,
      year: m.year,
      live: true,
      sourceType: "academic-live",
    }));

    const openSourceSources = openSourceResult.sourcesFound.slice(0, 4).map((s) => ({
      url: s.url,
      similarity: Math.round(openSourceResult.overallScore * (s.confidence / 100)),
      matchedText: s.matchedPhrase.slice(0, 80),
      title: s.title,
      authors: s.authors,
      year: s.year,
      live: true,
      sourceType: s.source,
    }));

    const plagiarismSources = [
      ...livePlagiarismSources,
      ...openSourceSources,
      ...localPlagiarismSources,
    ].slice(0, 8);

    // Blended score: local cosine similarity + open-source sentence-match rate
    const blendedPlagiarismScore = openSourceResult.totalSentencesChecked > 0
      ? Math.round((plagiarismScore * 0.4) + (openSourceResult.overallScore * 0.6))
      : plagiarismScore;

    const effectiveAiScore = aiScore >= 0 ? aiScore : null;

    const overallRisk: "low" | "medium" | "high" =
      (effectiveAiScore !== null && effectiveAiScore > 65) || blendedPlagiarismScore > 35
        ? "high"
        : (effectiveAiScore !== null && effectiveAiScore > 35) || blendedPlagiarismScore > 15
        ? "medium"
        : "low";

    try {
      const userId = req.userId ?? null;
      const mode =
        body.checkAi && body.checkPlagiarism
          ? "both"
          : body.checkAi
          ? "ai"
          : "plagiarism";
      const docNum = await getNextDocNumber(userId, "plagiarism");
      await db.insert(documentsTable).values({
        userId,
        title: formatDocTitle({ type: "plagiarism", docNumber: docNum, plagiarismMode: mode }),
        content: `AI Score: ${aiScore}% | Plagiarism Score: ${blendedPlagiarismScore}% (local: ${plagiarismScore}%, open-source: ${openSourceResult.overallScore}%)\nRisk: ${overallRisk}\nBurstiness: ${burstiness}/100 (stdDev: ${stdDev.toFixed(1)}w)\n\n${text.slice(0, 2000)}`,
        type: "plagiarism",
        docNumber: docNum,
        wordCount: text.split(/\s+/).filter(Boolean).length,
      });
    } catch {
      /* non-fatal */
    }

    send("step", { id: "report", message: "Computing writing quality metrics and generating report…", status: "running" });

    send("step", { id: "report", message: "Full diagnostic report ready", status: "done" });

    send("done", {
      aiScore: effectiveAiScore !== null ? effectiveAiScore : 0,
      aiDetectionAvailable: effectiveAiScore !== null,
      plagiarismScore: blendedPlagiarismScore,
      plagiarismScoreBreakdown: {
        localSimilarity: plagiarismScore,
        openSourceMatch: openSourceResult.overallScore,
        sentencesChecked: openSourceResult.totalSentencesChecked,
        breakdown: openSourceResult.breakdown,
      },
      aiSections,
      plagiarismSources,
      matchedSentences: openSourceResult.matchedSentences.slice(0, 5).map(ms => ({
        sentence: ms.sentence.slice(0, 200),
        matchScore: ms.matchScore,
        sources: ms.sources.slice(0, 2).map(s => ({ url: s.url, title: s.title, sourceType: s.source })),
      })),
      overallRisk,
      matchedWords,
      burstiness,
      stdDev: Math.round(stdDev * 10) / 10,
      aiFlags: aiIndicators,
      readability,
      detectionModel: "gpt-4o-mini + burstiness",
      sourcesScanned: [
        "OpenAlex (250M+ papers)", "Semantic Scholar (200M+ papers)", "CrossRef (145M+ DOIs)",
        "Open Library (20M+ books)", "Wikipedia", "Google Books", "Internet Archive",
        "PubMed NCBI", "Europe PMC", "arXiv", "CORE", "Zenodo", "DOAJ",
      ],
    });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error checking plagiarism");
    send("error", { message: "Internal server error" });
    res.end();
  }
});

/**
 * Quick Humanizer — uses the same AI detection model as the Humanizer tool.
 *
 * TARGET: < 10% AI score (matching GPT-4o-mini + burstiness, same standard as
 * the standalone Humanizer). Up to 3 passes. Always keeps the lowest-scoring version.
 */
router.post("/plagiarism/humanize", requireAuth, async (req, res) => {
  try {
    const quota = await enforceLimit(req.userId!, "humanizer");
    if (!quota.allowed) {
      return res.status(429).json({
        error: "quota",
        message: `You've used all ${quota.limit} humanizer uses for this month on your ${quota.plan} plan. Upgrade to Pro or use Pay-As-You-Go.`,
      });
    }
    const body = HumanizeTextBody.parse(req.body);
    const text = body.text;
    const intensity = body.intensity ?? "medium";
    const tone = (body as { tone?: string }).tone === "conversational"
      ? "conversational"
      : (body as { tone?: string }).tone === "professional"
      ? "professional"
      : "academic";

    const TARGET_SCORE = 0;
    const MAX_PASSES = 3;

    const { score: initialScore, indicators: initialIndicators } = await detectAIScore(
      text,
      "quick-humanize-initial",
    );

    if (initialScore < 0) {
      return res.json({
        humanizedText: text,
        changes: 0,
        beforeScore: 0,
        afterScore: 0,
        passes: 0,
        message: "AI detection unavailable — score could not be verified. Please try again.",
        detectionAvailable: false,
      });
    }

    if (initialScore <= TARGET_SCORE) {
      return res.json({
        humanizedText: text,
        changes: 0,
        beforeScore: initialScore,
        afterScore: initialScore,
        passes: 0,
        message: "Text already passes AI detection — no changes needed.",
      });
    }

    let bestText = text;
    let bestScore = initialScore;
    let bestIndicators = initialIndicators;
    let passesRun = 0;

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      passesRun = pass;
      const humanized = await humanizeTextOnce(bestText, tone, pass, bestIndicators);

      const { score: newScore, indicators: newIndicators } = await detectAIScore(
        humanized,
        `quick-humanize-pass-${pass}`,
      );

      if (newScore < 0) break;

      if (newScore < bestScore) {
        bestText = humanized;
        bestScore = newScore;
        bestIndicators = newIndicators;
      }

      if (bestScore <= TARGET_SCORE) break;
    }

    return res.json({
      humanizedText: bestText,
      changes: passesRun,
      beforeScore: initialScore,
      afterScore: bestScore,
      passes: passesRun,
    });
  } catch (err) {
    req.log.error({ err }, "Error humanizing text");
    res.status(500).json({ error: "Failed to humanize text. Please try again." });
  }
});

// Code similarity via Winnowing — unchanged (already real MOSS-style algorithm)
router.post("/plagiarism/code", requireAuth, async (req, res) => {
  try {
    const { doc1, doc2, language, kgramSize: rawK, windowSize: rawW } = req.body as Record<string, unknown>;
    if (typeof doc1 !== "string" || doc1.length < 10 || doc1.length > 50000) {
      return res.status(400).json({ error: "doc1 must be a string between 10 and 50000 characters" });
    }
    if (typeof doc2 !== "string" || doc2.length < 10 || doc2.length > 50000) {
      return res.status(400).json({ error: "doc2 must be a string between 10 and 50000 characters" });
    }
    const kgramSize = typeof rawK === "number" && rawK >= 5 && rawK <= 50 ? Math.floor(rawK) : 8;
    const windowSize = typeof rawW === "number" && rawW >= 2 && rawW <= 20 ? Math.floor(rawW) : 4;

    const result = compareDocuments(doc1, doc2, kgramSize, windowSize);
    const overallSimilarity = Math.round((result.similarity1 + result.similarity2) / 2);
    const riskLevel: "low" | "medium" | "high" =
      overallSimilarity >= 40 ? "high" : overallSimilarity >= 20 ? "medium" : "low";

    res.json({
      similarity1: Math.round(result.similarity1),
      similarity2: Math.round(result.similarity2),
      overallSimilarity,
      tokenOverlap: result.tokenOverlap,
      slices1: result.slices1,
      slices2: result.slices2,
      highlightedDoc1: result.highlightedDoc1,
      highlightedDoc2: result.highlightedDoc2,
      riskLevel,
      algorithm: "Winnowing (MOSS)",
      kgramSize,
      windowSize,
    });
  } catch (err) {
    req.log.error({ err }, "Error comparing code documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
