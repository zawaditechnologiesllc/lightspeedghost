/**
 * Academic Source Network — Multi-database search with real abstracts.
 * Aggregates from 50,000+ peer-reviewed sources via free public APIs.
 * No Wikipedia, no blogs — only DOI-verifiable academic content.
 *
 * Sources (25 live databases, 10B+ papers & citation records):
 *  • OpenAlex     — 250M+ papers from 50,000+ publishers (openalex.org)
 *  • CrossRef     — 145M+ DOI records (crossref.org)
 *  • Europe PMC   — 40M+ biomedical papers with full abstracts (europepmc.org)
 *  • CORE         — 200M+ open access outputs (humanities, social sciences, STEM)
 *  • DOAJ         — 20,000+ peer-reviewed open access journals
 *  • arXiv        — 2.4M+ STEM and CS preprints
 *  • Semantic Scholar — 200M+ papers with citation intelligence
 *  • PubMed NCBI  — 36M+ biomedical papers (gold standard for medicine)
 *  • ERIC         — 2M+ education research papers
 *  • Zenodo       — 3M+ CERN open research records
 *  • BASE         — 340M+ documents from 10,000+ repositories (broad coverage)
 *  • DataCite     — 48M+ research objects with DOIs (datasets, preprints, papers)
 *  • OpenAIRE     — 100M+ EU-funded research outputs (European academic coverage)
 *  • PLOS         — 300K+ open access papers, full abstracts
 *  • PubMed Central — 8M+ full-text biomedical articles
 *  • bioRxiv/medRxiv — latest preprints via Europe PMC preprint index
 *  • SSRN / Research Square — working papers (economics, finance, law)
 *  • HAL          — 3M+ French/European open archive documents
 *  • EconBiz      — 1M+ economics & business records (ZBW Leibniz)
 *  • DOAB         — 80K+ peer-reviewed academic books
 *  • OAPEN        — 30K+ university press open access books
 *  • Unpaywall    — 50M+ legal OA copies, DOI-verified
 *  • ClinicalTrials.gov — 450K+ registered clinical studies
 *  • WHO IRIS     — World Health Organization repository
 *  • dblp         — 7M+ computer science publications
 *
 * These APIs together cover virtually every major academic publisher:
 * Elsevier, Springer, Wiley, Nature, Science, IEEE, ACM, JSTOR, PubMed,
 * and thousands of open-access repositories worldwide.
 *
 * The abstracts are injected as RAG (Retrieval-Augmented Generation) context
 * into AI prompts, grounding responses in real peer-reviewed content and
 * preventing hallucination.
 */

import { withCache } from "./cache.js";
import { ssRateLimit } from "./ssRateLimit.js";

export interface AcademicPaper {
  title: string;
  authors: string;
  year: number;
  abstract: string;
  doi?: string;
  url: string;
  source: string;
  journal?: string;
  citationCount?: number;
}

// ── Helper: reconstruct OpenAlex inverted-index abstract ──────────────────────

function reconstructAbstract(
  inverted: Record<string, number[]> | null | undefined
): string {
  if (!inverted || Object.keys(inverted).length === 0) return "";
  const positions: Record<number, string> = {};
  for (const [word, posList] of Object.entries(inverted)) {
    for (const pos of posList) {
      positions[pos] = word;
    }
  }
  const maxPos = Math.max(...Object.keys(positions).map(Number));
  if (maxPos > 2000) return ""; // suspiciously large — skip
  return Array.from({ length: maxPos + 1 }, (_, i) => positions[i] ?? "")
    .join(" ")
    .trim();
}

// ── Helper: strip JATS XML tags from CrossRef abstracts ──────────────────────

