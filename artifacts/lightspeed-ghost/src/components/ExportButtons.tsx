import { useState } from "react";
import { Copy, CheckCheck, FileDown, Printer } from "lucide-react";
import { exportAsWord, exportAsPDF, copyText } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";

interface ExportButtonsProps {
  getHtml: () => string;
  getText: () => string;
  filename: string;
  className?: string;
}

export function ExportButtons({ getHtml, getText, filename, className }: ExportButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [wordDone, setWordDone] = useState(false);
  const [pdfDone, setPdfDone] = useState(false);

  const btn = cn(
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground",
    "hover:text-foreground border border-border hover:bg-muted transition-colors"
  );

  const handleCopy = async () => {
    await copyText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWord = () => {
    exportAsWord(getHtml(), filename);
    setWordDone(true);
    setTimeout(() => setWordDone(false), 2000);
  };

  const handlePdf = () => {
    exportAsPDF(getHtml());
    setPdfDone(true);
    setTimeout(() => setPdfDone(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button onClick={handleCopy} className={btn}>
        {copied ? <CheckCheck size={12} className="text-green-500" /> : <Copy size={12} />}
        {copied ? "Copied!" : "Copy"}
      </button>
      <button onClick={handleWord} className={btn}>
        {wordDone ? <CheckCheck size={12} className="text-green-500" /> : <FileDown size={12} />}
        {wordDone ? "Saved!" : "Word"}
      </button>
      <button onClick={handlePdf} className={btn}>
        {pdfDone ? <CheckCheck size={12} className="text-green-500" /> : <Printer size={12} />}
        {pdfDone ? "Sent!" : "PDF"}
      </button>
    </div>
  );
}
