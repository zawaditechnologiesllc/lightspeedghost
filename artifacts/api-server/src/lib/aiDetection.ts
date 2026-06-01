/**
 * Shared AI Detection — used by Humanizer, Plagiarism Checker, and Paper Writer.
 *
 * Single source of truth for AI content scoring so all three tools give
 * consistent numbers for the same text.
 *
 * Algorithm:
 *  1. Slopbuster pre-pass — local pattern-matching that strips AI "slop" phrases
 *     before any LLM call, reducing token waste and improving humanisation focus.
 *     Technique adapted from github.com/slopbuster (local regex, zero API cost).
 *  2. Local burstiness analysis (sentence-length variance) — fast, free, and the
 *     primary signal Turnitin uses. AI text has very low variance (stdDev 3–6 words),
 *     human writing varies wildly (stdDev 8–15).
 *  3. GPT-4o-mini semantic scoring — replicates the pattern recognition used by
 *     GPTZero and Originality.AI: structural symmetry, transition clichés,
 *     encyclopaedic tone, missing imperfection.
 *  4. Blended score — burstiness penalty applied to GPT score when burstiness is
 *     unusually low, ensuring the measurement is robust against prompt-injection tricks.
 *  5. Humanizer-X multi-pass fingerprint manipulation — when the blended score is
 *     still above threshold after the LLM humanisation pass, the engine targets
 *     residual statistical fingerprints: predictable n-grams, perplexity uniformity,
 *     and paragraph-level structural symmetry.
 */

import { openai } from "./ai.js";
import { computeBurstiness, sampleTextSections, computePerplexityProxy, scoreSentences } from "./textAnalysis.js";
import { recordUsage } from "./apiCost.js";
import { anthropic } from "./ai.js";
import { WRITER_SOUL } from "./soul.js";

// ── Slopbuster: local pattern-matching pre-pass ───────────────────────────────
// Removes AI "slop" phrases without any API call.
// Technique adapted from the Slopbuster project (local regex engine).
// Run this BEFORE sending text to the LLM humaniser so the model focuses
// on structural fingerprints rather than surface-level clichés.

const SLOP_REPLACEMENTS: [RegExp, string][] = [
  // ── Paragraph-opener clichés ─────────────────────────────────────────────
  [/\bFurthermore,?\s*/g, ""],
  [/\bMoreover,?\s*/g, ""],
  [/\bAdditionally,?\s*/g, ""],
  [/\bIn conclusion,?\s*/g, "Taken together, "],
  [/\bIn summary,?\s*/g, "Overall, "],
  [/\bIn today'?s (world|society|landscape|environment|context|era),?\s*/gi, ""],
  [/\bIn the realm of\s+/gi, "In "],
  [/\bIn recent years,?\s*/gi, ""],
  [/\bIt is (clear|evident|apparent) (that)?\s*/gi, ""],
  [/\bNeedless to say,?\s*/gi, ""],
  // ── High-frequency AI vocabulary ─────────────────────────────────────────
  [/\bdelve(s|d)? (into|deeper)\b/gi, "examine"],
  [/\bcrucial\b/gi, "important"],
  [/\bpivotal\b/gi, "significant"],
  [/\bunderscore(s|d)?\b/gi, "highlight$1"],
  [/\btapestry\b/gi, "combination"],
  [/\bmultifaceted\b/gi, "complex"],
  [/\bshed(s|ding)? light on\b/gi, "clarify"],
  [/\bnavigate (the )?complexit(y|ies)\b/gi, "address the challenges"],
  [/\bit is (worth|important to) (noting|note)\b/gi, "notably"],
  [/\bit (should|must) be noted (that)?\b/gi, ""],
  [/\bit can be argued (that)?\b/gi, "arguably"],
  [/\bthis (suggests|indicates|demonstrates) that\b/gi, "this shows that"],
  [/\bnuanced approach\b/gi, "careful approach"],
  [/\brobust\b/gi, "strong"],
  [/\butilize(s|d|r|rs)?\b/gi, "use$1"],
  [/\bfacilitate(s|d)?\b/gi, "enable$1"],
  [/\bleverage(s|d|ing)?\b/gi, "use$1"],
  [/\bsynerg(y|ies|ise|ize|istic)\b/gi, "interaction"],
  [/\bparadigm shift\b/gi, "major change"],
  [/\bholistic (approach|view|understanding)\b/gi, "broad $1"],
  [/\bproactive(ly)?\b/gi, "active$1"],
  [/\bseamless(ly)?\b/gi, "smooth$1"],
  [/\btransformative\b/gi, "significant"],
  [/\bgroundbreaking\b/gi, "novel"],
  [/\bcutting-edge\b/gi, "advanced"],
  [/\bstate-of-the-art\b/gi, "advanced"],
  [/\binnovative (approach|solution|strategy)\b/gi, "new $1"],
  [/\bemphasise(s|d)? the (importance|significance|need) of\b/gi, "stress the value of"],
  [/\bcomprehensive (understanding|overview|analysis)\b/gi, "thorough $1"],
  [/\bfoster(s|ed|ing)? a (culture|environment|sense) of\b/gi, "build$1 a $2 of"],
  [/\bstakeholder(s)?\b/gi, "parties involved"],
  [/\blend(s)? itself to\b/gi, "suit$1"],
  [/\bprovide(s|d)? a framework\b/gi, "offer$1 a structure"],
  [/\bunderpin(s|ned|ning)?\b/gi, "support$1"],
];

/**
 * Slopbuster pre-pass — strip known AI phrase patterns with local regex.
 * Zero API cost. Run before LLM humanisation to focus model effort on
 * structural fingerprints rather than surface clichés.
 */
export function removeSlopPatterns(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SLOP_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Clean up any double-spaces created by empty replacements
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/^[ \t]+/gm, (m, offset) => (offset === 0 ? m : ""));
  return out.trim();
}

