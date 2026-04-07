import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { spawn } from "child_process";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "text/markdown",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

/**
 * Extract text from a PDF buffer.
 *
 * Primary:  pdftotext (poppler-utils) — handles PDF 1.0–2.0 including
 *           cross-reference streams, scanned PDFs, encrypted PDFs.
 * Fallback: pdf2json — for environments where pdftotext is unavailable.
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // --- Primary: system pdftotext -------------------------------------------
  try {
    const text = await new Promise<string>((resolve, reject) => {
      // pdftotext -layout - -   reads from stdin, writes to stdout
      const proc = spawn("pdftotext", ["-layout", "-enc", "UTF-8", "-", "-"]);
      let out = "";
      let err = "";

      proc.stdout.on("data", (chunk: Buffer) => { out += chunk.toString("utf-8"); });
      proc.stderr.on("data", (chunk: Buffer) => { err += chunk.toString("utf-8"); });

      proc.on("close", (code) => {
        // Exit 0 = success. pdftotext also exits 0 with warnings — those are fine.
        // Consider it a success if we got any text, even on non-zero exit.
        if (code === 0 || out.trim().length > 0) {
          resolve(out);
        } else {
          reject(new Error(`pdftotext failed (exit ${code}): ${err.slice(0, 200)}`));
        }
      });

      proc.on("error", (e) => reject(e)); // ENOENT if pdftotext not on PATH

      proc.stdin.write(buffer);
      proc.stdin.end();
    });

    // pdftotext uses form-feed \f as page separator
    const pageCount = Math.max(1, (text.match(/\f/g) ?? []).length + 1);
    return { text, pageCount };

  } catch {
    // pdftotext not on PATH or hard failure — fall through to pdf2json
  }

  // --- Fallback: pdf2json ---------------------------------------------------
  const { default: PDFParser } = await import("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);

    parser.on("pdfParser_dataError", (errData: { parserError: unknown }) => {
      const msg = typeof errData.parserError === "string"
        ? errData.parserError
        : String(errData.parserError);
      reject(new Error(msg));
    });

    parser.on("pdfParser_dataReady", () => {
      const raw = (parser as any).getRawTextContent() as string;
      const pageCount = (parser as any).data?.Pages?.length ?? 0;
      resolve({ text: raw, pageCount });
    });

    parser.parseBuffer(buffer);
  });
}

router.post("/files/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { mimetype, originalname, buffer, size } = req.file;
    let text = "";
    let pageCount: number | undefined;

    if (mimetype === "application/pdf") {
      const result = await extractTextFromPDF(buffer);
      text = result.text;
      pageCount = result.pageCount || undefined;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (mimetype.startsWith("text/")) {
      text = buffer.toString("utf-8");
    } else if (mimetype.startsWith("image/")) {
      return res.json({
        text: "",
        mimeType: mimetype,
        filename: originalname,
        wordCount: 0,
        isImage: true,
        message: "Image uploaded — OCR will run in your browser",
        base64: buffer.toString("base64"),
      });
    } else {
      return res.status(400).json({ error: "Could not extract text from this file type" });
    }

    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\f/g, "\n\n---\n\n")          // page breaks (pdftotext)
      .replace(/\n{3,}/g, "\n\n")
      .replace(/----------------Page \(\d+\) Break----------------/g, "\n\n---\n\n")
      .trim();

    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

    res.json({
      text: cleaned,
      mimeType: mimetype,
      filename: originalname,
      wordCount,
      pageCount,
      fileSize: size,
      isImage: false,
    });
  } catch (err) {
    req.log.error({ err }, "Error extracting file text");
    res.status(500).json({ error: "Failed to extract text from file" });
  }
});

export default router;
