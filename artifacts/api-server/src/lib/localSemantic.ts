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
import { canonicalizeForMatch } from "./localSpell";

// A compact, curated academic synonym map: fold common interchangeable words to
// a single canonical form so a thesaurus swap can't defeat the match. Kept small
// and high-precision on purpose — only near-exact synonyms, no risky conflations.
// Curated for PRECISION: only low-ambiguity synonyms (words unlikely to carry a
// different literal meaning) are folded, so we never create a false match. Note
// values are also stemmed downstream, so both sides converge on one token.
const SYNONYM_CANON: Record<string, string> = {
  utilize: "use", utilise: "use", utilization: "use", employ: "use",
  demonstrate: "show", illustrate: "show", reveal: "show",
  facilitate: "help", assist: "help",
  crucial: "important", vital: "important", essential: "important", significant: "important", paramount: "important",
  numerous: "many", various: "many", multiple: "many", several: "many",
  obtain: "get", acquire: "get",
  additionally: "also", furthermore: "also", moreover: "also",
  nevertheless: "but", nonetheless: "but",
  therefore: "so", thus: "so", hence: "so", consequently: "so",
  approximately: "about", roughly: "about",
  commence: "start", initiate: "start", begin: "start",
  terminate: "end", conclude: "end",
  investigate: "study", examine: "study", analyse: "study", analyze: "study",
  methodology: "method", methodologies: "method", approach: "method", technique: "method", procedure: "method",
  individuals: "people", persons: "people",
  comprehend: "understand",
  endeavour: "try", endeavor: "try", attempt: "try",
  subsequently: "later", previously: "before",
  // Descriptive synonyms.
  huge: "large", enormous: "large", immense: "large", massive: "large", substantial: "large",
  tiny: "little", slight: "little",
  quick: "fast", rapid: "fast", swift: "fast", speedy: "fast",
  intelligent: "smart", clever: "smart",
  strengthen: "improve", enhance: "improve", bolster: "improve", augment: "improve",
  reduce: "decrease", lessen: "decrease", diminish: "decrease",
  increase: "raise", growth: "raise", expand: "raise", escalate: "raise",
  affect: "influence", influenced: "influence",
  elucidate: "clarify",
  imply: "indicate", denote: "indicate", signify: "indicate",
  assert: "claim", contend: "claim", posit: "claim", contention: "claim", thesis: "claim",
  prevalent: "widespread", ubiquitous: "widespread",
  challenging: "difficult", arduous: "difficult",
  precise: "accurate", exact: "accurate",
  erroneous: "incorrect", flawed: "incorrect",
  objective: "aim", purpose: "aim", intention: "aim",
  outcome: "result", consequence: "result", finding: "result",
  notion: "concept", theme: "concept",
  obstacle: "issue", hurdle: "issue", difficulty: "issue",
  teacher: "educator", instructor: "educator", tutor: "educator", professor: "educator", lecturer: "educator",
  pupil: "student", learner: "student",
  modify: "alter", transform: "alter", revise: "alter",
  retain: "maintain", preserve: "maintain", sustain: "maintain",
  // Domain synonyms that show up constantly in student writing.
  teenage: "adolescent", teenager: "adolescent", teen: "adolescent", youth: "adolescent",
  psychological: "mental", psychology: "mental",
  wellbeing: "health", wellness: "health", welfare: "health",
};

// Conservative inflectional stemmer (no derivational stripping → low over-stem
// risk). Folds plural / -ing / -ed / -ly so "argues", "arguing", "argued" match.
// Char-trigrams below cover derivational overlap (educate ≈ education).
function stem(w: string): string {
  if (w.length <= 4) return w;
  let s = w;
  if (/ies$/.test(s) && s.length > 4) s = s.slice(0, -3) + "y";
  else if (/(ches|shes|sses|xes|zes)$/.test(s)) s = s.slice(0, -2);
  else if (/([^s])s$/.test(s) && !/(ss|us|is|ous)$/.test(s)) s = s.slice(0, -1);
  if (/([a-z])\1ing$/.test(s)) s = s.slice(0, -4);          // running → run
  else if (/ing$/.test(s) && s.length > 5) s = s.slice(0, -3);
  else if (/([a-z])\1ed$/.test(s)) s = s.slice(0, -3);      // planned → plan
  else if (/ed$/.test(s) && s.length > 4) s = s.slice(0, -2);
  if (/ly$/.test(s) && s.length > 4) s = s.slice(0, -2);
  return s.length >= 3 ? s : w;
}

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

/**
 * Tokenise, drop stop-words, and fold each token to a canonical form so
 * spelling, synonym, and morphology variants all compare as equal:
 *   typo-correct → synonym-canonicalise → inflectional stem.
 */
function contentTokens(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => {
      const spellFixed = canonicalizeForMatch(w);          // recieve → receive
      const stemmed = stem(spellFixed);                    // improves/improved → improv
      // Fold synonyms on BOTH the surface and the stem, so inflected synonyms
      // ("affected", "influenced") still collapse to one canonical, then stem
      // the canonical so both sides land on the same token.
      const syn = SYNONYM_CANON[spellFixed] ?? SYNONYM_CANON[stemmed] ?? stemmed;
      return stem(syn);
    });
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
