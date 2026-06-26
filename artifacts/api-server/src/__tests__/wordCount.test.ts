/**
 * Word Count Enforcement Tests — Issue #4 / Issue #5
 *
 * Validates:
 * 1. computeBodyWordCount excludes references, citations, headings, footnotes, endnotes
 * 2. ±10% tolerance enforcement across paper types
 * 3. Outline section targets sum within tolerance
 */

import { describe, it, expect } from "vitest";

// ── Inline copy of computeBodyWordCount (mirrors the production function) ──────
// Tests run without the full Express server, so we inline the function here.
// Any change to the production version in writing.ts must be mirrored here.

function computeBodyWordCount(content: string): number {
  const withoutRefs = content.replace(/^#{1,3}\s*(references?|bibliography|works?\s*cited|further\s*reading|reference\s*list)\b[\s\S]*/im, "");
  const withoutFootnoteDefs = withoutRefs.replace(/^\[\^[^\]]+\]:[^\n]*/gm, "");
  const withoutFootnoteRefs = withoutFootnoteDefs.replace(/\[\^[^\]]+\]|\^[\d]+/g, "");
  const withoutCitations = withoutFootnoteRefs
    .replace(/\[[\d,;\s–-]+\]/g, "")
    .replace(/\([A-Z][A-Za-z\s&.,]+(?:et\s+al\.?)?,?\s*\d{4}[a-z]?(?:,\s*pp?\.?\s*[\d–-]+)?\)/g, "")
    .replace(/\([A-Z][A-Za-z\s&.,]+\d{4}[a-z]?\)/g, "");
  const clean = withoutCitations
    .replace(/^#+\s*.*/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/```[\s\S]*?```/gm, "")
    .replace(/\$\$[\s\S]*?\$\$/gm, "")
    .replace(/\$[^$\n]+\$/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/^\|[-:| ]+\|$/gm, "")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/^\s*\*\*?(figure|fig\.?|table|appendix)\s+[\d.]+[^*]*\*?\*?/gim, "")
    .replace(/^\s*\*\*?abstract\*?\*?$/gim, "");
  return clean.split(/\s+/).filter((w) => w.trim().length > 0).length;
}

