/**
 * Shared AI Detection — used by Humanizer, Plagiarism Checker, and Paper Writer.
 *
 * Single source of truth for AI content scoring so all three tools give
 * consistent numbers for the same text.
 *
 * Algorithm:
 *  1. Local burstiness analysis (sentence-length variance) — fast, free, and the
 *     primary signal Turnitin uses. AI text has very low variance (stdDev 3–6 words),
 *     human writing varies wildly (stdDev 8–15).
 *  2. GPT-4o-mini semantic scoring — replicates the pattern recognition used by
 *     GPTZero and Originality.AI: structural symmetry, transition clichés,
 *     encyclopaedic tone, missing imperfection.
 *  3. Blended score — burstiness penalty applied to GPT score when burstiness is
 *     unusually low, ensuring the measurement is robust against prompt-injection tricks.
 */

import { openai } from "./ai.js";
import { computeBurstiness, sampleTextSections } from "./textAnalysis.js";
import { recordUsage } from "./apiCost.js";
import { anthropic } from "./ai.js";
import { WRITER_SOUL } from "./soul.js";

export interface AIDetectionResult {
  score: number;
  indicators: string[];
  burstiness: number;
  stdDev: number;
}

const DETECTION_SYSTEM = (burstiness: number, stdDev: number) => `\
You are an expert AI content detection specialist replicating Turnitin, GPTZero, and Originality.AI methodology.

The text has already been measured for burstiness (sentence length variance):
- Burstiness stdDev: ${stdDev.toFixed(1)} words (human writing: 8–15, AI writing: 3–6)
- Burstiness score: ${burstiness}/100 (higher = more human-like variation)

Analyse the sampled text sections and return JSON:
{
  "aiScore": number (0-100, probability the full text is AI-generated — calibrate against burstiness above),
  "indicators": ["up to 4 specific AI patterns found, or 'none detected' if clean"]
}

TURNITIN AI DETECTION SIGNALS — each one found raises the score:
• LOW BURSTINESS (already measured above — weight this heavily)
• Paragraph-level symmetry: every paragraph has the same structure (claim → evidence → conclusion)
• Sentence starters: 3+ consecutive sentences begin with the same word class
• Transition clichés: "Furthermore", "Moreover", "Additionally", "In conclusion" as openers
• AI vocabulary: "delve", "crucial", "pivotal", "underscore", "navigate complexities",
  "it is worth noting", "it is important to note", "in today's world", "in the realm of"
• Uniform hedging register: constant "can be argued", "it should be noted", "this suggests"
• Encyclopaedic neutral tone: no personal analytical voice, no genuine uncertainty or position
• Perfect 3-part paragraph structure repeated throughout without variation
• Missing imperfection: no mid-thought corrections, rhetorical questions, or self-challenges

HUMAN WRITING SIGNALS — reduce the score:
• Short declarative sentences (under 8 words) mixed with complex ones
• Em dashes, parenthetical asides, rhetorical questions
• Specific analytical opinions ("the data here is less convincing")
• Non-standard or discipline-specific transitions
• At least one moment of genuine uncertainty or nuance`;

/**
 * Detect AI content score for any text.
 * Returns a 0-100 score (0 = human, 100 = AI) along with specific indicators.
 */
export async function detectAIScore(
  text: string,
  context = "ai-detection",
): Promise<AIDetectionResult> {
  try {
    const { score: burstiness, stdDev } = computeBurstiness(text);
    const sample = sampleTextSections(text);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: DETECTION_SYSTEM(burstiness, stdDev) },
        { role: "user", content: `Detect AI content in these sampled sections:\n\n${sample}` },
      ],
    });

    if (resp.usage) {
      recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, context);
    }

    const raw = JSON.parse(resp.choices[0]?.message?.content ?? "{}") as {
      aiScore?: number;
      indicators?: string[];
    };

    const gptScore = Math.min(100, Math.max(0, Number(raw.aiScore) ?? 40));
    const burstinessPenalty = burstiness < 30 ? Math.round((30 - burstiness) * 0.5) : 0;
    const blendedScore = Math.min(98, gptScore + burstinessPenalty);

    return {
      score: blendedScore,
      indicators: Array.isArray(raw.indicators) ? raw.indicators : [],
      burstiness,
      stdDev,
    };
  } catch {
    return { score: 30, indicators: [], burstiness: 50, stdDev: 8 };
  }
}

