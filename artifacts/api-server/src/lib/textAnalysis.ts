/**
 * Text plagiarism detection and AI text analysis.
 * Ported to TypeScript from: https://github.com/Churanta/Plagiarism-Checker-and-AI-Text-Detection
 *
 * Algorithms:
 * - Cosine Similarity via Term Frequency (TF) vectors for plagiarism detection
 * - Lexical Diversity score for AI-generated text detection
 *   (AI text tends to have lower unique-word ratios due to statistical generation patterns)
 */

import { ACADEMIC_CORPUS } from "./academicCorpus";
import nlp from "compromise";

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","this","that","these","those","is","are","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","can","it","its","as","if","not","no","nor","so",
  "yet","both","either","neither","each","few","more","most","other","some",
  "such","than","then","too","very","just","about","above","after","before",
  "between","into","through","during","including","however","therefore",
  "their","they","them","there","here","where","when","which","who","what",
]);

/** Tokenise and clean text — remove punctuation and numbers, lowercase, split */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Term Frequency map: word → count */
function buildTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const word of tokens) {
    tf.set(word, (tf.get(word) ?? 0) + 1);
  }
  return tf;
}

/** Cosine similarity between two TF maps over a shared vocabulary */
function cosineSimilarity(tf1: Map<string, number>, tf2: Map<string, number>): number {
  const vocabulary = new Set([...tf1.keys(), ...tf2.keys()]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  for (const word of vocabulary) {
    const v1 = tf1.get(word) ?? 0;
    const v2 = tf2.get(word) ?? 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export interface PlagiarismAnalysis {
  plagiarismScore: number;
  matchedWords: string[];
  topMatchingSource: { label: string; similarity: number } | null;
  sourceMatches: Array<{ label: string; similarity: number; matchedWords: string[] }>;
}

/** Compare query against each source in the academic corpus and return similarity scores */
export function analyseTextPlagiarism(query: string): PlagiarismAnalysis {
  const queryTokens = tokenize(query);
  if (queryTokens.length < 5) {
    return { plagiarismScore: 0, matchedWords: [], topMatchingSource: null, sourceMatches: [] };
  }
  const queryTF = buildTF(queryTokens);
  const queryWordSet = new Set(queryTokens);

  const sourceMatches: Array<{ label: string; similarity: number; matchedWords: string[] }> = [];

  for (const source of ACADEMIC_CORPUS) {
    const srcTokens = tokenize(source.text);
    const srcTF = buildTF(srcTokens);
    const srcWordSet = new Set(srcTokens);
    const sim = cosineSimilarity(queryTF, srcTF);
    const matchedWords = [...queryWordSet].filter((w) => srcWordSet.has(w));
    sourceMatches.push({ label: source.label, similarity: Math.round(sim * 100), matchedWords });
  }

  sourceMatches.sort((a, b) => b.similarity - a.similarity);

  const topMatchingSource = sourceMatches[0] ?? null;
  const allMatchedWords = [
    ...new Set(
      sourceMatches
        .filter((s) => s.similarity > 5)
        .flatMap((s) => s.matchedWords)
    ),
  ];

  const plagiarismScore = Math.min(
    Math.round(
      (topMatchingSource?.similarity ?? 0) * 1.2 +
        Math.max(0, sourceMatches[1]?.similarity ?? 0) * 0.3
    ),
    100
  );

  return {
    plagiarismScore,
    matchedWords: allMatchedWords,
    topMatchingSource,
    sourceMatches: sourceMatches.slice(0, 5),
  };
}

export interface AIAnalysis {
  aiScore: number;
  lexicalDiversity: number;
  avgSentenceLength: number;
  flags: string[];
}

/**
 * Detect AI-generated text using lexical diversity and writing patterns.
 * Based on the approach in Plagiarism-Checker-and-AI-Text-Detection by Churanta.
 *
 * AI-generated text tends to:
 * - Have lower lexical diversity (fewer unique words relative to total)
 * - Produce longer, more uniform sentences
 * - Use more passive constructions and filler transitions
 */
export function analyseAIContent(text: string): AIAnalysis {
  const cleanText = text.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const flags: string[] = [];

  if (words.length < 10) {
    return { aiScore: 0, lexicalDiversity: 1, avgSentenceLength: 0, flags: [] };
  }

  const uniqueWords = new Set(words);
  const uniqueRatio = uniqueWords.size / words.length;
  const lexicalDiversity = uniqueRatio;

  const sentences = (nlp(text).sentences().out("array") as string[]).filter((s: string) => s.trim().length > 10);
  const avgSentenceLength =
    sentences.length > 0
      ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
      : 0;

  const aiIndicatorPhrases = [
    /\bfurthermore\b/i,
    /\bmoreover\b/i,
    /\bin conclusion\b/i,
    /\bit is (important|worth|essential) to note\b/i,
    /\bthis (paper|essay|study|article) (examines|explores|investigates|discusses|aims)\b/i,
    /\bone (important|key|significant|notable|crucial) (factor|aspect|consideration)\b/i,
    /\bsubstantially\b/i,
    /\bfacilitate\b/i,
    /\butilize\b/i,
    /\bdemonstrate(s)?\b/i,
    /\bunderscores?\b/i,
  ];

  let phraseHits = 0;
  for (const pattern of aiIndicatorPhrases) {
    if (pattern.test(text)) phraseHits++;
  }

  if (uniqueRatio < 0.55) flags.push("Low lexical diversity (repetitive vocabulary)");
  if (avgSentenceLength > 28) flags.push("Unusually long average sentence length");
  if (phraseHits >= 3) flags.push("Multiple AI-indicator phrases detected");
  if (avgSentenceLength > 20 && avgSentenceLength < 30 && sentences.length > 3) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance =
      lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
    if (Math.sqrt(variance) < 5 && lengths.length >= 4)
      flags.push("Suspiciously uniform sentence lengths");
  }

  const lexicalDiversityScore = (1 - uniqueRatio) * 100;
  const phrasePenalty = phraseHits * 8;
  const sentencePenalty = avgSentenceLength > 28 ? (avgSentenceLength - 28) * 2 : 0;

  const aiScore = Math.min(
    Math.round(lexicalDiversityScore * 0.6 + phrasePenalty + sentencePenalty),
    98
  );

  return { aiScore, lexicalDiversity, avgSentenceLength, flags };
}

// ── Burstiness (Turnitin's primary AI signal) ─────────────────────────────────
// AI text has LOW burstiness — uniformly-lengthed sentences.
// Human text has HIGH burstiness — short punchy sentences mixed with long ones.
export function computeBurstiness(text: string): { score: number; avgLen: number; stdDev: number } {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().split(/\s+/).length)
    .filter((n) => n >= 3);

  if (sentences.length < 4) return { score: 0, avgLen: 0, stdDev: 0 };

  const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
  const variance = sentences.reduce((sum, l) => sum + (l - mean) ** 2, 0) / sentences.length;
  const stdDev = Math.sqrt(variance);

  // Burstiness score: high stdDev = high burstiness = more human
  // AI text: stdDev typically 3-6; human text: stdDev typically 8-15
  const burstinessScore = Math.min(100, Math.round(stdDev * 6.5));
  return { score: burstinessScore, avgLen: Math.round(mean), stdDev: Math.round(stdDev * 10) / 10 };
}

// ── Readability scores ────────────────────────────────────────────────────────
// Implements five standard academic readability formulas.
// Inspired by wordcounter2 (Repo 6) real-time readability analysis feature.
// Formulas: Flesch-Kincaid Grade Level, Flesch Reading Ease, Gunning Fog Index,
// SMOG Index, Automated Readability Index (ARI).

export interface ReadabilityScores {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  gunningFog: number;
  smogIndex: number;
  automatedReadabilityIndex: number;
  readingLevel: string;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
}

/** Estimate syllable count for an English word */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;
  const cleaned = w.replace(/e$/, "").replace(/[aeiou]{2,}/g, "a");
  const vowelGroups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

/** Map FK grade level to a human-readable label */
function readingLevelLabel(fkGrade: number): string {
  if (fkGrade <= 6)  return "Easy (Middle School)";
  if (fkGrade <= 8)  return "Moderate (High School)";
  if (fkGrade <= 10) return "Standard (Undergraduate)";
  if (fkGrade <= 13) return "Advanced (Graduate)";
  return "Expert (Academic / Doctoral)";
}

export function computeReadabilityScores(text: string): ReadabilityScores {
  const stripped = text
    .replace(/^#+.+$/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[^$]+\$/g, "")
    .trim();

  const sentences = stripped
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 3);

  const wordList = stripped
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0);

  const numSentences = Math.max(1, sentences.length);
  const numWords     = Math.max(1, wordList.length);
  const numChars     = wordList.join("").length;

  const numSyllables = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  const complexWords  = wordList.filter(w => countSyllables(w) >= 3).length;

  const wordsPerSentence   = numWords / numSentences;
  const syllablesPerWord   = numSyllables / numWords;
  const complexWordsRatio  = complexWords / numWords;

  const fleschKincaidGrade = Math.max(0, Math.round(
    (0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59) * 10) / 10
  );

  const fleschReadingEase = Math.min(100, Math.max(0, Math.round(
    (206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord) * 10) / 10
  ));

  const gunningFog = Math.max(0, Math.round(
    0.4 * (wordsPerSentence + 100 * complexWordsRatio) * 10) / 10
  );

  const smogIndex = Math.max(0, Math.round(
    (1.0430 * Math.sqrt(complexWords * (30 / numSentences)) + 3.1291) * 10) / 10
  );

  const automatedReadabilityIndex = Math.max(0, Math.round(
    (4.71 * (numChars / numWords) + 0.5 * wordsPerSentence - 21.43) * 10) / 10
  );

  return {
    fleschKincaidGrade,
    fleschReadingEase,
    gunningFog,
    smogIndex,
    automatedReadabilityIndex,
    readingLevel: readingLevelLabel(fleschKincaidGrade),
    avgWordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
  };
}

