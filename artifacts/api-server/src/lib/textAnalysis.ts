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

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
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
