/**
 * Wolfram Alpha API Integration for STEM Accuracy
 *
 * Wolfram Alpha (wolfram.com/api) provides mathematically-verified, step-by-step
 * solutions for algebra, calculus, statistics, physics, chemistry, and more.
 * The attached asset recommends connecting STEM queries to Wolfram to ensure
 * "100% accuracy on complex math and physics."
 *
 * API plan:
 *  • Simple API   (free, 2000 req/month):  Returns a short plaintext result
 *  • Full Results (paid):                  Returns step-by-step pods
 *
 * We use the Simple API + Short Answers API (both free), and format the
 * result to inject into the Claude STEM prompt as a "verified computation."
 *
 * Setup: set WOLFRAM_APP_ID environment variable.
 * Get a free Developer API key at: https://developer.wolframalpha.com/
 */

const WOLFRAM_APP_ID = process.env.WOLFRAM_APP_ID ?? "";

export interface WolframResult {
  query: string;
  answer: string;
  podTitle?: string;
  steps?: string[];
  available: boolean;
  source: "wolfram-alpha" | "unavailable";
}

// ── Query classifier ──────────────────────────────────────────────────────────
// Only route computationally verifiable queries to Wolfram.
// Conceptual / essay questions should go directly to Claude.

const WOLFRAM_KEYWORDS = [
  /\bsolve\b/i,
  /\bintegrat(e|ion)\b/i,
  /\bdifferentiat(e|ion)\b/i,
  /\bderivative\b/i,
  /\blimit\b/i,
  /\beigenvalue\b/i,
  /\bmatrix\b/i,
  /\bequation\b/i,
  /\bfactor\b/i,
  /\bexpand\b/i,
  /\bsimplify\b/i,
  /\bcalculate\b/i,
  /\bcompute\b/i,
  /\bsum of\b/i,
  /\bseries\b/i,
  /\bprob(ability)?\b/i,
  /\bstatistic(s|al)?\b/i,
  /\bmean\b/i,
  /\bvariance\b/i,
  /\bstandard deviation\b/i,
  /\bregression\b/i,
  /=\s*\?/,              // "x = ?"
  /\d+\s*[\+\-\*\/\^]\s*\d+/, // arithmetic expressions
  /[a-z]\s*=\s*[\d\(]/i, // variable assignments
];

export function isWolframEligible(query: string): boolean {
  if (!WOLFRAM_APP_ID) return false;
  return WOLFRAM_KEYWORDS.some(p => p.test(query));
}

// ── Simple API caller ─────────────────────────────────────────────────────────

async function callSimpleApi(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      appid: WOLFRAM_APP_ID,
      i: query,
      timeout: "8",
    });
    const resp = await fetch(`https://api.wolframalpha.com/v1/result?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.toLowerCase().includes("wolfram alpha did not understand")) return null;
    return text.trim();
  } catch {
    return null;
  }
}

// ── Short Answers API caller ──────────────────────────────────────────────────
// Same as Simple but asks for a more concise answer, lower timeout.

async function callShortApi(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      appid: WOLFRAM_APP_ID,
      i: query,
      output: "plaintext",
    });
    const resp = await fetch(`https://api.wolframalpha.com/v1/spoken?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.toLowerCase().includes("wolfram alpha did not understand")) return null;
    return text.trim();
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Query Wolfram Alpha for a mathematically-verified answer.
 *
 * Returns null-safe: if the API key is missing or the query fails,
 * returns { available: false } so callers can gracefully skip the check.
 */
export async function queryWolfram(query: string): Promise<WolframResult> {
  if (!WOLFRAM_APP_ID) {
    return {
      query,
      answer: "",
      available: false,
      source: "unavailable",
    };
  }

  // Try Simple API first, fall back to Short Answers
  const answer = await callSimpleApi(query) ?? await callShortApi(query);

  if (!answer) {
    return { query, answer: "", available: false, source: "unavailable" };
  }

  return {
    query,
    answer,
    available: true,
    source: "wolfram-alpha",
  };
}

/**
 * Build a Wolfram Alpha verification block to inject into STEM prompts.
 * Returns empty string if Wolfram is unavailable or query not eligible.
 *
 * Usage:
 *   const wolframBlock = await buildWolframContext(userProblem);
 *   systemPrompt += wolframBlock;
 */
export async function buildWolframContext(problem: string): Promise<string> {
  if (!isWolframEligible(problem)) return "";

  // Trim to a clean single-line query (Wolfram does best with concise inputs)
  const query = problem
    .replace(/\n+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .slice(0, 200);

  const result = await queryWolfram(query);

  if (!result.available) return "";

  return `\n\nWOLFRAM ALPHA VERIFIED COMPUTATION:
Query: "${result.query}"
Result: ${result.answer}

INSTRUCTION: The Wolfram Alpha result above is mathematically verified. Your final numerical answer MUST match this result exactly. If your working leads to a different answer, recheck your algebra before presenting the final result.`;
}

/**
 * Status check — returns whether Wolfram Alpha is configured and available.
 */
export function wolframStatus(): { configured: boolean; appId: string | null } {
  return {
    configured: Boolean(WOLFRAM_APP_ID),
    appId: WOLFRAM_APP_ID ? `${WOLFRAM_APP_ID.slice(0, 4)}****` : null,
  };
}
