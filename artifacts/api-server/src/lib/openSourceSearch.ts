/**
 * Open-Source Plagiarism Engine — completely free, zero paid APIs required.
 *
 * Sources checked:
 *  1. Open Library (openlibrary.org)   — 20M+ book records, no key
 *  2. Wikipedia REST API               — all articles, no key
 *  3. Google Books Volumes API         — 1,000 free req/day, no key required
 *  4. Internet Archive (archive.org)   — 70M+ items including web archives, no key
 *  5. Crossref DOI search              — 145M+ academic DOI records, no key
 *
 * Algorithm:
 *  1. Sentence-level segmentation — split text into meaningful sentences
 *  2. Distinctiveness scoring — rank sentences by information density
 *     (sentences with numbers, proper nouns, and specific claims are most likely to be plagiarised)
 *  3. 8-word n-gram fingerprint — extract the densest 8-word phrase from each sentence
 *  4. Concurrent multi-source search — query all 5 sources in parallel per phrase
 *  5. Match percentage — report what % of sentences have external source matches
 *  6. Sentence-level highlighting — return which sentences match which sources
 *
 * This approach replicates the core of commercial plagiarism detectors
 * (CopyLeaks, Turnitin, Copyscape) without paying for their web-spider indices.
 * What we cover: books, academic papers, Wikipedia, open web archives.
 * What we don't cover: paywalled journal full-text, private student paper repos.
 */

export interface SourceMatch {
  url: string;
  title: string;
  authors?: string;
  year?: number;
  source: "open-library" | "wikipedia" | "google-books" | "internet-archive" | "crossref";
  matchedPhrase: string;
  confidence: number;
}

export interface SentenceMatch {
  sentence: string;
  startIndex: number;
  endIndex: number;
  sources: SourceMatch[];
  matchScore: number;
}

export interface OpenSourceResult {
  overallScore: number;
  matchedSentences: SentenceMatch[];
  totalSentencesChecked: number;
  sourcesFound: SourceMatch[];
  breakdown: {
    webContent: number;
    books: number;
    academic: number;
    wikipedia: number;
  };
}

// ── Sentence extraction ────────────────────────────────────────────────────────

const STOP_WORDS_SET = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","this","that","these","those","is","are","was","were","be",
  "been","being","have","has","had","do","does","did","will","would","could",
  "should","may","might","can","it","its","as","if","not","no","nor","so",
  "yet","both","either","neither","each","few","more","most","other","some",
  "such","than","then","too","very","just","about","above","after","before",
  "between","into","through","during","including","however","therefore",
  "their","they","them","there","here","where","when","which","who","what",
]);

function splitSentences(text: string): Array<{ text: string; start: number }> {
  const results: Array<{ text: string; start: number }> = [];
  const re = /[^.!?]+[.!?]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = m[0].trim();
    if (s.split(/\s+/).length >= 8) {
      results.push({ text: s, start: m.index });
    }
  }
  return results;
}

/** Score a sentence by how distinctive/specific it is — higher = more likely to be plagiarised */
function distinctivenessScore(sentence: string): number {
  let score = 0;
  const words = sentence.split(/\s+/);

  // Numbers, percentages, years → very distinctive
  if (/\d{4}/.test(sentence)) score += 15;
  if (/\d+\.?\d*\s*%/.test(sentence)) score += 15;
  if (/\d+/.test(sentence)) score += 5;

  // Proper nouns (capitalized mid-sentence)
  const properNouns = words.slice(1).filter(w => /^[A-Z][a-z]+/.test(w)).length;
  score += properNouns * 8;

  // Citations e.g. (Smith, 2019) or [1]
  if (/\([A-Z][a-z]+,?\s*\d{4}\)|\[\d+\]/.test(sentence)) score += 20;

  // Technical/academic vocabulary (non-stop unique words)
  const unique = new Set(words.map(w => w.toLowerCase()).filter(w => !STOP_WORDS_SET.has(w)));
  score += unique.size;

  // Longer sentences are more identifiable
  score += Math.min(words.length - 8, 20);

  return score;
}

