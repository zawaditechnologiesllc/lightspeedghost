import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, studyMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { AskStudyAssistantBody, GetSessionMessagesParams } from "@workspace/api-zod";

const router = Router();

const TUTOR_RESPONSES = [
  "Great question! Let me break this down step by step for you. The key concept here is understanding the underlying principles before applying them.",
  "That's an important topic to master. Think of it this way — the foundational idea is that every complex problem can be decomposed into smaller, more manageable parts.",
  "Excellent! Let's explore this together. The most effective way to understand this is through a concrete example first, then we can generalize.",
  "I can see why this might be confusing. The trick is to approach it systematically — first establish what you know, then figure out what you need to find.",
  "Good thinking! This connects to several key concepts. Let me explain the relationship and why it matters for your overall understanding.",
];

router.get("/study/sessions", async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(studySessionsTable)
      .orderBy(desc(studySessionsTable.lastActivity))
      .limit(20);

    res.json({
      sessions: sessions.map((s) => ({
        ...s,
        lastActivity: s.lastActivity.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing study sessions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/study/sessions/:id/messages", async (req, res) => {
  try {
    const { id } = GetSessionMessagesParams.parse(req.params);
    const messages = await db
      .select()
      .from(studyMessagesTable)
      .where(eq(studyMessagesTable.sessionId, id))
      .orderBy(studyMessagesTable.createdAt);

    res.json({
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/study/ask", async (req, res) => {
  try {
    const body = AskStudyAssistantBody.parse(req.body);

    let sessionId = body.sessionId;

    if (!sessionId) {
      const [session] = await db
        .insert(studySessionsTable)
        .values({
          title: body.question.slice(0, 60) + (body.question.length > 60 ? "..." : ""),
          subject: "General",
          messageCount: 0,
          lastActivity: new Date(),
        })
        .returning();
      sessionId = session.id;
    }

    const [userMsg] = await db
      .insert(studyMessagesTable)
      .values({
        sessionId,
        role: "user",
        content: body.question,
      })
      .returning();

    const aiResponse =
      TUTOR_RESPONSES[Math.floor(Math.random() * TUTOR_RESPONSES.length)] +
      ` Regarding "${body.question.slice(0, 50)}${body.question.length > 50 ? "..." : ""}" — the key points to understand are: (1) the conceptual foundation, (2) the practical application, and (3) how this connects to broader themes in the subject.`;

    const [assistantMsg] = await db
      .insert(studyMessagesTable)
      .values({
        sessionId,
        role: "assistant",
        content: aiResponse,
      })
      .returning();

    await db
      .update(studySessionsTable)
      .set({
        lastActivity: new Date(),
        messageCount: db.$count(studyMessagesTable, eq(studyMessagesTable.sessionId, sessionId)) as unknown as number,
      })
      .where(eq(studySessionsTable.id, sessionId));

    res.json({
      answer: aiResponse,
      followUpQuestions: [
        "Can you explain this in simpler terms?",
        "What are the common mistakes people make with this concept?",
        "How does this apply to real-world problems?",
      ],
      sessionId,
      messageId: assistantMsg.id,
      relatedConcepts: ["Foundational Principles", "Advanced Applications", "Common Use Cases"],
    });
  } catch (err) {
    req.log.error({ err }, "Error in study assistant");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
