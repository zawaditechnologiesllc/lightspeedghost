import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, studyMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { AskStudyAssistantBody, GetSessionMessagesParams } from "@workspace/api-zod";
import { anthropic } from "../lib/ai";
import { TUTOR_SOUL } from "../lib/soul";
import { getStudentMemory, updateStudentMemory, buildMemoryContext, memoryFlush } from "../lib/memory";
import { recordUsage } from "../lib/apiCost";

const router = Router();

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

    // Save user message
    await db.insert(studyMessagesTable).values({
      sessionId,
      role: "user",
      content: body.question,
    });

    // 1. Load student persistent memory (Jarvis Effect)
    const memory = await getStudentMemory();
    const memoryContext = buildMemoryContext(memory);

    // 2. Load conversation history for context
    const history = await db
      .select()
      .from(studyMessagesTable)
      .where(eq(studyMessagesTable.sessionId, sessionId))
      .orderBy(studyMessagesTable.createdAt)
      .limit(20);

    const conversationMessages = history
      .slice(0, -1) // exclude the message we just inserted
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // 3. Build tutor mode instructions
    const modeInstructions: Record<string, string> = {
      tutor: "Guide the student step by step from first principles. Ask clarifying questions. Adapt to their level.",
      explain: "Give a clear, concise explanation. Use analogies and concrete examples. Keep it focused.",
      quiz: "Ask the student a series of questions to test their understanding. Give hints if they struggle. Reveal the answer after 2 wrong attempts.",
      summarize: "Create a structured summary with key points, definitions, and the most important takeaways.",
    };

    const modeInstruction = modeInstructions[body.mode ?? "tutor"] ?? modeInstructions.tutor;

    const systemPrompt = `${TUTOR_SOUL}

${memoryContext}

CURRENT MODE: ${(body.mode ?? "tutor").toUpperCase()}
Mode instructions: ${modeInstruction}

End every response with:
FOLLOW_UP_1: [relevant follow-up question]
FOLLOW_UP_2: [another follow-up question]
FOLLOW_UP_3: [third follow-up question]
RELATED_CONCEPTS: [3-5 comma-separated related concepts]
TOPIC_TAG: [single topic label for this conversation, e.g. "Integration by parts"]`;

    // 4. Call Claude 3.5 Sonnet — Tutoring model (ClawRouter)
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...conversationMessages,
        { role: "user", content: body.question },
      ],
    });

    recordUsage("claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens, "study-tutor");

    const fullText = response.content[0].type === "text" ? response.content[0].text : "";

    // 5. Parse follow-ups and topic tag from response
    const followUp1 = fullText.match(/FOLLOW_UP_1:\s*(.+)/)?.[1]?.trim() ?? "Can you explain this further?";
    const followUp2 = fullText.match(/FOLLOW_UP_2:\s*(.+)/)?.[1]?.trim() ?? "What are common mistakes here?";
    const followUp3 = fullText.match(/FOLLOW_UP_3:\s*(.+)/)?.[1]?.trim() ?? "How does this apply in practice?";
    const relatedConceptsRaw = fullText.match(/RELATED_CONCEPTS:\s*(.+)/)?.[1]?.trim() ?? "";
    const topicTag = fullText.match(/TOPIC_TAG:\s*(.+)/)?.[1]?.trim() ?? body.question.slice(0, 30);

    // 6. Strip metadata from the visible answer
    const answer = fullText
      .replace(/FOLLOW_UP_\d+:.*$/gm, "")
      .replace(/RELATED_CONCEPTS:.*$/gm, "")
      .replace(/TOPIC_TAG:.*$/gm, "")
      .trim();

    const relatedConcepts = relatedConceptsRaw
      ? relatedConceptsRaw.split(",").map((c) => c.trim()).filter(Boolean).slice(0, 5)
      : ["Foundational Principles", "Advanced Applications", "Common Use Cases"];

    // 7. Save assistant message
    const [assistantMsg] = await db
      .insert(studyMessagesTable)
      .values({ sessionId, role: "assistant", content: answer })
      .returning();

    // 8. Update session
    await db
      .update(studySessionsTable)
      .set({ lastActivity: new Date(), messageCount: history.length + 2 })
      .where(eq(studySessionsTable.id, sessionId));

    // 9. Update student memory — Jarvis Effect (fire-and-forget)
    updateStudentMemory({
      newTopic: topicTag,
      subject: body.subject ?? "General",
    }).catch(() => {});

    // 10. Detect struggle signals and log to memory
    const struggleSignals = /confused|don't understand|struggling|lost|wrong|error|mistake|help/i.test(body.question);
    if (struggleSignals) {
      memoryFlush(`Student struggled with: ${topicTag}`).catch(() => {});
    }

    res.json({
      answer,
      followUpQuestions: [followUp1, followUp2, followUp3],
      sessionId,
      messageId: assistantMsg.id,
      relatedConcepts,
    });
  } catch (err) {
    req.log.error({ err }, "Error in study assistant");
    res.status(500).json({ error: "Failed to get tutor response. Please try again." });
  }
});

export default router;
