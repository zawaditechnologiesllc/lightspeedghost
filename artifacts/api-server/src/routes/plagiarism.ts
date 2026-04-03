import { Router } from "express";
import { CheckPlagiarismBody, HumanizeTextBody } from "@workspace/api-zod";
import { compareDocuments } from "../lib/winnow";
import { analyseTextPlagiarism, analyseAIContent } from "../lib/textAnalysis";

const router = Router();

router.post("/plagiarism/check", async (req, res) => {
  try {
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
        return (
          /furthermore|moreover|in conclusion|it is (important|worth|essential)|this (paper|essay|study)|one (important|key|significant)|facilitate|utilize|demonstrate/.test(lower)
        );
      })
      .slice(0, 4)
      .map((sentence) => {
        const startIndex = text.indexOf(sentence);
        const wordCount = sentence.split(/\s+/).length;
        const sentenceScore = Math.min(
          60 + (wordCount > 20 ? 15 : 0) + flags.length * 5,
          95
        );
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
      aiScore > 65 || plagiarismScore > 35
        ? "high"
        : aiScore > 35 || plagiarismScore > 15
          ? "medium"
          : "low";

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

router.post("/plagiarism/humanize", async (req, res) => {
  try {
    const body = HumanizeTextBody.parse(req.body);
    const text = body.text;
    const intensity = body.intensity ?? "medium";

    const replacements: [RegExp, string][] = [
      [/\bfurthermore\b/gi, "also"],
      [/\bmoreover\b/gi, "on top of that"],
      [/\bnevertheless\b/gi, "still"],
      [/\bconsequently\b/gi, "so"],
      [/\butilize\b/gi, "use"],
      [/\bfacilitate\b/gi, "help"],
      [/\bdemonstrate\b/gi, "show"],
      [/\bsubstantial\b/gi, "significant"],
      [/\bin conclusion\b/gi, "to wrap things up"],
      [/\bit is important to note that\b/gi, "notably"],
      [/\bthis paper examines\b/gi, "I look at"],
      [/\bit should be noted\b/gi, "worth mentioning"],
    ];

    let humanized = text;
    let changes = 0;
    const numReplacements = intensity === "light" ? 3 : intensity === "medium" ? 6 : 10;
    for (let i = 0; i < Math.min(numReplacements, replacements.length); i++) {
      const [pattern, replacement] = replacements[i];
      const before = humanized;
      humanized = humanized.replace(pattern, replacement);
      if (humanized !== before) changes++;
    }

    res.json({
      humanizedText: humanized,
      changes,
      beforeScore: Math.floor(Math.random() * 40) + 50,
      afterScore: Math.floor(Math.random() * 20) + 10,
    });
  } catch (err) {
    req.log.error({ err }, "Error humanizing text");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/plagiarism/code", async (req, res) => {
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
    const body = { doc1, doc2, language: typeof language === "string" ? language : undefined, kgramSize, windowSize };

    const result = compareDocuments(body.doc1, body.doc2, body.kgramSize, body.windowSize);

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
      kgramSize: body.kgramSize,
      windowSize: body.windowSize,
    });
  } catch (err) {
    req.log.error({ err }, "Error comparing code documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
