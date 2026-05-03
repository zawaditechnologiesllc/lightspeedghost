import { useState } from "react";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import type { ListDocumentsType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, FileText, PenLine, FlaskConical, GraduationCap, Files, Search, Wand2, ShieldCheck, BookMarked, ListTree, Copy, FileDown, Printer, Clock, Infinity, Loader2 } from "lucide-react";
import { exportAsDocx, exportAsPDF, exportAsTxt, copyText, richToHtml, wrapDocHtml } from "@/lib/exportUtils";

const typeFilters = [
  { value: undefined,       label: "All" },
  { value: "paper",         label: "Papers" },
  { value: "outline",       label: "Outlines" },
  { value: "revision",      label: "Revisions" },
  { value: "humanizer",     label: "Humanizer" },
  { value: "plagiarism",    label: "AI & Plag" },
  { value: "stem",          label: "STEM" },
  { value: "study",         label: "Study" },
  { value: "ebook",         label: "Ebooks" },
] as const;

type DocType = typeof typeFilters[number]["value"];

const typeIcons: Record<string, React.ReactNode> = {
  paper:       <PenLine size={14} className="text-primary" />,
  outline:     <ListTree size={14} className="text-emerald-500" />,
  revision:    <Files size={14} className="text-blue-500" />,
  humanizer:   <Wand2 size={14} className="text-violet-500" />,
  plagiarism:  <ShieldCheck size={14} className="text-rose-500" />,
  stem:        <FlaskConical size={14} className="text-indigo-500" />,
  study:       <GraduationCap size={14} className="text-cyan-500" />,
  ebook:       <BookMarked size={14} className="text-purple-500" />,
};

const typeBadgeColors: Record<string, string> = {
  paper:      "bg-primary/10 text-primary",
  outline:    "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
  revision:   "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  humanizer:  "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400",
  plagiarism: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400",
  stem:       "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
  study:      "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400",
  ebook:      "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
};

const typeLabels: Record<string, string> = {
  paper:      "Write Paper",
  outline:    "Outline",
  revision:   "Revision",
  humanizer:  "Humanizer",
  plagiarism: "AI & Plagiarism",
  stem:       "STEM",
  study:      "Study",
  ebook:      "Ebook",
};

function parseLsgTitle(title: string): { code: string | null; label: string } {
  const match = title.match(/^(LSG-[A-Z]+\d+)-(.+)$/);
  if (match) return { code: match[1], label: match[2] };
  return { code: null, label: title };
}

export default function Documents() {
  const [selectedType, setSelectedType] = useState<DocType>(undefined);
  const [search, setSearch] = useState("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useListDocuments(
    { type: selectedType as ListDocumentsType | undefined, limit: 100, offset: 0 },
    { query: { queryKey: getListDocumentsQueryKey({ type: selectedType as ListDocumentsType | undefined, limit: 100, offset: 0 }) } }
  );

  const deleteDocument = useDeleteDocument();

  const handleExport = async (fmt: string, docId: number, title: string, content: string) => {
    const key = `${docId}-${fmt}`;
    setExportingKey(key);
    const { label } = parseLsgTitle(title);
    const slug = title.replace(/[^a-zA-Z0-9-_ ]/g, "_").replace(/\s+/g, "_").slice(0, 60).trim();
    try {
      if (fmt === "copy") await copyText(content);
      else if (fmt === "docx") await exportAsDocx(content, slug, label);
      else if (fmt === "pdf") exportAsPDF(wrapDocHtml(label, richToHtml(content)));
      else if (fmt === "txt") exportAsTxt(content, slug);
    } finally {
      setExportingKey(null);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDocument.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
  };

  const filtered = data?.documents.filter((doc) =>
    !search ||
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.subject?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const retentionDays = data?.retentionDays;

  const retentionLabel =
    retentionDays === null || retentionDays === undefined
      ? null
      : retentionDays <= 7
        ? { text: `Documents kept for ${retentionDays} days on your plan. Upgrade to Pro for 90-day history or Institution/Ebooks for unlimited.`, warn: true }
        : { text: `Documents kept for ${retentionDays} days on your plan.`, warn: false };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">History</h1>
        <p className="text-muted-foreground text-sm mt-1">All your saved documents — papers, outlines, revisions, humanizer runs, reports, STEM solutions, study sessions and ebooks</p>
      </div>

      {/* Retention notice */}
      {retentionDays !== undefined && (
        <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs ${
          retentionLabel?.warn
            ? "bg-amber-500/8 border-amber-500/20 text-amber-600 dark:text-amber-400"
            : retentionDays === null
              ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-muted/60 border-border text-muted-foreground"
        }`}>
          {retentionDays === null
            ? <Infinity size={13} className="shrink-0" />
            : <Clock size={13} className="shrink-0" />}
          <span>
            {retentionDays === null
              ? "Unlimited document history — your plan keeps all documents forever."
              : retentionLabel?.text}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.label}
              onClick={() => setSelectedType(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedType === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-40 bg-card border border-border rounded-lg px-3 py-1.5">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 w-1/3 bg-muted rounded mb-2" />
              <div className="h-3 w-1/2 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center gap-3">
          <FileText size={32} className="text-muted-foreground/30" />
          <div className="text-muted-foreground text-sm">
            {search ? "No documents match your search" : "No documents yet. Use any tool and your work will appear here."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const { code, label } = parseLsgTitle(doc.title);
            return (
              <div
                key={doc.id}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {typeIcons[doc.type] ?? <FileText size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {code && (
                      <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">
                        {code}
                      </span>
                    )}
                    <span className="font-medium text-sm truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[doc.type] ?? "bg-muted text-muted-foreground"}`}>
                      {typeLabels[doc.type] ?? doc.type}
                    </span>
                    {doc.subject && <span className="text-xs text-muted-foreground">{doc.subject}</span>}
                    <span className="text-xs text-muted-foreground">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    {(doc.wordCount ?? 0) > 0 && <span className="text-xs text-muted-foreground">{(doc.wordCount ?? 0).toLocaleString()} words</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.content && (
                    <>
                      {(["copy", "docx", "pdf", "txt"] as const).map((fmt) => {
                        const isLoading = exportingKey === `${doc.id}-${fmt}`;
                        const icons: Record<string, React.ReactNode> = {
                          copy: <Copy size={13} />,
                          docx: <FileDown size={13} />,
                          pdf:  <Printer size={13} />,
                          txt:  <FileText size={13} />,
                        };
                        const labels: Record<string, string> = { copy: "Copy", docx: "Word", pdf: "PDF", txt: ".txt" };
                        return (
                          <button
                            key={fmt}
                            onClick={() => handleExport(fmt, doc.id, doc.title, doc.content)}
                            disabled={!!exportingKey}
                            title={labels[fmt]}
                            className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                          >
                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : icons[fmt]}
                            <span className="hidden sm:inline">{labels[fmt]}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleteDocument.isPending}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
