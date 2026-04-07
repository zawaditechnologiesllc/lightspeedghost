import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";

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
