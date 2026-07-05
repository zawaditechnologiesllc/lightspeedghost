// ── Academic Integrity & EU AI Act Compliance Checker ────────────────────────

// Ordered MOST-SPECIFIC → GENERIC on purpose: a generic pattern (e.g. bare
// "cheat") must never fire before a longer phrase that contains it (e.g.
// "contract cheating" or "cheating detector"), or it mangles the longer phrase.
// Replacements are chosen to be grammatically self-contained — they read
// acceptably as a drop-in for the matched span (verb phrase for verb spans,
// noun phrase for noun spans) so sanitising never leaves a broken sentence like
// "...guarantees your work will improve writing quality for...".
const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  // ── specific multi-word phrases first ──
  { pattern: /\bcontract\s+cheat(?:ing)?\b/gi, replacement: "paying someone to write your work", label: "“contract cheating”" },
  { pattern: /\bcheat(?:ing)?\s+detector\b/gi, replacement: "writing-quality checker", label: "“cheating detector”" },
  { pattern: /\bturnitin\s+bypass\b/gi, replacement: "writing-quality improvement", label: "“Turnitin bypass”" },
  { pattern: /\bgptzero\s+bypass\b/gi, replacement: "AI-writing-pattern reduction", label: "“GPTZero bypass”" },
  // "bypass ... detection/turnitin/…" → a clean verb phrase. Bounded by [^.<\n]
  // so it can't run across a sentence or an HTML tag boundary.
  { pattern: /\bbypass\b[^.<\n]*?(turnitin|gpt[z-]?zero|detector|detection|check)\b/gi, replacement: "read more naturally", label: "“bypass … detection/Turnitin”" },
  { pattern: /\bwrite\s+my\s+essay\s+for\s+me\b/gi, replacement: "get AI writing help with my essay", label: "“write my essay for me”" },
  { pattern: /\bdo\s+my\s+(assignment|homework|essay|paper)\b/gi, replacement: "get AI writing help with my $1", label: "“do my assignment/homework/essay/paper”" },
  { pattern: /\bavoid\s+getting\s+caught\b/gi, replacement: "keep the writing genuinely my own", label: "“avoid getting caught”" },
  { pattern: /\bget\s+away\s+with\b/gi, replacement: "stay compliant with", label: "“get away with”" },
  { pattern: /\bghost\s*writ(?:e|ing|ten)\b/gi, replacement: "AI-assisted writing", label: "“ghostwriting”" },
  { pattern: /\bundetectable\b/gi, replacement: "natural-sounding", label: "“undetectable”" },
  // ── bare "cheat"/"cheating" last; split so the noun and verb forms each get a
  //    grammatically correct, meaning-preserving replacement (the old single
  //    replacement inverted the sense of warnings like "cheating is wrong"). ──
  { pattern: /\bcheating\b/gi, replacement: "academic dishonesty", label: "“cheating”" },
  { pattern: /\bcheat\b/gi, replacement: "break academic rules", label: "“cheat”" },
];

export interface ComplianceResult {
  passed: boolean;
  violations: string[];
  sanitized: string;
  /** True when the sanitiser actually edited the text (a pattern was rewritten).
   *  Callers should flag such pages for human review — an auto-rewrite can still
   *  read awkwardly and should never be published unseen. */
  rewritten: boolean;
}

export function checkAcademicIntegrity(content: string): ComplianceResult {
  // One plain-English violation per matched pattern, so an admin reading the
  // Integrity tab (or the Write-tab rule check) sees exactly which phrase is the
  // problem and what the auto-fix turns it into — not a raw regex source.
  const violations: string[] = [];
  let sanitized = content;

  for (const { pattern, replacement, label } of PROHIBITED_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push(`Says ${label} — auto-fix rewrites it to “${replacement.replace("$1", "…")}”`);
      sanitized = sanitized.replace(pattern, replacement);
      pattern.lastIndex = 0; // reset regex state
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    sanitized,
    rewritten: sanitized !== content,
  };
}

export function sanitizeContent(content: string): string {
  return checkAcademicIntegrity(content).sanitized;
}

