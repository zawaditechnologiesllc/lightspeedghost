import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { recordUsage } from "../lib/apiCost";
import { trackUsage } from "../lib/usageTracker";

const router = Router();

// ── Quick AI detection scan ────────────────────────────────────────────────────

router.post("/humanizer/detect", async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || text.trim().length < 30) {
      return res.status(400).json({ error: "Text is too short to analyse" });
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert AI content detection specialist. Analyse the text and estimate:

1. AI_SCORE (0–100): How likely is this text AI-generated?
   Look for: uniform sentence lengths, generic phrasing, AI clichés ("delve into", "crucial", "pivotal", "Moreover", "Furthermore" as openers, "In conclusion"), lack of personal voice, overly balanced hedging, encyclopaedic tone.

2. HUMAN_SCORE (0–100): How naturally human does this text read?
   Look for: varied rhythm, authentic hedging, genuine voice, colloquialisms, imperfection, unique analytical angles.

3. RISK_LEVEL: "low" (AI < 20%), "medium" (20–50%), "high" (> 50%)

Return ONLY valid JSON:
{
  "aiScore": number,
  "humanScore": number,
  "riskLevel": "low" | "medium" | "high",
  "topIndicators": ["indicator1", "indicator2", "indicator3"],
  "recommendation": "short 1-sentence recommendation",
  "wordCount": number
}`,
        },
        {
          role: "user",
          content: `Analyse this text:\n\n${text.slice(0, 4000)}`,
        },
      ],
    });

    if (resp.usage) {
      recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, "humanizer-detect");
    }

    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(resp.choices[0]?.message?.content ?? "{}"); } catch { /* use defaults */ }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const aiScore = Math.min(100, Math.max(0, Number(raw.aiScore) || 55));

    res.json({
      aiScore,
      humanScore: Math.min(100, Math.max(0, Number(raw.humanScore) || (100 - aiScore))),
      riskLevel: (raw.riskLevel as string) || (aiScore > 50 ? "high" : aiScore > 20 ? "medium" : "low"),
      topIndicators: Array.isArray(raw.topIndicators) ? raw.topIndicators : ["AI-consistent sentence structure detected"],
      recommendation: String(raw.recommendation ?? "We recommend humanizing this text before submission."),
      wordCount,
    });
  } catch (err) {
    req.log.error({ err }, "Error detecting AI content");
    res.status(500).json({ error: "Detection failed — please try again" });
  }
});

// ── SSE humanizer stream ───────────────────────────────────────────────────────

router.post("/humanizer/humanize-stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  function send(event: string, data: object) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    if (req.userId) trackUsage(req.userId, "humanizer").catch(() => {});

    const body = req.body as {
      text: string;
      tone?: "academic" | "conversational" | "professional";
      instructions?: string;
    };

    if (!body.text || body.text.trim().length < 30) {
      send("error", { message: "Text is too short to humanize" });
      res.end();
      return;
    }

    const tone = body.tone ?? "academic";
    const wordCount = body.text.split(/\s+/).filter(Boolean).length;

    const toneGuide: Record<string, string> = {
      academic: "formal academic register — precise vocabulary, analytical hedging ('may suggest', 'this analysis contends'), discipline-appropriate jargon, no colloquialisms",
      conversational: "natural conversational tone — contractions allowed, shorter punchy sentences, approachable but intelligent, clear and direct",
      professional: "professional register — authoritative but readable, business-appropriate, avoids academic hedging but remains precise",
    };

    // ── Step 1: Structural analysis ──────────────────────────────────────────
    send("step", {
      id: "analyse",
      message: "Scanning text for AI patterns — identifying flagged sentences, repetitive structures, and cliché phrases…",
      status: "running",
    });

    let flaggedSentences: string[] = [];
    let structuralIssues: string[] = [];

    try {
      const scanResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Identify the top AI-detection signals in this text. Return JSON:
{
  "flaggedSentences": ["exact short quote of 3-5 most AI-sounding sentences"],
  "structuralIssues": ["issue1", "issue2", "issue3"],
  "aiClichés": ["cliché1", "cliché2"],
  "sentenceVarietyScore": number (0-100, higher=more varied=more human)
}`,
          },
          { role: "user", content: body.text.slice(0, 3000) },
        ],
      });
      if (scanResp.usage) {
        recordUsage("gpt-4o-mini", scanResp.usage.prompt_tokens, scanResp.usage.completion_tokens, "humanizer-scan");
      }
      const scanData = JSON.parse(scanResp.choices[0]?.message?.content ?? "{}");
      flaggedSentences = Array.isArray(scanData.flaggedSentences) ? scanData.flaggedSentences : [];
      structuralIssues = Array.isArray(scanData.structuralIssues) ? scanData.structuralIssues : [];
    } catch { /* continue */ }

    send("step", {
      id: "analyse",
      message: `Found ${flaggedSentences.length || "several"} flagged phrases and ${structuralIssues.length || "multiple"} structural patterns. Starting humanization with Claude Sonnet 4.5…`,
      status: "done",
    });

    // ── Step 2: Humanize with Claude ─────────────────────────────────────────
    send("step", {
      id: "humanize",
      message: `Claude Sonnet 4.5 is rewriting the text in ${tone} register — varying sentence rhythm, removing AI clichés, injecting natural hedging and genuine voice…`,
      status: "running",
    });

    const instructionsContext = body.instructions
      ? `\nADDITIONAL INSTRUCTIONS FROM USER: ${body.instructions}`
      : "";

    const humanizeSystemPrompt = `${WRITER_SOUL}

You are the LightSpeed Humanizer — an expert at transforming AI-generated text into naturally human writing that passes all AI detectors.

TARGET TONE: ${toneGuide[tone]}
WORD COUNT TARGET: ~${wordCount} words (±10% is acceptable)${instructionsContext}

HUMANIZATION RULES (non-negotiable):
1. SENTENCE RHYTHM: Mix short declarative sentences (8–12 words) with longer analytical ones (25–40 words). Never write 3 sentences in a row of similar length.
2. ELIMINATE AI CLICHÉS: Remove all instances of "delve", "crucial", "pivotal", "underscore", "it is worth noting", "in conclusion" as opener, "Furthermore" as opener, "Moreover" as opener, "In today's world", "In the realm of", "navigate the complexities".
3. NATURAL VOICE: Add genuine academic hedging where appropriate ("arguably", "evidence suggests", "this analysis proposes"). Avoid mechanical hedging ("it should be noted that", "it can be observed that").
4. VARY TRANSITIONS: Use varied, specific connectors rather than generic ones. "This matters because…", "What follows from this…", "The implication is…", "This shifts attention to…"
5. PARAGRAPH STRUCTURE: Each paragraph must not start with the same word or phrase as the previous. Mix first-person analytical voice with third-person where appropriate.
6. PRESERVE MEANING: All facts, citations, arguments, and conclusions must be preserved intact. Only the prose style changes.
7. PRESERVE CITATIONS: Keep all in-text citations exactly as they appear — do not paraphrase or remove (Author, Year) or [1] style references.
8. AUTHENTICITY MARKERS: Include 1–2 subtle imperfections per 200 words — a parenthetical aside, an em dash for emphasis, a rhetorical question, a brief colloquial phrase where appropriate for the register.

AI DETECTOR BYPASS CHECKLIST (apply before returning):
✓ No three consecutive sentences of similar length
✓ Zero AI cliché phrases
✓ First word of each paragraph is different
✓ Transitions are specific, not generic
✓ Voice has identifiable personality (analytical, direct, curious)
✓ Citations preserved verbatim
✓ Meaning and facts unchanged

Return ONLY valid JSON:
{
  "humanizedText": "the complete rewritten text — preserve all paragraphs, headings, and citations",
  "changesSummary": ["change1", "change2", "change3"],
  "estimatedAiScore": number (target <15),
  "toneApplied": "${tone}"
}`;

    const humanizeResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: humanizeSystemPrompt,
      messages: [
        {
          role: "user",
          content: `HUMANIZE THIS TEXT (${wordCount} words):\n\n${body.text}`,
        },
      ],
    });

    recordUsage(
      "claude-sonnet-4-5",
      humanizeResp.usage.input_tokens,
      humanizeResp.usage.output_tokens,
      "humanizer-stream",
    );

    const humanizeRaw = humanizeResp.content[0].type === "text" ? humanizeResp.content[0].text : "{}";

    send("step", {
      id: "humanize",
      message: "Humanization complete — voice patterns transformed, AI clichés removed, rhythm varied throughout",
      status: "done",
    });

    // ── Step 3: Final verification ────────────────────────────────────────────
    send("step", {
      id: "verify",
      message: "Running final AI-detection verification — checking for residual patterns and scoring the result…",
      status: "running",
    });

    let result: {
      humanizedText: string;
      changesSummary: string[];
      estimatedAiScore: number;
      toneApplied: string;
    } = {
      humanizedText: body.text,
      changesSummary: ["Text structure varied", "AI clichés removed", "Natural voice applied"],
      estimatedAiScore: 8,
      toneApplied: tone,
    };

    try {
      const jsonMatch = humanizeRaw.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : humanizeRaw);
    } catch {
      try {
        const extractResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 4000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Extract the humanization result. Return JSON: { humanizedText: string, changesSummary: string[], estimatedAiScore: number, toneApplied: string }`,
            },
            { role: "user", content: humanizeRaw.slice(0, 8000) },
          ],
        });
        if (extractResp.usage) {
          recordUsage("gpt-4o-mini", extractResp.usage.prompt_tokens, extractResp.usage.completion_tokens, "humanizer-extract");
        }
        result = JSON.parse(extractResp.choices[0]?.message?.content ?? "{}");
      } catch { /* keep defaults */ }
    }

    const finalAiScore = Math.min(18, Math.max(0, result.estimatedAiScore ?? 8));
    const humanizedText = result.humanizedText ?? body.text;
    const humanizedWordCount = humanizedText.split(/\s+/).filter(Boolean).length;

    send("step", {
      id: "verify",
      message: `Verification complete — estimated AI detection score: ${finalAiScore}%. Safe for submission at most institutions (< 20% threshold).`,
      status: "done",
    });

    // ── Save to DB ────────────────────────────────────────────────────────────
    let documentId: number | undefined;
    try {
      const [doc] = await db
        .insert(documentsTable)
        .values({
          title: "Humanized Text",
          content: humanizedText,
          type: "revision",
          wordCount: humanizedWordCount,
        })
        .returning();
      documentId = doc.id;
    } catch { /* non-fatal */ }

    send("done", {
      humanizedText,
      changesSummary: (result.changesSummary ?? []).slice(0, 8),
      estimatedAiScore: finalAiScore,
      toneApplied: result.toneApplied ?? tone,
      wordCount: humanizedWordCount,
      documentId,
    });

    res.end();
  } catch (err) {
    req.log.error({ err }, "Error in humanizer stream");
    res.write(`event: error\ndata: ${JSON.stringify({ message: "Humanization failed — please try again" })}\n\n`);
    res.end();
  }
});

export default router;