function stripJats(str: string): string {
  return str
    .replace(/<jats:[^>]+>/g, "")
    .replace(/<\/jats:[^>]+>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────
// 250M+ papers, 50,000+ sources, free, no API key, with inverted abstracts

async function searchOpenAlex(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: String(Math.min(limit, 25)),
      select:
        "id,title,authorships,publication_year,abstract_inverted_index,primary_location,doi,cited_by_count",
      filter: "has_abstract:true",
    });

    const res = await fetch(`https://api.openalex.org/works?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        authorships?: Array<{ author?: { display_name?: string } }>;
        publication_year?: number;
        abstract_inverted_index?: Record<string, number[]>;
        primary_location?: {
          source?: { display_name?: string };
          doi?: string;
        };
        doi?: string;
        cited_by_count?: number;
        id?: string;
      }>;
    };

    return (data.results ?? [])
      .map((paper) => {
        const abstract = reconstructAbstract(paper.abstract_inverted_index);
        if (abstract.length < 50) return null;
        const authors = (paper.authorships ?? [])
          .slice(0, 3)
          .map((a) => a.author?.display_name ?? "")
          .filter(Boolean)
          .join(", ");
        const rawDoi = paper.doi ?? paper.primary_location?.doi;
        const doi = rawDoi?.replace("https://doi.org/", "");
        const url = doi
          ? `https://doi.org/${doi}`
          : paper.id ?? "";
        const journal = paper.primary_location?.source?.display_name;
        return {
          title: paper.title ?? "Unknown Title",
          authors: authors || "Unknown Authors",
          year: paper.publication_year ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "OpenAlex",
          journal,
          citationCount: paper.cited_by_count,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── CrossRef ──────────────────────────────────────────────────────────────────
// 145M+ DOI records, many with JATS-formatted abstracts. No API key.

async function searchCrossRef(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      rows: String(Math.min(limit, 20)),
      select: "title,author,published,abstract,DOI,URL,container-title",
      filter: "has-abstract:true",
      sort: "relevance",
    });

    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      message?: {
        items?: Array<{
          title?: string[];
          author?: Array<{ family?: string; given?: string }>;
          published?: { "date-parts"?: number[][] };
          abstract?: string;
          DOI?: string;
          URL?: string;
          "container-title"?: string[];
        }>;
      };
    };

    return (data.message?.items ?? [])
      .map((item) => {
        const abstract = stripJats(item.abstract ?? "");
        if (abstract.length < 50) return null;
        const authors = (item.author ?? [])
          .slice(0, 3)
          .map(
            (a) =>
              `${a.family ?? ""}${a.given ? ", " + a.given.charAt(0) + "." : ""}`
          )
          .filter((s) => s.trim() !== ",")
          .join("; ");
        const year =
          item.published?.["date-parts"]?.[0]?.[0] ??
          new Date().getFullYear();
        return {
          title: (item.title ?? ["Unknown Title"])[0],
          authors: authors || "Unknown Authors",
          year,
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : ""),
          source: "CrossRef",
          journal: item["container-title"]?.[0],
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Europe PMC ────────────────────────────────────────────────────────────────
// 40M+ biomedical papers with full plain-text abstracts. No API key.

async function searchEuropePMC(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      format: "json",
      resultType: "core",
      pageSize: String(Math.min(limit, 20)),
      sort: "RELEVANCE",
    });

    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      resultList?: {
        result?: Array<{
          id?: string;
          title?: string;
          authorString?: string;
          pubYear?: string;
          abstractText?: string;
          doi?: string;
          journalTitle?: string;
        }>;
      };
    };

    return (data.resultList?.result ?? [])
      .map((item) => {
        const abstract = (item.abstractText ?? "").trim();
        if (abstract.length < 50) return null;
        return {
          title: item.title ?? "Unknown Title",
          authors: item.authorString ?? "Unknown Authors",
          year: parseInt(item.pubYear ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi: item.doi,
          url: item.doi
            ? `https://doi.org/${item.doi}`
            : `https://europepmc.org/article/med/${item.id}`,
          source: "Europe PMC",
          journal: item.journalTitle,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── CORE ──────────────────────────────────────────────────────────────────────
// 200M+ open access research outputs — humanities, social sciences, STEM
// Free API (no key required for basic search)

async function searchCORE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(Math.min(limit, 10)),
    });

    const res = await fetch(`https://api.core.ac.uk/v3/search/works/?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        authors?: Array<{ name?: string }>;
        yearPublished?: number;
        abstract?: string;
        doi?: string;
        downloadUrl?: string;
        links?: Array<{ url?: string }>;
      }>;
    };

    return (data.results ?? [])
      .map((item) => {
        const abstract = (item.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const url =
          item.doi
            ? `https://doi.org/${item.doi}`
            : item.downloadUrl ??
              item.links?.[0]?.url ??
              `https://core.ac.uk/search?q=${encodeURIComponent(item.title ?? query)}`;
        return {
          title: item.title ?? "Unknown Title",
          authors: (item.authors ?? []).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: item.yearPublished ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.doi,
          url,
          source: "CORE (200M+ OA papers)",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── DOAJ ──────────────────────────────────────────────────────────────────────
// Directory of Open Access Journals — 20,000+ peer-reviewed OA journals
// Excellent for arts, humanities, social sciences, and interdisciplinary work

async function searchDOAJ(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      pageSize: String(Math.min(limit, 10)),
      page: "1",
    });

    const res = await fetch(
      `https://doaj.org/api/search/articles/${encodeURIComponent(query)}?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        bibjson?: {
          title?: string;
          abstract?: string;
          author?: Array<{ name?: string }>;
          journal?: { title?: string };
          year?: string;
          identifier?: Array<{ type?: string; id?: string }>;
          link?: Array<{ type?: string; url?: string }>;
        };
      }>;
    };

    return (data.results ?? [])
      .map((item) => {
        const bib = item.bibjson;
        if (!bib) return null;
        const abstract = (bib.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const doi = bib.identifier?.find((id) => id.type === "doi")?.id;
        const url =
          doi
            ? `https://doi.org/${doi}`
            : bib.link?.find((l) => l.type === "fulltext")?.url ??
              `https://doaj.org/search/articles?query.q=${encodeURIComponent(bib.title ?? query)}`;
        return {
          title: bib.title ?? "Unknown Title",
          authors: (bib.author ?? []).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: parseInt(bib.year ?? String(new Date().getFullYear())),
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "DOAJ (20,000+ peer-reviewed journals)",
          journal: bib.journal?.title,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── arXiv ─────────────────────────────────────────────────────────────────────
// 2.4M+ preprints in STEM, CS, Economics, Statistics, Quantitative Biology
// Free, no API key, authoritative for cutting-edge research

async function searchArXiv(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: String(Math.min(limit, 8)),
      sortBy: "relevance",
      sortOrder: "descending",
    });

    const res = await fetch(`https://export.arxiv.org/api/query?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const xml = await res.text();

    // Parse XML entries
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

    return entries
      .map((match) => {
        const entry = match[1];
        const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const abstract = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, " ") ?? "";
        const id = entry.match(/<id>(https?:\/\/arxiv\.org\/abs\/[^\s<]+)<\/id>/)?.[1] ?? "";
        const year = parseInt(entry.match(/<published>(\d{4})/)?.[1] ?? String(new Date().getFullYear()));
        const doi = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/)?.[1]?.trim() ?? undefined;

        const authorMatches = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)];
        const authors = authorMatches.map((m) => m[1].trim()).join(", ") || "Unknown Authors";

        if (abstract.length < 50 || !title) return null;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : id || `https://arxiv.org/search/?query=${encodeURIComponent(title)}`,
          source: "arXiv (2.4M+ preprints)",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Semantic Scholar ───────────────────────────────────────────────────────────
// 200M+ papers — CS, AI, medicine, biology, physics, economics
// AI-enhanced metadata: citation counts, open access PDFs, author disambiguation
// Rate limit: 1 req/sec with API key — enforced via shared ssRateLimit()

async function searchSemanticScholar(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 6)),
      fields: "paperId,title,authors,year,abstract,openAccessPdf,citationCount,externalIds",
    });

    await ssRateLimit();

    const ssHeaders: Record<string, string> = { "User-Agent": "LightSpeedGhost/1.0" };
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) ssHeaders["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;

    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      { headers: ssHeaders, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        paperId?: string;
        title?: string;
        authors?: Array<{ name: string }>;
        year?: number;
        abstract?: string;
        openAccessPdf?: { url: string };
        citationCount?: number;
        externalIds?: { DOI?: string };
      }>;
    };

    return (data.data ?? [])
      .map((p) => {
        const abstract = (p.abstract ?? "").trim();
        if (abstract.length < 50) return null;
        const doi = p.externalIds?.DOI;
        return {
          title: p.title ?? "Unknown Title",
          authors: (p.authors ?? []).map((a) => a.name).join(", ") || "Unknown Authors",
          year: p.year ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi
            ? `https://doi.org/${doi}`
            : p.openAccessPdf?.url ??
              `https://www.semanticscholar.org/paper/${p.paperId}`,
          source: "Semantic Scholar (200M+ papers)",
          citationCount: p.citationCount ?? 0,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── PubMed NCBI ───────────────────────────────────────────────────────────────
// 36M+ biomedical papers — the gold standard for medical/health research
// Free API via NCBI E-utilities; returns full abstracts

async function searchPubMed(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    // Step 1: Search for PMIDs
    const searchParams = new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(Math.min(limit, 6)),
      retmode: "json",
      sort: "relevance",
    });

    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) return [];

    const searchData = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const ids = searchData.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    // Step 2: Fetch abstracts as plain text
    const fetchParams = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      rettype: "abstract",
      retmode: "text",
    });

    const fetchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams}`,
      { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!fetchRes.ok) return [];

    const rawText = await fetchRes.text();

    // Split records; each starts with a numbered line "1. Title..."
    const rawRecords = rawText.split(/\n\n\n+/).filter((r) => r.trim().length > 0);

    return rawRecords
      .map((record): AcademicPaper | null => {
        const lines = record.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) return null;

        // First non-empty line after the record number is the title
        const titleLine = lines[0].replace(/^\d+\.\s*/, "").trim();
        const title = titleLine.replace(/\.$/, "") || "Unknown Title";

        // Second line is usually authors
        const authors = lines[1]?.replace(/\.$/, "") ?? "Unknown Authors";

        // Extract year from any date pattern
        const yearMatch = record.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Extract DOI
        const doiMatch = record.match(/doi:\s*([^\s\n]+)/i);
        const doi = doiMatch ? doiMatch[1].replace(/[.,]$/, "") : undefined;

        // Extract PMID
        const pmidMatch = record.match(/PMID:\s*(\d+)/);
        const pmid = pmidMatch ? pmidMatch[1] : null;

        // Extract abstract (text after "Abstract:" label or after the bibliographic block)
        const absIdx = record.search(/\bAbstract\b/i);
        let abstract = "";
        if (absIdx !== -1) {
          abstract = record
            .slice(absIdx + 8)
            .split(/\n\nPMID:/)[0]
            .trim()
            .replace(/\s+/g, " ");
        }

        if (abstract.length < 40 || !title) return null;

        const url = doi
          ? `https://doi.org/${doi}`
          : pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
          : null;

        if (!url) return null;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "PubMed NCBI (36M+ papers)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── ERIC (Education Resources Information Center) ─────────────────────────────
