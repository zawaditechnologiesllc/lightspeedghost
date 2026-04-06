import { Router } from "express";
import { db } from "@workspace/db";
import { studySessionsTable, studyMessagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { AskStudyAssistantBody, GetSessionMessagesParams } from "@workspace/api-zod";
import { anthropic, openai } from "../lib/ai";
import { TUTOR_SOUL } from "../lib/soul";
import { getStudentMemory, updateStudentMemory, buildMemoryContext, memoryFlush } from "../lib/memory";
import { recordSearchResults, recordTopicSearch } from "../lib/learningEngine";
import { indexStudyExchange, recallStudyContext } from "../lib/memvidMemory";
import { searchAllAcademicSources, buildRAGContext } from "../lib/academicSources";
import { recordUsage } from "../lib/apiCost";
import { trackUsage } from "../lib/usageTracker";
import multer from "multer";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

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
    if (req.userId) trackUsage(req.userId, "study").catch(() => {});
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

    // 1. Load student memory + academic RAG in parallel (both fire-and-forget safe)
    const [memory, semanticContext, ragPapers] = await Promise.all([
      getStudentMemory(req.userId),
      req.userId
        ? recallStudyContext(req.userId, body.question, 3).catch(() => "")
        : Promise.resolve(""),
      searchAllAcademicSources(body.question, 8, body.subject).catch(() => []),
    ]);

    // Record which sources returned results (fire-and-forget — learning engine)
    if (ragPapers.length > 0) {
      const sourceCounts = ragPapers.reduce<Record<string, number>>((acc, p) => {
        acc[p.source] = (acc[p.source] ?? 0) + 1;
        return acc;
      }, {});
      const subject = body.subject ?? (
        /biolog|medicine|health/i.test(body.question) ? "biomedical" :
        /physics|math|computer/i.test(body.question) ? "stem" :
        /history|art|law|social/i.test(body.question) ? "humanities" : "general"
      );
      recordSearchResults(
        Object.entries(sourceCounts).map(([source, resultCount]) => ({ source, resultCount })),
        subject
      ).catch(() => {});
    }

    // Track topic for personalised future suggestions (fire-and-forget)
    if (req.userId) {
      recordTopicSearch(req.userId, body.question.slice(0, 120)).catch(() => {});
    }

    const memoryContext = buildMemoryContext(memory);
    const ragContext = buildRAGContext(ragPapers);

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
${semanticContext ? `\n${semanticContext}\n` : ""}${body.documentContext ? `
STUDENT-UPLOADED MATERIALS (PRIMARY SOURCE — answer from this material first and foremost):
${body.documentContext.slice(0, 6000)}

INSTRUCTION: The student has uploaded their own notes/materials above. Base your answer primarily on what is in those materials. If the question is answered there, cite from it directly. Only use the academic sources below for supplementary depth.

` : ""}${ragContext ? `${ragContext}\n\n` : ""}ANSWER QUALITY STANDARDS:
• Accuracy target: 92%+ — ground every claim in the student's materials or the verified sources above
• Do NOT cite Wikipedia or unverified sources
• If you are uncertain, say so explicitly rather than speculating
• Cite sources by [Source N] number when drawing from the academic knowledge base above

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

    // 9. Update student memory — Jarvis Effect (fire-and-forget, per-user)
    updateStudentMemory({
      newTopic: topicTag,
      subject: body.subject ?? "General",
    }, req.userId).catch(() => {});

    // 10. Detect struggle signals and log to memory
    const struggleSignals = /confused|don't understand|struggling|lost|wrong|error|mistake|help/i.test(body.question);
    if (struggleSignals) {
      memoryFlush(`Student struggled with: ${topicTag}`, req.userId).catch(() => {});
    }

    // 11. Index this exchange into the user's long-term memory capsule (fire-and-forget)
    if (req.userId) {
      indexStudyExchange(
        req.userId,
        body.question,
        answer,
        topicTag,
        body.subject ?? "General",
      ).catch(() => {});
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

const GenerateBody = z.object({
  content: z.string().max(60000),
  type: z.enum(["flashcards", "quiz", "summary", "studyguide", "slides", "weakpoints"]),
  subject: z.string().optional(),
  weakTopics: z.array(z.string()).optional(),
  images: z.array(z.object({
    base64: z.string().max(10_000_000),
    mimeType: z.string(),
  })).optional(),
});

const GENERATE_PROMPTS: Record<string, (content: string, subject: string, weakTopics?: string[]) => string> = {
  flashcards: (content, subject) => `
You are an expert educator. Create 15 high-quality flashcards from this study material on ${subject}.

Study material:
${content.slice(0, 40000)}

Return ONLY valid JSON (no markdown, no code blocks), exactly this format:
{"flashcards":[{"front":"Question or concept","back":"Answer or explanation","tag":"subtopic"}]}

Generate 15 flashcards covering the most important concepts, definitions, formulas, and facts.`,

  quiz: (content, subject) => `
You are an expert educator. Create 10 multiple-choice quiz questions from this study material on ${subject}.

Study material:
${content.slice(0, 40000)}

Return ONLY valid JSON, exactly this format:
{"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"Why this is correct and others are wrong"}]}

"correct" is the 0-based index of the right answer. Mix easy (30%), medium (50%), and hard (20%) questions.`,

  summary: (content, subject) => `
You are an expert educator. Create a comprehensive structured summary of this study material on ${subject}.

Study material:
${content.slice(0, 40000)}

Return ONLY valid JSON, exactly this format:
{"title":"Topic Title","overview":"2-3 sentence overview","sections":[{"heading":"Section name","points":["Key point 1","Key point 2"],"keyTerms":[{"term":"Term","definition":"Definition"}]}],"takeaways":["Most important thing to remember 1","..."],"relatedConcepts":["Related topic 1","Related topic 2"]}

Create 4-6 sections covering all major concepts.`,

  studyguide: (content, subject) => `
You are an expert educator. Create a comprehensive study guide for ${subject} from this material.

Study material:
${content.slice(0, 40000)}

Return ONLY valid JSON, exactly this format:
{"title":"Study Guide: Topic","sections":[{"type":"overview","heading":"What This Is About","content":"..."},{"type":"concepts","heading":"Core Concepts","items":[{"name":"Concept","explanation":"...","example":"..."}]},{"type":"process","heading":"Step-by-Step Process","steps":["Step 1: ...","Step 2: ..."]},{"type":"tips","heading":"Exam Tips","tips":["Remember that...","Common mistake: ..."]}],"quickRef":[{"label":"Formula/Key","value":"..."}]}`,

  slides: (content, subject) => `
You are an expert presentation designer. Create a 10-slide presentation from this study material on ${subject}.

Study material:
${content.slice(0, 40000)}

Return ONLY valid JSON, exactly this format:
{"title":"Presentation Title","slides":[{"slideNum":1,"type":"title","title":"Main Title","subtitle":"Subtitle or author"},{"slideNum":2,"type":"agenda","title":"Agenda","bullets":["Topic 1","Topic 2","Topic 3"]},{"slideNum":3,"type":"content","title":"Slide Title","bullets":["Key point 1","Key point 2","Key point 3"],"notes":"Speaker notes for this slide"}]}

Include: 1 title slide, 1 agenda, 6-7 content slides, 1 conclusion. Each content slide has 3-5 bullets and speaker notes.`,

  weakpoints: (content, subject, weakTopics = []) => `
You are an adaptive learning expert. The student has struggled with these topics: ${weakTopics.join(", ") || "general concepts"}.

Study material:
${content.slice(0, 30000)}

Create 8 targeted practice questions focusing on their weak areas.

Return ONLY valid JSON, exactly this format:
{"questions":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"...","targetsTopic":"which weak topic this addresses"}]}`,
};

router.post("/study/generate", async (req, res) => {
  try {
    const body = GenerateBody.parse(req.body);
    const subject = body.subject ?? "General";

    const promptFn = GENERATE_PROMPTS[body.type];
    if (!promptFn) return res.status(400).json({ error: "Invalid type" });

    const prompt = promptFn(body.content, subject, body.weakTopics);

    // Build message content — include images as vision blocks if provided
    type ImageBlock = { type: "image"; source: { type: "base64"; media_type: string; data: string } };
    type TextBlock  = { type: "text"; text: string };
    type ContentBlock = ImageBlock | TextBlock;

    const userContent: ContentBlock[] = [];
    for (const img of body.images ?? []) {
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: img.mimeType, data: img.base64 },
      });
    }
    userContent.push({ type: "text", text: prompt });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      messages: [{ role: "user", content: userContent }],
    });

    recordUsage("claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens, `study-${body.type}`);

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: unknown;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      req.log.error({ raw }, "Failed to parse study generate JSON");
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    res.json({ type: body.type, data: parsed });
  } catch (err) {
    req.log.error({ err }, "Error generating study material");
    res.status(500).json({ error: "Failed to generate study material" });
  }
});

router.post("/study/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No audio file provided" });

    const { Readable } = await import("stream");
    const buffer = req.file.buffer;
    const filename = req.file.originalname || "audio.webm";

    const stream = Readable.from(buffer);
    (stream as NodeJS.ReadableStream & { name?: string }).name = filename;

    const transcription = await openai.audio.transcriptions.create({
      file: new File([buffer], filename, { type: req.file.mimetype }),
      model: "whisper-1",
      response_format: "text",
    });

    res.json({ transcript: transcription, words: typeof transcription === "string" ? transcription.split(/\s+/).length : 0 });
  } catch (err) {
    req.log.error({ err }, "Error transcribing audio");
    res.status(500).json({ error: "Failed to transcribe audio. Please try uploading a text file instead." });
  }
});

export default router;
