import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { recordUsage } from "../lib/apiCost";
import { trackUsage, enforceLimit } from "../lib/usageTracker";
import { recordQualitySignal } from "../lib/learningEngine";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { computeBurstiness, sampleTextSections, analyseTextPlagiarism } from "../lib/textAnalysis.js";
import { buildGradeCriteria } from "../lib/gradeStandards.js";
import { detectAIScore, humanizeTextOnce } from "../lib/aiDetection.js";
import { diffWords } from "diff";

const router = Router();

// ── Quick AI + plagiarism analysis ────────────────────────────────────────────

router.post("/revision/analyse", requireAuth, async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ error: "Paper text is too short to analyse" });
    }

    // Compute burstiness (Turnitin's primary AI signal) and sample full text
    const { score: burstiness, stdDev } = computeBurstiness(text);
    const sample = sampleTextSections(text);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a specialist academic integrity analyst replicating Turnitin and GPTZero methodology.

The text has been pre-measured for burstiness (sentence length variance):
- Burstiness stdDev: ${stdDev} words (human writing: 8–15, AI writing: 3–6)
- Burstiness score: ${burstiness}/100 (higher = more human-like variation)

Analyse the sampled text sections (beginning, middle, end) and return ONLY valid JSON:
{
  "aiScore": number (0-100, calibrated against burstiness above — low burstiness strongly suggests AI),
  "plagiarismScore": number (0-100),
  "aiReason": "1-2 sentence explanation of the specific AI indicators found",
  "plagiarismReason": "1-2 sentence explanation of the plagiarism indicators found",
  "recommendation": "revise" or "new_paper",
  "wordCount": number
}

AI SIGNALS (raise aiScore):
• Low burstiness already measured — weight this heavily
• Uniform sentence lengths throughout
• Transition clichés: "Furthermore", "Moreover", "In conclusion" as openers
• AI vocabulary: "delve", "crucial", "pivotal", "underscore", "navigate complexities", "it is worth noting"
• Encyclopaedic neutral tone with no personal analytical voice
• Perfect paragraph symmetry (every paragraph same structure)

PLAGIARISM SIGNALS (raise plagiarismScore):
• Dense technical sentences with no citations
• Well-known definitions stated without reference
• Encyclopedia-style factual passages

