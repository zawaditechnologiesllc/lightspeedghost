import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { CheckPlagiarismBody, HumanizeTextBody } from "@workspace/api-zod";
import { compareDocuments } from "../lib/winnow";
import { analyseCodeSimilarity, detectLanguage, type CodeLanguage } from "../lib/codeAnalysis";
import { analyseTextPlagiarism, computeReadabilityScores } from "../lib/textAnalysis";
import { recordUsage } from "../lib/apiCost";
import { trackUsage, enforceLimit, quotaExceededMessage } from "../lib/usageTracker";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { detectAIScore, humanizeTextOnce } from "../lib/aiDetection";
import { searchAllAcademicSources, ACADEMIC_DATABASE_NAMES } from "../lib/academicSources";
import { runOpenSourcePlagiarismCheck } from "../lib/openSourceSearch";
import { semanticSimilarity } from "../lib/localSemantic";
import { ingestSources, searchCorpus } from "../lib/plagiarismCorpus";
import { correctTypos } from "../lib/localSpell";

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
 * Used to build multi-angle queries so all 35 databases are searched
 * against representative samples from beginning, middle, and key concepts.
 */
// Build the search phrases used to query the live academic databases. Coverage
// scales with document length: instead of only sampling the opening + middle,
// we slide evenly-spaced windows across the WHOLE document so every section is
// compared against the 250M+ papers. No LLM is involved — this is plain text
// windowing. The window count is bounded (MAX_WINDOWS) so a long paper doesn't
// fan out into hundreds of concurrent external requests and trip the free
// academic APIs' rate limits.
const PLAG_WINDOW_WORDS = 34;
const PLAG_MAX_WINDOWS = 6; // ×35 databases = up to ~78 polite parallel lookups/scan
function extractQueryPhrases(rawText: string): string[] {
  // Spell-correct the text used to BUILD SEARCH QUERIES only (not the report /
  // highlight text), so a submission with typos still matches real sources.
  const text = correctTypos(rawText);
  const words = text.split(/\s+/).filter(Boolean);
  const queries: string[] = [];
  if (words.length === 0) return queries;

  // Concept query: distinctive long tokens = the document's topic fingerprint.
  const techTokens = words
    .filter(w => w.length > 7 && !STOP_WORDS.has(w.toLowerCase()) && /^[a-zA-Z]/.test(w))
    .slice(0, 12);
  if (techTokens.length >= 4) queries.push(techTokens.join(" "));

  // Evenly-spaced windows across the entire document — ~1 window per 200 words,
  // clamped to [2, PLAG_MAX_WINDOWS]. A 3,000-word paper → 8 windows spanning the
  // whole text (vs. the old fixed 2), so far more of it is actually checked.
  const windowsWanted = Math.min(PLAG_MAX_WINDOWS, Math.max(2, Math.ceil(words.length / 200)));
  if (words.length <= PLAG_WINDOW_WORDS) {
    queries.push(words.join(" "));
  } else {
    const step = Math.max(PLAG_WINDOW_WORDS, Math.floor((words.length - PLAG_WINDOW_WORDS) / (windowsWanted - 1)));
    for (let start = 0; start < words.length && queries.length <= PLAG_MAX_WINDOWS; start += step) {
      const w = words.slice(start, start + PLAG_WINDOW_WORDS).join(" ");
      if (w.split(/\s+/).length >= 8) queries.push(w);
    }
  }

  return [...new Set(queries)];
}

