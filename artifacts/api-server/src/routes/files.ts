import { Router } from "express";
import multer from "multer";
import PDFParser from "pdf2json";
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

function extractTextFromPDF(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);

    parser.on("pdfParser_dataError", (errData: { parserError: Error }) => {
      reject(errData.parserError);
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
