/**
 * Winnowing algorithm for document fingerprinting and plagiarism detection.
 * Ported to TypeScript from copydetect (Python) by blingenf:
 * https://github.com/blingenf/copydetect
 * Based on: "Winnowing: Local Algorithms for Document Fingerprinting"
 * Aiken et al., SIGMOD 2003: https://theory.stanford.edu/~aiken/publications/papers/sigmod03.pdf
 * Same approach used by Stanford MOSS plagiarism detection system.
 */

const MOD = 2 ** 32;

function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h % MOD;
}

/** Generate hashes for all k-grams in a string */
function hashedKgrams(s: string, k: number): number[] {
  const hashes: number[] = [];
  for (let i = 0; i <= s.length - k; i++) {
    hashes.push(djb2Hash(s.slice(i, i + k)));
  }
  return hashes;
}

/** Robust Winnowing algorithm — selects representative hashes from sliding windows */
function winnow(hashes: number[], windowSize: number): Map<number, number[]> {
  if (hashes.length === 0) return new Map();

  const selected = new Map<number, number[]>();
  const buffer = new Array<number>(windowSize).fill(Infinity);
  let r = -1;
  let minIdx = 0;

  for (let hashIdx = 0; hashIdx < hashes.length; hashIdx++) {
    r = (r + 1) % windowSize;
    buffer[r] = hashes[hashIdx];

    if (minIdx === r) {
      let i = (r - 1 + windowSize) % windowSize;
      while (i !== r) {
        if (buffer[i] < buffer[minIdx]) minIdx = i;
        i = (i - 1 + windowSize) % windowSize;
      }
      const trueIdx = hashIdx - ((r - minIdx + windowSize) % windowSize);
      const h = hashes[trueIdx];
      if (!selected.has(h)) selected.set(h, []);
      selected.get(h)!.push(trueIdx);
    } else {
      if (buffer[r] <= buffer[minIdx]) {
        minIdx = r;
        const h = hashes[hashIdx];
        if (!selected.has(h)) selected.set(h, []);
        selected.get(h)!.push(hashIdx);
      }
    }
  }
  return selected;
}

/** Get document fingerprints: winnowed hash → list of positions */
function getFingerprints(doc: string, k: number, winSize: number): Map<number, number[]> {
  if (doc.length < k) return new Map();
  const hashes = hashedKgrams(doc, k);
  return winnow(hashes, winSize);
}

/** Find overlapping k-gram indexes between two fingerprint maps */
function findOverlap(
  fps1: Map<number, number[]>,
  fps2: Map<number, number[]>
): { idx1: number[]; idx2: number[] } {
  const idx1: number[] = [];
  const idx2: number[] = [];
  for (const [hash, positions1] of fps1) {
    if (fps2.has(hash)) {
      idx1.push(...positions1);
      idx2.push(...fps2.get(hash)!);
    }
  }
  return { idx1, idx2 };
}

/** Merge overlapping k-gram positions into contiguous slices [start, end] */
function getCopiedSlices(idx: number[], k: number): Array<[number, number]> {
  if (idx.length === 0) return [];
  const sorted = [...new Set(idx)].sort((a, b) => a - b);
  const slices: Array<[number, number]> = [];
  let start = sorted[0];
  let end = sorted[0] + k;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] <= end) {
      end = Math.max(end, sorted[i] + k);
    } else {
      slices.push([start, end]);
      start = sorted[i];
      end = sorted[i] + k;
    }
  }
  slices.push([start, end]);
  return slices;
}

export interface CodeSimilarityResult {
  similarity1: number;
  similarity2: number;
  tokenOverlap: number;
  slices1: Array<[number, number]>;
  slices2: Array<[number, number]>;
  highlightedDoc1: string;
  highlightedDoc2: string;
}

/** Compare two text documents and return similarity metrics + highlighted versions */
export function compareDocuments(
  doc1: string,
  doc2: string,
  k = 8,
  winSize = 4
): CodeSimilarityResult {
  const fps1 = getFingerprints(doc1, k, winSize);
  const fps2 = getFingerprints(doc2, k, winSize);

  const { idx1, idx2 } = findOverlap(fps1, fps2);

  const slices1 = getCopiedSlices(idx1, k);
  const slices2 = getCopiedSlices(idx2, k);

  const coveredChars1 = countCoveredChars(slices1);
  const coveredChars2 = countCoveredChars(slices2);

  const similarity1 = doc1.length > 0 ? Math.min(100, (coveredChars1 / doc1.length) * 100) : 0;
  const similarity2 = doc2.length > 0 ? Math.min(100, (coveredChars2 / doc2.length) * 100) : 0;
  const tokenOverlap = Math.min(coveredChars1, coveredChars2);

  const highlightedDoc1 = applyHighlights(doc1, slices1, "[[HL]]", "[[/HL]]");
  const highlightedDoc2 = applyHighlights(doc2, slices2, "[[HL]]", "[[/HL]]");

  return { similarity1, similarity2, tokenOverlap, slices1, slices2, highlightedDoc1, highlightedDoc2 };
}

function countCoveredChars(slices: Array<[number, number]>): number {
  return slices.reduce((sum, [s, e]) => sum + (e - s), 0);
}

function applyHighlights(
  doc: string,
  slices: Array<[number, number]>,
  open: string,
  close: string
): string {
  if (slices.length === 0) return doc;
  let result = "";
  let cursor = 0;
  for (const [start, end] of slices) {
    if (start > cursor) result += doc.slice(cursor, start);
    result += open + doc.slice(start, Math.min(end, doc.length)) + close;
    cursor = Math.min(end, doc.length);
  }
  if (cursor < doc.length) result += doc.slice(cursor);
  return result;
}

/** Normalise text for word-level plagiarism (strip punctuation, lowercase) */
export function normaliseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quick text similarity score using Winnowing on word-level k-grams */
export function textSimilarityScore(text1: string, text2: string, k = 5): number {
  const t1 = normaliseText(text1);
  const t2 = normaliseText(text2);
  if (t1.length < k || t2.length < k) return 0;
  const fps1 = getFingerprints(t1, k, 4);
  const fps2 = getFingerprints(t2, k, 4);
  let overlap = 0;
  for (const hash of fps1.keys()) {
    if (fps2.has(hash)) overlap++;
  }
  const total = Math.max(fps1.size, fps2.size);
  return total > 0 ? Math.min(100, (overlap / total) * 100) : 0;
}