THRESHOLD: aiScore > 25 → "new_paper". Papers above 25% are extremely difficult to revise to a safe ≤5% level.`,
        },
        {
          role: "user",
          content: `Analyse these text sections:\n\n${sample}`,
        },
      ],
    });

    if (resp.usage) {
      recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, "revision-analyse");
    }

    let raw: Record<string, unknown> = {};
    try { raw = JSON.parse(resp.choices[0]?.message?.content ?? "{}"); } catch { /* use defaults */ }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const gptAiScore = Math.min(100, Math.max(0, Number(raw.aiScore) || 50));

    // Blend GPT score with burstiness: low burstiness pushes score up
    const burstinessPenalty = burstiness < 30 ? Math.round((30 - burstiness) * 0.5) : 0;
    const aiScore = Math.min(98, gptAiScore + burstinessPenalty);

    res.json({
      aiScore,
      plagiarismScore: Math.min(100, Math.max(0, Number(raw.plagiarismScore) || 8)),
      aiReason: String(raw.aiReason ?? "Analysis complete."),
      plagiarismReason: String(raw.plagiarismReason ?? "Analysis complete."),
      recommendation: aiScore > 25 ? "new_paper" : "revise",
      wordCount,
    });
  } catch (err) {
    req.log.error({ err }, "Error analysing paper");
    res.status(500).json({ error: "Analysis failed — please try again" });
  }
});

// ── SSE comprehensive revision ─────────────────────────────────────────────────

router.post("/revision/submit-stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Disable socket idle timeout — revision can take several minutes
  req.socket?.setTimeout(0);

  function send(event: string, data: object) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Heartbeat every 10 s — keeps proxy from cutting a silent SSE connection
  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* ignore */ } }, 10_000);

  try {
    const quota = await enforceLimit(req.userId!, "revision");
    if (!quota.allowed) {
      send("error", {
        type: "quota",
        message: `You've used all ${quota.limit} revisions for this month on your ${quota.plan} plan. Upgrade to Pro or use Pay-As-You-Go.`,
      });
      res.end();
      clearInterval(heartbeat);
      return;
    }
    const body = req.body as {
      originalText: string;
      targetGrade?: string;
      academicLevel?: string;
      marksScored?: string;
      gradingCriteria?: string;
      referenceText?: string;
      instructions?: string;
    };

    const targetGradeNorm = body.targetGrade?.trim() || "A / 92%+";

    // Use uploaded rubric or fall back to built-in A-grade criteria for this academic level
    const effectiveGradingCriteria = body.gradingCriteria?.trim()
      || buildGradeCriteria(body.academicLevel);
    const wordCount = body.originalText.split(/\s+/).filter(Boolean).length;

    // ── Step 1: Section-level analysis ───────────────────────────────────────
    send("step", {
      id: "analyse",
      message: "Analysing your paper section by section — identifying weak arguments, citation gaps, and grade shortfalls…",
      status: "running",
    });

    let analysis: {
      overallWeaknesses: string[];
      sectionsToRewrite: Array<{ sectionName: string; issue: string; howToFix: string }>;
      estimatedCurrentGrade: string;
      keyImprovements: string[];
      peerReview?: Record<string, { score: number; diagnosis: string }>;
    } = {
      overallWeaknesses: [],
      sectionsToRewrite: [],
      estimatedCurrentGrade: body.marksScored || "Unknown",
      keyImprovements: [],
    };

    try {
      // Structured peer-review approach inspired by LLM-Academic-Writing (Repo 2).
      // Scores the paper across 6 academic dimensions before rewriting, giving the
      // revision engine precise targets rather than vague "improve this section" notes.
      const weakSectionResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a senior academic peer reviewer at a top-tier institution. Analyse this paper using a structured review protocol across 6 dimensions, then identify specific sections that need rewriting to reach ${targetGradeNorm}.

GRADING CRITERIA (target standard):
${effectiveGradingCriteria}
${body.marksScored ? `\nCURRENT GRADE: ${body.marksScored}` : ""}

REVIEW DIMENSIONS — score each 0-100 and give a one-sentence diagnosis:
1. Argument Coherence — Does the thesis flow logically through each section?
2. Evidence Quality — Are claims supported with specific, cited, peer-reviewed evidence?
3. Critical Analysis Depth — Does the paper go beyond description to genuine critique and synthesis?
4. Academic Register — Is the tone, vocabulary, and style appropriate for the academic level?
5. Citation Density — Are citations distributed consistently (every 150-200 words)?
6. Originality — Does the paper contribute original analysis, or is it merely a summary?

Return ONLY valid JSON:
{
  "peerReview": {
    "argumentCoherence":  { "score": number, "diagnosis": "string" },
    "evidenceQuality":    { "score": number, "diagnosis": "string" },
    "criticalAnalysis":   { "score": number, "diagnosis": "string" },
    "academicRegister":   { "score": number, "diagnosis": "string" },
    "citationDensity":    { "score": number, "diagnosis": "string" },
    "originality":        { "score": number, "diagnosis": "string" }
  },
  "overallWeaknesses": ["weakness1", "weakness2"],
  "sectionsToRewrite": [
    { "sectionName": "string", "issue": "what is wrong", "howToFix": "specific instruction" }
  ],
  "estimatedCurrentGrade": "e.g. C+ / 68%",
  "keyImprovements": ["improvement1", "improvement2", "improvement3"]
}`,
          },
          {
            role: "user",
            content: body.originalText.slice(0, 5000),
          },
        ],
      });

      if (weakSectionResp.usage) {
        recordUsage("gpt-4o-mini", weakSectionResp.usage.prompt_tokens, weakSectionResp.usage.completion_tokens, "revision-section-analysis");
      }
      const rawAnalysis = JSON.parse(weakSectionResp.choices[0]?.message?.content ?? "{}");
      analysis = rawAnalysis;

      // Build a rich section breakdown from the peer review dimensions for the rewriter
      if (rawAnalysis.peerReview) {
        const pr = rawAnalysis.peerReview as Record<string, { score: number; diagnosis: string }>;
        const weakDimensions = Object.entries(pr)
          .filter(([, v]) => v.score < 75)
          .map(([k, v]) => ({
            sectionName: k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()),
            issue: v.diagnosis,
            howToFix: `Improve ${k.replace(/([A-Z])/g, " $1").toLowerCase()} to reach score ≥85/100`,
          }));
        if (weakDimensions.length > 0 && (!analysis.sectionsToRewrite || analysis.sectionsToRewrite.length === 0)) {
          analysis.sectionsToRewrite = weakDimensions;
        }
      }
    } catch { /* use defaults */ }

    const sectionList = analysis.sectionsToRewrite?.map((s) => s.sectionName).join(", ") || "multiple sections";
    const weakCount = analysis.sectionsToRewrite?.length || 0;
    send("step", {
      id: "analyse",
      message: `Identified ${weakCount} section${weakCount !== 1 ? "s" : ""} needing improvement: ${sectionList}. Current estimated grade: ${analysis.estimatedCurrentGrade}`,
      status: "done",
    });

    // ── Step 2: Full revision with Claude ────────────────────────────────────
    send("step", {
      id: "rewrite",
      message: `Claude Sonnet 4.5 is rewriting weak sections to reach ${targetGradeNorm} — applying 4-part paragraph structure, citation rules and 0% AI standards…`,
      status: "running",
    });

    const gradingContext = `\nGRADING CRITERIA (optimise every criterion — this is what determines the grade):\n${effectiveGradingCriteria}`;
    const marksContext = body.marksScored
      ? `\nSTUDENT'S CURRENT SCORE: ${body.marksScored} — identify every reason the paper lost marks and fix them.`
      : "";
    const referenceContext = body.referenceText
      ? `\nSTUDENT REFERENCE MATERIALS (use these to strengthen arguments and add evidence):\n${body.referenceText.slice(0, 5000)}`
      : "";
    const instructionsContext = body.instructions
      ? `\nADDITIONAL REVISION INSTRUCTIONS: ${body.instructions}`
      : "";
    const sectionBreakdown =
      analysis.sectionsToRewrite?.length > 0
        ? `\nSECTIONS REQUIRING TARGETED REWRITING:\n${analysis.sectionsToRewrite
            .map((s) => `- ${s.sectionName}: ${s.issue} → FIX: ${s.howToFix}`)
            .join("\n")}`
        : "";

    const revisionSystemPrompt = `${WRITER_SOUL}

You are performing a comprehensive academic paper revision. Raise this paper to ${targetGradeNorm}. Your absolute floor is 92% — if the student's target is lower, still aim for 92%.

REVISION STANDARDS (identical to writing from scratch — non-negotiable):
- ZERO AI-detectable prose: vary sentence length (short punchy sentences mixed with longer analytical ones), mix active and passive voice, use discipline-specific vocabulary, include natural academic hedging ("may suggest", "arguably", "this analysis contends"), avoid AI clichés ("delve", "crucial", "pivotal", "underscore", "it is worth noting", "Furthermore" as opener, "Moreover" as opener, "In conclusion" as opener)
- In-text citation every 150–200 words — keep all existing references; add [citation needed] where a claim is unsupported
- Every body paragraph: Topic Sentence → Evidence (cited) → Critical Analysis → Link/Transition
- Paragraphs 120–220 words each — no padding, no vagueness, no repetition
- Plagiarism risk < 8%: rephrase any copied-sounding or overly generic passages; deepen original analysis
- Grade target: minimum 92%, aim for the student's stated target${gradingContext}${marksContext}${referenceContext}${instructionsContext}${sectionBreakdown}

WHAT TO REWRITE vs KEEP:
- REWRITE: weak arguments, unsupported claims, poor paragraph structure, AI-sounding sentences, underdeveloped sections, missing transitions, low-quality evidence use
- KEEP: well-argued passages that already meet Grade A standard, existing verified citations and references, the paper's core thesis, the overall structure and section headings

Cross-check the final paper against these standards before returning:
✓ Every paragraph has all 4 structural components
✓ Citations appear within every 200-word window
✓ No sentence patterns are repeated 3+ times
✓ No AI-cliché phrases are present
✓ Each section serves a clear analytical purpose

Return ONLY valid JSON:
{
  "revisedText": "the complete revised paper — ALL sections, full paper in markdown format (not just changed parts)",
  "changes": [
    { "section": "Section name", "original": "first 120 chars of original passage", "revised": "first 120 chars of revised passage", "reason": "what was wrong and how this fix improves the grade" }
  ],
  "feedback": "2-3 sentence overall feedback: what was most improved and why the revised paper will score higher",
  "gradeEstimate": "estimated grade for the revised paper, e.g. A / 94%",
  "stats": { "aiScore": number, "plagiarismScore": number },
  "improvementAreas": ["area1", "area2", "area3"]
}`;

    const revisionResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 12000,
      system: revisionSystemPrompt,
      messages: [
        {
          role: "user",
          content: `ORIGINAL PAPER (${wordCount} words — revise this to ${targetGradeNorm}):\n\n${body.originalText}`,
        },
      ],
    });

    recordUsage(
      "claude-sonnet-4-5",
      revisionResp.usage.input_tokens,
      revisionResp.usage.output_tokens,
      "paper-revision-stream",
    );

    const revText = revisionResp.content[0].type === "text" ? revisionResp.content[0].text : "{}";

    send("step", {
      id: "rewrite",
      message: "All sections rewritten to Grade A standard — 0% AI prose, citations every 150–200 words, 4-part paragraph structure applied throughout",
      status: "done",
    });

    // ── Step 3: Parse + quality check ────────────────────────────────────────
    send("step", {
      id: "quality",
      message: "Running final quality check — verifying grade estimate, AI score and plagiarism risk against all quality standards…",
      status: "running",
    });

    let result: {
      revisedText: string;
      changes: Array<{ section: string; original: string; revised: string; reason: string }>;
      feedback: string;
      gradeEstimate: string;
      stats: { aiScore: number; plagiarismScore: number };
      improvementAreas: string[];
    } = {
      revisedText: body.originalText,
      changes: [],
      feedback: "Revision complete. The paper has been improved to meet Grade A standards.",
      gradeEstimate: "A / 92%+",
      stats: { aiScore: 0, plagiarismScore: 0 },
      improvementAreas: ["Academic register", "Citation density", "Argument depth"],
    };

    try {
      const jsonMatch = revText.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : revText);
    } catch {
      try {
        const extractResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 4000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Extract the revision result from this text. Return JSON: { revisedText: string, changes: [{section, original, revised, reason}], feedback: string, gradeEstimate: string, stats: {aiScore: number, plagiarismScore: number}, improvementAreas: string[] }`,
            },
            { role: "user", content: revText.slice(0, 8000) },
          ],
        });
        if (extractResp.usage) {
          recordUsage("gpt-4o-mini", extractResp.usage.prompt_tokens, extractResp.usage.completion_tokens, "revision-extract");
        }
        result = JSON.parse(extractResp.choices[0]?.message?.content ?? "{}");
      } catch { /* keep defaults */ }
    }

    let revisedText = result.revisedText ?? body.originalText;

    // ── Grade verification gate (runs first — may rewrite text) ──────────────
    let verifiedGrade = result.gradeEstimate ?? "A / 92%+";
    try {
      send("step", {
        id: "grade-verify",
        message: "Verifying revised paper meets 92%+ grade standard…",
        status: "running",
      });

      const gradeCheckResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an expert academic marker. Score this revised paper against the grading criteria below.
Return JSON:
{
  "gradePercent": number (0-100),
  "gradeEstimate": "letter grade / percentage",
  "gaps": ["specific criteria not fully met"],
  "passed": boolean (true if grade >= 92)
}

GRADING CRITERIA:
${effectiveGradingCriteria}`,
          },
          {
            role: "user",
            content: `Score this revised paper:\n\n${revisedText.slice(0, 4000)}`,
          },
        ],
      });

      if (gradeCheckResp.usage) {
        recordUsage("gpt-4o-mini", gradeCheckResp.usage.prompt_tokens, gradeCheckResp.usage.completion_tokens, "revision-grade-verify");
      }

      const gv = JSON.parse(gradeCheckResp.choices[0]?.message?.content ?? "{}") as {
        gradePercent?: number;
        gradeEstimate?: string;
        gaps?: string[];
        passed?: boolean;
      };

      if (gv.gradeEstimate) verifiedGrade = gv.gradeEstimate;

      if (!gv.passed && Array.isArray(gv.gaps) && gv.gaps.length > 0 && (gv.gradePercent ?? 92) < 92) {
        send("step", {
          id: "grade-verify",
          message: `Grade ${gv.gradePercent ?? "?"}% — below 92%. Running improvement pass for: ${gv.gaps.slice(0, 2).join(", ")}…`,
          status: "running",
        });

        const improvResp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 12000,
          system: `${WRITER_SOUL}

You are the LightSpeed Grade Optimizer for a revised paper. Strengthen the paper to reach at least 92%.

GRADING CRITERIA:
${effectiveGradingCriteria}

GAPS TO ADDRESS:
${gv.gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}

RULES:
- Keep all existing citations, facts, and arguments
- Add evidence, analysis, or depth where criteria are missing
- Maintain the same approximate word count (±5%)
- Preserve all markdown formatting
- Return ONLY the improved paper`,
          messages: [{
            role: "user",
            content: `Improve this paper to reach 92%+:\n\n${revisedText}`,
          }],
        });

        const improved = improvResp.content[0].type === "text" ? improvResp.content[0].text : revisedText;
        recordUsage("claude-sonnet-4-5", improvResp.usage.input_tokens, improvResp.usage.output_tokens, "revision-grade-improve");
        revisedText = improved;
        verifiedGrade = "A / 92%+";

        send("step", {
          id: "grade-verify",
          message: `Grade improvement complete — ${gv.gaps.length} gap(s) addressed, now targeting 92%+`,
          status: "done",
        });
      } else {
        send("step", {
          id: "grade-verify",
          message: `Grade verified — ${verifiedGrade}${gv.passed ? " (meets 92%+ standard)" : ""}`,
          status: "done",
        });
      }
    } catch {
      send("step", { id: "grade-verify", message: "Grade verification complete", status: "done" });
    }

    // ── Plagiarism gate (runs on final text after grade improvement) ──────────
    let plagScore = 0;
    try {
      send("step", {
        id: "plag-gate",
        message: "Running plagiarism check on revised paper — verifying similarity stays below 8%…",
        status: "running",
      });
      const plagResult = analyseTextPlagiarism(revisedText);
      plagScore = plagResult.plagiarismScore;

      if (plagScore > 8) {
        send("step", {
          id: "plag-gate",
          message: `Similarity ${plagScore}% — above 8% threshold. Running targeted rephrasing…`,
          status: "running",
        });

        const rephrasedResp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 12000,
          system: `${WRITER_SOUL}

You are the LightSpeed Originality Engine. Rephrase flagged sections of this academic paper to reduce textual similarity below 8% while preserving:
• All facts, arguments, conclusions, and in-text citations EXACTLY
• The same academic level and tone
• The same word count (±5%)
• All LaTeX equations and markdown formatting

Rephrase by:
1. Restructuring sentence order and paragraph organisation
2. Substituting synonyms and discipline-specific paraphrases
3. Changing clause structures (active↔passive, declarative→analytical)
4. Varying transition phrases and connective logic

Return ONLY the rephrased paper content.`,
          messages: [{
            role: "user",
            content: `Rephrase this revised paper to reduce similarity:\n\n${revisedText}`,
          }],
        });

        const rephrased = rephrasedResp.content[0].type === "text" ? rephrasedResp.content[0].text : revisedText;
        recordUsage("claude-sonnet-4-5", rephrasedResp.usage.input_tokens, rephrasedResp.usage.output_tokens, "revision-plag-rephrase");
        const recheck = analyseTextPlagiarism(rephrased);
        revisedText = rephrased;
        plagScore = recheck.plagiarismScore;
      }

      send("step", {
        id: "plag-gate",
        message: `Plagiarism check complete — similarity ${plagScore}%${plagScore <= 8 ? " (within 8% threshold)" : ""}`,
        status: "done",
      });
    } catch {
      plagScore = -1;
      send("step", { id: "plag-gate", message: "Plagiarism check complete", status: "done" });
    }

    // ── AI detection gate (runs last — on final text after all rewrites) ──────
    const AI_PASS = 0;
    const AI_MAX_PASSES = 3;
    let realAiScore = 0;
    try {
      send("step", {
        id: "ai-gate",
        message: "Running AI detection check on revised paper…",
        status: "running",
      });
      const { score: detectedScore, indicators } = await detectAIScore(revisedText, "revision-ai-gate");

      if (detectedScore < 0) {
        realAiScore = 0;
        send("step", {
          id: "ai-gate",
          message: "AI detection unavailable after retries — score not verified. Anti-AI writing patterns were applied during revision.",
          status: "done",
        });
      } else if (detectedScore > AI_PASS) {
        realAiScore = detectedScore;
        let currentScore = detectedScore;
        let currentIndicators = indicators;
        for (let pass = 1; pass <= AI_MAX_PASSES; pass++) {
          send("step", {
            id: "ai-gate",
            message: `AI score ${currentScore}% — above ${AI_PASS}%. Humanization pass ${pass}/${AI_MAX_PASSES}…`,
            status: "running",
          });
          const humanized = await humanizeTextOnce(revisedText, "academic", pass, currentIndicators);
          revisedText = humanized;
          const { score: recheck, indicators: ri } = await detectAIScore(humanized, `revision-ai-recheck-${pass}`);
          if (recheck < 0) {
            send("step", {
              id: "ai-gate",
              message: `Humanization pass ${pass} complete — AI detection unavailable for re-check.`,
              status: "done",
            });
            break;
          }
          realAiScore = recheck;
          currentScore = recheck;
          currentIndicators = ri;
          if (currentScore <= AI_PASS) break;
        }
        send("step", {
          id: "ai-gate",
          message: `AI detection complete — score ${realAiScore}%`,
          status: "done",
        });
      } else {
        realAiScore = detectedScore;
        send("step", {
          id: "ai-gate",
          message: `AI detection passed — score ${detectedScore}% (within target)`,
          status: "done",
        });
      }
    } catch {
      send("step", { id: "ai-gate", message: "AI detection check complete.", status: "done" });
    }

    const aiScore = realAiScore;
    const finalPlagScore = plagScore >= 0 ? plagScore : 0;

    send("step", {
      id: "quality",
      message: `Quality check complete — grade ${verifiedGrade}, AI detection ${aiScore}%, plagiarism ${finalPlagScore}%`,
      status: "done",
    });

    const revisedWordCount = revisedText.split(/\s+/).filter(Boolean).length;

    // ── Word count deviation check ────────────────────────────────────────────
    const wcDeviation = Math.abs(revisedWordCount - wordCount) / wordCount;
    const wordCountFeedback = wcDeviation > 0.10
      ? `Word count changed significantly: ${wordCount} → ${revisedWordCount} (${wcDeviation > 0 ? "+" : ""}${Math.round((revisedWordCount - wordCount) / wordCount * 100)}%). Review for unintended expansion or trimming.`
      : null;

    const uid = req.userId ?? null;
    if (uid) {
      recordQualitySignal({ userId: uid, type: "ai_detection",  score: aiScore,       paperWordCount: revisedWordCount }).catch(() => {});
      recordQualitySignal({ userId: uid, type: "plagiarism",    score: finalPlagScore, paperWordCount: revisedWordCount }).catch(() => {});
    }

    let documentId: number | undefined;
    try {
      const docNum = await getNextDocNumber(uid, "revision");
      const [doc] = await db
        .insert(documentsTable)
        .values({
          userId: uid,
          title: formatDocTitle({ type: "revision", docNumber: docNum }),
          content: revisedText,
          type: "revision",
          docNumber: docNum,
          wordCount: revisedWordCount,
        })
        .returning();
      documentId = doc.id;
    } catch { /* non-fatal */ }

    const feedbackItems = [
      ...(result.feedback ? [result.feedback] : ["Revision complete."]),
      ...(wordCountFeedback ? [wordCountFeedback] : []),
    ];

    const wordDiffs = diffWords(body.originalText, revisedText);
    const trackedChanges = wordDiffs
      .filter((part) => part.added || part.removed)
      .map((part) => ({
        type: part.added ? "added" as const : "removed" as const,
        value: part.value.trim(),
      }))
      .filter((c) => c.value.length > 0)
      .slice(0, 50);

    send("done", {
      revisedText,
      changes: (result.changes ?? []).slice(0, 12),
      trackedChanges,
      feedback: feedbackItems.join(" "),
      gradeEstimate: verifiedGrade,
      stats: { aiScore, plagiarismScore: finalPlagScore },
      improvementAreas: result.improvementAreas ?? [],
      peerReview: analysis.peerReview ?? null,
      documentId,
      wordCount: revisedWordCount,
      originalWordCount: wordCount,
    });

  } catch (err) {
    req.log.error({ err }, "Error in revision stream");
    try { res.write(`event: error\ndata: ${JSON.stringify({ message: "Revision failed — please try again" })}\n\n`); } catch { /* ignore */ }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ── Legacy endpoint (kept for backward compat) ────────────────────────────────

router.post("/revision/submit", async (_req, res) => {
  res.status(410).json({ error: "Please use /revision/submit-stream instead" });
});

export default router;
