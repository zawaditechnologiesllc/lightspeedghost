// Client-side reference formatting for the peer reviewer's citation suggestions
// and bibliography export. Deterministic string formatting — no LLM. Covers the
// styles the reviewer detects; unknown styles fall back to APA.

import type { CitationStyle } from "@/lib/peerReview";

export interface CitationSource {
  title: string;
  authors: string;
  year: number;
  doi?: string | null;
  url: string;
  source?: string;
}

function cleanTitle(t: string): string {
  return t.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
}
function link(s: CitationSource): string {
  return s.doi ? `https://doi.org/${s.doi.replace(/^https?:\/\/doi\.org\//, "")}` : s.url;
}

// Format one source in the requested style. Author strings arrive pre-formatted
// from the databases (e.g., "Smith, J., Doe, A."), so we keep them as given.
export function formatCitation(s: CitationSource, style: CitationStyle): string {
  const authors = (s.authors || "Unknown author").replace(/\s+/g, " ").trim();
  const title = cleanTitle(s.title);
  const year = s.year || "n.d.";
  const u = link(s);
  switch (style) {
    case "mla":
      return `${authors}. "${title}." ${year}, ${u}.`;
    case "chicago":
    case "turabian":
      return `${authors}. "${title}." ${year}. ${u}.`;
    case "harvard":
      return `${authors} (${year}) '${title}'. Available at: ${u}.`;
    case "ieee":
      return `${authors}, "${title}," ${year}. [Online]. Available: ${u}`;
    case "vancouver":
    case "ama":
      return `${authors}. ${title}. ${year}. Available from: ${u}`;
    case "asa":
      return `${authors}. ${year}. "${title}." Retrieved (${u}).`;
    case "apa":
    default:
      return `${authors} (${year}). ${title}. ${u}`;
  }
}

export function buildBibliography(sources: CitationSource[], style: CitationStyle): string {
  const seen = new Set<string>();
  const entries = sources
    .map((s) => formatCitation(s, style))
    .filter((e) => { const k = e.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.localeCompare(b));
  const heading = style === "mla" ? "Works Cited" : style === "ieee" ? "References" : "References";
  return `${heading}\n\n${entries.map((e) => e).join("\n\n")}`;
}
