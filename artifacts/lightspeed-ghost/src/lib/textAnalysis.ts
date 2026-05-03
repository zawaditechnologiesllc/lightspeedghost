function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function tokenizeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function tokenizeWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z'-]/g, ""))
    .filter((w) => w.length > 0);
}

export interface ReadabilityResult {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  colemanLiauIndex: number;
  automatedReadabilityIndex: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  wordCount: number;
  sentenceCount: number;
  charCount: number;
  readingTime: number;
  level: "elementary" | "middle" | "high_school" | "college" | "graduate" | "professional";
  levelLabel: string;
}

export function analyzeReadability(text: string): ReadabilityResult {
  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);
  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = words.length;
  const charCount = words.join("").length;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const avgSentenceLength = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / Math.max(wordCount, 1);

  const fleschReadingEase = Math.round(
    (206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllablesPerWord) * 10
  ) / 10;

  const fleschKincaidGrade = Math.round(
    (0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59) * 10
  ) / 10;

  const L = (charCount / Math.max(wordCount, 1)) * 100;
  const S = (sentenceCount / Math.max(wordCount, 1)) * 100;
  const colemanLiauIndex = Math.round((0.0588 * L - 0.296 * S - 15.8) * 10) / 10;

  const automatedReadabilityIndex = Math.round(
    (4.71 * (charCount / Math.max(wordCount, 1)) +
      0.5 * (wordCount / sentenceCount) -
      21.43) * 10
  ) / 10;

  const readingTime = Math.ceil(wordCount / 238);

  let level: ReadabilityResult["level"];
  let levelLabel: string;
  const grade = fleschKincaidGrade;
  if (grade <= 5) { level = "elementary"; levelLabel = "Elementary"; }
  else if (grade <= 8) { level = "middle"; levelLabel = "Middle School"; }
  else if (grade <= 12) { level = "high_school"; levelLabel = "High School"; }
  else if (grade <= 16) { level = "college"; levelLabel = "College Level"; }
  else if (grade <= 20) { level = "graduate"; levelLabel = "Graduate Level"; }
  else { level = "professional"; levelLabel = "Professional / Academic"; }

  return {
    fleschReadingEase: Math.max(0, Math.min(100, fleschReadingEase)),
    fleschKincaidGrade: Math.max(0, fleschKincaidGrade),
    colemanLiauIndex,
    automatedReadabilityIndex,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    wordCount,
    sentenceCount,
    charCount,
    readingTime,
    level,
    levelLabel,
  };
}

export interface GrammarIssue {
  type: "grammar" | "spelling" | "punctuation" | "style" | "clarity";
  severity: "error" | "warning" | "suggestion";
  message: string;
  context: string;
  position: number;
  suggestion?: string;
}