// ── Perplexity proxy (Turnitin-style token predictability) ───────────────────
// AI models choose the most statistically probable next token, producing
// predictable n-grams. We measure this by checking how many of the text's
// 3-grams match a curated list of known AI-generated patterns.
// High match rate → low perplexity → likely AI.

const AI_TRIGRAMS = new Set([
  "it is important","it should be","it is worth","in today s","in the realm",
  "in conclusion it","furthermore it is","moreover it","additionally it",
  "it is evident","it can be","it is clear","this essay will","this paper will",
  "this study will","this report will","in order to","due to the",
  "as a result","with respect to","in terms of","it is also","can be seen",
  "can be found","plays a crucial","plays a vital","plays an important",
  "of great importance","it is essential","it is necessary","needs to be",
  "has been shown","has been found","research has shown","studies have shown",
  "one of the","in the context","in the field","the fact that","the ability to",
  "the importance of","the role of","is a key","is an important",
  "have a significant","have a major","this is a","this is an","there is a",
  "this can be","this may be","this could be","this would be","this should be",
]);

/**
 * Perplexity proxy: measures fraction of 3-grams matching known AI patterns.
 * Mirrors Turnitin's token-level predictability signal.
 * Returns 0-100 (100 = maximally predictable / AI-like, 0 = highly random / human-like).
 */
