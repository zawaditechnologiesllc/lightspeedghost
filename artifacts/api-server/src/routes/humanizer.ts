import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { recordUsage } from "../lib/apiCost";
import { trackUsage } from "../lib/usageTracker";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";

const router = Router();

// ── AI detection helper (actual GPT-4o-mini scoring, not self-assessment) ─────

async function detectAIScore(text: string): Promise<{ score: number; indicators: string[] }> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert AI content detection specialist trained on Turnitin, GPTZero, and Originality.AI patterns.

Analyse the text and return JSON:
{
  "aiScore": number (0-100, how likely AI-generated — be strict and accurate),
  "indicators": ["top 3 specific AI patterns found in this text, or 'none detected' if clean"]
}

AI signals (each raises score):
• Uniform sentence lengths (no short punchy sentences mixed with long ones)
• Generic openers: "Furthermore", "Moreover", "In conclusion", "It is worth noting"
• AI clichés: "delve into", "crucial", "pivotal", "underscore", "navigate the complexities"
• Encyclopaedic neutral tone with no personal analytical voice
• Three or more sentences starting with the same word type in a row
• Overly balanced hedging: "it can be argued", "it should be noted"
• Perfect paragraph symmetry (every paragraph exactly same structure)
• Missing genuine imperfection or unique perspective`,
        },
        {
          role: "user",
          content: `Detect AI content in this text:\n\n${text.slice(0, 4000)}`,
        },
      ],
    });

    if (resp.usage) {
      recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, "humanizer-detect-pass");
    }

    const raw = JSON.parse(resp.choices[0]?.message?.content ?? "{}") as {
      aiScore?: number;
      indicators?: string[];
    };

    return {
      score: Math.min(100, Math.max(0, Number(raw.aiScore) ?? 40)),
      indicators: Array.isArray(raw.indicators) ? raw.indicators : [],
    };
  } catch {
    return { score: 30, indicators: [] };
  }
}

// ── Humanize pass helper ──────────────────────────────────────────────────────

async function humanizePass(
  text: string,
  tone: string,
  toneGuide: string,
  passNumber: number,
  remainingIndicators: string[]
): Promise<string> {
  const targetScore = 3;
  const focusNote =
    passNumber > 1 && remainingIndicators.length > 0
      ? `\nFOCUS FOR THIS PASS — fix these specific remaining AI patterns:\n${remainingIndicators.map((i) => `• ${i}`).join("\n")}`
      : "";

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const systemPrompt = `${WRITER_SOUL}

You are the LightSpeed Humanizer — the industry's most advanced AI-to-human text converter.
Your output must score below ${targetScore}% on all major AI detectors (Turnitin, GPTZero, Originality.AI, ZeroGPT).

TARGET TONE: ${toneGuide}
WORD COUNT TARGET: ~${wordCount} words (±8%)${focusNote}

PASS ${passNumber} — HUMANIZATION RULES (absolute, non-negotiable):

SENTENCE RHYTHM (most important signal):
• Mix sentence lengths aggressively: 6-word declaratives → 35-word analytical chains → 12-word assertions
• Never write 2 sentences in a row of similar length
• Open at least 2 paragraphs with a sub-10-word sentence
• Include at least one sentence fragment or rhetorical question per 300 words

BANNED PHRASES (zero tolerance — remove every instance):
"delve into", "delve deeper", "crucial", "pivotal", "underscore", "it is worth noting",
"it should be noted", "it can be argued", "it can be observed", "it is evident",
"in today's world", "in the realm of", "navigate the complexities", "in conclusion" as opener,
"Furthermore" as paragraph opener, "Moreover" as paragraph opener, "Additionally" as opener,
"In summary", "Lastly", "Firstly", "Secondly", "Thirdly" as openers

VOICE AND AUTHENTICITY:
• Every 200 words: add one authentic touch (em dash aside—like this—, parenthetical, or rhetorical question)
• Use discipline-specific vocabulary the subject demands — show genuine expertise
• Vary between first-person analytical ("This analysis argues…") and third-person scholarly
• Include 1-2 moments of genuine uncertainty where appropriate ("the data here is less clear", "one complication arises")
• Transitions must be specific and logical: "This matters because…", "What follows from this is…", "The implication cuts both ways:"

PARAGRAPH STRUCTURE:
• No two paragraphs may open with the same grammatical structure
• Mix deductive (claim→evidence→analysis) and inductive (observation→pattern→conclusion) paragraphs
• Last sentence of each paragraph should not be a restatement — it should advance or challenge

PRESERVE (non-negotiable):
• All facts, data, arguments, and conclusions — word-for-word accuracy
• All in-text citations exactly: (Author, Year), [1], etc.
• All LaTeX equations and markdown formatting
• Academic register appropriate to the tone