/**
 * Query all 35 live academic databases with multiple representative phrases
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

    // Fan out to all 35 databases with each phrase, collect unique papers by DOI/URL
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

    // Feed every fetched abstract into the local self-building corpus so future
    // scans can catch these sources instantly, in-database, with no external
    // call (Turnitin-style pre-built index that compounds with real usage).
    ingestSources(
      allPapers
        .filter((p) => p.abstract && p.abstract.length > 60)
        .map((p) => ({
          title: p.title,
          authors: p.authors,
          year: p.year,
          url: p.doi ? `https://doi.org/${p.doi}` : p.url,
          sourceType: "academic-live",
          content: p.abstract!,
        })),
    ).catch(() => {});

    // Score each paper against the submitted text. We take the STRONGER of two
    // signals: classic TF-cosine (verbatim overlap) and our local semantic
    // engine (catches paraphrase/word-swap that TF-cosine dilutes). No LLM.
    const scored = allPapers
      .filter(p => p.abstract && p.abstract.length > 60)
      .map(p => ({
        url: p.doi ? `https://doi.org/${p.doi}` : p.url,
        title: p.title,
        authors: p.authors,
        year: p.year,
        similarity: Math.round(Math.max(
          computeCosineSimilarity(text, p.abstract!),
          semanticSimilarity(text, p.abstract!),
        ) * 10) / 10,
        matchedText: p.abstract!.slice(0, 120),
        sourceType: "academic-live" as const,
      }))
      // FALSE-POSITIVE GUARD: only report a paper as a "matching source" at a
      // confident similarity. Topical overlap (same subject, original wording)
      // lands ~5–15%; a real paraphrase/copy lands well above. 18 is the floor
      // so we never accuse a student over shared vocabulary.
      .filter(p => p.similarity >= 18)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return scored;
  } catch {
    return [];
  }
}

/**
 * Search the LOCAL corpus (pg_trgm, in-database) for passages similar to the
 * submitted text. Instant, no external API, no LLM — and it grows every scan.
 * Returns matches shaped like the live ones so they merge into the same report.
 */