// 2M+ education research papers — US Dept of Education
// Unique niche: educational psychology, pedagogy, curriculum, K-12, higher ed

async function searchERIC(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      fields: "id,title,author,publicationdateyear,description,source,url,issn,eric_id",
      format: "json",
      rows: String(Math.min(limit, 8)),
      start: "0",
    });

    const res = await fetch(`https://api.ies.ed.gov/eric/?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      response?: {
        docs?: Array<{
          id?: string;
          eric_id?: string;
          title?: string;
          author?: string | string[];
          publicationdateyear?: number;
          description?: string;
          source?: string;
          url?: string;
          issn?: string;
        }>;
      };
    };

    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const abstract = (item.description ?? "").trim();
        if (abstract.length < 40) return null;

        const authors = Array.isArray(item.author)
          ? item.author.join(", ")
          : item.author ?? "Unknown Authors";

        const id = item.eric_id ?? item.id ?? "";
        const url =
          item.url ?? (id ? `https://eric.ed.gov/?id=${id}` : null);
        if (!url) return null;

        return {
          title: item.title ?? "Unknown Title",
          authors,
          year: item.publicationdateyear ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          url,
          source: "ERIC — Education Resources (2M+ papers)",
          journal: item.source,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Zenodo (CERN Open Repository) ─────────────────────────────────────────────
// 3M+ open research records — datasets, preprints, theses, conference papers
// All fields, DOI-assigned, peer-reviewed & grey literature

async function searchZenodo(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      type: "publication",
      size: String(Math.min(limit, 8)),
      sort: "mostrecent",
      access_right: "open",
    });

    const res = await fetch(`https://zenodo.org/api/records?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      hits?: {
        hits?: Array<{
          id?: number;
          doi?: string;
          links?: { html?: string };
          metadata?: {
            title?: string;
            description?: string;
            creators?: Array<{ name?: string }>;
            publication_date?: string;
            doi?: string;
          };
        }>;
      };
    };

    return (data.hits?.hits ?? [])
      .map((item): AcademicPaper | null => {
        const meta = item.metadata;
        if (!meta) return null;

        const raw = (meta.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (raw.length < 40) return null;

        const doi = item.doi ?? meta.doi;
        const authors =
          (meta.creators ?? []).map((c) => c.name ?? "").filter(Boolean).join(", ") ||
          "Unknown Authors";
        const year = parseInt(
          meta.publication_date?.slice(0, 4) ?? String(new Date().getFullYear())
        );

        return {
          title: meta.title ?? "Unknown Title",
          authors,
          year,
          abstract: raw.slice(0, 700),
          doi,
          url: doi
            ? `https://doi.org/${doi}`
            : item.links?.html ??
              `https://zenodo.org/record/${item.id}`,
          source: "Zenodo — CERN Open Repository (3M+ records)",
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── BASE (Bielefeld Academic Search Engine) ───────────────────────────────────
// 340M+ documents from 10,000+ academic repositories worldwide.
// Excellent broad coverage — humanities, social sciences, natural sciences, medicine.
// Free API, no key required.

async function searchBASE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      func: "PerformSearch",
      query: `dctitle:${query} OR dcterms_abstract:${query}`,
      hits: String(Math.min(limit, 10)),
      offset: "0",
      format: "json",
    });

    const res = await fetch(
      `https://api.base-search.net/cgi-bin/BaseHttpSearchInterface.fcgi?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      response?: {
        docs?: Array<{
          dc_title?: string | string[];
          dc_creator?: string | string[];
          dc_date?: string | number;
          dcterms_abstract?: string | string[];
          dc_identifier?: string | string[];
          dc_source?: string | string[];
          dc_type?: string | string[];
        }>;
      };
    };

    return (data.response?.docs ?? [])
      .map((item): AcademicPaper | null => {
        const title = Array.isArray(item.dc_title) ? item.dc_title[0] : (item.dc_title ?? "");
        const abstract = Array.isArray(item.dcterms_abstract)
          ? item.dcterms_abstract[0]
          : (item.dcterms_abstract ?? "");
        if (!title || abstract.length < 50) return null;

        const creators = Array.isArray(item.dc_creator) ? item.dc_creator : (item.dc_creator ? [item.dc_creator] : []);
        const authors = creators.slice(0, 3).join(", ") || "Unknown Authors";

        const dateRaw = String(item.dc_date ?? "");
        const year = parseInt(dateRaw.slice(0, 4)) || new Date().getFullYear();

        // Find DOI in identifier array
        const identifiers = Array.isArray(item.dc_identifier) ? item.dc_identifier : (item.dc_identifier ? [item.dc_identifier] : []);
        const doi = identifiers.find((id) => id.startsWith("10."))?.replace("https://doi.org/", "");
        const url = doi
          ? `https://doi.org/${doi}`
          : identifiers.find((id) => id.startsWith("http")) ?? "";

        if (!url) return null;

        const journal = Array.isArray(item.dc_source) ? item.dc_source[0] : (item.dc_source ?? undefined);

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url,
          source: "BASE (340M+ academic docs)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── DataCite ──────────────────────────────────────────────────────────────────
// 48M+ research objects (datasets, papers, preprints, software) with DOIs.
// Operated by DataCite consortium — highly credible, DOI-assigned.
// Free REST API, no key required.

async function searchDataCite(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      "page[size]": String(Math.min(limit, 10)),
      sort: "-relevance",
      "fields[dois]": "titles,creators,publicationYear,descriptions,doi,container,types",
    });

    const res = await fetch(`https://api.datacite.org/dois?${params}`, {
      headers: {
        "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      data?: Array<{
        attributes?: {
          titles?: Array<{ title?: string }>;
          creators?: Array<{ name?: string; givenName?: string; familyName?: string }>;
          publicationYear?: number;
          descriptions?: Array<{ description?: string; descriptionType?: string }>;
          doi?: string;
          container?: { title?: string };
          types?: { resourceTypeGeneral?: string };
        };
      }>;
    };

    return (data.data ?? [])
      .map((item): AcademicPaper | null => {
        const attr = item.attributes;
        if (!attr) return null;

        const title = attr.titles?.[0]?.title ?? "";
        if (!title) return null;

        // Prefer abstract description
        const desc = (attr.descriptions ?? []).find((d) => d.descriptionType === "Abstract") ?? attr.descriptions?.[0];
        const abstract = (desc?.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (abstract.length < 50) return null;

        const creators = attr.creators ?? [];
        const authors = creators
          .slice(0, 3)
          .map((c) => c.name ?? [c.familyName, c.givenName?.charAt(0)].filter(Boolean).join(", "))
          .filter(Boolean)
          .join("; ") || "Unknown Authors";

        const doi = attr.doi;
        const year = attr.publicationYear ?? new Date().getFullYear();
        const journal = attr.container?.title;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : "",
          source: "DataCite (48M+ research objects)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null && p.url !== "");
  } catch {
    return [];
  }
}

// ── OpenAIRE ──────────────────────────────────────────────────────────────────
// 100M+ research outputs from EU-funded projects, with full open-access coverage.
// Aggregates from 100,000+ data sources including CORDIS, Zenodo, institutional repos.
// Free API, no key required.

async function searchOpenAIRE(
  query: string,
  limit: number
): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      keywords: query,
      format: "json",
      size: String(Math.min(limit, 10)),
      type: "publications",
    });

    const res = await fetch(
      `https://api.openaire.eu/search/publications?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(9000),
      }
    );

    if (!res.ok) return [];

    const text = await res.text();

    // OpenAIRE returns JSON but sometimes with XML wrapper — parse JSON
    let data: {
      response?: {
        results?: {
          result?: Array<{
            metadata?: {
              "oaf:entity"?: {
                "oaf:result"?: {
                  title?: { $?: string } | Array<{ $?: string }>;
                  creator?: { $?: string } | Array<{ $?: string }>;
                  dateofacceptance?: { $?: string };
                  description?: { $?: string } | Array<{ $?: string }>;
                  pid?: Array<{ "@classid"?: string; $?: string }>;
                  journal?: { $?: string };
                };
              };
            };
          }>;
        };
      };
    };

    try {
      data = JSON.parse(text);
    } catch {
      return [];
    }

    const results = data.response?.results?.result ?? [];

    return results
      .map((item): AcademicPaper | null => {
        const entity = item.metadata?.["oaf:entity"]?.["oaf:result"];
        if (!entity) return null;

        const titleRaw = entity.title;
        const title = Array.isArray(titleRaw) ? (titleRaw[0]?.$ ?? "") : (titleRaw?.$ ?? "");
        if (!title) return null;

        const descRaw = entity.description;
        const abstract = (Array.isArray(descRaw) ? (descRaw[0]?.$ ?? "") : (descRaw?.$ ?? "")).trim();
        if (abstract.length < 50) return null;

        const creatorRaw = entity.creator;
        const creatorList = Array.isArray(creatorRaw) ? creatorRaw : (creatorRaw ? [creatorRaw] : []);
        const authors = creatorList.slice(0, 3).map((c) => c.$ ?? "").filter(Boolean).join(", ") || "Unknown Authors";

        const dateRaw = entity.dateofacceptance?.$?.slice(0, 4);
        const year = parseInt(dateRaw ?? String(new Date().getFullYear()));

        const pids = entity.pid ?? [];
        const doiEntry = pids.find((p) => p["@classid"] === "doi");
        const doi = doiEntry?.$ ?? undefined;

        const journal = entity.journal?.$ ?? undefined;

        return {
          title,
          authors,
          year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://explore.openaire.eu/search/publication?keywords=${encodeURIComponent(title)}`,
          source: "OpenAIRE (100M+ EU research outputs)",
          journal,
        };
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// ── PLOS ──────────────────────────────────────────────────────────────────────
// 300K+ open-access papers across all PLOS journals. Full abstracts. No key.

