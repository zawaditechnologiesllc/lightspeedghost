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

Respond in EXACTLY this format:
ERRORS_FOUND: [yes/no]
CORRECTIONS: [list each error with its fix, one per line — or write "none" if perfect]
VERIFIED_ANSWER: [Complete corrected solution with LaTeX, or repeat original if correct]
VERIFIED_LATEX: [Single-line LaTeX of the final result]`;

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
    model: "claude-3-5-haiku-20241022",
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
    "claude-3-5-haiku-20241022",
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
  const verified = verifiedMatch ? verifiedMatch[1].trim() : draft.finalAnswer;

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