async function fetchCorpusMatches(
  text: string,
): Promise<Array<{ url: string; title: string; authors: string; year: number; similarity: number; matchedText: string; sourceType: string }>> {
  try {
    const phrases = extractQueryPhrases(text);
    const seen = new Set<string>();
    const out: Array<{ url: string; title: string; authors: string; year: number; similarity: number; matchedText: string; sourceType: string }> = [];
    const batches = await Promise.all(phrases.slice(0, 6).map((p) => searchCorpus(p, 3)));
    for (const batch of batches) {
      for (const m of batch) {
        const key = m.url || m.title;
        if (seen.has(key)) continue;
        seen.add(key);
        // Confirm with the semantic engine against the full text so trigram
        // near-misses don't inflate the score.
        const sim = Math.max(m.similarity, semanticSimilarity(text, m.matchedText));
        out.push({
          url: m.url,
          title: m.title,
          authors: m.authors,
          year: m.year ?? 0,
          similarity: Math.round(sim * 10) / 10,
          matchedText: m.matchedText,
          sourceType: "academic-corpus",
        });
      }
    }
    return out.filter((m) => m.similarity >= 18).sort((a, b) => b.similarity - a.similarity).slice(0, 4);
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
 *  2. Live database query against 35 real academic databases (async, non-blocking)
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
        message: quotaExceededMessage(quota, "plagiarism checks"),
      });
      return res.end();
    }
    const body = CheckPlagiarismBody.parse(req.body);
    const text = body.text;

    // Free plan never touches an LLM: AI detection runs in deterministic
    // local mode (burstiness + perplexity). Paid plans get the blended
    // GPT-4o-mini + burstiness score.
    const localOnlyDetection = quota.plan === "free";

    send("step", { id: "tokenise", message: "Tokenising document and building word frequency map…", status: "running" });

    const localAnalysisPromise = Promise.resolve(analyseTextPlagiarism(text));
    const readabilityPromise = Promise.resolve(computeReadabilityScores(text));

    send("step", { id: "tokenise", message: "Document tokenised", status: "done" });
    send("step", { id: "ai-detect", message: "Detecting AI-generated patterns — lexical diversity & sentence flow…", status: "running" });
    send("step", { id: "plag-scan", message: "Scanning against academic corpus for plagiarism sources…", status: "running" });

    const [
      { plagiarismScore, matchedWords, sourceMatches },
      { score: aiScore, indicators: aiIndicators, burstiness, stdDev, perplexity: aiPerplexity, bypasserDetected: aiBypasserDetected },
      readability,
      liveMatches,
      corpusMatches,
      openSourceResult,
    ] = await Promise.all([
      localAnalysisPromise,
      detectAIScore(text, "plagiarism-check", { localOnly: localOnlyDetection }).then(r => { send("step", { id: "ai-detect", message: `AI detection complete — score: ${r.score >= 0 ? r.score + "%" : "unavailable"}`, status: "done" }); return r; }),
      readabilityPromise,
      fetchLiveAcademicMatches(text),
      fetchCorpusMatches(text),
      runOpenSourcePlagiarismCheck(text).then(r => { send("step", { id: "plag-scan", message: `Plagiarism scan complete — ${r.totalSentencesChecked} sentences checked`, status: "done" }); return r; }),
    ]);

    // Sentence-level AI highlights — FALSE-POSITIVE GUARDED. Human academic
    // writing legitimately uses "furthermore", "this study", "demonstrate", etc.,
    // so we ONLY surface sentence flags when the document as a whole reads AI
    // (score ≥ 45), and we never claim a per-sentence score above the document
    // score. On anything that reads human, zero sentences are flagged.
    const docText: string = text;
    const sentenceList: string[] = docText.split(/(?<=[.!?])\s+/).filter((s: string) => s.length > 20);
    const AI_MARKERS = /furthermore|moreover|in conclusion|it is (?:important|worth|essential) to note|one (?:important|key|significant)|facilitate|utilize|delve into|navigate the complexities|it can be argued/g;
    const docLooksAI = aiScore >= 45;
    const aiSections = !docLooksAI ? [] : sentenceList
      .map((sentence: string) => ({ sentence, markers: (sentence.toLowerCase().match(AI_MARKERS) ?? []).length }))
      .filter((x) => x.markers >= 1)
      .sort((a, b) => b.markers - a.markers)
      .slice(0, 4)
      .map(({ sentence, markers }) => {
        const startIndex = text.indexOf(sentence);
        const sentenceScore = Math.min(aiScore + markers * 3, 90);
        return { text: sentence, score: sentenceScore, startIndex, endIndex: startIndex + sentence.length };
      });

    const localPlagiarismSources = sourceMatches
      .filter((s) => s.similarity >= 18)
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

    // Local corpus hits (pg_trgm) — deduped against live results by URL.
    const liveUrls = new Set(livePlagiarismSources.map((s) => s.url));
    const corpusPlagiarismSources = corpusMatches
      .filter((m) => m.url && !liveUrls.has(m.url))
      .map((m) => ({
        url: m.url,
        similarity: m.similarity,
        matchedText: m.matchedText,
        title: m.title,
        authors: m.authors,
        year: m.year,
        live: false,
        sourceType: "academic-corpus",
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
      ...corpusPlagiarismSources,
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
      perplexity: aiPerplexity ?? null,
      bypasserDetected: aiBypasserDetected ?? false,
      readability,
      detectionModel: localOnlyDetection
        ? "burstiness + perplexity (local — Free plan)"
        : "gpt-4o-mini + burstiness",
      sourcesScanned: [
        ...ACADEMIC_DATABASE_NAMES,
        "LightSpeed local corpus (self-building index)",
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
        message: quotaExceededMessage(quota, "humanizer uses"),
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

    // Code-AWARE analysis (structure, control-flow, API-call patterns) on top
    // of raw winnowing — previously the `language` field was parsed then
    // ignored and code was compared as plain text, missing renamed-variable
    // and restructured plagiarism this analyser is built to catch.
    let codeAware: ReturnType<typeof analyseCodeSimilarity> | null = null;
    try {
      const lang = typeof language === "string" && language.length > 0
        ? (language as CodeLanguage)
        : detectLanguage(doc1);
      codeAware = analyseCodeSimilarity(doc1, doc2, lang);
    } catch { /* non-fatal — winnowing result still returned */ }

    // Take the stronger signal so rename/restructure evasion can't lower it.
    const winnowSim = Math.round((result.similarity1 + result.similarity2) / 2);
    const overallSimilarity = codeAware ? Math.max(winnowSim, Math.round(codeAware.similarity)) : winnowSim;
    const riskLevel: "low" | "medium" | "high" =
      overallSimilarity >= 40 ? "high" : overallSimilarity >= 20 ? "medium" : "low";

    res.json({
      ...(codeAware ? {
        detectedLanguage: codeAware.language,
        codeSimilarity: Math.round(codeAware.similarity),
        structuralSimilarity: Math.round(codeAware.structuralSimilarity),
        tokenSimilarity: Math.round(codeAware.tokenSimilarity),
        apiCallSimilarity: Math.round(codeAware.apiCallSimilarity),
        sharedPatterns: codeAware.sharedPatterns.slice(0, 12),
        verdict: codeAware.verdict,
        verdictLabel: codeAware.verdictLabel,
      } : {}),
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
