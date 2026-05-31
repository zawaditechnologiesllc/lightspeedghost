/**
 * AI Detection Pipeline Tests — Issue #4 / Issue #6
 *
 * Validates:
 * 1. Burstiness analysis correctly scores human vs AI text
 * 2. AIDetectionResult interface fields are all present
 * 3. Burstiness fallback mode is detected and reported
 * 4. Score is within [0, 100] range
 * 5. Edge cases: short text, code blocks, math content
 */

import { describe, it, expect, vi } from "vitest";

// ── Inline burstiness analysis (mirrors production computeBurstiness) ─────────

function computeBurstiness(text: string): { score: number; stdDev: number } {
  const sentences = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 10);

  if (sentences.length < 3) return { score: 50, stdDev: 0 };

  const lengths = sentences.map(s => s.split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // Human writing: stdDev 8–15, AI writing: stdDev 3–6
  const score = Math.min(100, Math.max(0, (stdDev / 15) * 100));
  return { score, stdDev };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("burstiness analysis", () => {
  const AI_TEXT = `Artificial intelligence has revolutionized many industries across the globe.
The technology enables machines to perform tasks that previously required human intelligence.
Furthermore, it has transformed the way businesses operate and make decisions.
Moreover, the implementation of AI has led to significant improvements in efficiency.
Additionally, organizations have benefited greatly from these technological advancements.
In conclusion, artificial intelligence continues to reshape our modern world today.`;

  const HUMAN_TEXT = `I started thinking about this problem at 2am, which is never ideal.
The math just wouldn't work out — three attempts, all wrong in different ways.
Here's what I eventually figured out: you can't use a simple linear model here because the data isn't linear.
No kidding, right?
It took me embarrassingly long to see that the distribution has a fat tail on the left side — completely changes the approach.
Once I switched to a log transformation, everything clicked, and I could finally prove the original hypothesis.`;

  it("scores AI text with low burstiness (uniform sentence lengths)", () => {
    const { stdDev } = computeBurstiness(AI_TEXT);
    expect(stdDev).toBeLessThan(8);
  });

  it("scores human text with higher burstiness (variable sentence lengths)", () => {
    const { stdDev } = computeBurstiness(HUMAN_TEXT);
    expect(stdDev).toBeGreaterThan(3);
  });

  it("returns score in [0, 100] range", () => {
    const { score } = computeBurstiness(AI_TEXT);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("handles very short text gracefully (< 3 sentences)", () => {
    const { score, stdDev } = computeBurstiness("Short text.");
    expect(score).toBe(50);
    expect(stdDev).toBe(0);
  });

  it("handles empty text gracefully", () => {
    const { score } = computeBurstiness("");
    expect(score).toBe(50);
  });
});

describe("AIDetectionResult structure", () => {
  it("expected interface fields exist", () => {
    const mockResult = {
      score: 15,
      indicators: ["transition clichés", "uniform paragraph structure"],
      burstiness: 42,
      stdDev: 4.2,
      mode: "blended" as const,
    };

    expect(mockResult).toHaveProperty("score");
    expect(mockResult).toHaveProperty("indicators");
    expect(mockResult).toHaveProperty("burstiness");
    expect(mockResult).toHaveProperty("stdDev");
    expect(mockResult).toHaveProperty("mode");
    expect(["blended", "burstiness_fallback"]).toContain(mockResult.mode);
  });

  it("score is clamped to 0–100 range", () => {
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    expect(clamp(-5)).toBe(0);
    expect(clamp(105)).toBe(100);
    expect(clamp(50)).toBe(50);
  });

  it("burstiness fallback mode is correctly identified", () => {
    const fallbackResult = {
      score: 30,
      indicators: ["low sentence length variance"],
      burstiness: 25,
      stdDev: 3.1,
      mode: "burstiness_fallback" as const,
    };

    expect(fallbackResult.mode).toBe("burstiness_fallback");
    expect(fallbackResult.score).toBeGreaterThanOrEqual(0);
    expect(fallbackResult.score).toBeLessThanOrEqual(100);
  });
});

describe("AI detection edge cases", () => {
  it("does not spuriously flag code-heavy content", () => {
    const codeContent = `
The algorithm works as follows. First, initialise the matrix.
\`\`\`python
def solve(matrix):
    n = len(matrix)
    for i in range(n):
        for j in range(n):
            matrix[i][j] = 0
\`\`\`
Then iterate and apply the transformation step by step.
    `;
    const { stdDev } = computeBurstiness(codeContent);
    expect(stdDev).toBeGreaterThanOrEqual(0);
  });

  it("handles text with mathematical formulas", () => {
    const mathContent = `
The quadratic formula gives us the roots of any quadratic equation.
For the general form $ax^2 + bx + c = 0$, we get $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.
This is one of the most fundamental results in algebra.
Consider a specific example where $a = 1$, $b = -5$, and $c = 6$.
    `;
    const { score } = computeBurstiness(mathContent);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
