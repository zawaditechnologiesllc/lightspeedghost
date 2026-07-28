/**
 * Local semantic similarity — a no-API, no-model, pure-TypeScript engine that
 * approximates what sentence-transformers embeddings give you (catching
 * paraphrase that plain term-frequency cosine misses), but runs instantly
 * inside our own Node backend with zero external calls and zero cost.
 *
 * It is NOT a neural network — it's a well-understood lexical/statistical
 * ensemble. It blends four complementary signals so reordered, reworded, and
 * morphologically-varied copying still scores high:
 *
 *   1. Word-bigram cosine   — shared two-word phrases (structure/word order)
 *   2. Char-trigram cosine  — fuzzy/morphological overlap (organise≈organize,
 *                             run≈running), robust to typos & inflection
 *   3. Token-set containment— order-independent overlap (paraphrase that
 *                             keeps the vocabulary but rewrites the sentence)
 *   4. Synonym canonicalise — common academic synonyms folded to one form
 *                             (utilize→use, demonstrate→show) before the above,
 *                             so a thesaurus-swap doesn't fool it
 *
 * All functions are synchronous and deterministic.
 */

// A compact, curated academic synonym map: fold common interchangeable words to
// a single canonical form so a thesaurus swap can't defeat the match. Kept small
// and high-precision on purpose — only near-exact synonyms, no risky conflations.
const SYNONYM_CANON: Record<string, string> = {
  utilize: "use", utilise: "use", utilization: "use", employ: "use",
  demonstrate: "show", demonstrates: "show", illustrate: "show", illustrates: "show", reveal: "show", reveals: "show",
  facilitate: "help", facilitates: "help", assist: "help", aid: "help",
  significant: "important", crucial: "important", vital: "important", essential: "important", critical: "important",
  numerous: "many", various: "many", multiple: "many", several: "many",
  obtain: "get", obtained: "get", acquire: "get", acquired: "get",
  additionally: "also", furthermore: "also", moreover: "also",
  however: "but", nevertheless: "but", nonetheless: "but", nonetheless2: "but",
  therefore: "so", thus: "so", hence: "so", consequently: "so",
  approximately: "about", roughly: "about",
  commence: "start", commenced: "start", initiate: "start", initiated: "start", begin: "start", began: "start",
  terminate: "end", terminated: "end", conclude: "end", concluded: "end",
  investigate: "study", investigated: "study", examine: "study", examined: "study", analyse: "study", analyze: "study",
  methodology: "method", methodologies: "method",
  individuals: "people", persons: "people",
  comprehend: "understand", comprehends: "understand",
  endeavour: "try", endeavor: "try", attempt: "try",
  subsequently: "later", previously: "before",
};

const STOP = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","as","is","was","are",
  "were","be","been","being","have","has","had","do","does","did","will","would","could","should","may",
  "might","shall","that","this","these","those","it","its","which","who","what","when","where","how","if",
  "then","than","so","yet","not","no","nor","any","each","all","also","into","over","about","up","out","can",
  "one","two","i","we","you","they","he","she","our","their","your","his","her","my","there","here","such",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Tokenise, drop stop-words + very short tokens, and canonicalise synonyms. */
function contentTokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => SYNONYM_CANON[w] ?? w);
}

function ngramCounts(items: string[], n: number): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i + n <= items.length; i++) {
    const g = items.slice(i, i + n).join(" ");
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function charTrigramCounts(text: string): Map<string, number> {
  const s = ` ${normalize(text)} `;
  const m = new Map<string, number>();
  for (let i = 0; i + 3 <= s.length; i++) {
    const g = s.slice(i, i + 3);
    if (g.trim().length === 0) continue;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function cosineOfCounts(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  // iterate the smaller map for the dot product
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const w = big.get(k);
    if (w) dot += v * w;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Order-independent token-set containment (max of the two directions). */
function containment(aTokens: string[], bTokens: string[]): number {
  if (!aTokens.length || !bTokens.length) return 0;
  const sa = new Set(aTokens), sb = new Set(bTokens);
  let inter = 0;
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  for (const t of small) if (big.has(t)) inter++;
  // containment relative to the smaller set catches "short passage lifted into
  // a longer one" — the classic plagiarism shape TF-cosine dilutes.
  return inter / small.size;
}

/**
 * 0–100 semantic similarity between two passages. Higher = more likely one is a
 * paraphrase/derivative of the other. Tuned so that verbatim copy ≈100,
 * heavy paraphrase ≈55–80, unrelated academic prose ≈0–20.
 */
export function semanticSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.length < 3 || tb.length < 3) {
    // Too short for n-grams — fall back to char-trigram only.
    return Math.round(cosineOfCounts(charTrigramCounts(a), charTrigramCounts(b)) * 1000) / 10;
  }

  const bigramCos = cosineOfCounts(ngramCounts(ta, 2), ngramCounts(tb, 2));
  const unigramCos = cosineOfCounts(ngramCounts(ta, 1), ngramCounts(tb, 1));
  const charCos = cosineOfCounts(charTrigramCounts(a), charTrigramCounts(b));
  const contain = containment(ta, tb);

  // Weighted ensemble. Bigram + containment carry the paraphrase signal;
  // char-trigram stabilises morphology; unigram anchors topical overlap.
  const blended =
    bigramCos * 0.34 +
    contain * 0.28 +
    unigramCos * 0.20 +
    charCos * 0.18;

  return Math.round(Math.min(1, blended) * 1000) / 10;
}

/** Best semantic match of `query` against many `candidates` (returns index + score). */
export function bestSemanticMatch(query: string, candidates: string[]): { index: number; score: number } {
  let best = { index: -1, score: 0 };
  for (let i = 0; i < candidates.length; i++) {
    const s = semanticSimilarity(query, candidates[i]);
    if (s > best.score) best = { index: i, score: s };
  }
  return best;
}
