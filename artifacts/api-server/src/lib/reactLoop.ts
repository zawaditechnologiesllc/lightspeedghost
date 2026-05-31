/**
 * ReAct (Reasoning and Acting) Loop — OpenClaw Pi Engine pattern.
 * Implements: Think → Act → Observe → Reflect → Final Answer
 *
 * Uses Claude streaming API so tokens flow continuously through the SSE
 * connection — prevents proxy timeouts on long/hard problems.
 */

import { anthropic } from "./ai";
import { STEM_SOUL } from "./soul";
import { recordUsage } from "./apiCost";

export interface ReActStep {
  stepNumber: number;
  description: string;
  expression: string;
  explanation: string;
  type: "thought" | "action" | "observation" | "final";
}

export interface ReActResult {
  steps: ReActStep[];
  finalAnswer: string;
  latex: string;
  confidence: number;
  rawText: string;
}

const REACT_SYSTEM = `${STEM_SOUL}

You MUST structure your response using the ReAct framework with EXACTLY this format:

THOUGHT 1: [Understand the problem — identify knowns, unknowns, and what's being asked]
ACTION 1: [Choose the solution strategy and relevant formulas/theorems]
OBSERVATION 1: [What the strategy immediately tells us; setup the equations]
THOUGHT 2: [Work through the math step by step with full LaTeX notation]
ACTION 2: [Execute the calculation — show ALL intermediate steps in LaTeX]
OBSERVATION 2: [Verify: check units, magnitude, physical reasonableness]
THOUGHT 3: [Self-check — any errors? Are there edge cases or alternative interpretations?]
FINAL ANSWER: [Complete solution with the numerical/symbolic result in LaTeX]
CONFIDENCE: [0-100 integer, honest assessment of solution correctness]
LATEX_SUMMARY: [Single-line LaTeX of the key result only, e.g. $$v = 9.8 \\text{ m/s}$$]`;

/**
 * Solve a STEM problem using the ReAct reasoning framework.
 *
 * @param onToken        Optional callback invoked for every streaming token — use
 *                       this to forward tokens through an SSE connection so the
 *                       connection is never idle during long AI calls.
 * @param academicContext Pre-fetched paper abstracts to inject as RAG context,
 *                       grounding the model in real peer-reviewed material.
 */
export async function reactSolve(
  problem: string,
  subject: string,
  onToken?: (chunk: string) => void,
  academicContext?: string,
): Promise<ReActResult> {
  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  const userContent = academicContext
    ? `ACADEMIC REFERENCE CONTEXT (peer-reviewed abstracts — use these to ground your reasoning):\n\n${academicContext}\n\n---\n\nNow solve this ${subject} problem using the ReAct framework, referencing the above context where relevant:\n\n${problem}`
    : `Solve this ${subject} problem using the ReAct framework:\n\n${problem}`;

  await anthropic.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: REACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
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
    "claude-sonnet-4-5",
    inputTokens,
    outputTokens,
    `react-stem-${subject}`,
  );

  return parseReActText(fullText);
}

function parseReActText(text: string): ReActResult {
  const steps: ReActStep[] = [];
  let stepNum = 0;

  const thoughtRe =
    /THOUGHT \d+:\s*([\s\S]*?)(?=ACTION \d+:|OBSERVATION \d+:|THOUGHT \d+:|FINAL ANSWER:|$)/g;
  const actionRe =
    /ACTION \d+:\s*([\s\S]*?)(?=OBSERVATION \d+:|THOUGHT \d+:|ACTION \d+:|FINAL ANSWER:|$)/g;
  const observationRe =
    /OBSERVATION \d+:\s*([\s\S]*?)(?=THOUGHT \d+:|ACTION \d+:|OBSERVATION \d+:|FINAL ANSWER:|$)/g;

  for (const m of text.matchAll(thoughtRe)) {
    steps.push({
      stepNumber: ++stepNum,
      description: "Reasoning",
      expression: "",
      explanation: m[1].trim(),
      type: "thought",
    });
  }
  for (const m of text.matchAll(actionRe)) {
    steps.push({
      stepNumber: ++stepNum,
      description: "Action",
      expression: extractLatex(m[1]),
      explanation: m[1].trim(),
      type: "action",
    });
  }
  for (const m of text.matchAll(observationRe)) {
    steps.push({
      stepNumber: ++stepNum,
      description: "Observation",
      expression: extractLatex(m[1]),
      explanation: m[1].trim(),
      type: "observation",
    });
  }

  steps.sort((a, b) => {
    const posA = text.indexOf(a.explanation.slice(0, 30));
    const posB = text.indexOf(b.explanation.slice(0, 30));
    return posA - posB;
  });
  steps.forEach((s, i) => {
    s.stepNumber = i + 1;
  });

  const finalMatch = text.match(
    /FINAL ANSWER:\s*([\s\S]*?)(?=CONFIDENCE:|LATEX_SUMMARY:|$)/,
  );
  const finalAnswer = finalMatch ? finalMatch[1].trim() : text;

  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
  const confidence = confidenceMatch
    ? Math.min(parseInt(confidenceMatch[1]) / 100, 1.0)
    : 0.9;

  const latexMatch = text.match(/LATEX_SUMMARY:\s*([\s\S]+?)$/);
  const latex = latexMatch ? latexMatch[1].trim() : `\\text{See solution above}`;

  steps.push({
    stepNumber: steps.length + 1,
    description: "Final Answer",
    expression: extractLatex(finalAnswer),
    explanation: finalAnswer,
    type: "final",
  });

  return { steps, finalAnswer, latex, confidence, rawText: text };
}

function extractLatex(text: string): string {
  const blockMatch = text.match(/\$\$([\s\S]+?)\$\$/);
  if (blockMatch) return `$$${blockMatch[1]}$$`;
  const inlineMatch = text.match(/\$([\s\S]+?)\$/);
  if (inlineMatch) return `$${inlineMatch[1]}$`;
  return text.slice(0, 100);
}
