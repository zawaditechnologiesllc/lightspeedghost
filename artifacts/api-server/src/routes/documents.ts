import { Router } from "express";
import { db, pool } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  CreateDocumentBody,
  UpdateDocumentBody,
  ListDocumentsQueryParams,
  GetDocumentParams,
  UpdateDocumentParams,
  DeleteDocumentParams,
} from "@workspace/api-zod";

const router = Router();

// ── Export tracking ───────────────────────────────────────────────────────────

async function ensureExportsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_exports (
      id          BIGSERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      document_id TEXT NOT NULL,
      format      TEXT NOT NULL DEFAULT 'doc',
      exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_doc_exports_user ON document_exports (user_id);
    CREATE INDEX IF NOT EXISTS idx_doc_exports_time ON document_exports (exported_at DESC);
  `);
}
ensureExportsTable().catch(() => {});

async function getExportExpiryDays(): Promise<number> {
  try {
    const { rows } = await pool.query<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'export_expiry_days'",
    );
    const n = parseInt(rows[0]?.value ?? "30", 10);
    return Number.isFinite(n) && n > 0 ? n : 30;
  } catch {
    return 30;
  }
}

// POST /documents/:id/export — returns content for download if the document is
// still within the export window (export_expiry_days after last update), and
// logs the export so admin can audit activity.
router.post("/documents/:id/export", requireAuth, async (req, res) => {
  try {
    const { id } = GetDocumentParams.parse(req.params);
    const format = (req.body as { format?: string })?.format === "md" ? "md" : "doc";

    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, req.userId!)));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const expiryDays = await getExportExpiryDays();
    const ageMs = Date.now() - doc.updatedAt.getTime();
    const expired = ageMs > expiryDays * 24 * 60 * 60 * 1000;
    if (expired) {
      return res.status(410).json({
        error: `Export window closed — documents can be exported for ${expiryDays} days after their last edit. Open and re-save the document to refresh the window.`,
        expiryDays,
      });
    }

    await pool.query(
      `INSERT INTO document_exports (user_id, document_id, format) VALUES ($1, $2, $3)`,
      [req.userId!, id, format],
    );

    res.json({
      ok: true,
      title: doc.title,
      content: doc.content ?? "",
      format,
      expiresAt: new Date(doc.updatedAt.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error exporting document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;

    const allDocs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId))
      .orderBy(desc(documentsTable.updatedAt));

    const stats = {
      totalDocuments: allDocs.length,
      papersWritten: allDocs.filter((d) => d.type === "paper").length,
      revisionsCompleted: allDocs.filter((d) => d.type === "revision").length,
      stemSolved: allDocs.filter((d) => d.type === "stem").length,
      studySessions: allDocs.filter((d) => d.type === "study").length,
      recentDocuments: allDocs.slice(0, 5).map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    };

    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Error fetching document stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents", requireAuth, async (req, res) => {
  try {
    const params = ListDocumentsQueryParams.parse(req.query);
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const userId = req.userId!;

    const allDocs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.userId, userId))
      .orderBy(desc(documentsTable.updatedAt));

    const filtered = params.type ? allDocs.filter((d) => d.type === params.type) : allDocs;
    const paginated = filtered.slice(offset, offset + limit);

    res.json({
      documents: paginated.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      total: filtered.length,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/documents", requireAuth, async (req, res) => {
  try {
    const body = CreateDocumentBody.parse(req.body);
    const wordCount = body.content.split(/\s+/).filter(Boolean).length;
    const userId = req.userId!;

    const [doc] = await db
      .insert(documentsTable)
      .values({ ...body, wordCount, userId })
      .returning();

    res.status(201).json({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error creating document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/documents/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetDocumentParams.parse(req.params);
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, req.userId!)));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/documents/:id", requireAuth, async (req, res) => {
  try {
    const { id } = UpdateDocumentParams.parse(req.params);
    const body = UpdateDocumentBody.parse(req.body);

    const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.content) {
      updates.wordCount = body.content.split(/\s+/).filter(Boolean).length;
    }

    const [doc] = await db
      .update(documentsTable)
      .set(updates)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, req.userId!)))
      .returning();

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      ...doc,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error updating document");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/documents/:id", requireAuth, async (req, res) => {
  try {
    const { id } = DeleteDocumentParams.parse(req.params);
    const [deleted] = await db
      .delete(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, req.userId!)))
      .returning({ id: documentsTable.id });

    if (!deleted) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Error deleting document");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