/** Extract the most distinctive 8-word n-gram from a sentence */
function extractFingerprint(sentence: string): string {
  const words = sentence.replace(/["""'']/g, "").split(/\s+/).filter(Boolean);
  if (words.length <= 8) return words.join(" ");

  let bestStart = 0;
  let bestDensity = -1;

  for (let i = 0; i <= words.length - 8; i++) {
    const window = words.slice(i, i + 8);
    // Count non-stop-words (more = more distinctive)
    const density = window.filter(w => !STOP_WORDS_SET.has(w.toLowerCase())).length;
    if (density > bestDensity) {
      bestDensity = density;
      bestStart = i;
    }
  }

  return words.slice(bestStart, bestStart + 8).join(" ");
}

// ── Source searchers ───────────────────────────────────────────────────────────

async function searchOpenLibrary(phrase: string): Promise<SourceMatch[]> {
  try {
    const params = new URLSearchParams({ q: `"${phrase}"`, limit: "3", fields: "key,title,author_name,first_publish_year" });
    const res = await fetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 Academic Plagiarism Tool" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { docs?: Array<{ key: string; title?: string; author_name?: string[]; first_publish_year?: number }> };
    return (data.docs ?? []).slice(0, 2).map(doc => ({
      url: `https://openlibrary.org${doc.key}`,
      title: doc.title ?? "Unknown Book",
      authors: (doc.author_name ?? []).slice(0, 2).join(", "),
      year: doc.first_publish_year,
      source: "open-library" as const,
      matchedPhrase: phrase,
      confidence: 45,
    }));
  } catch { return []; }
}

async function searchWikipedia(phrase: string): Promise<SourceMatch[]> {
  try {
    const params = new URLSearchParams({
      action: "query", list: "search", srsearch: phrase,
      format: "json", origin: "*", srlimit: "2", srprop: "snippet",
    });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { query?: { search?: Array<{ pageid: number; title: string; snippet: string }> } };
    return (data.query?.search ?? []).slice(0, 2).map(item => ({
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      title: item.title,
      source: "wikipedia" as const,
      matchedPhrase: phrase,
      confidence: 40,
    }));
  } catch { return []; }
}

async function searchGoogleBooks(phrase: string): Promise<SourceMatch[]> {
  try {
    const params = new URLSearchParams({ q: `"${phrase}"`, maxResults: "2", fields: "items(volumeInfo/title,volumeInfo/authors,volumeInfo/publishedDate,volumeInfo/infoLink)" });
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { items?: Array<{ volumeInfo?: { title?: string; authors?: string[]; publishedDate?: string; infoLink?: string } }> };
    return (data.items ?? []).slice(0, 2).map(item => {
      const info = item.volumeInfo ?? {};
      const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : undefined;
      return {
        url: info.infoLink ?? "https://books.google.com",
        title: info.title ?? "Unknown Book",
        authors: (info.authors ?? []).slice(0, 2).join(", "),
        year,
        source: "google-books" as const,
        matchedPhrase: phrase,
        confidence: 50,
      };
    });
  } catch { return []; }
}

async function searchInternetArchive(phrase: string): Promise<SourceMatch[]> {
  try {
    const params = new URLSearchParams({
      q: phrase, output: "json", rows: "2",
      "fl[]": "title,identifier,creator,year",
      "sort[]": "score desc",
    });
    const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { response?: { docs?: Array<{ identifier?: string; title?: string; creator?: string | string[]; year?: string }> } };
    return (data.response?.docs ?? []).slice(0, 1).map(doc => ({
      url: `https://archive.org/details/${doc.identifier ?? ""}`,
      title: doc.title ?? "Unknown Item",
      authors: Array.isArray(doc.creator) ? doc.creator.slice(0, 2).join(", ") : (doc.creator ?? ""),
      year: doc.year ? parseInt(doc.year) : undefined,
      source: "internet-archive" as const,
      matchedPhrase: phrase,
      confidence: 35,
    }));
  } catch { return []; }
}

async function searchCrossref(phrase: string): Promise<SourceMatch[]> {
  try {
    const params = new URLSearchParams({ query: phrase, rows: "2", select: "DOI,title,author,published" });
    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:admin@lightspeedghost.com)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      message?: {
        items?: Array<{
          DOI?: string;
          title?: string[];
          author?: Array<{ given?: string; family?: string }>;
          published?: { "date-parts"?: number[][] };
        }>;
      };
    };
    return (data.message?.items ?? []).slice(0, 2).map(item => {
      const authors = (item.author ?? [])
        .slice(0, 2)
        .map(a => [a.given, a.family].filter(Boolean).join(" "))
        .join(", ");
      const year = item.published?.["date-parts"]?.[0]?.[0];
      return {
        url: item.DOI ? `https://doi.org/${item.DOI}` : "https://crossref.org",
        title: (item.title ?? ["Unknown"])[0],
        authors,
        year,
        source: "crossref" as const,
        matchedPhrase: phrase,
        confidence: 55,
      };
    });
  } catch { return []; }
}

// ── Main search function ───────────────────────────────────────────────────────

/**
 * Run a full open-source plagiarism check against free APIs.
 * Takes up to 10 seconds — designed to run in parallel with the local check.
 */
export async function runOpenSourcePlagiarismCheck(text: string): Promise<OpenSourceResult> {
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return {
      overallScore: 0,
      matchedSentences: [],
      totalSentencesChecked: 0,
      sourcesFound: [],
      breakdown: { webContent: 0, books: 0, academic: 0, wikipedia: 0 },
    };
  }

  // Rank sentences by distinctiveness, pick the top 6 to check
  const ranked = sentences
    .map(s => ({ ...s, score: distinctivenessScore(s.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  // For each candidate sentence, extract fingerprint and search all sources concurrently
  const sentenceMatchResults: SentenceMatch[] = [];

  await Promise.allSettled(
    ranked.map(async (candidate) => {
      const fingerprint = extractFingerprint(candidate.text);

      const [wikiMatches, bookMatches, googleMatches, archiveMatches, crossrefMatches] =
        await Promise.all([
          searchWikipedia(fingerprint),
          searchOpenLibrary(fingerprint),
          searchGoogleBooks(fingerprint),
          searchInternetArchive(fingerprint),
          searchCrossref(fingerprint),
        ]);

      const allSources = [...wikiMatches, ...bookMatches, ...googleMatches, ...archiveMatches, ...crossrefMatches];

      if (allSources.length > 0) {
        const matchScore = Math.min(
          95,
          allSources.reduce((sum, s) => sum + s.confidence, 0) / allSources.length + (allSources.length > 2 ? 15 : 0),
        );

        sentenceMatchResults.push({
          sentence: candidate.text,
          startIndex: candidate.start,
          endIndex: candidate.start + candidate.text.length,
          sources: allSources.slice(0, 4),
          matchScore,
        });
      }
    }),
  );

  const allSources = sentenceMatchResults.flatMap(m => m.sources);
  const uniqueSources = allSources.filter(
    (s, i) => allSources.findIndex(x => x.url === s.url) === i,
  ).slice(0, 8);

  const matchRate = ranked.length > 0 ? sentenceMatchResults.length / ranked.length : 0;
  const overallScore = Math.round(matchRate * 100);

  const breakdown = {
    webContent: uniqueSources.filter(s => s.source === "internet-archive").length > 0 ? Math.min(overallScore, 25) : 0,
    books: uniqueSources.filter(s => s.source === "open-library" || s.source === "google-books").length > 0 ? Math.min(overallScore, 30) : 0,
    academic: uniqueSources.filter(s => s.source === "crossref").length > 0 ? Math.min(overallScore, 20) : 0,
    wikipedia: uniqueSources.filter(s => s.source === "wikipedia").length > 0 ? Math.min(overallScore, 15) : 0,
  };

  return {
    overallScore,
    matchedSentences: sentenceMatchResults,
    totalSentencesChecked: ranked.length,
    sourcesFound: uniqueSources,
    breakdown,
  };
}
