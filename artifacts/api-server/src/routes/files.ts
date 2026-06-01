import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { convert as htmlToText } from "html-to-text";

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
      // Excel formats
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "application/octet-stream", // some browsers send xlsx as this
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Also allow by extension for browsers that send wrong mime
      const name = (file.originalname ?? "").toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    }
  },
});

/**
 * Extract text from a PDF buffer using pdf-parse v2.
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
 * Extract text from Excel files (.xlsx, .xls) using the xlsx library.
 * Converts each sheet to CSV and returns all sheets concatenated.
 */
async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetTexts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
    if (csv.trim()) {
      sheetTexts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
  }
  return sheetTexts.join("\n\n");
}

/**
 * Fallback text extractor for RTF, HTML, and plain text saved with odd extensions.
 */
function extractTextFallback(buffer: Buffer): string {
  const raw = buffer.toString("utf-8");

  // RTF: strip control words and groups, keep visible text
  if (raw.trimStart().startsWith("{\\rtf")) {
    return raw
      .replace(/\{\\[^{}]*\}/g, " ")
      .replace(/\\[a-z]+[-]?\d* ?/g, " ")
      .replace(/[{}\\]/g, " ")
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

  const cleaned = raw.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "").trim();
  if (cleaned.length < 20) {
    throw new Error("File does not appear to contain readable text");
  }
  return cleaned;
}

/**
 * POST /api/files/extract
 * Extracts text from an uploaded file. Does NOT require authentication —
 * text extraction is stateless and stores no user data.
 */
router.post("/files/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { mimetype, originalname, buffer, size } = req.file;
    const nameLower = (originalname ?? "").toLowerCase();
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
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimetype === "application/vnd.ms-excel" ||
      nameLower.endsWith(".xlsx") ||
      nameLower.endsWith(".xls")
    ) {
      text = await extractTextFromExcel(buffer);
    } else if (nameLower.endsWith(".csv") || mimetype === "text/csv") {
      text = buffer.toString("utf-8");
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
    } else if (mimetype === "application/octet-stream") {
      // Try Excel first (common when browser doesn't set correct mime)
      try {
        text = await extractTextFromExcel(buffer);
      } catch {
        text = extractTextFallback(buffer);
      }
    } else {
      return res.status(400).json({ error: "Could not extract text from this file type" });
    }

    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

    const isExcel = nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
    res.json({
      text: cleaned,
      mimeType: mimetype,
      filename: originalname,
      wordCount,
      pageCount,
      fileSize: size,
      isImage: false,
      isSpreadsheet: isExcel,
    });
  } catch (err) {
    req.log.error({ err }, "Error extracting file text");
    res.status(500).json({ error: "Failed to extract text from file" });
  }
});

export default router;