export function computePerplexityProxy(text: string): { score: number; aiTrigramCount: number; totalTrigrams: number } {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 0);
  if (words.length < 6) return { score: 0, aiTrigramCount: 0, totalTrigrams: 0 };

  let aiTrigramCount = 0;
  const totalTrigrams = Math.max(1, words.length - 2);

  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (AI_TRIGRAMS.has(trigram)) aiTrigramCount++;
  }

  // 0-100 scale: >5% AI trigrams = suspicious, >15% = very likely AI
  const fraction = aiTrigramCount / totalTrigrams;
  const score = Math.min(100, Math.round(fraction * 650));

  return { score, aiTrigramCount, totalTrigrams };
}

// ── Sentence-level AI scorer (Copyleaks AI Phrases Tool approach) ─────────────
// Assigns each sentence a 0-100 AI probability so the UI can render per-sentence
// heatmaps — matching Turnitin's and Copyleaks' phrase-level detection output.

const AI_PHRASE_LIST = [
  "it is important to note","it should be noted","it is worth noting",
  "in today's","in the realm of","furthermore","moreover","additionally",
  "in conclusion","delve into","crucial","pivotal","underscore",
  "it is evident","it can be argued","navigate the complexities",
  "shed light on","multifaceted","nuanced approach","tapestry",
  "it goes without saying","at the end of the day","it is clear that",
  "plays a vital role","plays a crucial role","has been shown to",
  "it is essential","one of the most important","it is necessary to",
];

/**
 * Score individual sentences for AI probability.
 * Implements Copyleaks' phrase-level AI probability concept.
 * Returns sentences flagged if score ≥ 30.
 */
export function scoreSentences(text: string): Array<{ text: string; score: number; flagged: boolean }> {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).length >= 4);

  return sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    const wordCount = sentence.split(/\s+/).length;
    let score = 0;

    for (const phrase of AI_PHRASE_LIST) {
      if (lower.includes(phrase)) score += 25;
    }

    // AI sweet-spot sentence length (20-30 words — uniformly produced by LLMs)
    if (wordCount >= 20 && wordCount <= 30) score += 10;
    if (wordCount >= 23 && wordCount <= 27) score += 15;

    // Short punchy sentences = burstiness signal = human-like (reduce score)
    if (wordCount <= 7) score = Math.max(0, score - 20);

    // Formulaic AI transition openers
    const aiOpeners = ["furthermore,","moreover,","additionally,","therefore,","consequently,","it is important","in conclusion,","in summary,"];
    if (aiOpeners.some(w => lower.startsWith(w))) score += 25;

    return { text: sentence, score: Math.min(100, score), flagged: score >= 30 };
  });
}

// ── Multi-section text sampler ────────────────────────────────────────────────
// Turnitin analyses the full document — not just the opening paragraphs.
// Sample beginning, middle, and end so long papers are scored throughout.
export function sampleTextSections(text: string, maxCharsPerSection = 1800): string {
  const total = text.length;
  if (total <= maxCharsPerSection * 2) return text.slice(0, maxCharsPerSection * 2);

  const start = text.slice(0, maxCharsPerSection);
  const midStart = Math.floor(total / 2) - Math.floor(maxCharsPerSection / 2);
  const mid = text.slice(midStart, midStart + maxCharsPerSection);
  const end = text.slice(total - maxCharsPerSection);

  return `[BEGINNING]\n${start}\n\n[MIDDLE]\n${mid}\n\n[END]\n${end}`;
}
