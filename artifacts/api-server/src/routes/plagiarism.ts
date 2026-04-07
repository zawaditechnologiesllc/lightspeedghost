import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { CheckPlagiarismBody, HumanizeTextBody } from "@workspace/api-zod";
import { compareDocuments } from "../lib/winnow";
import { analyseTextPlagiarism, analyseAIContent } from "../lib/textAnalysis";
import { anthropic, openai } from "../lib/ai";
import { HUMANIZER_SOUL } from "../lib/soul";
import { recordUsage } from "../lib/apiCost";
import { trackUsage } from "../lib/usageTracker";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";

const router = Router();

// Plagiarism + AI detection (local algorithms — already solid)
router.post("/plagiarism/check", requireAuth, async (req, res) => {
  try {
    if (req.userId) trackUsage(req.userId, "plagiarism").catch(() => {});
    const body = CheckPlagiarismBody.parse(req.body);
    const text = body.text;

    const plagResult = analyseTextPlagiarism(text);
    const aiResult = analyseAIContent(text);

    const { plagiarismScore, matchedWords, sourceMatches } = plagResult;
    const { aiScore, lexicalDiversity, avgSentenceLength, flags } = aiResult;

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
        const sentenceScore = Math.min(60 + (wordCount > 20 ? 15 : 0) + flags.length * 5, 95);
        return { text: sentence, score: sentenceScore, startIndex, endIndex: startIndex + sentence.length };
      });

    const plagiarismSources = sourceMatches
      .filter((s) => s.similarity > 5)
      .slice(0, 3)
      .map((s) => ({
        url: `https://scholar.google.com/search?q=${encodeURIComponent(s.label)}`,
        similarity: s.similarity,
        matchedText: s.matchedWords.slice(0, 12).join(", "),
      }));

    const overallRisk: "low" | "medium" | "high" =
      aiScore > 65 || plagiarismScore > 35 ? "high" : aiScore > 35 || plagiarismScore > 15 ? "medium" : "low";

    // Save report to documents history (non-fatal)
    try {
      const userId = req.userId ?? null;
      const mode = body.checkAi && body.checkPlagiarism ? "both"
        : body.checkAi ? "ai"
        : "plagiarism";
      const docNum = await getNextDocNumber(userId, "plagiarism");
      await db.insert(documentsTable).values({
        userId,
        title: formatDocTitle({ type: "plagiarism", docNumber: docNum, plagiarismMode: mode }),
        content: `AI Score: ${aiScore}% | Plagiarism Score: ${plagiarismScore}%\nRisk: ${overallRisk}\n\n${text.slice(0, 2000)}`,
        type: "plagiarism",
        docNumber: docNum,
        wordCount: text.split(/\s+/).filter(Boolean).length,
      });
    } catch { /* non-fatal */ }

    res.json({
      aiScore,
      plagiarismScore,
      aiSections,
      plagiarismSources,
      overallRisk,
      matchedWords,
      lexicalDiversity: Math.round(lexicalDiversity * 100),
      avgSentenceLength: Math.round(avgSentenceLength),
      aiFlags: flags,
    });
  } catch (err) {
    req.log.error({ err }, "Error checking plagiarism");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Recursive Humanizer — OpenClaw Recursive Paraphrasing pattern.
 * Writes → Detects AI score → Rewrites if still detected → Repeats until passes.
 * Max 3 passes. Returns the version with the lowest AI detection score.
 */
router.post("/plagiarism/humanize", requireAuth, async (req, res) => {
  try {
    if (req.userId) trackUsage(req.userId, "humanizer").catch(() => {});
    const body = HumanizeTextBody.parse(req.body);
    const text = body.text;
    const intensity = body.intensity ?? "medium";

    // Map intensity to humanizer instructions
    const intensityMap: Record<string, string> = {
      light: `Make LIGHT edits only:
- Fix grammar and punctuation
- Vary the starts of 3-4 sentences (don't begin every sentence with the same structure)
- Replace 4-5 robotic transition words (furthermore→also, moreover→also, in conclusion→overall)
- Keep 90% of the original wording intact`,

      medium: `Make MEDIUM edits:
- Rephrase 30-40% of sentences while preserving all meaning
- Break up 3-4 overly long sentences into 2 shorter ones
- Combine 2-3 short choppy sentences into one flowing sentence
- Replace all AI transition words with natural alternatives
- Add 1-2 natural hedging phrases ("it seems", "in practice", "broadly speaking")`,

      heavy: `Perform a COMPLETE academic rewrite:
- Rewrite every sentence in your own voice while keeping all arguments and facts
- Dramatically vary sentence length: mix 8-word punchy sentences with 25-word complex ones
- Use active voice for 70% of sentences
- Add natural academic idioms and field-specific expressions
- Make the writing sound like a knowledgeable human who studied this topic deeply
- Remove all AI patterns completely`,
    };

    const intensityInstruction = intensityMap[intensity] ?? intensityMap.medium;

    // Measure initial AI score
    const initialDetection = analyseAIContent(text);
    const initialAiScore = initialDetection.aiScore;

    let bestText = text;
    let bestScore = initialAiScore;
    let totalChanges = 0;
    const MAX_PASSES = 3;
    const TARGET_SCORE = 25; // Below this is "human-like"

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const textToProcess = pass === 0 ? text : bestText;

      // Claude 3.5 Sonnet for humanizing (Writing model — ClawRouter)
      const humanizeResp = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: Math.min(textToProcess.length * 2 + 500, 6000),
        system: `${HUMANIZER_SOUL}

${intensityInstruction}

CRITICAL: Return ONLY the humanized text. No explanations, no preamble, no "Here is the revised text:" — just the text itself.`,
        messages: [
          {
            role: "user",
            content: pass === 0
              ? `Humanize this text:\n\n${textToProcess}`
              : `This text still reads as AI-generated (score: ${bestScore}%). Humanize it further using different sentence structures and vocabulary:\n\n${textToProcess}`,
          },
        ],
      });

      recordUsage("claude-sonnet-4-5", humanizeResp.usage.input_tokens, humanizeResp.usage.output_tokens, `humanize-pass-${pass + 1}`);

      const humanizedCandidate = humanizeResp.content[0].type === "text" ? humanizeResp.content[0].text.trim() : textToProcess;

      // Internal AI detection check — GPT-4o-mini (Detection model — ClawRouter)
      let candidateScore = bestScore;
      try {
        const detectionResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content: `You are an AI text detector. Analyze the text and return ONLY a JSON object: {"aiScore": number} where aiScore is 0-100 (0=human, 100=AI-generated). Be strict.`,
            },
            { role: "user", content: humanizedCandidate.slice(0, 1500) },
          ],
          response_format: { type: "json_object" },
        });
        if (detectionResp.usage) {
          recordUsage("gpt-4o-mini", detectionResp.usage.prompt_tokens, detectionResp.usage.completion_tokens, "ai-detection-check");
        }
        const detResult = JSON.parse(detectionResp.choices[0]?.message?.content ?? "{}") as { aiScore?: number };
        candidateScore = detResult.aiScore ?? bestScore;
      } catch {
        // Fall back to local detection
        candidateScore = analyseAIContent(humanizedCandidate).aiScore;
      }

      // Keep the best version (lowest AI score)
      if (candidateScore < bestScore || pass === 0) {
        bestText = humanizedCandidate;
        bestScore = candidateScore;
        totalChanges++;
      }

      // Stop if we've achieved human-like score
      if (bestScore <= TARGET_SCORE) break;
    }

    res.json({
      humanizedText: bestText,
      changes: totalChanges,
      beforeScore: initialAiScore,
      afterScore: bestScore,
    });
  } catch (err) {
    req.log.error({ err }, "Error humanizing text");
    res.status(500).json({ error: "Failed to humanize text. Please try again." });
  }
});

// Code similarity via Winnowing (already real — keeping unchanged)
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
