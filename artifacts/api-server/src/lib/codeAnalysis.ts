/**
 * Code Plagiarism Analysis — AST-inspired structural similarity detection
 *
 * Inspired by:
 *  • Advanced-Code-Plagiarism-Detection-Tool (GitHub) — uses AST analysis
 *    to find logic matches even when variable names are renamed
 *  • MOSS (Measure Of Software Similarity) — Stanford's winnowing-based system
 *  • winnow.ts — this project's existing text Winnowing implementation
 *
 * This module goes beyond winnow.ts (which operates on raw text tokens) by:
 *  1. Language detection — identifies Python, JS/TS, Java, C/C++, R, MATLAB
 *  2. Code normalisation — strips comments, normalises identifiers, literals
 *  3. Structural fingerprinting — extracts control-flow skeleton (if/for/while/
 *     function call sequences) which persists even after variable renaming
 *  4. API/library call matching — two submissions using the same library
 *     functions in the same order are likely derived from each other
 *  5. Combined score — structural + token-level similarity
 *
 * Languages supported (no external parser required — pure regex heuristics):
 *  Python, JavaScript/TypeScript, Java, C/C++, R, MATLAB/Octave, Haskell
 */

export type CodeLanguage =
  | "python"
  | "javascript"
  | "typescript"
  | "java"
  | "c"
  | "cpp"
  | "r"
  | "matlab"
  | "haskell"
  | "unknown";

export interface CodeMatch {
  type: "function-call" | "control-flow" | "structure" | "literal" | "identifier";
  snippet: string;
  frequency: number;
}

export interface CodeSimilarityResult {
  language: CodeLanguage;
  similarity: number;
  structuralSimilarity: number;
  tokenSimilarity: number;
  apiCallSimilarity: number;
  sharedPatterns: CodeMatch[];
  normalised1: string;
  normalised2: string;
  verdict: "identical" | "highly-similar" | "moderately-similar" | "dissimilar";
  verdictLabel: string;
}

// ── Language detection ────────────────────────────────────────────────────────