export interface SentenceScore {
  text: string;
  score: number;
  flagged: boolean;
}

export interface AIDetectionResult {
  score: number;
  indicators: string[];
  burstiness: number;
  stdDev: number;
  perplexity: number;
  sentenceScores: SentenceScore[];
  /** True when score < 20 (Turnitin-style false-positive suppression) */
  falsePositiveSuppressed: boolean;
  /** Minimum word count met for reliable detection (Turnitin requires 400+) */
  meetsMinimumWordCount: boolean;
  /** True if text shows systematic AI humanizer tool patterns (Turnitin 2025 bypasser detection) */
  bypasserDetected?: boolean;
  mode?: "blended" | "burstiness_fallback";
}

const DETECTION_SYSTEM = (burstiness: number, stdDev: number, perplexity: number) => `\
You are an expert AI content detection specialist replicating Turnitin, GPTZero, Copyleaks, and Originality.AI methodology.

The text has already been measured with two local signals:
- Burstiness stdDev: ${stdDev.toFixed(1)} words (human: 8–15, AI: 3–6)
- Burstiness score: ${burstiness}/100 (higher = more human-like sentence variation)
- Perplexity proxy: ${perplexity}/100 (AI-trigram density — higher = more predictable/AI-like)

Turnitin 2025 BYPASSER DETECTION: also flag if text shows systematic humanizer patterns —
uniform synonym substitution throughout, formulaic burstiness injection (every paragraph has same
short/long/short pattern), or mechanical transition replacement. These are signs of AI humanizer tools.

Analyse the sampled text sections and return JSON:
{
  "aiScore": number (0-100, probability the full text is AI-generated — calibrate against both signals above),
  "indicators": ["up to 4 specific AI or humanizer patterns found, or 'none detected' if clean"],
  "bypasserDetected": boolean (true if text shows systematic humanizer tool patterns)
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
  const { score: burstiness, stdDev } = computeBurstiness(text);
  const { score: perplexity } = computePerplexityProxy(text);
  const sentenceScores = scoreSentences(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const meetsMinimumWordCount = wordCount >= 400;
  const sample = sampleTextSections(text);

  const MAX_RETRIES = 2;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DETECTION_SYSTEM(burstiness, stdDev, perplexity) },
          { role: "user", content: `Detect AI content in these sampled sections:\n\n${sample}` },
        ],
      });

      if (resp.usage) {
        recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, context);
      }

      const raw = JSON.parse(resp.choices[0]?.message?.content ?? "{}") as {
        aiScore?: number;
        indicators?: string[];
        bypasserDetected?: boolean;
      };

      const gptScore = Math.min(100, Math.max(0, Number(raw.aiScore) ?? 40));
      const burstinessPenalty = burstiness < 30 ? Math.round((30 - burstiness) * 0.5) : 0;
      // Perplexity penalty: high AI-trigram rate boosts score (Turnitin's predictability signal)
      const perplexityPenalty = perplexity > 40 ? Math.round((perplexity - 40) * 0.25) : 0;
      const blendedScore = Math.min(98, gptScore + burstinessPenalty + perplexityPenalty);

      return {
        score: blendedScore,
        indicators: Array.isArray(raw.indicators) ? raw.indicators : [],
        burstiness,
        stdDev,
        perplexity,
        sentenceScores,
        falsePositiveSuppressed: blendedScore < 20,
        meetsMinimumWordCount,
        bypasserDetected: raw.bypasserDetected === true,
        mode: "blended",
      };
    } catch {
      if (attempt < MAX_RETRIES) continue;
    }
  }

  // Deterministic fallback (no guessing): derive score from burstiness + perplexity only.
  const burstinessContrib = (100 - burstiness) * 0.6;
  const perplexityContrib = perplexity * 0.4;
  const fallbackScore = Math.min(98, Math.max(0, Math.round(burstinessContrib + perplexityContrib)));
  return {
    score: fallbackScore,
    indicators: ["burstiness_perplexity_fallback:model_unavailable"],
    burstiness,
    stdDev,
    perplexity,
    sentenceScores,
    falsePositiveSuppressed: fallbackScore < 20,
    meetsMinimumWordCount,
    mode: "burstiness_fallback",
  };
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
  // ── Slopbuster pre-pass (free, instant, local) ───────────────────────────
  // Strip surface-level AI phrases before the LLM even sees the text.
  // This lets the model focus on deeper statistical fingerprints: perplexity
  // variance, burstiness patterns, and n-gram predictability — not clichés.
  const preCleaned = removeSlopPatterns(text);

  const focusNote =
    passNumber > 1 && indicators.length > 0
      ? `\nFOCUS FOR THIS PASS — these specific AI patterns are still detectable. Fix all of them:\n${indicators.map((i) => `• ${i}`).join("\n")}`
      : "";

  const wordCount = preCleaned.split(/\s+/).filter(Boolean).length;

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

You are the LightSpeed Blader Humanizer. Your SOLE mission: make this text score 0% on Turnitin AI, GPTZero, and Originality.AI — completely undetectable by any detector. This is non-negotiable.

TARGET TONE: ${toneGuide[tone] ?? toneGuide.academic}
WORD COUNT TARGET: ~${wordCount} words (±5%)${focusNote}

━━━ HUMANIZER-X STATISTICAL FINGERPRINT ATTACK (ALL MANDATORY) ━━━

◆ PASS 1 — BURSTINESS INJECTION (Turnitin's #1 signal):
AI text has sentence-length stdDev of 3–6 words. Human text: 8–15. You must achieve 10+.
• Every 400 words MUST contain: ≥3 sentences under 9 words, ≥3 sentences over 32 words
• Open ≥50% of paragraphs with a sub-9-word sentence
• Insert ≥1 sentence fragment (grammatically incomplete, for rhetorical effect) per 300 words
• Break up any 3+ consecutive sentences of similar length — vary aggressively

◆ PASS 2 — PERPLEXITY VARIANCE (GPTZero's primary signal):
AI text has uniformly low perplexity. Human text spikes and dips.
• Every paragraph: mix at least one highly predictable sentence with one genuinely surprising phrasing
• Never use the first or second word that comes to mind for a slot — choose the 3rd or 4th most natural option
• Introduce at least 2 mildly unexpected but semantically correct word choices per 300 words

◆ PASS 3 — N-GRAM DISRUPTION (Originality.AI's signal):
• No 5+ word sequence should follow AI statistical predictions
• Restructure clauses: move adverbials, split compound sentences, invert subject-verb order occasionally
• Replace predictable transitions with mid-sentence connectors: "—and yet", "(though this varies)", "curiously,"

◆ PASS 4 — STRUCTURAL SYMMETRY BREAK (paragraph-level Turnitin signal):
AI paragraphs all follow: claim → evidence → analysis → link. Vary this ruthlessly.
• ≥30% of paragraphs must NOT follow the standard 4-part structure
• Use: question-led paragraphs, concessive openers, mid-paragraph pivots, abrupt one-sentence paragraphs

◆ PASS 5 — VOICE AUTHENTICITY INJECTION:
• Every 200 words: one em dash aside—like this—, one parenthetical, or one rhetorical question
• ≥2 moments of genuine analytical doubt ("the evidence here is less convincing", "one complication arises when…")
• ≥1 direct analytical opinion per 500 words ("the data here points squarely toward X")
• ≥1 mid-sentence self-correction or qualifier per 600 words ("—or rather, what this implies is…")

◆ BANNED PHRASES (absolute zero tolerance — any match is a detection failure):
"delve into", "delve deeper", "delve", "crucial", "pivotal", "underscore", "tapestry",
"multifaceted", "it is worth noting", "it should be noted", "it can be argued",
"it is evident", "it is important to note", "in today's world", "in the realm of",
"navigate the complexities", "shed light on", "nuanced approach", "robust",
"leverage", "synergy", "paradigm shift", "holistic", "seamless", "transformative",
"groundbreaking", "cutting-edge", "state-of-the-art", "furthermore" (as paragraph opener),
"moreover" (as paragraph opener), "additionally" (as paragraph opener),
"in conclusion" (as paragraph opener), "in summary" (as paragraph opener),
"it is clear that", "needless to say", "as previously mentioned", "as noted above"

◆ PRESERVE (non-negotiable):
• All facts, statistics, data points, and conclusions — exact accuracy
• All in-text citations exactly as formatted (Author, Year) / [N] / etc.
• All LaTeX equations ($...$ and $$...$$), markdown headings, and structural formatting
• The original central argument and scope

Return ONLY the humanized text. No preamble, no explanation, no commentary.`,
    messages: [
      {
        role: "user",
        content:
          passNumber === 1
            ? `Apply the full Blader Humanizer protocol to this text:\n\n${preCleaned}`
            : `Re-humanize (Pass ${passNumber}) — fix ALL remaining AI patterns listed above:\n\n${preCleaned}`,
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
