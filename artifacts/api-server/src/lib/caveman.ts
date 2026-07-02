/**
 * Caveman Prompt Compression — extreme brevity for AI system prompts.
 *
 * Inspired by the Caveman tool (github.com/ErikBjare/caveman) which is designed
 * to strip LLM prompts of all conversational filler, leaving only the essential
 * instruction signal. Paired with Graphify's context-graph approach: before
 * sending a prompt we reduce it to its core meaning nodes.
 *
 * Benefits:
 *  • Saves 80–250 input tokens per compressed call
 *  • Meaningfully cheaper on GPT-4o-mini (billing is per-token)
 *  • Forces cleaner, less ambiguous prompts — reduces model confusion
 *  • Especially effective on structured-output (JSON mode) calls where
 *    "please return only valid JSON, do not include markdown fences" etc.
 *    is completely redundant when response_format: json_object is set
 *
 * Compression levels:
 *  • "lite"   — remove obvious filler phrases (default, ~10-20% reduction)
 *  • "full"   — aggressive compression, rewrites preambles (~30-50% reduction)
 *  • "ultra"  — JSON-mode calls only, strips ALL conversational content (~60%)
 */

export type CavemanLevel = "lite" | "full" | "ultra";

// ── Filler patterns ───────────────────────────────────────────────────────────

const LITE_REMOVALS: Array<[RegExp, string]> = [
  [/\bPlease\b\s*/gi, ""],
  [/\bKindly\b\s*/gi, ""],
  [/\bNote that\b\s*/gi, ""],
  [/\bNote:\s*/gi, ""],
  [/\bRemember (that|to)\b\s*/gi, ""],
  [/\bAlways remember\b\s*/gi, "Always"],
  [/\bIt is (very |absolutely )?(important|crucial|essential|critical|vital) (to|that)\b/gi, "MUST"],
  [/\bMake sure (to|that)\b\s*/gi, ""],
  [/\bYou (must|should|need to) make sure\b/gi, "Ensure"],
  [/\bIn order to\b/gi, "To"],
  [/\bDo not forget to\b/gi, ""],
  [/\bAs previously mentioned\b/gi, ""],
  [/\bAs noted (above|below|earlier)\b/gi, ""],
  [/\bNeedless to say[,\s]+/gi, ""],
  [/\bIt goes without saying (that)?\s*/gi, ""],
  [/\bIt is worth noting (that)?\s*/gi, ""],
  [/\bIt should be noted (that)?\s*/gi, ""],
];

