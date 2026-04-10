/**
 * Chain-of-Verification (CoVe) — OpenClaw Self-Correction Loop.
 * Pattern: Draft → Critic Agent → Verified Final Answer
 *
 * Uses Claude Haiku with streaming so tokens flow continuously through the
 * SSE connection — prevents proxy timeouts and gives faster CoVe results.
 */

import { anthropic } from "./ai";
import { STEM_SOUL } from "./soul";
import { recordUsage } from "./apiCost";
import type { ReActResult } from "./reactLoop";

export interface CoveResult {
  draft: string;
  corrections: string[];
  verified: string;
  passedVerification: boolean;
  verifiedLatex: string;
}

const CRITIC_SYSTEM = `${STEM_SOUL}

You are the CRITIC AGENT. Your ONLY job is to find errors in a solution.
Be ruthlessly precise. Check:
1. Mathematical/arithmetic errors (wrong signs, wrong operations)
2. Unit conversion errors or missing units
3. Wrong formula applied for the context
4. Logical reasoning gaps
5. Conceptual misunderstandings

Respond in EXACTLY this format with NO extra text, headers, commentary, or sections outside these four fields:

ERRORS_FOUND: [yes/no]
CORRECTIONS: [list each error with its fix, one per line — or write "none" if no errors]
VERIFIED_ANSWER: [The complete final solution text with LaTeX math. This field must contain ONLY the solution — no critic notes, no verification commentary, no "Critic Agent" text, no section headers, no explanations about what you checked.]
VERIFIED_LATEX: [Single-line LaTeX of the final result only]

IMPORTANT: Do NOT add any text after VERIFIED_LATEX. Do NOT add "DETAILED VERIFICATION", "Critic Agent fixed", or any other sections. The four fields above are the complete response.`;

/**
 * Run Chain-of-Verification on a ReAct solution draft.
 *
 * @param onToken  Optional callback invoked for every streaming token — use
 *                 to forward tokens through an SSE connection so it stays alive.
 */
export async function chainOfVerification(
  problem: string,
  subject: string,
  draft: ReActResult,
  onToken?: (chunk: string) => void,
): Promise<CoveResult> {
  const critiquePrompt = `Problem: ${problem}

Draft Solution:
${draft.finalAnswer}

Full working:
${draft.rawText.slice(0, 2000)}

Critically verify this ${subject} solution for any errors.`;

  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  await anthropic.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 1500,
    system: CRITIC_SYSTEM,
    messages: [{ role: "user", content: critiquePrompt }],
  })
    .on("text", (text) => {
      fullText += text;
      onToken?.(text);
    })
    .on("message", (msg) => {
      inputTokens = msg.usage.input_tokens;
      outputTokens = msg.usage.output_tokens;
    })
    .finalMessage();

  recordUsage(
    "claude-haiku-4-5",
    inputTokens,
    outputTokens,
    `cove-critique-${subject}`,
  );

  const text = fullText;

  const errorsFound = /ERRORS_FOUND:\s*yes/i.test(text);

  const correctionsMatch = text.match(
    /CORRECTIONS:\s*([\s\S]*?)(?=VERIFIED_ANSWER:|$)/,
  );
  const correctionsRaw = correctionsMatch
    ? correctionsMatch[1].trim()
    : "none";
  const corrections =
    correctionsRaw.toLowerCase() === "none"
      ? []
      : correctionsRaw
          .split(/\n/)
          .map((l) => l.replace(/^[-•*]\s*/, "").trim())
          .filter((l) => l.length > 0);

  const verifiedMatch = text.match(
    /VERIFIED_ANSWER:\s*([\s\S]*?)(?=VERIFIED_LATEX:|$)/,
  );
  const rawVerified = verifiedMatch ? verifiedMatch[1].trim() : draft.finalAnswer;

  // Strip critic commentary that sometimes leaks into the VERIFIED_ANSWER block.
  // Handles: leading critic text (no preceding newline), mid-block leakage, separators.
  const criticNoisePattern = /(?:^|\n)[ \t]*(?:---+|\*{0,3}Critic Agent\b|##\s*DETAILED VERIFICATION\b|DETAILED VERIFICATION\b)/i;
  const noiseIdx = rawVerified.search(criticNoisePattern);
  const verified = noiseIdx !== -1 ? rawVerified.slice(0, noiseIdx).trim() : rawVerified;

  const latexMatch = text.match(/VERIFIED_LATEX:\s*([\s\S]+?)$/);
  const verifiedLatex = latexMatch ? latexMatch[1].trim() : draft.latex;

  return {
    draft: draft.finalAnswer,
    corrections,
    verified,
    passedVerification: !errorsFound,
    verifiedLatex,
  };
}
