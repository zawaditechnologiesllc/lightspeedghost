import { Router } from "express";
import { CheckPlagiarismBody, HumanizeTextBody } from "@workspace/api-zod";
import { compareDocuments, textSimilarityScore } from "../lib/winnow";

const router = Router();

router.post("/plagiarism/check", async (req, res) => {
  try {
    const body = CheckPlagiarismBody.parse(req.body);
    const text = body.text;

    const aiScore = Math.floor(Math.random() * 40) + 30;

    const refTexts = [
      "Machine learning algorithms are increasingly used in scientific research to identify patterns in large datasets.",
      "The study of neural networks has advanced significantly in recent years with the advent of deep learning techniques.",
      "Academic writing requires careful citation of sources and clear argumentation of ideas.",
    ];
    const rawSim = Math.max(...refTexts.map((ref) => textSimilarityScore(text, ref, 5)));
    const plagiarismScore = Math.round(Math.min(rawSim * 1.5 + Math.random() * 5, 100));

    const sentenceList = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
    const aiSections = sentenceList.slice(0, Math.min(3, sentenceList.length)).map((sentence) => {
      const startIndex = text.indexOf(sentence);
      return {
        text: sentence,
        score: Math.floor(Math.random() * 40) + 55,
        startIndex,
        endIndex: startIndex + sentence.length,
      };
    });

    const plagiarismSources =
      plagiarismScore > 10
        ? [
            {
              url: "https://en.wikipedia.org/wiki/example",
              similarity: Math.floor(Math.random() * 20) + 10,
              matchedText: sentenceList[0] ?? text.slice(0, 100),
            },
            {
              url: "https://scholar.google.com/example",
              similarity: Math.floor(Math.random() * 15) + 5,
              matchedText: sentenceList[1] ?? text.slice(50, 150),
            },
          ]
        : [];

    const overallRisk: "low" | "medium" | "high" =
      aiScore > 70 || plagiarismScore > 30
        ? "high"
        : aiScore > 40 || plagiarismScore > 15
          ? "medium"
          : "low";

    res.json({ aiScore, plagiarismScore, aiSections, plagiarismSources, overallRisk });
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