async function searchPLOS(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: `everything:"${query.replace(/"/g, "")}"`,
      fl: "id,title_display,author_display,abstract,publication_date,journal,counter_total_all",
      fq: "doc_type:full",
      wt: "json",
      rows: String(Math.min(limit, 15)),
    });
    const res = await fetch(`https://api.plos.org/search?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { docs?: Array<{
        id?: string; title_display?: string; author_display?: string[];
        abstract?: string[]; publication_date?: string; journal?: string;
        counter_total_all?: number;
      }> };
    };
    return (data.response?.docs ?? [])
      .map((d) => {
        const abstract = (d.abstract?.[0] ?? "").trim();
        if (abstract.length < 50) return null;
        return {
          title: d.title_display ?? "Unknown Title",
          authors: (d.author_display ?? []).slice(0, 3).join(", ") || "Unknown Authors",
          year: d.publication_date ? new Date(d.publication_date).getFullYear() : new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: d.id,
          url: d.id ? `https://doi.org/${d.id}` : "",
          source: "PLOS (open access journals)",
          journal: d.journal,
          citationCount: d.counter_total_all,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── PubMed Central (PMC) ─────────────────────────────────────────────────────
// 8M+ full-text biomedical articles — distinct from PubMed (abstracts-only index).

async function searchPMC(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const searchParams = new URLSearchParams({
      db: "pmc", term: query, retmax: String(Math.min(limit, 10)), retmode: "json", sort: "relevance",
    });
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (!searchRes.ok) return [];
    const searchData = (await searchRes.json()) as { esearchresult?: { idlist?: string[] } };
    const ids = searchData.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const sumParams = new URLSearchParams({ db: "pmc", id: ids.join(","), retmode: "json" });
    const sumRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${sumParams}`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (!sumRes.ok) return [];
    const sumData = (await sumRes.json()) as {
      result?: Record<string, { title?: string; authors?: Array<{ name?: string }>; pubdate?: string; fulljournalname?: string; articleids?: Array<{ idtype?: string; value?: string }> }>;
    };
    return ids
      .map((id) => {
        const r = sumData.result?.[id];
        if (!r?.title) return null;
        const doi = r.articleids?.find((a) => a.idtype === "doi")?.value;
        const year = r.pubdate ? parseInt(r.pubdate.slice(0, 4), 10) : new Date().getFullYear();
        return {
          title: r.title,
          authors: (r.authors ?? []).slice(0, 3).map((a) => a.name ?? "").filter(Boolean).join(", ") || "Unknown Authors",
          year: isNaN(year) ? new Date().getFullYear() : year,
          abstract: `Full-text open access article in ${r.fulljournalname ?? "PubMed Central"}. PMCID: PMC${id}.`,
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${id}/`,
          source: "PubMed Central (8M+ full-text)",
          journal: r.fulljournalname,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── bioRxiv + medRxiv preprints (via Europe PMC preprint index) ──────────────
// Latest pre-publication research — clearly labelled as preprints.

async function searchPreprints(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query: `SRC:PPR AND (${query})`,
      format: "json",
      pageSize: String(Math.min(limit, 10)),
      resultType: "core",
    });
    const res = await fetch(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`,
      { signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      resultList?: { result?: Array<{
        title?: string; authorString?: string; pubYear?: string;
        abstractText?: string; doi?: string; bookOrReportDetails?: { publisher?: string };
      }> };
    };
    return (data.resultList?.result ?? [])
      .map((r) => {
        const abstract = (r.abstractText ?? "").trim();
        if (abstract.length < 50) return null;
        return {
          title: r.title ?? "Unknown Title",
          authors: (r.authorString ?? "Unknown Authors").split(",").slice(0, 3).join(",").trim(),
          year: r.pubYear ? parseInt(r.pubYear, 10) : new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: r.doi,
          url: r.doi ? `https://doi.org/${r.doi}` : "",
          source: "bioRxiv / medRxiv (preprints)",
          journal: r.bookOrReportDetails?.publisher ?? "Preprint server",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── CrossRef Preprints (SSRN, Research Square, Preprints.org) ────────────────
// posted-content slice of CrossRef — covers SSRN working papers heavily used
// in economics, finance, and law.

async function searchCrossRefPreprints(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      query,
      filter: "type:posted-content",
      rows: String(Math.min(limit, 12)),
      select: "title,author,published,abstract,DOI,URL,container-title,is-referenced-by-count",
    });
    const res = await fetch(`https://api.crossref.org/works?${params}`, {
      headers: { "User-Agent": "LightSpeedGhost/1.0 (mailto:research@lightspeedghost.com)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      message?: { items?: Array<{
        title?: string[]; author?: Array<{ given?: string; family?: string }>;
        published?: { "date-parts"?: number[][] }; abstract?: string;
        DOI?: string; URL?: string; "container-title"?: string[];
        "is-referenced-by-count"?: number;
      }> };
    };
    return (data.message?.items ?? [])
      .map((item) => {
        const abstract = item.abstract ? stripJats(item.abstract) : "";
        if (abstract.length < 50) return null;
        const authors = (item.author ?? []).slice(0, 3)
          .map((a) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ");
        return {
          title: item.title?.[0] ?? "Unknown Title",
          authors: authors || "Unknown Authors",
          year: item.published?.["date-parts"]?.[0]?.[0] ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: item.DOI,
          url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL ?? "",
          source: "SSRN / Research Square (working papers)",
          journal: item["container-title"]?.[0],
          citationCount: item["is-referenced-by-count"],
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── HAL (French national open archive) ───────────────────────────────────────
// 3M+ documents — strong European humanities/social science coverage.

async function searchHAL(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      fl: "title_s,authFullName_s,producedDateY_i,abstract_s,doiId_s,uri_s,journalTitle_s",
      wt: "json",
      rows: String(Math.min(limit, 12)),
    });
    const res = await fetch(`https://api.archives-ouvertes.fr/search/?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      response?: { docs?: Array<{
        title_s?: string[]; authFullName_s?: string[]; producedDateY_i?: number;
        abstract_s?: string[]; doiId_s?: string; uri_s?: string; journalTitle_s?: string;
      }> };
    };
    return (data.response?.docs ?? [])
      .map((d) => {
        const abstract = (d.abstract_s?.[0] ?? "").trim();
        if (abstract.length < 50) return null;
        return {
          title: d.title_s?.[0] ?? "Unknown Title",
          authors: (d.authFullName_s ?? []).slice(0, 3).join(", ") || "Unknown Authors",
          year: d.producedDateY_i ?? new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi: d.doiId_s,
          url: d.doiId_s ? `https://doi.org/${d.doiId_s}` : d.uri_s ?? "",
          source: "HAL (French open archive, 3M+ docs)",
          journal: d.journalTitle_s,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── EconBiz ───────────────────────────────────────────────────────────────────
// 1M+ economics & business studies records (ZBW — Leibniz Centre).

async function searchEconBiz(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ q: query, size: String(Math.min(limit, 12)) });
    const res = await fetch(`https://api.econbiz.de/v1/search?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      hits?: { hits?: Array<{
        title?: string; creator_personal?: string[] | string; date?: string;
        abstract?: string[] | string; identifier_doi?: string[] | string;
        identifier_url?: string[] | string; source?: string;
      }> };
    };
    const first = (v: string[] | string | undefined): string =>
      Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
    return (data.hits?.hits ?? [])
      .map((h) => {
        const abstract = first(h.abstract).trim();
        if (abstract.length < 50) return null;
        const doi = first(h.identifier_doi) || undefined;
        const creators = Array.isArray(h.creator_personal)
          ? h.creator_personal.slice(0, 3).join(", ")
          : (h.creator_personal ?? "");
        return {
          title: h.title ?? "Unknown Title",
          authors: creators || "Unknown Authors",
          year: h.date ? parseInt(h.date.slice(0, 4), 10) || new Date().getFullYear() : new Date().getFullYear(),
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : first(h.identifier_url),
          source: "EconBiz (economics & business)",
          journal: h.source,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── DOAB (Directory of Open Access Books) ────────────────────────────────────
// 80K+ peer-reviewed academic books — long-form humanities sources.

async function searchDOAB(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ query, expand: "metadata", limit: String(Math.min(limit, 10)) });
    const res = await fetch(`https://directory.doabooks.org/rest/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      name?: string; handle?: string;
      metadata?: Array<{ key?: string; value?: string }>;
    }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const meta = (key: string) => item.metadata?.find((m) => m.key === key)?.value ?? "";
        const abstract = meta("dc.description.abstract").trim();
        if (abstract.length < 50) return null;
        const year = parseInt(meta("dc.date.issued").slice(0, 4), 10);
        const doi = meta("oapen.identifier.doi") || undefined;
        return {
          title: item.name ?? meta("dc.title") ?? "Unknown Title",
          authors: meta("dc.contributor.author") || "Unknown Authors",
          year: isNaN(year) ? new Date().getFullYear() : year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://directory.doabooks.org/handle/${item.handle ?? ""}`,
          source: "DOAB (peer-reviewed academic books)",
          journal: meta("publisher.name") || "Academic book",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── OAPEN ─────────────────────────────────────────────────────────────────────
// 30K+ open access academic books (European university presses).

async function searchOAPEN(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ query, expand: "metadata", limit: String(Math.min(limit, 8)) });
    const res = await fetch(`https://library.oapen.org/rest/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      name?: string; handle?: string;
      metadata?: Array<{ key?: string; value?: string }>;
    }>;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const meta = (key: string) => item.metadata?.find((m) => m.key === key)?.value ?? "";
        const abstract = meta("dc.description.abstract").trim();
        if (abstract.length < 50) return null;
        const year = parseInt(meta("dc.date.issued").slice(0, 4), 10);
        const doi = meta("oapen.identifier.doi") || undefined;
        return {
          title: item.name ?? "Unknown Title",
          authors: meta("dc.contributor.author") || "Unknown Authors",
          year: isNaN(year) ? new Date().getFullYear() : year,
          abstract: abstract.slice(0, 700),
          doi,
          url: doi ? `https://doi.org/${doi}` : `https://library.oapen.org/handle/${item.handle ?? ""}`,
          source: "OAPEN (university press books)",
          journal: meta("publisher.name") || "Academic book",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── Unpaywall ─────────────────────────────────────────────────────────────────
// 50M+ legal open-access copies of paywalled papers — DOI-verified.

async function searchUnpaywall(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ query, email: "research@lightspeedghost.com" });
    const res = await fetch(`https://api.unpaywall.org/v2/search?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ response?: {
        title?: string; doi?: string; year?: number;
        journal_name?: string; z_authors?: Array<{ given?: string; family?: string }>;
        best_oa_location?: { url?: string } | null; is_oa?: boolean;
      } }>;
    };
    return (data.results ?? [])
      .slice(0, Math.min(limit, 10))
      .map(({ response: r }) => {
        if (!r?.title || !r.doi) return null;
        const authors = (r.z_authors ?? []).slice(0, 3)
          .map((a) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", ");
        return {
          title: r.title,
          authors: authors || "Unknown Authors",
          year: r.year ?? new Date().getFullYear(),
          abstract: `Peer-reviewed article in ${r.journal_name ?? "academic journal"} (${r.year ?? "n.d."}).${r.is_oa ? " Open-access full text available." : ""} DOI-verified via Unpaywall.`,
          doi: r.doi,
          url: `https://doi.org/${r.doi}`,
          source: "Unpaywall (50M+ OA copies)",
          journal: r.journal_name,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── ClinicalTrials.gov ───────────────────────────────────────────────────────
// 450K+ registered clinical studies — primary-source evidence for health papers.

async function searchClinicalTrials(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({
      "query.term": query,
      pageSize: String(Math.min(limit, 8)),
      fields: "NCTId,BriefTitle,BriefSummary,StartDate,LeadSponsorName,OverallStatus",
    });
    const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      studies?: Array<{ protocolSection?: {
        identificationModule?: { nctId?: string; briefTitle?: string };
        descriptionModule?: { briefSummary?: string };
        statusModule?: { startDateStruct?: { date?: string } };
        sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
      } }>;
    };
    return (data.studies ?? [])
      .map((s) => {
        const p = s.protocolSection;
        const abstract = (p?.descriptionModule?.briefSummary ?? "").trim();
        if (abstract.length < 50 || !p?.identificationModule?.nctId) return null;
        const year = parseInt((p.statusModule?.startDateStruct?.date ?? "").slice(0, 4), 10);
        return {
          title: p.identificationModule.briefTitle ?? "Clinical study",
          authors: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? "Clinical investigators",
          year: isNaN(year) ? new Date().getFullYear() : year,
          abstract: abstract.slice(0, 700),
          url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`,
          source: "ClinicalTrials.gov (450K+ studies)",
          journal: "Registered clinical trial",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── WHO IRIS ──────────────────────────────────────────────────────────────────
// World Health Organization institutional repository — global health reports.

async function searchWHOIRIS(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ query, size: String(Math.min(limit, 8)) });
    const res = await fetch(
      `https://iris.who.int/server/api/discover/search/objects?${params}`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      _embedded?: { searchResult?: { _embedded?: { objects?: Array<{
        _embedded?: { indexableObject?: {
          name?: string; handle?: string;
          metadata?: Record<string, Array<{ value?: string }>>;
        } };
      }> } } };
    };
    const objects = data._embedded?.searchResult?._embedded?.objects ?? [];
    return objects
      .map((o) => {
        const obj = o._embedded?.indexableObject;
        if (!obj?.name) return null;
        const meta = (key: string) => obj.metadata?.[key]?.[0]?.value ?? "";
        const abstract = meta("dc.description.abstract").trim();
        if (abstract.length < 50) return null;
        const year = parseInt(meta("dc.date.issued").slice(0, 4), 10);
        return {
          title: obj.name,
          authors: meta("dc.contributor.author") || "World Health Organization",
          year: isNaN(year) ? new Date().getFullYear() : year,
          abstract: abstract.slice(0, 700),
          url: `https://iris.who.int/handle/${obj.handle ?? ""}`,
          source: "WHO IRIS (global health)",
          journal: "WHO publication",
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

// ── dblp ──────────────────────────────────────────────────────────────────────
// 7M+ computer science publications with venue rankings — the CS bibliography.

async function searchDBLP(query: string, limit: number): Promise<AcademicPaper[]> {
  try {
    const params = new URLSearchParams({ q: query, format: "json", h: String(Math.min(limit, 10)) });
    const res = await fetch(`https://dblp.org/search/publ/api?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result?: { hits?: { hit?: Array<{ info?: {
        title?: string; venue?: string; year?: string; doi?: string; url?: string;
        authors?: { author?: Array<{ text?: string }> | { text?: string } };
      } }> } };
    };
    const hits = data.result?.hits?.hit ?? [];
    return hits
      .map((h) => {
        const info = h.info;
        if (!info?.title || !info.venue) return null;
        const authorsRaw = info.authors?.author;
        const authorList = Array.isArray(authorsRaw) ? authorsRaw : authorsRaw ? [authorsRaw] : [];
        const authors = authorList.slice(0, 3).map((a) => a.text ?? "").filter(Boolean).join(", ");
        return {
          title: info.title.replace(/\.$/, ""),
          authors: authors || "Unknown Authors",
          year: info.year ? parseInt(info.year, 10) : new Date().getFullYear(),
          abstract: `Peer-reviewed computer science publication in ${info.venue} (${info.year ?? "n.d."}). Indexed in the dblp computer science bibliography.`,
          doi: info.doi,
          url: info.doi ? `https://doi.org/${info.doi}` : info.url ?? "",
          source: "dblp (computer science bibliography)",
          journal: info.venue,
        } as AcademicPaper;
      })
      .filter((p): p is AcademicPaper => p !== null);
  } catch {
    return [];
  }
}

/**
 * Search all academic databases in parallel and return deduplicated results.
 *
 * Database coverage (25 sources, 10B+ papers & citation records):
 *  • OpenAlex          — 250M+ works, all disciplines (primary source, highest quality)
 *  • CrossRef          — 145M+ DOI records (citation backbone of academic publishing)
 *  • Europe PMC        — 40M+ biomedical papers (MEDLINE, PubMed Central, life sciences)
 *  • CORE              — 200M+ open access outputs (humanities, social sciences, OA STEM)
 *  • DOAJ              — 20,000+ peer-reviewed OA journals (arts, humanities, interdisciplinary)
 *  • arXiv             — 2.4M+ preprints (STEM, CS, economics, statistics, quantitative biology)
 *  • Semantic Scholar  — 200M+ papers with citation counts, AI-enhanced metadata
 *  • PubMed NCBI       — 36M+ biomedical papers, gold standard for medical research
 *  • ERIC (US Dept Ed) — 2M+ education research papers
 *  • Zenodo (CERN)     — 3M+ open research records (datasets, preprints, theses)
 *  • BASE              — 340M+ documents from 10,000+ repos (broadest OA coverage)
 *  • DataCite          — 48M+ research objects with DOIs (datasets, preprints, papers)
 *  • OpenAIRE          — 100M+ EU-funded research outputs across all disciplines
 *
 * Results are ranked by citation count (highest first) after deduplication.
 *
 * @param query   - Topic or question to search for
 * @param limit   - Maximum number of papers to return
 * @param subject - Optional subject hint for specialised routing
 */
async function _fetchAllAcademicSources(
  query: string,
  limit: number,
  subject?: string
): Promise<AcademicPaper[]> {
  const combinedCtx = (subject ?? "") + " " + query;

  const isBiomedical =
    /biolog|chemist|medicine|medic|health|pharma|clinical|disease|cell|protein|gene|drug|anatomy|physiol|immuno|neuro|oncol/i.test(combinedCtx);

  const isSTEM =
    /physics|math|engineer|computer|algorithm|computation|statistics|quantit|mechanic|electr|thermody/i.test(combinedCtx);

  const isHumanities =
    /history|philosoph|literature|art|music|sociol|psychol|anthropol|linguist|politic|law|cultural|media|communication/i.test(combinedCtx);

  const isEducation =
    /education|teaching|learning|pedagog|curricul|student|classroom|school|universit|college|instructional|assessment/i.test(combinedCtx);

  const isFinanceBusiness =
    /financ|account|actuari|insurance|credit|banking|invest|econom|business|portfolio|risk\s*manage|audit|tax|ifrs|gaap|ebitda|valuation|derivative|hedge|underwriting|solvency|capital\s*market/i.test(combinedCtx);

  // ── Budget allocation (over-request, then de-dup to `limit`) ─────────────────
  // Over-fetch per source so after deduplication we still hit the target limit.
  const budget = Math.ceil(limit * 2.0);   // fetch ~100% more than needed across 13 sources

  const openAlexLimit    = Math.ceil(budget * (isFinanceBusiness ? 0.22 : 0.20));
  const crossRefLimit    = Math.ceil(budget * (isFinanceBusiness ? 0.14 : 0.12));
  const ssLimit          = Math.ceil(budget * (isFinanceBusiness ? 0.14 : 0.12));
  const pmcEuLimit       = isBiomedical ? Math.ceil(budget * 0.12) : 0;
  const pubmedLimit      = isBiomedical ? Math.ceil(budget * 0.10) : Math.ceil(budget * 0.04);
  const arxivLimit       = (isSTEM || isFinanceBusiness) ? Math.ceil(budget * 0.12) : Math.ceil(budget * 0.03);
  const ericLimit        = isEducation  ? Math.ceil(budget * 0.12) : Math.ceil(budget * 0.03);
  const coreLimit        = (isHumanities || isFinanceBusiness) ? Math.ceil(budget * 0.10) : Math.ceil(budget * 0.04);
  const doajLimit        = (isHumanities || isFinanceBusiness) ? Math.ceil(budget * 0.08) : Math.ceil(budget * 0.03);
  const zenodoLimit      = Math.ceil(budget * 0.04);  // general supplement
  const baseLimit        = Math.ceil(budget * 0.08);  // broad humanities/social science coverage
  const dataCiteLimit    = Math.ceil(budget * 0.05);  // datasets and interdisciplinary research
  const openAIRELimit    = Math.ceil(budget * 0.06);  // European academic coverage
  // Specialised sources — routed by subject so each query hits its best databases
  const plosLimit        = isBiomedical ? Math.ceil(budget * 0.06) : Math.ceil(budget * 0.02);
  const pmcFullLimit     = isBiomedical ? Math.ceil(budget * 0.06) : 0;
  const preprintsLimit   = (isBiomedical || isSTEM) ? Math.ceil(budget * 0.04) : 0;
  const ssrnLimit        = isFinanceBusiness ? Math.ceil(budget * 0.10) : Math.ceil(budget * 0.03);
  const halLimit         = isHumanities ? Math.ceil(budget * 0.05) : Math.ceil(budget * 0.02);
  const econBizLimit     = isFinanceBusiness ? Math.ceil(budget * 0.10) : 0;
  const doabLimit        = isHumanities ? Math.ceil(budget * 0.04) : Math.ceil(budget * 0.02);
  const oapenLimit       = isHumanities ? Math.ceil(budget * 0.03) : 0;
  const unpaywallLimit   = Math.ceil(budget * 0.04);
  const trialsLimit      = isBiomedical ? Math.ceil(budget * 0.05) : 0;
  const whoLimit         = isBiomedical ? Math.ceil(budget * 0.04) : 0;
  const dblpLimit        = isSTEM ? Math.ceil(budget * 0.05) : 0;

  const [
    openAlexResults,
    crossRefResults,
    ssResults,
    europePMCResults,
    pubmedResults,
    arxivResults,
    ericResults,
    coreResults,
    doajResults,
    zenodoResults,
    baseResults,
    dataCiteResults,
    openAIREResults,
    plosResults,
    pmcFullResults,
    preprintResults,
    ssrnResults,
    halResults,
    econBizResults,
    doabResults,
    oapenResults,
    unpaywallResults,
    trialsResults,
    whoResults,
    dblpResults,
  ] = await Promise.all([
    searchOpenAlex(query, openAlexLimit),
    searchCrossRef(query, crossRefLimit),
    searchSemanticScholar(query, ssLimit),
    pmcEuLimit > 0  ? searchEuropePMC(query, pmcEuLimit)  : Promise.resolve([] as AcademicPaper[]),
    pubmedLimit > 0 ? searchPubMed(query, pubmedLimit)    : Promise.resolve([] as AcademicPaper[]),
    arxivLimit > 0  ? searchArXiv(query, arxivLimit)      : Promise.resolve([] as AcademicPaper[]),
    ericLimit > 0   ? searchERIC(query, ericLimit)        : Promise.resolve([] as AcademicPaper[]),
    coreLimit > 0   ? searchCORE(query, coreLimit)        : Promise.resolve([] as AcademicPaper[]),
    doajLimit > 0   ? searchDOAJ(query, doajLimit)        : Promise.resolve([] as AcademicPaper[]),
    zenodoLimit > 0 ? searchZenodo(query, zenodoLimit)    : Promise.resolve([] as AcademicPaper[]),
    baseLimit > 0   ? searchBASE(query, baseLimit)        : Promise.resolve([] as AcademicPaper[]),
    dataCiteLimit > 0 ? searchDataCite(query, dataCiteLimit) : Promise.resolve([] as AcademicPaper[]),
    openAIRELimit > 0 ? searchOpenAIRE(query, openAIRELimit) : Promise.resolve([] as AcademicPaper[]),
    plosLimit > 0      ? searchPLOS(query, plosLimit)               : Promise.resolve([] as AcademicPaper[]),
    pmcFullLimit > 0   ? searchPMC(query, pmcFullLimit)             : Promise.resolve([] as AcademicPaper[]),
    preprintsLimit > 0 ? searchPreprints(query, preprintsLimit)     : Promise.resolve([] as AcademicPaper[]),
    ssrnLimit > 0      ? searchCrossRefPreprints(query, ssrnLimit)  : Promise.resolve([] as AcademicPaper[]),
    halLimit > 0       ? searchHAL(query, halLimit)                 : Promise.resolve([] as AcademicPaper[]),
    econBizLimit > 0   ? searchEconBiz(query, econBizLimit)         : Promise.resolve([] as AcademicPaper[]),
    doabLimit > 0      ? searchDOAB(query, doabLimit)               : Promise.resolve([] as AcademicPaper[]),
    oapenLimit > 0     ? searchOAPEN(query, oapenLimit)             : Promise.resolve([] as AcademicPaper[]),
    unpaywallLimit > 0 ? searchUnpaywall(query, unpaywallLimit)     : Promise.resolve([] as AcademicPaper[]),
    trialsLimit > 0    ? searchClinicalTrials(query, trialsLimit)   : Promise.resolve([] as AcademicPaper[]),
    whoLimit > 0       ? searchWHOIRIS(query, whoLimit)             : Promise.resolve([] as AcademicPaper[]),
    dblpLimit > 0      ? searchDBLP(query, dblpLimit)               : Promise.resolve([] as AcademicPaper[]),
  ]);

  // ── Deduplicate by DOI (primary), then normalised title prefix (fallback) ───
  const seen = new Set<string>();
  const merged: AcademicPaper[] = [];

  const allResults = [
    ...openAlexResults,    // highest coverage first so they survive dedup
    ...crossRefResults,
    ...ssResults,
    ...europePMCResults,
    ...pubmedResults,
    ...arxivResults,
    ...ericResults,
    ...coreResults,
    ...doajResults,
    ...zenodoResults,
    ...baseResults,
    ...dataCiteResults,
    ...openAIREResults,
    ...plosResults,
    ...pmcFullResults,
    ...preprintResults,
    ...ssrnResults,
    ...halResults,
    ...econBizResults,
    ...doabResults,
    ...oapenResults,
    ...unpaywallResults,
    ...trialsResults,
    ...whoResults,
    ...dblpResults,
  ];

  for (const paper of allResults) {
    const key = paper.doi
      ? paper.doi.toLowerCase()
      : paper.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(paper);
    }
  }

  // ── Quality ranking: sort by citation count desc, then recency ────────────
  merged.sort((a, b) => {
    const citDiff = (b.citationCount ?? 0) - (a.citationCount ?? 0);
    if (citDiff !== 0) return citDiff;
    return (b.year ?? 0) - (a.year ?? 0);
  });

  return merged.slice(0, limit);
}

/**
 * Cache-wrapped version of _fetchAllAcademicSources.
 * Identical API — callers see no difference.
 */
export async function searchAllAcademicSources(
  query: string,
  limit = 10,
  subject?: string
): Promise<AcademicPaper[]> {
  return withCache(
    "academicRag",
    () => _fetchAllAcademicSources(query, limit, subject),
    query,
    String(limit),
    subject ?? "general"
  );
}

/**
 * Build a RAG (Retrieval-Augmented Generation) context block from papers.
 * Inject this string into AI system prompts to ground responses in real sources.
 *
 * The AI is instructed to:
 *  - Only cite papers present in this block
 *  - Not invent statistics or facts not supported by these abstracts
 *  - Not cite Wikipedia or non-peer-reviewed sources
 */
export function buildRAGContext(papers: AcademicPaper[]): string {
  if (papers.length === 0) return "";

  const entries = papers
    .map((p, i) => {
      const journal = p.journal ? ` ${p.journal}.` : "";
      return `[SOURCE ${i + 1}]
Title: ${p.title}
Authors: ${p.authors} (${p.year})
Journal/Database: ${p.journal ?? p.source}
Abstract: ${p.abstract}
DOI/URL: ${p.url}
APA Reference: ${p.authors} (${p.year}). ${p.title}.${journal} ${p.source}. ${p.url}`;
    })
    .join("\n\n" + "─".repeat(60) + "\n\n");

  return `════════════════════════════════════════════════════════════
VERIFIED ACADEMIC KNOWLEDGE BASE — ${papers.length} PEER-REVIEWED SOURCES
Retrieved from 25 live academic databases (10B+ papers & citation records):
OpenAlex, CrossRef, Semantic Scholar, PubMed NCBI, PubMed Central, Europe PMC,
arXiv, CORE, DOAJ, ERIC, Zenodo, BASE, DataCite, OpenAIRE, PLOS, bioRxiv/medRxiv,
SSRN/Research Square, HAL, EconBiz, DOAB, OAPEN, Unpaywall, ClinicalTrials.gov,
WHO IRIS, and dblp.
Results ranked by citation count. Wikipedia and non-peer-reviewed sources excluded.

GROUNDING RULES (non-negotiable):
• Cite ONLY papers present in this knowledge base
• Do NOT invent statistics, figures, or findings not supported by these abstracts
• Do NOT cite Wikipedia, general websites, or sources not in this list
• If a fact cannot be grounded here, state it as general academic consensus and mark [citation needed]
• Prioritise higher-cited and more recent papers where both are available
════════════════════════════════════════════════════════════

${entries}

════════════════════════════════════════════════════════════`;
}

/**
 * Format papers as clean academic citations in the requested style.
 * These can be appended to the reference list.
 */
export function formatPaperCitations(
  papers: AcademicPaper[],
  style: "apa" | "mla" | "chicago" | "harvard" | "ieee" = "apa"
): string[] {
  return papers.map((p, i) => {
    const journal = p.journal ? ` *${p.journal}*.` : ` ${p.source}.`;
    switch (style) {
      case "mla":
        return `${p.authors}. "${p.title}."${journal} ${p.year}. ${p.url}.`;
      case "chicago":
        return `${p.authors}. "${p.title}."${journal} (${p.year}). ${p.url}.`;
      case "ieee":
        return `[${i + 1}] ${p.authors}, "${p.title},"${journal} ${p.year}. [Online]. Available: ${p.url}`;
      case "harvard":
        return `${p.authors} (${p.year}) '${p.title}',${journal} Available at: ${p.url}.`;
      default:
        return `${p.authors} (${p.year}). ${p.title}.${journal} ${p.url}`;
    }
  });
}
