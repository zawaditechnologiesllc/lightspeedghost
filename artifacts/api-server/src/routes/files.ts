import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { convert as htmlToText } from "html-to-text";
import { requireAuth } from "../middlewares/auth";
import { openai } from "../lib/ai";
import { recordUsage } from "../lib/apiCost";
import { wordsToTokens } from "../lib/tokenBudget.js";

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

// ── Reducto-style PDF cleaning ─────────────────────────────────────────────────
// Technique from the Reducto pattern: after raw PDF text extraction, run a cheap
// GPT-4o-mini pass to convert noisy OCR output into clean structured Markdown.
// This reduces the "noise tokens" Claude must process — page numbers, repeated
// headers/footers, OCR artifacts, and encoding garbage inflate the effective token
// count without contributing information. Only triggered for large or noisy files.
//
// Heuristic for "noisy":
//   • More than 10 standalone numeric lines (page numbers)
//   • Repeated header/footer pattern detected in consecutive pages
//   • Density of non-alphabetic chars > 15% (OCR artifacts)
//   • File > REDUCTO_MIN_WORDS words (small files aren't worth the extra call)

const REDUCTO_MIN_WORDS = 1500;

function isNoisyText(text: string): boolean {
  const lines = text.split("\n");
  // Count lines that are pure numbers (page numbers)
  const numericLines = lines.filter(l => /^\s*\d+\s*$/.test(l)).length;
  if (numericLines > 10) return true;
  // Non-alpha density
  const nonAlpha = (text.match(/[^a-zA-Z\s]/g) ?? []).length;
  const total = text.length;
  if (total > 0 && nonAlpha / total > 0.18) return true;
  // Excessive whitespace fragmentation (>40% blank lines)
  const blankLines = lines.filter(l => l.trim() === "").length;
  if (lines.length > 20 && blankLines / lines.length > 0.4) return true;
  return false;
}

async function reductoClean(rawText: string): Promise<string> {
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  if (wordCount < REDUCTO_MIN_WORDS || !isNoisyText(rawText)) return rawText;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: wordsToTokens(wordCount),
      messages: [{
        role: "user",
        content: `Convert this extracted PDF text to clean Markdown. Remove: page numbers, repeated headers/footers, OCR artifacts, excessive blank lines. Preserve ALL academic content, headings, lists, and data. Do not summarise — keep every substantive sentence.\n\n${rawText.slice(0, 18000)}`,
      }],
    });
    if (resp.usage) recordUsage("gpt-4o-mini", resp.usage.prompt_tokens, resp.usage.completion_tokens, "reducto-clean");
    const cleaned = resp.choices[0]?.message?.content ?? "";
    return cleaned.length > 100 ? cleaned : rawText;
  } catch {
    return rawText; // non-fatal — fall back to raw text
  }
}

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
      // Reducto pass — clean noisy PDF output before returning to client
      text = await reductoClean(result.text);
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
