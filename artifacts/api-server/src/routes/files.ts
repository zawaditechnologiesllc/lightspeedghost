import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { convert as htmlToText } from "html-to-text";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/rtf",
      "text/rtf",
      "text/plain",
      "text/markdown",
      "text/html",
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
 * Extract text from a PDF buffer using pdf-parse v2 (pure JS, no system binaries).
 * Works on any host including Render, Vercel, etc.
 *
 * v2 API: { PDFParse } is a class.
 *   const parser = new PDFParse({ data: buffer });
 *   const { text, totalPages } = await parser.getText();
 */
async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { PDFParse } = await import("pdf-parse") as any;
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return {
    text: result.text ?? "",
    pageCount: result.totalPages ?? result.numpages ?? 1,
  };
}

/**
 * Fallback text extractor for files that aren't true Word binary documents:
 * - RTF files (strip control codes)
 * - Plain text / HTML saved with a .doc extension
 */
function extractTextFallback(buffer: Buffer): string {
  const raw = buffer.toString("utf-8");

  // RTF: strip control words and groups, keep visible text
  if (raw.trimStart().startsWith("{\\rtf")) {
    return raw
      .replace(/\{\\[^{}]*\}/g, " ")         // remove \{...\} groups
      .replace(/\\[a-z]+[-]?\d* ?/g, " ")    // remove \controlword
      .replace(/[{}\\]/g, " ")               // remove remaining { } \
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  if (/<html[\s>]/i.test(raw) || raw.trimStart().startsWith("<!DOCTYPE")) {
    return htmlToText(raw, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "script", format: "skip" },
      ],
    }).trim();
  }

  // Plain text: strip non-printable bytes (keep tabs, newlines, and printable Unicode)
  const cleaned = raw.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "").trim();
  if (cleaned.length < 20) {
    throw new Error("File does not appear to contain readable text");
  }
  return cleaned;
}

router.post("/files/extract", requireAuth, upload.single("file"), async (req, res) => {
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
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch {
        // mammoth failed — the file may be RTF, HTML, or plain text with a .doc extension
        text = extractTextFallback(buffer);
      }
    } else if (mimetype === "application/rtf" || mimetype === "text/rtf") {
      text = extractTextFallback(buffer);
    } else if (mimetype === "text/html") {
      text = htmlToText(buffer.toString("utf-8"), {
        wordwrap: false,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
        ],
      });
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
      .replace(/\n{3,}/g, "\n\n")
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
