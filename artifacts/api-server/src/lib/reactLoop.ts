/**
 * ReAct (Reasoning and Acting) Loop — OpenClaw Pi Engine pattern.
 * Implements: Think → Act → Observe → Reflect → Final Answer
 * Used for STEM problem solving to eliminate one-shot math errors.
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

export async function reactSolve(
  problem: string,
  subject: string
): Promise<ReActResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    system: REACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Solve this ${subject} problem using the ReAct framework:\n\n${problem}`,
      },
    ],
  });

  const usage = response.usage;
  recordUsage("claude-sonnet-4-5", usage.input_tokens, usage.output_tokens, `react-stem-${subject}`);

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  const steps: ReActStep[] = [];
  let stepNum = 0;

  const thoughtRe = /THOUGHT \d+:\s*([\s\S]*?)(?=ACTION \d+:|OBSERVATION \d+:|THOUGHT \d+:|FINAL ANSWER:|$)/g;
  const actionRe = /ACTION \d+:\s*([\s\S]*?)(?=OBSERVATION \d+:|THOUGHT \d+:|ACTION \d+:|FINAL ANSWER:|$)/g;
  const observationRe = /OBSERVATION \d+:\s*([\s\S]*?)(?=THOUGHT \d+:|ACTION \d+:|OBSERVATION \d+:|FINAL ANSWER:|$)/g;

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

  // Sort steps roughly in order they appear in the text
  steps.sort((a, b) => {
    const posA = text.indexOf(a.explanation.slice(0, 30));
    const posB = text.indexOf(b.explanation.slice(0, 30));
    return posA - posB;
  });

  // Re-number sequentially
  steps.forEach((s, i) => { s.stepNumber = i + 1; });

  const finalMatch = text.match(/FINAL ANSWER:\s*([\s\S]*?)(?=CONFIDENCE:|LATEX_SUMMARY:|$)/);
  const finalAnswer = finalMatch ? finalMatch[1].trim() : text;

  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/);
  const confidence = confidenceMatch ? Math.min(parseInt(confidenceMatch[1]) / 100, 1.0) : 0.9;

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