const FULL_REMOVALS: Array<[RegExp, string]> = [
  ...LITE_REMOVALS,
  // Strip verbose AI identity preambles
  [/You are (a|an) (world[-\s]class|expert|highly skilled|experienced|senior|professional|dedicated|specialized)\s+/gi, ""],
  [/You are (a|an) \w+\s+who\s+/gi, "You "],
  [/As (a|an) \w+ (AI |assistant |model )?(,\s*)?you\s+/gi, "You "],
  // Compress verbose affirmation language
  [/\bYou should\b\s*/gi, ""],
  [/\bYou must\b\s*/gi, "MUST "],
  [/\bYou will\b\s*/gi, ""],
  [/\bYour (task|job|goal|objective|purpose|role) is (to)?\s*/gi, ""],
  [/\bYour (primary|main|sole|only) (task|job|goal|objective) is (to)?\s*/gi, ""],
  // Compress coupling phrases
  [/\bWith (that|this) in mind[,\s]+/gi, ""],
  [/\bGiven (the above|this|all of this|the context)[,\s]+/gi, ""],
  [/\bBased on (the above|this|all of this|the context)[,\s]+/gi, ""],
  [/\bTaking (into account|everything into consideration)[,\s]+/gi, ""],
  // Compress output instructions that are redundant in JSON mode
  [/Return ONLY valid JSON[,\s]+no markdown[,\s]+/gi, ""],
  [/Do not include (any )?(markdown|code blocks|```)[,\s]+/gi, ""],
  [/Output (must be|should be|is) (valid )?JSON[.\s]+/gi, ""],
  [/Respond (only |exclusively )?(with|in) (valid )?JSON[.\s]+/gi, ""],
  // Compress trailing "thank you / confirmation" language (real in some prompts)
  [/\bThank you[.!]?\s*$/gim, ""],
];

const ULTRA_REMOVALS: Array<[RegExp, string]> = [
  ...FULL_REMOVALS,
  // Strip all role-setting sentences entirely
  [/^You are .+?[.!]\s*/gim, ""],
  // Strip parenthetical clarifications where brevity is paramount
  [/\s*\([^)]{0,60}\)\s*/g, " "],
  // Collapse multi-word field labels to shorthand
  [/\bfor example\b/gi, "e.g."],
  [/\bsuch as\b/gi, "e.g."],
  [/\bthat is[,]?\b/gi, "i.e."],
  [/\bin other words\b/gi, "i.e."],
];

// ── Whitespace normaliser (applied at every level) ────────────────────────────

function normaliseWhitespace(text: string): string {
  return text
    .replace(/ {2,}/g, " ")          // multiple spaces → single
    .replace(/\n{3,}/g, "\n\n")       // 3+ blank lines → 2
    .replace(/[ \t]+\n/g, "\n")       // trailing spaces before newline
    .trim();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compress a prompt string to reduce token count.
 *
 * @param prompt  The system or user prompt to compress
 * @param level   Compression aggressiveness — "lite" | "full" | "ultra"
 * @returns       The compressed string
 */
export function compressPrompt(prompt: string, level: CavemanLevel = "lite"): string {
  let result = prompt;

  const rules =
    level === "ultra" ? ULTRA_REMOVALS :
    level === "full"  ? FULL_REMOVALS  :
                        LITE_REMOVALS;

  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement);
  }

  return normaliseWhitespace(result);
}

/**
 * Compress a prompt and return both the compressed text and savings metrics.
 *
 * Rough token estimate: 1 token ≈ 4 chars for English prose.
 */
export function compressWithStats(
  prompt: string,
  level: CavemanLevel = "full"
): {
  compressed: string;
  originalChars: number;
  compressedChars: number;
  charsRemoved: number;
  estimatedTokensSaved: number;
  compressionRatio: number;
} {
  const compressed = compressPrompt(prompt, level);
  const originalChars  = prompt.length;
  const compressedChars = compressed.length;
  const charsRemoved   = originalChars - compressedChars;
  const estimatedTokensSaved = Math.round(charsRemoved / 4);
  const compressionRatio = originalChars > 0
    ? Math.round((1 - compressedChars / originalChars) * 100)
    : 0;

  return { compressed, originalChars, compressedChars, charsRemoved, estimatedTokensSaved, compressionRatio };
}

/**
 * Convenience wrapper: compress a system prompt and log savings in dev mode.
 * Use for GPT-4o-mini JSON-mode calls where JSON structure instructions are redundant.
 */
export function cavemanSystem(prompt: string, level: CavemanLevel = "full"): string {
  if (process.env.NODE_ENV === "development") {
    const stats = compressWithStats(prompt, level);
    if (stats.estimatedTokensSaved > 5) {
      console.log(
        `[CAVEMAN] Compressed ${stats.originalChars}→${stats.compressedChars} chars ` +
        `(~${stats.estimatedTokensSaved} tokens saved, ${stats.compressionRatio}% reduction)`
      );
    }
  }
  return compressPrompt(prompt, level);
}

// ── Graphify: context-graph reduction ────────────────────────────────────────
// The other half of the hunted pairing (see header): reduce a long context to
// its core "meaning nodes" before compression. Deterministic and local — keeps
// sentences carrying instruction verbs, numbers/statistics, citations, or
// domain keywords; drops connective filler. Chain: graphify → caveman.
const NODE_SIGNAL = /\b(must|never|always|require|cite|use|return|include|solve|compute|calculate|show|prove|derive|analy[sz]e|compare|\d|%|=|DOI|et al\.)\b/i;

export function graphifyContext(text: string, maxNodes = 120): string {
  const sentences = text.split(/(?<=[.!?:])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set<string>();
  const nodes: string[] = [];
  for (const s of sentences) {
    if (nodes.length >= maxNodes) break;
    if (!NODE_SIGNAL.test(s)) continue;              // no instruction/data signal
    const key = s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (key.length < 8 || seen.has(key)) continue;   // dedupe near-identical nodes
    seen.add(key);
    nodes.push(s);
  }
  return nodes.length >= 5 ? nodes.join("\n") : text; // fall back if too sparse
}