export function buildAIDisclosureLabel(): string {
  return `<div class="ai-disclosure" role="note" aria-label="AI-assisted content disclosure">
  <span class="ai-disclosure-icon" aria-hidden="true">🤖</span>
  <span>This page was created with AI writing assistance and reviewed for accuracy and compliance.</span>
</div>`;
}

export function buildEUAIActMeta(locale = "en"): Record<string, string> {
  if (locale.startsWith("en")) {
    return {
      "ai-generated": "assisted",
      "ai-content-disclosure": "This content was created with AI writing assistance.",
    };
  }
  return {
    "ai-generated": "assisted",
    "ai-content-disclosure": "This content was created with AI writing assistance.",
  };
}

export function validateWordCount(content: string, minWords = 800): boolean {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return wordCount >= minWords;
}

export function countUniqueDataPoints(content: string): number {
  // Count statistics, percentages, numbers, cited figures as data points
  const stats = content.match(/\b\d+(?:\.\d+)?%|\$\d+(?:,\d{3})*(?:\.\d+)?|\b\d{4}\b|\b\d+\s*(?:billion|million|thousand|studies|papers|sources)\b/gi);
  return stats ? stats.length : 0;
}

export function hasFAQSection(content: string): boolean {
  return /frequently asked questions|faq|common questions/i.test(content);
}

// ── Marketing-foundation audit (the four questions + the villain) ─────────────
// A page passes the positioning audit when it (a) names the villain / real-paper
// contrast, and (b) answers the four questions well enough to be on-brand. This
// is the pre-publish standard: content that doesn't carry the positioning is
// flagged for review, not published silently.
export function checkPositioningCoverage(content: string): { passed: boolean; issues: string[] } {
  const text = content.toLowerCase();
  const issues: string[] = [];

  // Q1/Q2 + Villain: writes from real papers, not from memory.
  const namesRealPapers = /real (academic )?papers?|indexed papers?|from real research|actual research/.test(text);
  const namesVillain = /from memory|writes? from nothing|fabricat|hallucinat/.test(text);
  if (!namesRealPapers) issues.push("Positioning: page never states it writes from real academic papers (the governing line).");
  if (!namesVillain) issues.push("Villain missing: page never contrasts against AI that writes from memory / fabricates citations.");

  // Q3 Why trust it: verifiable sources + grade/rubric standard.
  const namesTrust = /rubric|grade a|92%|clickable|verif|peer-review|money-back/.test(text);
  if (!namesTrust) issues.push("Why-trust-it thin: no rubric / Grade A / verifiable-source / guarantee signal.");

  // Q4 Why choose it: an explicit comparison to a named alternative.
  const namesComparison = /chatgpt|quillbot|grammarly|chegg|instead of|compared to|vs\.?\s/.test(text);
  if (!namesComparison) issues.push("Why-choose-it missing: no comparison to ChatGPT / QuillBot / Grammarly / Chegg or 'instead of' framing.");

  return { passed: issues.length === 0, issues };
}

export function validatePage(content: string): {
  wordCount: number;
  uniqueDataPoints: number;
  hasFAQ: boolean;
  hasAIDisclosure: boolean;
  integrityCheck: boolean;
  positioningCheck: boolean;
  issues: string[];
} {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const uniqueDataPoints = countUniqueDataPoints(content);
  const hasFAQ = hasFAQSection(content);
  const hasAIDisclosure = content.includes("ai-disclosure") || content.includes("AI writing assistance");
  const integrity = checkAcademicIntegrity(content);
  const positioning = checkPositioningCoverage(content);
  const issues: string[] = [];

  if (wordCount < 800) issues.push(`Word count ${wordCount} < 800 minimum`);
  if (uniqueDataPoints < 8) issues.push(`Only ${uniqueDataPoints} data points (need 8+)`);
  if (!hasFAQ) issues.push("No FAQ section found");
  if (!hasAIDisclosure) issues.push("No AI disclosure label");
  if (!integrity.passed) issues.push(...integrity.violations);
  if (!positioning.passed) issues.push(...positioning.issues);

  return {
    wordCount,
    uniqueDataPoints,
    hasFAQ,
    hasAIDisclosure,
    integrityCheck: integrity.passed,
    positioningCheck: positioning.passed,
    issues,
  };
}