function withinTolerance(actual: number, target: number, pct = 10): boolean {
  const min = Math.floor(target * (1 - pct / 100));
  const max = Math.ceil(target * (1 + pct / 100));
  return actual >= min && actual <= max;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateWords(n: number, word = "word"): string {
  return Array(n).fill(word).join(" ");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeBodyWordCount", () => {
  it("counts plain body words correctly", () => {
    const content = generateWords(1000);
    expect(computeBodyWordCount(content)).toBe(1000);
  });

  it("excludes the references section", () => {
    const body = generateWords(1000);
    const content = `${body}\n\n## References\n\nSmith, J. (2020). A study. Journal, 1(1), 1–10.\nJones, B. (2021). Another study.`;
    const count = computeBodyWordCount(content);
    expect(count).toBe(1000);
  });

  it("excludes bibliography section", () => {
    const body = generateWords(500);
    const content = `${body}\n\n# Bibliography\n\nSome ref text here with more words.`;
    expect(computeBodyWordCount(content)).toBe(500);
  });

  it("excludes inline APA citations from count", () => {
    // Body = "The evidence suggests this is true" (6 words) + 99 filler = 105
    // body words. The APA citation "(Smith, 2020, pp. 45–50)" must contribute
    // nothing; a lone "." left where it was removed may be tokenised, so the
    // count lands at 105–106. (If the citation were NOT excluded its 4 tokens
    // would push the count to ~109, which this range rejects.)
    const content = "The evidence suggests this is true (Smith, 2020, pp. 45–50). " + generateWords(99);
    const count = computeBodyWordCount(content);
    expect(count).toBeGreaterThanOrEqual(105);
    expect(count).toBeLessThanOrEqual(106);
  });

  it("excludes numbered citation brackets [1], [2,3]", () => {
    const content = generateWords(200) + " [1] [2] [3,4] [5–7]";
    expect(computeBodyWordCount(content)).toBe(200);
  });

  it("excludes Markdown headings", () => {
    const content = `# Introduction\n\n${generateWords(300)}\n\n## Methodology\n\n${generateWords(200)}`;
    expect(computeBodyWordCount(content)).toBe(500);
  });

  it("excludes Markdown footnote definitions ([^1]: text)", () => {
    const body = generateWords(400);
    const footnotes = "[^1]: This is a footnote with many extra words that should not be counted.\n[^2]: Another footnote here.";
    const content = `${body}\n\n${footnotes}`;
    expect(computeBodyWordCount(content)).toBe(400);
  });

  it("excludes footnote references in-text ([^1])", () => {
    const content = generateWords(300) + " [^1] [^2] [^note]";
    expect(computeBodyWordCount(content)).toBe(300);
  });

  it("excludes LaTeX equations", () => {
    const content = generateWords(200) + " $$E = mc^2$$ " + generateWords(200);
    expect(computeBodyWordCount(content)).toBeLessThanOrEqual(402);
    expect(computeBodyWordCount(content)).toBeGreaterThanOrEqual(398);
  });

  it("excludes table rows", () => {
    const body = generateWords(500);
    const table = "| Col1 | Col2 |\n|------|------|\n| val1 | val2 |\n| val3 | val4 |";
    expect(computeBodyWordCount(body + "\n\n" + table)).toBe(500);
  });

  it("correctly handles large footnote sections without counting them", () => {
    const body = generateWords(2000);
    const bigFootnote = "[^1]: " + generateWords(500, "footnote");
    const refs = "## References\n\n" + generateWords(300, "refword");
    const content = `${body}\n\n${bigFootnote}\n\n${refs}`;
    expect(computeBodyWordCount(content)).toBe(2000);
  });
});

describe("withinTolerance (±10%)", () => {
  it("accepts a count exactly at target", () => {
    expect(withinTolerance(1000, 1000)).toBe(true);
  });

  it("accepts a count 10% below target", () => {
    expect(withinTolerance(900, 1000)).toBe(true);
  });

  it("accepts a count 10% above target", () => {
    expect(withinTolerance(1100, 1000)).toBe(true);
  });

  it("rejects a count more than 10% below target", () => {
    expect(withinTolerance(899, 1000)).toBe(false);
  });

  it("rejects a count more than 10% above target", () => {
    expect(withinTolerance(1101, 1000)).toBe(false);
  });

  it("works for common paper word counts: 500", () => {
    expect(withinTolerance(460, 500)).toBe(true);
    expect(withinTolerance(540, 500)).toBe(true);
    expect(withinTolerance(449, 500)).toBe(false);
  });

  it("works for common paper word counts: 2500", () => {
    expect(withinTolerance(2250, 2500)).toBe(true);
    expect(withinTolerance(2749, 2500)).toBe(true);
  });
});

describe("outline word count distribution", () => {
  function mockSectionPlan(totalWords: number): { name: string; targetWords: number }[] {
    const pcts = [0.10, 0.20, 0.30, 0.25, 0.15];
    return pcts.map((pct, i) => ({ name: `Section ${i + 1}`, targetWords: Math.ceil(totalWords * pct) }));
  }

  it("section targets sum within ±10% of total for 1000 words", () => {
    const total = 1000;
    const sections = mockSectionPlan(total);
    const sectionSum = sections.reduce((s, sec) => s + sec.targetWords, 0);
    expect(withinTolerance(sectionSum, total)).toBe(true);
  });

  it("section targets sum within ±10% of total for 4000 words", () => {
    const total = 4000;
    const sections = mockSectionPlan(total);
    const sectionSum = sections.reduce((s, sec) => s + sec.targetWords, 0);
    expect(withinTolerance(sectionSum, total)).toBe(true);
  });
});
