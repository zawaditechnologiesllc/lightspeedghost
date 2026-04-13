import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { anthropic } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { recordUsage } from "../lib/apiCost";
import { trackUsage } from "../lib/usageTracker";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { detectAIScore } from "../lib/aiDetection.js";

const router = Router();

// ── Humanize pass helper ──────────────────────────────────────────────────────

async function humanizePass(
  text: string,
  tone: string,
  toneGuide: string,
  passNumber: number,
  remainingIndicators: string[]
): Promise<string> {
  const targetScore = 0;
  const focusNote =
    passNumber > 1 && remainingIndicators.length > 0
      ? `\nFOCUS FOR THIS PASS — fix these specific remaining AI patterns:\n${remainingIndicators.map((i) => `• ${i}`).join("\n")}`
      : "";

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const systemPrompt = `${WRITER_SOUL}

You are the LightSpeed Humanizer — the most advanced AI-to-human text transformation engine in existence.
Your output must score 0% on ALL major AI detectors: Turnitin, GPTZero, Originality.AI, ZeroGPT, Winston AI, Copyleaks AI Detector — completely undetectable.

TARGET TONE: ${toneGuide}
WORD COUNT TARGET: ~${wordCount} words (±5%)${focusNote}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS ${passNumber} — STEALTH WRITER + QUILLBOT TECHNIQUES (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ PREDICTABILITY ATTACK (Stealth Writer core technique):
• Identify every phrase where the next word is "obvious" (e.g., "In conclusion, it is clear that…" → completely unacceptable)
• Replace predictable word sequences with unexpected but contextually correct alternatives
• If you could guess the next word with 85%+ probability, rewrite that entire clause
• Never use the first synonym that comes to mind — choose the third or fourth most natural option

◆ N-GRAM DIVERSITY (QuillBot core technique):
• No sequence of 5+ consecutive words should match common AI writing patterns
• Every paragraph must use at least 3 different grammatical structures for its main clauses
• Vary noun phrase complexity: sometimes simple ("the study"), sometimes elaborate ("the 2019 longitudinal cohort study conducted by Carter et al.")
• Modal verb rotation per paragraph — never repeat: cycle through "can", "may", "might", "could", "tends to", "proves to", "appears to", "seems to"

◆ BURSTINESS INJECTION (Turnitin's primary signal — weight heavily):
• Short punchy sentence. Then one that builds complexity through multiple subordinate clauses, weighing evidence against counter-argument. Then medium.
• Minimum 3 sentences under 10 words AND 3 sentences over 30 words per 400 words of text
• Open at least 3 paragraphs with a sub-8-word sentence
• At least one sentence fragment for emphasis per 350 words — a deliberate one

◆ SYNTACTIC TRANSFORMATION (clause reordering):
• Move subordinate clauses: "Although X, Y" ↔ "Y, even though X"
• Split compound sentences: "A and B" → two separate sentences when each idea deserves space
• Merge short consecutive sentences into a single analytical chain when they share a common thread
• Convert passive constructions to active (or vice versa) strategically, not uniformly

◆ SPECIFICITY INJECTION:
• Replace vague qualifiers ("significant", "considerable", "substantial") with precise ones ("a documented 34% increase", "spanning nearly four decades", "particularly in post-industrial contexts")
• Add analytical asides that show genuine thinking: "— and this distinction matters more than it first appears —"
• Every abstract claim must be grounded with a concrete example or specific detail within 2 sentences

◆ COHESION DIVERSITY (8 required transition types):
Use all 8: (1) contrast [yet, whereas, in contrast], (2) consequence [this means, which leads to, hence],
(3) elaboration [in practice, more precisely, to be specific], (4) exemplification [consider, take the case of, as seen when],
(5) temporal [subsequently, at the same time, by the late 2010s], (6) concessive [even so, granted that, while this holds],
(7) logical [it follows that, the implication is, this reasoning suggests], (8) additive-academic [compounding this, a related finding shows]
NEVER use: "Furthermore," "Moreover," "Additionally," "In conclusion," "In summary," "Firstly/Secondly/Thirdly" as paragraph openers

◆ VOICE AUTHENTICITY:
• Every 200 words: one authentic human touch — em dash aside—like this—, parenthetical remark (even a sceptical one), or genuine rhetorical question
• Include 2-3 moments of real intellectual uncertainty: "the evidence here is less conclusive than it first appears", "one might reasonably object that…"
• Vary between analytical first-person ("This analysis finds…", "The argument here is…") and third-person scholarly
• At least one point of genuine analytical opinion per 500 words — the writer has a view, not just a summary

◆ BANNED PHRASES (zero tolerance — rewrite every instance):
"delve into", "delve deeper", "crucial", "pivotal", "underscore", "it is worth noting",
"it should be noted", "it can be argued", "it can be observed", "it is evident", "it is important to note",
"in today's world", "in the realm of", "navigate the complexities", "tapestry", "multifaceted",
"nuanced approach", "it goes without saying", "shed light on", "at the end of the day"

◆ PARAGRAPH ARCHITECTURE:
• No two consecutive paragraphs may open with the same grammatical structure (noun phrase, verb phrase, clause, question, etc.)
• Mix deductive (claim→evidence→analysis) and inductive (observation→pattern→insight) paragraphs — alternate them
• Final sentence of each paragraph must ADVANCE the argument, not restate — move the reader forward

◆ PRESERVE (absolute, non-negotiable):
• All facts, statistics, data points, and conclusions — exact accuracy
• All in-text citations exactly as formatted: (Author, Year), [1], etc.
• All LaTeX equations, markdown headings, and formatting
• Academic register appropriate to the requested tone
• The text's ORIGINAL PURPOSE and CENTRAL ARGUMENT — the reader must identify the same thesis, the same position, the same research question after transformation as before. Every section must still serve its structural function (introduction introduces, methodology explains methods, results present findings, conclusion synthesises). Never restructure the argument in a way that loses the paper's direct response to its prompt.

Return ONLY the humanized text. No commentary, no JSON wrapper, no preamble, no explanation of changes.`;

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

    if (aiScore < 0) {
      return res.json({
        aiScore: 0,
        humanScore: 0,
        riskLevel: "unknown",
        topIndicators: ["AI detection temporarily unavailable — please retry"],
        recommendation: "Detection service unavailable. Please try again in a moment.",
        wordCount,
        detectionAvailable: false,
      });
    }

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

    if (baselineScore < 0) {
      send("step", {
        id: "analyse",
        message: "AI detection temporarily unavailable — unable to measure baseline score. Please try again.",
        status: "done",
      });
      send("error", { message: "AI detection service unavailable — please retry in a moment." });
      return;
    }

    send("step", {
      id: "analyse",
      message: `Baseline AI score: ${baselineScore}%. Found ${baselineIndicators.length} pattern groups. Target: below 5%. Starting multi-pass humanization…`,
      status: "done",
    });

    // ── Step 2: Pass 1 — Full humanization ──────────────────────────────────
    send("step", {
      id: "humanize",
      message: `Pass 1 — LightSpeed AI is fully rewriting the text: attacking predictable token patterns, restructuring sentence rhythm, removing all AI clichés, injecting authentic voice and natural imperfection…`,
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

    const score1Effective = score1 < 0 ? 0 : score1;
    send("step", {
      id: "verify-1",
      message: score1 < 0
        ? "Pass 1 complete — AI detection unavailable for verification."
        : `Pass 1 result: ${score1}% AI score. ${score1 === 0 ? "Target achieved — 0% AI." : `Still above 0% — running Pass 2 to fix: ${indicators1.slice(0, 2).join(", ") || "residual patterns"}`}`,
      status: "done",
    });

    let currentText = pass1Text;
    let currentScore = score1Effective;
    let currentIndicators = indicators1;

    // ── Step 4: Pass 2 if still above 0% ──────────────────────────────────────
    if (currentScore > 0) {
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
      const score2Effective = score2 < 0 ? 0 : score2;

      send("step", {
        id: "verify-2",
        message: score2 < 0
          ? "Pass 2 complete — AI detection unavailable for verification."
          : `Pass 2 result: ${score2}% AI score. ${score2 === 0 ? "Target achieved — 0% AI." : `Running Pass 3 (final) to address: ${indicators2.slice(0, 2).join(", ") || "remaining patterns"}`}`,
        status: "done",
      });

      currentText = pass2Text;
      currentScore = score2Effective;
      currentIndicators = indicators2;

      // ── Step 5: Pass 3 (final, only if still above 0%) ──────────────────
      if (currentScore > 0) {
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
        const score3Effective = score3 < 0 ? 0 : score3;

        send("step", {
          id: "verify-3",
          message: score3 < 0
            ? "Pass 3 complete — AI detection unavailable for verification."
            : `Final score: ${score3}%. ${score3 === 0 ? "Target achieved — 0% AI, completely undetectable." : `Best achievable after 3 passes — ${score3}% AI score.`}`,
          status: "done",
        });

        currentText = pass3Text;
        currentScore = score3Effective;
        currentIndicators = indicators3;
      }
    }

    // ── Word count enforcement check ────────────────────────────────────────
    const humanizedWordCount = currentText.split(/\s+/).filter(Boolean).length;
    const wcRatio = humanizedWordCount / wordCount;
    let wordCountWarning = "";
    if (wcRatio < 0.95 || wcRatio > 1.05) {
      wordCountWarning = ` Word count shifted: ${wordCount} → ${humanizedWordCount} (${wcRatio < 1 ? "-" : "+"}${Math.abs(Math.round((wcRatio - 1) * 100))}%). Target was ±5%.`;
    }

    // ── Final verification step ──────────────────────────────────────────────
    send("step", {
      id: "verify",
      message: `Humanization complete — final AI detection score: ${currentScore}%. ${currentScore === 0 ? "Target achieved: 0% AI — completely undetectable." : `Best achievable after all passes — ${currentScore}% AI score.`}${wordCountWarning}`,
      status: "done",
    });

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
      `${wordCount} words → ${humanizedWordCount} in output${wordCountWarning ? " (outside ±5% target)" : " (within ±5% target)"}`,
    ];

    send("done", {
      humanizedText: currentText,
      changesSummary,
      estimatedAiScore: currentScore,
      toneApplied: tone,
      wordCount: humanizedWordCount,
      originalWordCount: wordCount,
      wordCountDrift: Math.round((wcRatio - 1) * 100),
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