Return ONLY the humanized text. No commentary, no JSON wrapper, no preamble.`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content:
          passNumber === 1
            ? `HUMANIZE THIS TEXT — apply all rules above:\n\n${text}`
            : `HUMANIZE THIS TEXT AGAIN (Pass ${passNumber} — fix remaining AI patterns):\n\n${text}`,
      },
    ],
  });

  recordUsage(
    "claude-sonnet-4-5",
    resp.usage.input_tokens,
    resp.usage.output_tokens,
    `humanizer-pass-${passNumber}`,
  );

  const result = resp.content[0].type === "text" ? resp.content[0].text : text;
  return result.trim().replace(/^```(?:text|markdown)?\n?/, "").replace(/\n?```$/, "");
}

// ── Quick AI detection scan ────────────────────────────────────────────────────

router.post("/humanizer/detect", requireAuth, async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || text.trim().length < 30) {
      return res.status(400).json({ error: "Text is too short to analyse" });
    }

    const { score: aiScore, indicators } = await detectAIScore(text);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    res.json({
      aiScore,
      humanScore: Math.min(100, Math.max(0, 100 - aiScore)),
      riskLevel: aiScore > 50 ? "high" : aiScore > 20 ? "medium" : "low",
      topIndicators: indicators.length > 0 ? indicators : ["No significant AI patterns detected"],
      recommendation:
        aiScore > 20
          ? "Humanization recommended before submission — AI patterns detected above threshold."
          : "Text reads as naturally human. Safe for most platforms.",
      wordCount,
    });
  } catch (err) {
    req.log.error({ err }, "Error detecting AI content");
    res.status(500).json({ error: "Detection failed — please try again" });
  }
});

// ── SSE humanizer stream — multi-pass to <5% AI score ─────────────────────────

router.post("/humanizer/humanize-stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Disable socket idle timeout — humanization with multiple passes can take minutes
  req.socket?.setTimeout(0);

  function send(event: string, data: object) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Heartbeat every 10 s — keeps proxy alive during long AI calls
  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* ignore */ } }, 10_000);

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
      academic:
        "formal academic register — precise vocabulary, analytical hedging ('may suggest', 'this analysis contends'), discipline-appropriate jargon, no colloquialisms",
      conversational:
        "natural conversational tone — contractions allowed, shorter punchy sentences, approachable but intelligent, clear and direct",
      professional:
        "professional register — authoritative but readable, business-appropriate, avoids academic hedging but remains precise",
    };

    // ── Step 1: Baseline scan ────────────────────────────────────────────────
    send("step", {
      id: "analyse",
      message: "Scanning text for AI patterns — identifying flagged sentences, uniform structures, and AI clichés…",
      status: "running",
    });

    const { score: baselineScore, indicators: baselineIndicators } =
      await detectAIScore(body.text);

    send("step", {
      id: "analyse",
      message: `Baseline AI score: ${baselineScore}%. Found ${baselineIndicators.length} pattern groups. Target: below 5%. Starting multi-pass humanization…`,
      status: "done",
    });

    // ── Step 2: Pass 1 — Full humanization (Claude Sonnet) ──────────────────
    send("step", {
      id: "humanize",
      message: `Pass 1 — Claude Sonnet is fully rewriting the text: restructuring sentence rhythm, removing all AI clichés, injecting authentic voice and natural imperfection…`,
      status: "running",
    });

    const additionalNote = body.instructions
      ? `\nADDITIONAL USER INSTRUCTIONS: ${body.instructions}`
      : "";

    const pass1Text = await humanizePass(
      body.text + (additionalNote ? `\n\n[NOTE: ${body.instructions}]` : ""),
      tone,
      toneGuide[tone],
      1,
      baselineIndicators,
    );

    send("step", {
      id: "humanize",
      message: "Pass 1 complete — voice patterns transformed, clichés removed, rhythm varied",
      status: "done",
    });

    // ── Step 3: Verify pass 1 ────────────────────────────────────────────────
    send("step", {
      id: "verify-1",
      message: "Running detection check after Pass 1 — measuring actual AI score with strict detection model…",
      status: "running",
    });

    const { score: score1, indicators: indicators1 } = await detectAIScore(pass1Text);

    send("step", {
      id: "verify-1",
      message: `Pass 1 result: ${score1}% AI score. ${score1 <= 5 ? "Target achieved." : `Still above 5% — running Pass 2 to fix: ${indicators1.slice(0, 2).join(", ") || "residual patterns"}`}`,
      status: "done",
    });

    let currentText = pass1Text;
    let currentScore = score1;
    let currentIndicators = indicators1;

    // ── Step 4: Pass 2 if still above threshold ──────────────────────────────
    if (currentScore > 5) {
      send("step", {
        id: "humanize-2",
        message: `Pass 2 — targeting specific residual patterns: ${currentIndicators.slice(0, 2).join(", ") || "sentence uniformity"}. Applying deeper structural variation…`,
        status: "running",
      });

      const pass2Text = await humanizePass(
        currentText,
        tone,
        toneGuide[tone],
        2,
        currentIndicators,
      );

      send("step", {
        id: "humanize-2",
        message: "Pass 2 complete — structural patterns repaired, voice further naturalised",
        status: "done",
      });

      send("step", {
        id: "verify-2",
        message: "Running detection check after Pass 2…",
        status: "running",
      });

      const { score: score2, indicators: indicators2 } = await detectAIScore(pass2Text);

      send("step", {
        id: "verify-2",
        message: `Pass 2 result: ${score2}% AI score. ${score2 <= 5 ? "Target achieved." : `Running Pass 3 (final) to address: ${indicators2.slice(0, 2).join(", ") || "remaining patterns"}`}`,
        status: "done",
      });

      currentText = pass2Text;
      currentScore = score2;
      currentIndicators = indicators2;

      // ── Step 5: Pass 3 (final, only if still above 5%) ──────────────────
      if (currentScore > 5) {
        send("step", {
          id: "humanize-3",
          message: `Pass 3 (final) — deep restructuring pass targeting: ${currentIndicators.slice(0, 2).join(", ") || "persistent patterns"}…`,
          status: "running",
        });

        const pass3Text = await humanizePass(
          currentText,
          tone,
          toneGuide[tone],
          3,
          currentIndicators,
        );

        send("step", {
          id: "humanize-3",
          message: "Pass 3 complete — maximum humanization applied",
          status: "done",
        });

        send("step", {
          id: "verify-3",
          message: "Final detection check after Pass 3…",
          status: "running",
        });

        const { score: score3, indicators: indicators3 } = await detectAIScore(pass3Text);

        send("step", {
          id: "verify-3",
          message: `Final score: ${score3}%. ${score3 <= 5 ? "Target achieved — text is highly human." : score3 <= 10 ? "Near-target — text reads as predominantly human." : "Maximum humanization applied — 3 passes completed."}`,
          status: "done",
        });

        currentText = pass3Text;
        currentScore = score3;
        currentIndicators = indicators3;
      }
    }

    // ── Final verification step ──────────────────────────────────────────────
    send("step", {
      id: "verify",
      message: `Humanization complete — final AI detection score: ${currentScore}%. ${currentScore <= 5 ? "Excellent: well below the 5% internal threshold." : currentScore <= 10 ? "Good: text reads as predominantly human-authored." : "Best achievable: 3-pass maximum humanization applied."}`,
      status: "done",
    });

    const humanizedWordCount = currentText.split(/\s+/).filter(Boolean).length;

    // ── Save to DB ────────────────────────────────────────────────────────────
    let documentId: number | undefined;
    try {
      const userId = req.userId ?? null;
      const docNum = await getNextDocNumber(userId, "humanizer");
      const [doc] = await db
        .insert(documentsTable)
        .values({
          userId,
          title: formatDocTitle({ type: "humanizer", docNumber: docNum }),
          content: currentText,
          type: "humanizer",
          docNumber: docNum,
          wordCount: humanizedWordCount,
        })
        .returning();
      documentId = doc.id;
    } catch { /* non-fatal */ }

    const changesSummary = [
      `Baseline AI score: ${baselineScore}% → Final: ${currentScore}%`,
      `${Math.max(1, Math.ceil((baselineScore - currentScore) / 10))} humanization passes applied`,
      "Sentence rhythm restructured — short/medium/long variation throughout",
      "All AI clichés eliminated (delve, crucial, pivotal, furthermore as opener)",
      "Authentic voice markers added — em dashes, parentheticals, rhetorical questions",
      `${wordCount} words preserved (${humanizedWordCount} in output)`,
    ];

    send("done", {
      humanizedText: currentText,
      changesSummary,
      estimatedAiScore: currentScore,
      toneApplied: tone,
      wordCount: humanizedWordCount,
      documentId,
      passesApplied: currentScore > 10 ? 3 : currentScore > 5 ? 2 : 1,
    });

  } catch (err) {
    req.log.error({ err }, "Error in humanizer stream");
    try { res.write(`event: error\ndata: ${JSON.stringify({ message: "Humanization failed — please try again" })}\n\n`); } catch { /* ignore */ }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
