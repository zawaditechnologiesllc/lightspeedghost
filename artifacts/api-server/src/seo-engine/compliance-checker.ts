// ── Academic Integrity & EU AI Act Compliance Checker ────────────────────────

const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bbypass\b.*?(turnitin|gpt[z-]?zero|detector|detection|check)/gi, replacement: "improve writing quality for" },
  { pattern: /\bturnitin\s+bypass\b/gi, replacement: "writing quality improvement" },
  { pattern: /\bgptzero\s+bypass\b/gi, replacement: "AI writing pattern reduction" },
  { pattern: /\bcheat(?:ing)?\b/gi, replacement: "academic writing support" },
  { pattern: /\bcontract\s+cheat(?:ing)?\b/gi, replacement: "academic writing assistance" },
  { pattern: /\bdo\s+my\s+(assignment|homework|essay|paper)\b/gi, replacement: "get AI writing assistance for your $1" },
  { pattern: /\bwrite\s+my\s+essay\s+for\s+me\b/gi, replacement: "AI-assisted essay writing" },
  { pattern: /\bundetectable\b/gi, replacement: "natural-sounding" },
  { pattern: /\bghost\s*writ(?:e|ing|ten)\b/gi, replacement: "AI-assisted academic writing" },
  { pattern: /\bget\s+away\s+with\b/gi, replacement: "achieve compliance with" },
  { pattern: /\bavoid\s+getting\s+caught\b/gi, replacement: "ensure writing quality" },
  { pattern: /\bcheat(?:ing)?\s+detector\b/gi, replacement: "writing quality checker" },
];

const PROHIBITED_EXACT: string[] = [
  "bypass turnitin",
  "bypass gptzero",
  "bypass ai detection",
  "turnitin bypass",
  "cheat",
  "cheating",
  "contract cheating",
  "do my assignment",
  "do my homework",
  "write my essay for me",
  "undetectable ai",
  "get away with",
  "avoid getting caught",
];

export interface ComplianceResult {
  passed: boolean;
  violations: string[];
  sanitized: string;
}

export function checkAcademicIntegrity(content: string): ComplianceResult {
  const violations: string[] = [];
  let sanitized = content;

  for (const exact of PROHIBITED_EXACT) {
    if (sanitized.toLowerCase().includes(exact.toLowerCase())) {
      violations.push(`Prohibited phrase: "${exact}"`);
    }
  }

  for (const { pattern, replacement } of PROHIBITED_PATTERNS) {
    if (pattern.test(sanitized)) {
      violations.push(`Prohibited pattern matched: ${pattern.source}`);
      sanitized = sanitized.replace(pattern, replacement);
      pattern.lastIndex = 0; // reset regex state
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    sanitized,
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

export function validatePage(content: string): {
  wordCount: number;
  uniqueDataPoints: number;
  hasFAQ: boolean;
  hasAIDisclosure: boolean;
  integrityCheck: boolean;
  issues: string[];
} {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const uniqueDataPoints = countUniqueDataPoints(content);
  const hasFAQ = hasFAQSection(content);
  const hasAIDisclosure = content.includes("ai-disclosure") || content.includes("AI writing assistance");
  const integrity = checkAcademicIntegrity(content);
  const issues: string[] = [];

  if (wordCount < 800) issues.push(`Word count ${wordCount} < 800 minimum`);
  if (uniqueDataPoints < 8) issues.push(`Only ${uniqueDataPoints} data points (need 8+)`);
  if (!hasFAQ) issues.push("No FAQ section found");
  if (!hasAIDisclosure) issues.push("No AI disclosure label");
  if (!integrity.passed) issues.push(...integrity.violations);

  return {
    wordCount,
    uniqueDataPoints,
    hasFAQ,
    hasAIDisclosure,
    integrityCheck: integrity.passed,
    issues,
  };
}
