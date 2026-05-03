import { useRef, useState, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface StemImageOcrProps {
  onExtracted: (text: string) => void;
  compact?: boolean;
}

type OcrStatus = "idle" | "dragging" | "loading_ocr" | "processing" | "done" | "error";

export default function StemImageOcr({ onExtracted, compact = false }: StemImageOcrProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runOcr = useCallback(
    async (file: File) => {
      setStatus("loading_ocr");
      setFilename(file.name);
      setError(null);
      setProgress(0);

      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
            if (m.status !== "idle") {
              setStatus("processing");
            }
          },
        });

        const { data } = await worker.recognize(file);
        await worker.terminate();

        const cleaned = data.text.trim();
        if (!cleaned) {
          throw new Error("No text detected in image. Try a clearer photo.");
        }

        setStatus("done");
        onExtracted(cleaned);
      } catch (err) {
        setError(err instanceof Error ? err.message : "OCR failed");
        setStatus("error");
      }
    },
    [onExtracted],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (PNG, JPG, WEBP)");
        setStatus("error");
        return;
      }
      runOcr(file);
    },
    [runOcr],
  );

  const clear = () => {
    setStatus("idle");
    setFilename(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isProcessing = status === "loading_ocr" || status === "processing";
  const isDragging = status === "dragging";

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/jpg"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => !isProcessing && inputRef.current?.click()}
          disabled={isProcessing}
          title="Take or upload a photo of your problem (OCR)"
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
            status === "done"
              ? "border-green-500/50 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
              : status === "error"
              ? "border-destructive/50 text-destructive bg-destructive/5"
              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50 bg-card"
          } disabled:opacity-60`}
        >
          {isProcessing ? (
            <>
              <Loader2 size={12} className="animate-spin text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">{progress > 0 ? `${progress}%` : "Reading…"}</span>
            </>
          ) : status === "done" ? (
            <>
              <CheckCircle size={12} />
              <span>Re-scan</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }} className="hover:text-foreground ml-0.5">
                <X size={11} />
              </button>
            </>
          ) : status === "error" ? (
            <>
              <AlertCircle size={12} />
              <span>Retry</span>
            </>
          ) : (
            <>
              <Camera size={12} />
              <span>Scan photo</span>
            </>
          )}
        </button>
      </>
    );
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setStatus("dragging"); }}
      onDragOver={(e) => { e.preventDefault(); }}
      onDragLeave={() => setStatus("idle")}
      onDrop={(e) => { e.preventDefault(); setStatus("idle"); handleFiles(e.dataTransfer.files); }}
      onClick={() => !isProcessing && inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-5
        cursor-pointer select-none transition-all duration-150
        ${isDragging ? "border-primary bg-primary/5" : isProcessing ? "border-blue-400 bg-blue-500/5 cursor-default" : status === "done" ? "border-green-500/40 bg-green-500/5" : status === "error" ? "border-destructive/40 bg-destructive/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {isProcessing ? (
        <>
          <Loader2 size={22} className="text-blue-500 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {status === "loading_ocr" ? "Loading OCR engine…" : `Reading text… ${progress}%`}
            </p>
            {status === "processing" && (
              <div className="mt-2 h-1.5 w-40 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{filename}</p>
          </div>
        </>
      ) : status === "done" ? (
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-green-500" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">Text extracted from image</span>
          <button onClick={(e) => { e.stopPropagation(); clear(); }} className="ml-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      ) : status === "error" ? (
        <>
          <AlertCircle size={20} className="text-destructive" />
          <span className="text-xs text-destructive font-medium text-center">{error}</span>
          <span className="text-xs text-muted-foreground">Click to try again</span>
        </>
      ) : (
        <>
          <Camera size={22} className={isDragging ? "text-primary" : "text-muted-foreground"} />
          <div className="text-center">
            <p className={`text-sm font-medium ${isDragging ? "text-primary" : "text-foreground"}`}>
              Upload a photo of your problem
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, WEBP — OCR runs in your browser</p>
          </div>
        </>
      )}
    </div>
  );
}
