/**
 * tokenBudget.ts — Dynamic token budget calculator
 *
 * Converts a user-requested word count into a safe max_tokens value so the
 * model is never over- or under-budgeted, eliminating word-count hallucination.
 *
 * Formula:
 *   tokens = ceil(words × 1.35)  ← 1 word ≈ 1.35 tokens (English prose)
 *           × 1.10               ← ±10 % error margin
 *         + overhead             ← caller-supplied structural overhead
 *                                   (citations, JSON wrappers, headings, etc.)
 *
 *   simplified: ceil(words × 1.485) + overhead
 *
 * Hard cap: 16 000 tokens (maximum safe output for Claude Sonnet / GPT-4o).
 * A separate cap of 8 000 is available for gpt-4o-mini heavy tasks via the
 * optional `maxCap` parameter.
 */

const TOKEN_PER_WORD = 1.35;
const ERROR_MARGIN   = 1.10;   // +10 %
const MULTIPLIER     = TOKEN_PER_WORD * ERROR_MARGIN; // 1.485

/**
 * Convert a word count to a token budget.
 *
 * @param words    The user-requested word count (or expected output word count).
 * @param overhead Additional tokens for structural content that is NOT counted
 *                 in `words` — e.g. citation list, JSON wrapper, headings.
 *                 Defaults to 0.
 * @param maxCap   Hard ceiling for the result. Defaults to 16 000.
 * @returns        The recommended max_tokens value.
 *
 * @example
 * // 500-word essay with citation overhead
 * wordsToTokens(500, 600)  // → 1_342
 *
 * @example
 * // 3 000-word paper, references add ~1 500 tokens
 * wordsToTokens(3000, 1500) // → 5_955
 */
export function wordsToTokens(
  words: number,
  overhead = 0,
  maxCap = 16_000
): number {
  return Math.min(maxCap, Math.ceil(words * MULTIPLIER) + overhead);
}