const GRAMMAR_PATTERNS: { pattern: RegExp; type: GrammarIssue["type"]; severity: GrammarIssue["severity"]; message: string; suggestion?: string }[] = [
  { pattern: /\b(their|there|they're)\b.*\b(their|there|they're)\b/gi, type: "grammar", severity: "warning", message: "Check commonly confused words: their/there/they're" },
  { pattern: /\b(its|it's)\s+(a|the|an|not|very)\b/gi, type: "grammar", severity: "warning", message: "Check 'its' vs 'it's' usage" },
  { pattern: /\b(affect|effect)\b/gi, type: "grammar", severity: "suggestion", message: "Verify affect (verb) vs effect (noun) usage" },
  { pattern: /\b(could|would|should)\s+of\b/gi, type: "grammar", severity: "error", message: "Use 'could have' instead of 'could of'", suggestion: "have" },
  { pattern: /\b(alot)\b/gi, type: "spelling", severity: "error", message: "'Alot' is not a word — use 'a lot'", suggestion: "a lot" },
  { pattern: /\b(irregardless)\b/gi, type: "spelling", severity: "warning", message: "Use 'regardless' instead of 'irregardless'", suggestion: "regardless" },
  { pattern: /\b(supposably)\b/gi, type: "spelling", severity: "error", message: "Use 'supposedly' instead of 'supposably'", suggestion: "supposedly" },
  { pattern: /\b(definately|definatly)\b/gi, type: "spelling", severity: "error", message: "Correct spelling: 'definitely'", suggestion: "definitely" },
  { pattern: /\b(occured)\b/gi, type: "spelling", severity: "error", message: "Correct spelling: 'occurred'", suggestion: "occurred" },
  { pattern: /\b(recieve)\b/gi, type: "spelling", severity: "error", message: "Correct spelling: 'receive'", suggestion: "receive" },
  { pattern: /\b(seperate)\b/gi, type: "spelling", severity: "error", message: "Correct spelling: 'separate'", suggestion: "separate" },
  { pattern: /\b(accomodate)\b/gi, type: "spelling", severity: "error", message: "Correct spelling: 'accommodate'", suggestion: "accommodate" },
  { pattern: /\s{2,}/g, type: "punctuation", severity: "suggestion", message: "Multiple spaces detected — use single space" },
  { pattern: /[.]{4,}/g, type: "punctuation", severity: "warning", message: "Excessive periods — use ellipsis (…) or proper punctuation" },
  { pattern: /\b(very|really|basically|actually|literally|just)\b/gi, type: "style", severity: "suggestion", message: "Weak filler word — consider removing or replacing with a stronger alternative" },
  { pattern: /\b(in order to)\b/gi, type: "clarity", severity: "suggestion", message: "Simplify 'in order to' to 'to'", suggestion: "to" },
  { pattern: /\b(due to the fact that)\b/gi, type: "clarity", severity: "suggestion", message: "Simplify 'due to the fact that' to 'because'", suggestion: "because" },
  { pattern: /\b(at this point in time)\b/gi, type: "clarity", severity: "suggestion", message: "Simplify to 'now' or 'currently'", suggestion: "currently" },
  { pattern: /\b(in the event that)\b/gi, type: "clarity", severity: "suggestion", message: "Simplify to 'if'", suggestion: "if" },
  { pattern: /\b(utilize)\b/gi, type: "style", severity: "suggestion", message: "Consider using 'use' instead of 'utilize' for clarity", suggestion: "use" },
  { pattern: /\bi\b/g, type: "grammar", severity: "error", message: "Lowercase 'i' should be capitalized to 'I'" },
  { pattern: /[,]{2,}/g, type: "punctuation", severity: "error", message: "Double commas detected" },
];

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const sentences = tokenizeSentences(text);

  for (const rule of GRAMMAR_PATTERNS) {
    let match;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + match[0].length + 30);
      issues.push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        context: text.slice(start, end),
        position: match.index,
        suggestion: rule.suggestion,
      });
    }
  }

  for (const sentence of sentences) {
    const words = tokenizeWords(sentence);
    if (words.length > 50) {
      issues.push({
        type: "clarity",
        severity: "warning",
        message: `Very long sentence (${words.length} words) — consider breaking into shorter sentences`,
        context: sentence.slice(0, 80) + "…",
        position: text.indexOf(sentence),
      });
    }
  }

  const words = tokenizeWords(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  for (const para of paragraphs) {
    const pSentences = tokenizeSentences(para);
    if (pSentences.length === 1 && tokenizeWords(para).length > 60) {
      issues.push({
        type: "clarity",
        severity: "suggestion",
        message: "Single-sentence paragraph is very long — consider splitting",
        context: para.slice(0, 80) + "…",
        position: text.indexOf(para),
      });
    }
  }

  return issues.sort((a, b) => {
    const sevOrder = { error: 0, warning: 1, suggestion: 2 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

export interface ToneResult {
  dominant: string;
  scores: { tone: string; score: number }[];
  formality: number;
  confidence: number;
  suggestion: string;
}

const TONE_LEXICONS: Record<string, string[]> = {
  formal: ["furthermore", "moreover", "consequently", "nevertheless", "whereas", "notwithstanding", "henceforth", "thereby", "herein", "aforementioned", "pursuant", "thus", "hence", "accordingly", "therefore"],
  casual: ["pretty", "kinda", "gonna", "wanna", "stuff", "thing", "cool", "awesome", "okay", "yeah", "lots", "huge", "super", "tons", "hey"],
  confident: ["certainly", "undoubtedly", "clearly", "evidently", "demonstrates", "proves", "establishes", "confirms", "asserts", "definitively"],
  tentative: ["perhaps", "maybe", "might", "possibly", "somewhat", "appears", "seems", "suggests", "arguably", "potentially", "conceivably"],
  analytical: ["analysis", "data", "evidence", "correlation", "methodology", "hypothesis", "empirical", "quantitative", "qualitative", "statistical", "framework"],
  persuasive: ["must", "should", "essential", "critical", "imperative", "vital", "crucial", "urgent", "necessary", "compelling", "undeniable"],
};

export function detectTone(text: string): ToneResult {
  const words = tokenizeWords(text).map((w) => w.toLowerCase());
  const wordCount = words.length;
  const scores: { tone: string; score: number }[] = [];

  for (const [tone, lexicon] of Object.entries(TONE_LEXICONS)) {
    const matches = words.filter((w) => lexicon.includes(w)).length;
    const score = Math.min(100, Math.round((matches / Math.max(wordCount, 1)) * 1000));
    scores.push({ tone, score });
  }

  scores.sort((a, b) => b.score - a.score);
  const dominant = scores[0]?.tone || "neutral";
  const formalScore = scores.find((s) => s.tone === "formal")?.score || 0;
  const casualScore = scores.find((s) => s.tone === "casual")?.score || 0;
  const formality = Math.round(((formalScore - casualScore + 100) / 200) * 100);

  const topScore = scores[0]?.score || 0;
  const confidence = Math.min(100, topScore * 3);

  const suggestions: Record<string, string> = {
    formal: "Your writing has a formal academic tone. Suitable for research papers and dissertations.",
    casual: "Your writing is quite casual. For academic work, consider using more formal vocabulary and structure.",
    confident: "Your assertions are strong and confident. Make sure claims are backed by evidence.",
    tentative: "Your writing uses hedging language. This can be appropriate for academic caution, but too much may weaken your argument.",
    analytical: "Your writing is analytical and data-driven. Good for research papers.",
    persuasive: "Your writing has a persuasive tone. Ensure you balance rhetoric with evidence.",
    neutral: "Your writing has a neutral, balanced tone.",
  };

  return {
    dominant,
    scores,
    formality,
    confidence,
    suggestion: suggestions[dominant] || suggestions.neutral,
  };
}

export interface StyleConsistencyResult {
  overallScore: number;
  sentenceLengthVariance: number;
  vocabularyDiversity: number;
  toneShifts: { position: number; from: string; to: string; context: string }[];
  passiveVoicePercent: number;
  avgParagraphLength: number;
  issues: string[];
}

export function checkStyleConsistency(text: string): StyleConsistencyResult {
  const sentences = tokenizeSentences(text);
  const words = tokenizeWords(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  const sentenceLengths = sentences.map((s) => tokenizeWords(s).length);
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceLengths.length, 1);
  const variance = Math.round(
    Math.sqrt(
      sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) /
        Math.max(sentenceLengths.length, 1)
    ) * 10
  ) / 10;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const vocabularyDiversity = Math.round((uniqueWords.size / Math.max(words.length, 1)) * 100);

  const passivePatterns = /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+ed\b/gi;
  const passiveMatches = text.match(passivePatterns) || [];
  const passiveVoicePercent = Math.round(
    (passiveMatches.length / Math.max(sentences.length, 1)) * 100
  );

  const avgParagraphLength = Math.round(
    paragraphs.reduce((sum, p) => sum + tokenizeWords(p).length, 0) /
      Math.max(paragraphs.length, 1)
  );

  const chunkSize = Math.max(3, Math.floor(sentences.length / 4));
  const toneShifts: StyleConsistencyResult["toneShifts"] = [];
  let prevTone = "";

  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join(" ");
    const tone = detectTone(chunk);
    if (prevTone && tone.dominant !== prevTone && tone.confidence > 20) {
      toneShifts.push({
        position: i,
        from: prevTone,
        to: tone.dominant,
        context: chunk.slice(0, 60) + "…",
      });
    }
    prevTone = tone.dominant;
  }

  const issues: string[] = [];
  if (variance < 3) issues.push("Sentences are very uniform in length — this can sound monotonous and robotic. Vary sentence length for natural flow.");
  if (variance > 15) issues.push("Sentence length varies wildly — some sentences are very long while others are very short. Aim for more consistent pacing.");
  if (vocabularyDiversity < 40) issues.push("Low vocabulary diversity — many words are repeated. Use synonyms and varied phrasing.");
  if (passiveVoicePercent > 40) issues.push("High passive voice usage (" + passiveVoicePercent + "%). Academic writing generally favors active voice.");
  if (toneShifts.length > 2) issues.push("Multiple tone shifts detected — the writing style changes noticeably in different sections. This can indicate mixed AI/human authorship.");
  if (avgParagraphLength > 200) issues.push("Paragraphs are very long on average. Consider breaking into shorter, focused paragraphs.");
  if (avgParagraphLength < 30) issues.push("Paragraphs are very short. Consider combining related ideas.");

  let overallScore = 100;
  overallScore -= issues.length * 12;
  overallScore -= toneShifts.length * 8;
  if (passiveVoicePercent > 30) overallScore -= 10;
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore,
    sentenceLengthVariance: variance,
    vocabularyDiversity,
    toneShifts,
    passiveVoicePercent,
    avgParagraphLength,
    issues,
  };
}

export interface SentenceScore {
  text: string;
  aiProbability: number;
  startIndex: number;
  endIndex: number;
}

export function scoreSentences(text: string, overallAiScore: number): SentenceScore[] {
  const sentences = tokenizeSentences(text);
  return sentences.map((s) => {
    const words = tokenizeWords(s);
    const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / Math.max(words.length, 1);
    const hasTransition = /^(Furthermore|Moreover|Additionally|However|Nevertheless|Consequently|In conclusion|Therefore|Thus|Hence)\b/i.test(s);
    const hasCliche = /\b(delve|pivotal|crucial|leverag|multifaceted|comprehensive|nuanced|landscape|paradigm|synergy|holistic)\b/i.test(s);
    const isVeryUniform = words.length > 10 && words.length < 25;

    let prob = overallAiScore;
    if (hasTransition) prob += 15;
    if (hasCliche) prob += 20;
    if (isVeryUniform) prob += 5;
    if (avgWordLen > 6) prob += 5;
    prob += (Math.random() - 0.5) * 20;
    prob = Math.max(0, Math.min(100, Math.round(prob)));

    const startIndex = text.indexOf(s);
    return {
      text: s,
      aiProbability: prob,
      startIndex,
      endIndex: startIndex + s.length,
    };
  });
}

export function generateCitation(
  metadata: { title: string; authors: string[]; year: string; url: string; publisher?: string; accessDate?: string },
  style: "apa" | "mla" | "chicago" | "harvard" | "ieee"
): string {
  const { title, authors, year, url, publisher, accessDate } = metadata;
  const access = accessDate || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const authorStr = authors.length > 0 ? authors.join(", ") : "Unknown Author";
  const lastFirst = authors.length > 0
    ? authors[0].split(" ").reverse().join(", ") + (authors.length > 1 ? `, et al.` : "")
    : "Unknown Author";

  switch (style) {
    case "apa":
      return `${lastFirst} (${year}). ${title}. ${publisher ? publisher + ". " : ""}${url}`;
    case "mla":
      return `${lastFirst}. "${title}." ${publisher ? publisher + ", " : ""}${year}, ${url}. Accessed ${access}.`;
    case "chicago":
      return `${lastFirst}. "${title}." ${publisher ? publisher + ". " : ""}${year}. ${url}.`;
    case "harvard":
      return `${lastFirst} (${year}) '${title}', ${publisher ? publisher + ". " : ""}Available at: ${url} (Accessed: ${access}).`;
    case "ieee":
      const authorIeee = authors.length > 0 ? authors[0].split(" ").map((n, i, arr) => i < arr.length - 1 ? n[0] + "." : n).join(" ") : "Unknown";
      return `${authorIeee}, "${title}," ${publisher ? publisher + ", " : ""}${year}. [Online]. Available: ${url}`;
    default:
      return `${authorStr}. "${title}." ${year}. ${url}`;
  }
}
