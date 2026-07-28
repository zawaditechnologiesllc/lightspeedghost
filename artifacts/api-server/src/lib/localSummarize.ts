/**
 * Local extractive summariser — a no-API, no-model, pure-TypeScript engine that
 * fills the same slot as facebook/bart-large-cnn (study summaries) but runs
 * inside our Node backend for free. It's *extractive* (it selects and ranks the
 * document's own most-central sentences) rather than *abstractive* (BART rewrites
 * in new words), so it never hallucinates — every line is verbatim from the
 * source, which is exactly what you want for study material.
 *
 * Algorithm = classic TextRank (Mihalcea & Tarau, 2004):
 *   1. Split into sentences.
 *   2. Build a graph where each sentence is a node and edges are weighted by
 *      lexical overlap (normalised by length — the original TextRank measure).
 *   3. Run PageRank (power iteration) over the graph → centrality per sentence.
 *   4. Return the top-ranked sentences, restored to original reading order.
 *
 * No external services. Deterministic. O(n²) in sentence count, which is fine
 * for study-length inputs (we cap at MAX_SENTENCES).
 */

const STOP = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","as","is","was","are",
  "were","be","been","being","have","has","had","do","does","did","will","would","could","should","may",
  "might","shall","that","this","these","those","it","its","which","who","what","when","where","how","if",
  "then","than","so","yet","not","no","nor","any","each","all","also","into","over","about","up","out","can",
  "one","two","i","we","you","they","he","she","our","their","your","his","her","my","there","here","such",
  "will","just","only","more","most","some","other","been","because","between","both","during","through",
]);

const MAX_SENTENCES = 400;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4 && s.length >= 25);
}

function words(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/** Original TextRank sentence-overlap weight: shared words / (log|a| + log|b|). */
function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let shared = 0;
  const seen = new Set<string>();
  for (const w of a) {
    if (seen.has(w)) continue;
    seen.add(w);
    if (sb.has(w)) shared++;
  }
  const denom = Math.log(a.length + 1) + Math.log(b.length + 1);
  return denom > 0 ? shared / denom : 0;
}

function textRank(sentences: string[]): number[] {
  const n = sentences.length;
  const toks = sentences.map(words);
  const w: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const outSum = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = overlap(toks[i], toks[j]);
      w[i][j] = sim;
      w[j][i] = sim;
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) outSum[i] += w[i][j];

  const d = 0.85;
  let score = new Array(n).fill(1 / n);
  for (let iter = 0; iter < 30; iter++) {
    const next = new Array(n).fill((1 - d) / n);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let j = 0; j < n; j++) {
        if (i === j || w[j][i] === 0 || outSum[j] === 0) continue;
        acc += (w[j][i] / outSum[j]) * score[j];
      }
      next[i] += d * acc;
    }
    score = next;
  }
  return score;
}

/** Document term-frequency, used to surface key terms (excluding stop-words). */
function topTerms(text: string, limit: number): string[] {
  const tf = new Map<string, number>();
  for (const w of words(text)) tf.set(w, (tf.get(w) ?? 0) + 1);
  return [...tf.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

export interface ExtractiveSummary {
  overview: string;
  keySentences: string[];
  keyTerms: string[];
}

/** Core: rank sentences and return the top `maxSentences`, in reading order. */
export function summarizeExtractive(text: string, maxSentences = 5): ExtractiveSummary {
  const all = splitSentences(text).slice(0, MAX_SENTENCES);
  if (all.length === 0) {
    const fallback = text.trim().slice(0, 240);
    return { overview: fallback, keySentences: fallback ? [fallback] : [], keyTerms: topTerms(text, 8) };
  }
  if (all.length <= maxSentences) {
    return { overview: all[0], keySentences: all, keyTerms: topTerms(text, 8) };
  }

  const scores = textRank(all);
  const ranked = all
    .map((s, i) => ({ s, i, score: scores[i] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences);

  const chosen = new Set(ranked.map((r) => r.i));
  const keySentences = all.filter((_, i) => chosen.has(i)); // reading order
  // Overview = single most-central sentence.
  const overview = ranked[0].s;
  return { overview, keySentences, keyTerms: topTerms(text, 10) };
}

/**
 * Build a structured summary matching the study "summary" JSON shape the client
 * already renders — but produced with zero LLM calls. Sections are formed by
 * splitting the document into ordered chunks and extracting each chunk's most
 * central lines, so the result reads like a real outline of the source.
 */
export interface StructuredSummary {
  title: string;
  overview: string;
  sections: Array<{ heading: string; points: string[]; keyTerms: Array<{ term: string; definition: string }> }>;
  takeaways: string[];
  relatedConcepts: string[];
}

export function summarizeStructured(text: string, subject = "General"): StructuredSummary {
  const sentences = splitSentences(text).slice(0, MAX_SENTENCES);
  const globalTerms = topTerms(text, 12);
  const top = summarizeExtractive(text, 6);

  // Title: the highest-frequency capitalised noun phrase, else the subject.
  const titleMatch = text.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})\b/);
  const title = (titleMatch?.[1] && titleMatch[1].length > 4 ? titleMatch[1] : subject).slice(0, 80);

  // Sections: split the sentence list into up to 4 ordered chunks, summarise each.
  const sectionCount = Math.min(4, Math.max(1, Math.ceil(sentences.length / 6)));
  const perChunk = Math.ceil(sentences.length / sectionCount);
  const sections: StructuredSummary["sections"] = [];
  for (let c = 0; c < sectionCount; c++) {
    const chunk = sentences.slice(c * perChunk, (c + 1) * perChunk);
    if (chunk.length === 0) continue;
    const chunkText = chunk.join(" ");
    const chunkSummary = summarizeExtractive(chunkText, Math.min(3, chunk.length));
    const chunkTerms = topTerms(chunkText, 3);
    sections.push({
      heading: chunkTerms.length ? `${chunkTerms[0].replace(/^\w/, (m) => m.toUpperCase())} & related concepts` : `Part ${c + 1}`,
      points: chunkSummary.keySentences.map((s) => (s.length > 220 ? s.slice(0, 220) + "…" : s)),
      keyTerms: chunkTerms.map((t) => ({
        term: t,
        // Definition = the source sentence where the term first appears (verbatim, no hallucination).
        definition: (chunk.find((s) => s.toLowerCase().includes(t)) ?? "").slice(0, 180),
      })).filter((kt) => kt.definition),
    });
  }

  return {
    title,
    overview: top.overview,
    sections: sections.length ? sections : [{ heading: "Overview", points: top.keySentences, keyTerms: [] }],
    takeaways: top.keySentences.slice(0, 4).map((s) => (s.length > 200 ? s.slice(0, 200) + "…" : s)),
    relatedConcepts: globalTerms.slice(0, 6).map((t) => t.replace(/^\w/, (m) => m.toUpperCase())),
  };
}
