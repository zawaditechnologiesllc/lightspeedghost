import { useState } from "react";
import { generateCitation } from "@/lib/textAnalysis";
import { Link2, Copy, CheckCircle, Loader2, Globe, BookOpen } from "lucide-react";

const STYLES = [
  { value: "apa" as const, label: "APA 7th" },
  { value: "mla" as const, label: "MLA 9th" },
  { value: "chicago" as const, label: "Chicago" },
  { value: "harvard" as const, label: "Harvard" },
  { value: "ieee" as const, label: "IEEE" },
];

interface PageMeta {
  title: string;
  authors: string[];
  year: string;
  url: string;
  publisher?: string;
}

export function CitationFromUrl() {
  const [url, setUrl] = useState("");
  const [style, setStyle] = useState<"apa" | "mla" | "chicago" | "harvard" | "ieee">("apa");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [citation, setCitation] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualYear, setManualYear] = useState(String(new Date().getFullYear()));

  async function handleExtract() {
    if (!url.trim()) return;
    setError("");
    setLoading(true);

    try {
      let domain = "";
      try {
        domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
      } catch { domain = url; }

      const extracted: PageMeta = {
        title: manualTitle || `Article from ${domain}`,
        authors: manualAuthor ? [manualAuthor] : [],
        year: manualYear || String(new Date().getFullYear()),
        url: url.startsWith("http") ? url : `https://${url}`,
        publisher: domain,
      };

      setMeta(extracted);
      const cite = generateCitation(extracted, style);
      setCitation(cite);
    } catch (e) {
      setError("Could not process URL. Please fill in the fields manually.");
    } finally {
      setLoading(false);
    }
  }

  function handleStyleChange(newStyle: typeof style) {
    setStyle(newStyle);
    if (meta) {
      setCitation(generateCitation(meta, newStyle));
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function regenerate() {
    if (!url.trim()) return;
    const m: PageMeta = {
      title: manualTitle || meta?.title || "Untitled",
      authors: manualAuthor ? [manualAuthor] : meta?.authors || [],
      year: manualYear || meta?.year || String(new Date().getFullYear()),
      url: url.startsWith("http") ? url : `https://${url}`,
      publisher: meta?.publisher,
    };
    setMeta(m);
    setCitation(generateCitation(m, style));
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <Link2 size={16} className="text-blue-400" />
        Citation Generator
      </h3>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a URL..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <button
            onClick={handleExtract}
            disabled={loading || !url.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Generate
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Title (optional)"
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40"
          />
          <input
            type="text"
            value={manualAuthor}
            onChange={(e) => setManualAuthor(e.target.value)}
            placeholder="Author name (optional)"
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40"
          />
          <input
            type="text"
            value={manualYear}
            onChange={(e) => setManualYear(e.target.value)}
            placeholder="Year"
            className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/40"
          />
        </div>

        <div className="flex gap-1.5">
          {STYLES.map((s) => (
            <button
              key={s.value}
              onClick={() => handleStyleChange(s.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                style === s.value
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                  : "bg-white/[0.03] text-white/50 border-white/10 hover:border-white/20"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {citation && (
        <div className="space-y-3">
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
            <p className="text-sm text-white/80 leading-relaxed font-mono">{citation}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-colors"
            >
              {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy Citation"}
            </button>
            <button
              onClick={() => {
                if (!meta) return;
                const key = (meta.authors[0]?.split(" ").pop() || "unknown") + meta.year;
                const bib = `@misc{${key},\n  author = {${meta.authors.join(" and ") || "Unknown"}},\n  title = {${meta.title}},\n  year = {${meta.year}},\n  url = {${meta.url}},\n  publisher = {${meta.publisher || ""}}\n}`;
                const blob = new Blob([bib], { type: "application/x-bibtex" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `citation-${key}.bib`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.03] text-white/50 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              <BookOpen size={12} />
              Export BibTeX
            </button>
            <button
              onClick={regenerate}
              className="text-xs px-3 py-1.5 bg-white/[0.03] text-white/50 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