/**
 * Single-pass humanization using Claude + anti-AI prompt engineering.
 * Used by the Paper Writer's auto-humanize step and the quick humanizer.
 * For the full multi-pass experience, use the dedicated Humanizer tool.
 */
export async function humanizeTextOnce(
  text: string,
  tone: "academic" | "conversational" | "professional" = "academic",
  passNumber = 1,
  indicators: string[] = [],
): Promise<string> {
  const focusNote =
    passNumber > 1 && indicators.length > 0
      ? `\nFOCUS FOR THIS PASS — fix these specific remaining AI patterns:\n${indicators.map((i) => `• ${i}`).join("\n")}`
      : "";

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const toneGuide: Record<string, string> = {
    academic:
      "formal academic register — precise vocabulary, analytical hedging ('may suggest', 'this analysis contends'), discipline-appropriate jargon",
    conversational:
      "natural conversational tone — contractions allowed, shorter punchy sentences, approachable but intelligent",
    professional:
      "professional register — authoritative but readable, avoids academic hedging but remains precise",
  };

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    system: `${WRITER_SOUL}

You are the LightSpeed Humanizer. Your output must score below 5% on all major AI detectors.

TARGET TONE: ${toneGuide[tone] ?? toneGuide.academic}
WORD COUNT TARGET: ~${wordCount} words (±8%)${focusNote}

━━━ STEALTH WRITER TECHNIQUES (MANDATORY) ━━━

◆ BURSTINESS INJECTION (Turnitin's primary signal):
• Short punchy sentence. Then one that builds complexity through multiple subordinate clauses. Then medium.
• Minimum 3 sentences under 10 words AND 3 sentences over 30 words per 400 words of text
• Open at least 3 paragraphs with a sub-8-word sentence
• At least one sentence fragment for emphasis per 350 words

◆ PREDICTABILITY ATTACK:
• Identify every phrase where the next word is "obvious" — rewrite those clauses
• Never use the first synonym that comes to mind — choose the third or fourth most natural option

◆ N-GRAM DIVERSITY:
• No sequence of 5+ consecutive words should match common AI writing patterns
• Every paragraph must use at least 3 different grammatical structures

◆ VOICE AUTHENTICITY:
• Every 200 words: one em dash aside—like this—, parenthetical remark, or rhetorical question
• Include 2-3 moments of real intellectual uncertainty per document
• At least one genuine analytical opinion per 500 words

◆ BANNED PHRASES (zero tolerance):
"delve into", "delve deeper", "crucial", "pivotal", "underscore", "it is worth noting",
"it should be noted", "it can be argued", "it is evident", "it is important to note",
"in today's world", "in the realm of", "navigate the complexities", "tapestry",
"multifaceted", "nuanced approach", "shed light on"

◆ PRESERVE (non-negotiable):
• All facts, statistics, data points, conclusions — exact accuracy
• All in-text citations exactly as formatted
• All LaTeX equations, markdown headings, formatting
• The paper's original purpose and central argument

Return ONLY the humanized text. No commentary, no preamble, no explanation of changes.`,
    messages: [
      {
        role: "user",
        content:
          passNumber === 1
            ? `Humanize this text — apply all rules:\n\n${text}`
            : `Humanize this text again (Pass ${passNumber} — fix remaining AI patterns):\n\n${text}`,
      },
    ],
  });

  recordUsage(
    "claude-sonnet-4-5",
    resp.usage.input_tokens,
    resp.usage.output_tokens,
    `humanize-pass-${passNumber}`,
  );

  const result = resp.content[0].type === "text" ? resp.content[0].text : text;
  return result.trim().replace(/^```(?:text|markdown)?\n?/, "").replace(/\n?```$/, "");
}
