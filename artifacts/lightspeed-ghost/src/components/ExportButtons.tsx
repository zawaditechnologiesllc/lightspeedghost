import { useState } from "react";
import { Copy, CheckCheck, FileDown, Printer, FileText, FileCode2 } from "lucide-react";
import {
  exportAsWord, exportAsDocx, exportAsPDF,
  exportAsTxt, exportAsMd, copyText,
} from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

export type ExportFormat = "copy" | "docx" | "doc" | "pdf" | "txt" | "md";

interface ExportButtonsProps {
  getHtml: () => string;
  getText: () => string;
  filename: string;
  /** Ordered list of formats to show. Defaults to ["docx", "doc", "pdf", "copy"]. */
  formats?: ExportFormat[];
  className?: string;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  copy:  "Copy",
  docx:  ".docx",
  doc:   ".doc",
  pdf:   "PDF",
  txt:   ".txt",
  md:    ".md",
};

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  copy:  <Copy size={12} />,
  docx:  <FileDown size={12} />,
  doc:   <FileDown size={12} />,
  pdf:   <Printer size={12} />,
  txt:   <FileText size={12} />,
  md:    <FileCode2 size={12} />,
};

const DEFAULT_FORMATS: ExportFormat[] = ["docx", "doc", "pdf", "copy"];

export function ExportButtons({
  getHtml,
  getText,
  filename,
  formats = DEFAULT_FORMATS,
  className,
}: ExportButtonsProps) {
  const [done, setDone] = useState<Partial<Record<ExportFormat, boolean>>>({});

  const btn = cn(
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground",
    "hover:text-foreground border border-border hover:bg-muted transition-colors whitespace-nowrap"
  );

  const markDone = (fmt: ExportFormat) => {
    setDone((d) => ({ ...d, [fmt]: true }));
    setTimeout(() => setDone((d) => ({ ...d, [fmt]: false })), 2000);
  };

  const handle = async (fmt: ExportFormat) => {
    switch (fmt) {
      case "copy":  await copyText(getText()); break;
      case "docx":  exportAsDocx(getHtml(), filename); break;
      case "doc":   exportAsWord(getHtml(), filename); break;
      case "pdf":   exportAsPDF(getHtml()); break;
      case "txt":   exportAsTxt(getText(), filename); break;
      case "md":    exportAsMd(getText(), filename); break;
    }
    markDone(fmt);
  };

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {formats.map((fmt) => (
        <button key={fmt} onClick={() => handle(fmt)} className={btn}>
          {done[fmt]
            ? <CheckCheck size={12} className="text-green-500" />
            : FORMAT_ICONS[fmt]}
          {done[fmt]
            ? fmt === "copy" ? "Copied!" : fmt === "pdf" ? "Opened!" : "Saved!"
            : FORMAT_LABELS[fmt]}
        </button>
      ))}
    </div>
  );
}