const LANGUAGE_SIGNALS: Array<[CodeLanguage, RegExp[]]> = [
  ["python",     [/^import\s+\w/m, /^def\s+\w+\s*\(/m, /^class\s+\w+[:(]/m, /print\s*\(/, /elif\s+/]],
  ["typescript", [/:\s*(string|number|boolean|any|void|Record)\b/, /interface\s+\w+/, /type\s+\w+\s*=/, /=>\s*{/]],
  ["javascript", [/^const\s+\w/m, /^let\s+\w/m, /=>\s*{/, /require\s*\(/, /module\.exports/]],
  ["java",       [/^(public|private|protected)\s+(class|static|void)\b/m, /System\.out\.print/, /\.equals\(/, /\bnew\s+[A-Z]/]],
  ["cpp",        [/#include\s*</, /std::/, /cout\s*<</, /\bvoid\s+main\s*\(/]],
  ["c",          [/#include\s*<stdio\.h>/, /printf\s*\(/, /scanf\s*\(/, /\bint\s+main\s*\(/]],
  ["r",          [/<-\s/, /\bggplot\s*\(/, /\bc\s*\(/, /\blibrary\s*\(/, /\bdata\.frame\s*\(/]],
  ["matlab",     [/^\s*%/, /\bend\s*$/m, /\bfprintf\s*\(/, /\bdisp\s*\(/]],
  ["haskell",    [/^module\s+\w/m, /\bdo\s*$/, /\bwhere\s*$/, /::\s*\w/]],
];

export function detectLanguage(code: string): CodeLanguage {
  let bestMatch: CodeLanguage = "unknown";
  let bestScore = 0;

  for (const [lang, signals] of LANGUAGE_SIGNALS) {
    const score = signals.filter(p => p.test(code)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = lang;
    }
  }

  return bestMatch;
}

// ── Code normalisation ────────────────────────────────────────────────────────

function stripComments(code: string, lang: CodeLanguage): string {
  let result = code;

  // Block comments /* ... */
  result = result.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Python / Shell / R line comments
  if (["python", "r"].includes(lang)) {
    result = result.replace(/#[^\n]*/g, " ");
  }
  // MATLAB line comments
  if (lang === "matlab") {
    result = result.replace(/%[^\n]*/g, " ");
  }
  // Haskell line comments
  if (lang === "haskell") {
    result = result.replace(/--[^\n]*/g, " ");
  }
  // C-style line comments // ...
  if (!["python", "r", "matlab", "haskell"].includes(lang)) {
    result = result.replace(/\/\/[^\n]*/g, " ");
  }

  return result;
}

/**
 * Normalise code for comparison:
 *  1. Strip comments
 *  2. Lowercase all identifiers (makes renaming transparent)
 *  3. Replace string literals with STRING_LITERAL
 *  4. Replace number literals with NUM_LITERAL
 *  5. Collapse whitespace
 */
function normaliseCode(code: string, lang: CodeLanguage): string {
  let norm = stripComments(code, lang);

  // Normalise string literals
  norm = norm
    .replace(/"(?:[^"\\]|\\.)*"/g, "STRING_LITERAL")
    .replace(/'(?:[^'\\]|\\.)*'/g, "STRING_LITERAL")
    .replace(/`(?:[^`\\]|\\.)*`/g, "STRING_LITERAL");

  // Normalise number literals (preserve structural integers like 0, 1 in loops)
  norm = norm.replace(/\b\d+\.\d+\b/g, "FLOAT_LITERAL");
  norm = norm.replace(/\b\d{4,}\b/g, "INT_LITERAL");

  // Lowercase everything (variable renaming should not affect similarity)
  norm = norm.toLowerCase();

  // Normalise whitespace
  norm = norm.replace(/\s+/g, " ").trim();

  return norm;
}

// ── Structural fingerprinting ─────────────────────────────────────────────────

const CONTROL_FLOW_KEYWORDS = [
  "if", "else", "elif", "for", "while", "do", "switch", "case",
  "try", "catch", "except", "finally", "with", "return", "yield",
  "break", "continue", "throw", "raise",
];

/** Extract a structural skeleton — the sequence of control-flow keywords */
function extractStructure(normalised: string): string[] {
  const tokens = normalised.split(/\s+|[(){};\[\]]/).filter(Boolean);
  return tokens.filter(t => CONTROL_FLOW_KEYWORDS.includes(t));
}

/** Extract function/method call patterns (functionName(...)) */
function extractApiCalls(normalised: string): string[] {
  const matches = normalised.matchAll(/([a-z_][a-z0-9_]*)\s*\(/g);
  const calls: string[] = [];
  for (const m of matches) {
    const name = m[1];
    // Skip language keywords and very short names
    if (CONTROL_FLOW_KEYWORDS.includes(name) || name.length < 3) continue;
    calls.push(name);
  }
  return calls;
}

// ── Token n-gram overlap ──────────────────────────────────────────────────────

function buildNgrams(tokens: string[], n: number): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    grams.add(tokens.slice(i, i + n).join(" "));
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// ── Sequence similarity (longest common subsequence ratio) ───────────────────

function lcsRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  // Limit to 200 elements to avoid O(n²) blowup on huge inputs
  const A = a.slice(0, 200);
  const B = b.slice(0, 200);

  const dp: number[][] = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));

  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      dp[i][j] = A[i - 1] === B[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const lcs = dp[A.length][B.length];
  return (2 * lcs) / (A.length + B.length);
}

// ── Shared pattern extraction ─────────────────────────────────────────────────

function findSharedPatterns(norm1: string, norm2: string): CodeMatch[] {
  const tokens1 = norm1.split(/\s+/).filter(Boolean);
  const tokens2 = norm2.split(/\s+/).filter(Boolean);

  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();
  for (const t of tokens1) freq1.set(t, (freq1.get(t) ?? 0) + 1);
  for (const t of tokens2) freq2.set(t, (freq2.get(t) ?? 0) + 1);

  const shared: CodeMatch[] = [];

  // Find tokens that appear ≥2 times in both (non-trivial matches)
  for (const [token, count1] of freq1) {
    const count2 = freq2.get(token) ?? 0;
    if (count1 >= 2 && count2 >= 2 && token.length >= 4 && !CONTROL_FLOW_KEYWORDS.includes(token)) {
      const type: CodeMatch["type"] =
        /[a-z_][a-z0-9_]*\s*\(/.test(token) ? "function-call" :
        CONTROL_FLOW_KEYWORDS.includes(token) ? "control-flow" :
        /[A-Z_]{4,}/.test(token) ? "literal" :
        "identifier";

      shared.push({
        type,
        snippet: token,
        frequency: Math.min(count1, count2),
      });
    }
  }

  // Also find 3-gram token patterns
  const grams1 = buildNgrams(tokens1, 3);
  const grams2 = buildNgrams(tokens2, 3);
  const sharedGrams = [...grams1].filter(g => grams2.has(g)).slice(0, 5);
  for (const gram of sharedGrams) {
    if (!gram.includes("string_literal") && !gram.includes("int_literal")) {
      shared.push({ type: "structure", snippet: gram, frequency: 1 });
    }
  }

  return shared.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
}

// ── Verdict mapping ───────────────────────────────────────────────────────────

function getVerdict(similarity: number): { verdict: CodeSimilarityResult["verdict"]; label: string } {
  if (similarity >= 85) return { verdict: "identical",          label: "Likely copied or auto-generated from the same source" };
  if (similarity >= 60) return { verdict: "highly-similar",    label: "Highly similar structure — probable plagiarism" };
  if (similarity >= 35) return { verdict: "moderately-similar",label: "Some structural overlap — manual review recommended" };
  return                       { verdict: "dissimilar",          label: "Distinct code — no significant structural match" };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compare two code blocks for structural similarity.
 * Language is auto-detected if not provided.
 */
export function analyseCodeSimilarity(
  code1: string,
  code2: string,
  lang?: CodeLanguage
): CodeSimilarityResult {
  if (!code1.trim() || !code2.trim()) {
    return {
      language: "unknown",
      similarity: 0,
      structuralSimilarity: 0,
      tokenSimilarity: 0,
      apiCallSimilarity: 0,
      sharedPatterns: [],
      normalised1: "",
      normalised2: "",
      verdict: "dissimilar",
      verdictLabel: "No code provided",
    };
  }

  const detectedLang = lang ?? detectLanguage(code1 + "\n" + code2);

  const norm1 = normaliseCode(code1, detectedLang);
  const norm2 = normaliseCode(code2, detectedLang);

  // 1. Token-level Jaccard (3-grams)
  const tokens1 = norm1.split(/\s+/).filter(Boolean);
  const tokens2 = norm2.split(/\s+/).filter(Boolean);
  const grams1 = buildNgrams(tokens1, 3);
  const grams2 = buildNgrams(tokens2, 3);
  const tokenSimilarity = Math.round(jaccardSimilarity(grams1, grams2) * 100);

  // 2. Structural similarity (control-flow skeleton LCS)
  const struct1 = extractStructure(norm1);
  const struct2 = extractStructure(norm2);
  const structuralSimilarity = Math.round(lcsRatio(struct1, struct2) * 100);

  // 3. API call sequence similarity
  const calls1 = extractApiCalls(norm1);
  const calls2 = extractApiCalls(norm2);
  const apiCallSimilarity = Math.round(lcsRatio(calls1, calls2) * 100);

  // 4. Shared patterns
  const sharedPatterns = findSharedPatterns(norm1, norm2);

  // 5. Combined score (weighted average — structural is most important)
  const similarity = Math.round(
    structuralSimilarity * 0.4 +
    tokenSimilarity      * 0.35 +
    apiCallSimilarity    * 0.25
  );

  const { verdict, label: verdictLabel } = getVerdict(similarity);

  return {
    language: detectedLang,
    similarity,
    structuralSimilarity,
    tokenSimilarity,
    apiCallSimilarity,
    sharedPatterns,
    normalised1: norm1.slice(0, 500),
    normalised2: norm2.slice(0, 500),
    verdict,
    verdictLabel,
  };
}

/**
 * Quick single-value similarity check — returns 0–100 score.
 * Use when you only need the number, not the full breakdown.
 */
export function codeOverlapScore(code1: string, code2: string): number {
  return analyseCodeSimilarity(code1, code2).similarity;
}

/**
 * Detect if a block of text contains code (vs. prose).
 * Used by the plagiarism route to decide whether to run code analysis.
 */
export function containsCode(text: string): boolean {
  const codeSignals = [
    /```[\s\S]+?```/,              // fenced code blocks
    /^\s{4,}\S/m,                  // indented blocks (common in Python/prose)
    /\b(def|function|class|import|require|include)\b/,
    /[{}();\[\]]\s*\n/,            // brace/paren at end of line
    /\/\/\s*[A-Za-z]/,             // line comments
    /(for|while|if)\s*\(.+\)\s*{/, // C-style loops
    /\bprint\s*\(/,
    /\bcout\s*<</,
    /=>\s*\{/,                     // arrow functions
  ];
  return codeSignals.some(p => p.test(text));
}
