import { useState } from "react";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, FileText, PenLine, FlaskConical, GraduationCap, Files, Search } from "lucide-react";

const typeFilters = [
  { value: undefined, label: "All" },
  { value: "paper" as const, label: "Papers" },
  { value: "revision" as const, label: "Revisions" },
  { value: "stem" as const, label: "STEM" },
  { value: "study" as const, label: "Study" },
];

const typeIcons: Record<string, React.ReactNode> = {
  paper: <PenLine size={14} className="text-primary" />,
  revision: <Files size={14} className="text-blue-500" />,
  stem: <FlaskConical size={14} className="text-indigo-500" />,
  study: <GraduationCap size={14} className="text-cyan-500" />,
};

const typeBadgeColors: Record<string, string> = {
  paper: "bg-primary/10 text-primary",
  revision: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  stem: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
  study: "bg-cyan-100 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400",
};

export default function Documents() {
  const [selectedType, setSelectedType] = useState<"paper" | "revision" | "stem" | "study" | undefined>();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useListDocuments(
    { type: selectedType, limit: 50, offset: 0 },
    { query: { queryKey: getListDocumentsQueryKey({ type: selectedType, limit: 50, offset: 0 }) } }
  );

  const deleteDocument = useDeleteDocument();

  const handleDelete = async (id: number) => {
    await deleteDocument.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({}) });
  };

  const filtered = data?.documents.filter((doc) =>
    !search || doc.title.toLowerCase().includes(search.toLowerCase()) || doc.subject?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">History</h1>
        <p className="text-muted-foreground text-sm mt-1">All your saved papers, revisions, STEM solutions, and study sessions</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <button
              key={f.label}
              onClick={() => setSelectedType(f.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
        <span className="text-sm text-muted-foreground">{filtered.length} documents</span>
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
            {search ? "No documents match your search" : "No documents yet. Start writing or solving STEM problems!"}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {typeIcons[doc.type] ?? <FileText size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{doc.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColors[doc.type] ?? "bg-muted text-muted-foreground"}`}>
                    {doc.type}
                  </span>
                  {doc.subject && <span className="text-xs text-muted-foreground">{doc.subject}</span>}
                  <span className="text-xs text-muted-foreground">{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  {doc.wordCount > 0 && <span className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deleteDocument.isPending}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
