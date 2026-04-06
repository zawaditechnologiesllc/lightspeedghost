import { useRef, useState, useCallback } from "react";
import { Upload, FileText, Image, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export interface ExtractedFile {
  text: string;
  filename: string;
  mimeType: string;
  wordCount: number;
  pageCount?: number;
  isImage: boolean;
  base64?: string;
}

interface FileUploadZoneProps {
  onExtracted: (file: ExtractedFile) => void;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
  compact?: boolean;
}

const ACCEPT_DEFAULT = ".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp";

const MIME_ICON: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "text/plain": "TXT",
  "text/markdown": "MD",
};

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <Image size={14} className="shrink-0" />;
  return <FileText size={14} className="shrink-0" />;
}

function fileLabel(mime: string) {
  return MIME_ICON[mime] ?? mime.split("/")[1]?.toUpperCase() ?? "FILE";
}

type Status = "idle" | "dragging" | "extracting" | "done" | "error";

export default function FileUploadZone({
  onExtracted,
  accept = ACCEPT_DEFAULT,
  label = "Upload a file",
  hint = "PDF, Word, or plain text",
  className = "",
  compact = false,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [uploadedFile, setUploadedFile] = useState<ExtractedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API = import.meta.env.VITE_API_URL ?? "";

  const processFile = useCallback(
    async (file: File) => {
      setStatus("extracting");
      setError(null);
      setUploadedFile(null);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API}/api/files/extract`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Server error ${res.status}`);
        }

        const data: ExtractedFile = await res.json();
        setUploadedFile(data);
        setStatus("done");
        onExtracted(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to extract file");
        setStatus("error");
      }
    },
    [onExtracted],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      processFile(files[0]);
    },
    [processFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setStatus("idle");
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const clear = () => {
    setStatus("idle");
    setUploadedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isDragging = status === "dragging";
  const isExtracting = status === "extracting";

  if (compact && uploadedFile) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/5 text-sm ${className}`}>
        <CheckCircle size={14} className="text-green-500 shrink-0" />
        <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium min-w-0">
          {fileIcon(uploadedFile.mimeType)}
          <span className="truncate">{uploadedFile.filename}</span>
        </span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">{uploadedFile.wordCount.toLocaleString()} words</span>
        <button onClick={clear} className="text-muted-foreground hover:text-foreground shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        onDragEnter={(e) => { e.preventDefault(); setStatus("dragging"); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragLeave={() => setStatus("idle")}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-150 select-none
          ${compact ? "px-4 py-3" : "px-6 py-6"}
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : isExtracting
            ? "border-blue-400 bg-blue-500/5"
            : status === "done"
            ? "border-green-500/40 bg-green-500/5"
            : status === "error"
            ? "border-destructive/40 bg-destructive/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isExtracting ? (
          <>
            <Loader2 size={compact ? 18 : 22} className="text-blue-500 animate-spin" />
            <span className="text-xs text-blue-500 font-medium">Extracting text…</span>
          </>
        ) : status === "done" && uploadedFile ? (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle size={compact ? 16 : 20} className="text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400 truncate max-w-[200px]">
                {uploadedFile.filename}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); clear(); }}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="px-1.5 py-0.5 bg-muted rounded font-mono">{fileLabel(uploadedFile.mimeType)}</span>
              <span>{uploadedFile.wordCount.toLocaleString()} words extracted</span>
              {uploadedFile.pageCount ? <span>{uploadedFile.pageCount} pages</span> : null}
            </div>
          </>
        ) : status === "error" ? (
          <>
            <AlertCircle size={compact ? 16 : 20} className="text-destructive" />
            <span className="text-xs text-destructive font-medium text-center">{error}</span>
            <span className="text-xs text-muted-foreground">Click to try again</span>
          </>
        ) : (
          <>
            <Upload size={compact ? 16 : 20} className={`${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-center">
              <span className={`font-medium text-sm ${isDragging ? "text-primary" : "text-foreground"}`}>{label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
