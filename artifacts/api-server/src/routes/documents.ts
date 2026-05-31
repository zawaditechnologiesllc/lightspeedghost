import { Router } from "express";
import { db } from "@workspace/db";
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
