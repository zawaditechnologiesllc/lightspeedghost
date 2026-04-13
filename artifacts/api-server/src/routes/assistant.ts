import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { anthropic } from "../lib/ai";
import { recordUsage } from "../lib/apiCost";
import { trackUsage, isAtLimit, getUserPlan, getUsage, PLAN_LIMITS } from "../lib/usageTracker";
import { searchAllAcademicSources, buildRAGContext } from "../lib/academicSources";
import { z } from "zod";

const router = Router();

type Mode = "learn" | "quick" | "exam" | "simplify" | "diagram" | "research";

const AskBody = z.object({
  question: z.string().max(16000).default(""),
  mode: z.enum(["learn", "quick", "exam", "simplify", "diagram", "research", "auto"]).default("auto"),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  subject: z.string().optional(),
});

function detectMode(question: string, hasImage: boolean): Mode {
  if (hasImage && !question.trim()) return "diagram";
  if (/\bA\.\s|\bB\.\s|\bC\.\s|\bD\.\s|which of the following|select the correct|choose the (best|correct)/i.test(question)) return "exam";
  if (/simplif|explain\s+like|eli5|eli10|in\s+simple\s+terms|make\s+it\s+easy|for\s+a\s+beginner/i.test(question)) return "simplify";
  if (/research|find\s+(sources|papers|studies)|literature\s+review|what\s+does\s+research\s+say/i.test(question)) return "research";
  if (/\$.*?\$|\\frac|\\int|equation|formula|calculate|solve\s+for|proof|derivative|integral/i.test(question)) return "learn";
  return "learn";
}

const SYSTEM_PROMPTS: Record<Mode, string> = {
  learn: `You are a brilliant step-by-step academic tutor. For every question:
1. Open with a single clear direct answer (1 sentence)
2. Break the explanation into numbered steps — each step on its own line
3. Use LaTeX for math: $inline$ or $$display$$
4. Close with a bold **Key takeaway:** line

Be precise, clear, and educational. Prioritise understanding over brevity. Cite concepts correctly.`,

  quick: `You are a rapid-fire answer engine. Rules you must follow:
• Answer in 2–4 sentences at most
• The very first word/phrase is the direct answer — never start with preamble
• No bullet points, no headers, no lengthy explanations
• If the question is ambiguous, pick the most common interpretation

Be surgical. Stop the moment you've answered.`,

  exam: `You are an exam-mode assistant. When given a multiple-choice question:

**Answer: [letter] — [option text]**

Justification: [1–2 sentences explaining why this is correct]

Why others are wrong: [1 sentence covering the key distractor]

Never give more than this. Format strictly as shown above.`,

  simplify: `You are a master of making the complex simple. For any concept:
1. Start with a concrete everyday analogy ("Think of it like...")
2. Explain the idea through that analogy in plain English
3. Give one concrete example a 10-year-old could picture
4. In one line, say what it matters for

No jargon. No technical terms unless you explain them with an analogy first. Warm, friendly, enthusiastic tone.`,

  diagram: `You are a visual content expert. When shown an image or diagram:
1. State what type of visual it is (graph, diagram, chart, photo, etc.)
2. List and explain the main components/elements you can see
3. Explain what the diagram demonstrates or shows
4. If there are labels, axes, or annotations — explain each one
5. State the key insight or takeaway from the visual

Be specific about what you actually see. Reference real elements in the image.`,

  research: `You are a deep research synthesiser. For any topic:
1. Give a clear, substantive 2–3 paragraph answer
2. Mention real academic concepts, well-known researchers, or landmark studies where relevant
3. Present multiple perspectives if they exist (e.g., "Some researchers argue... while others contend...")
4. End with a **Further Reading** section suggesting 2–3 types of sources to explore

Do not invent sources. You may reference real well-known works. Be substantive and intellectually rigorous.`,
};

const MODE_LABELS: Record<Mode, string> = {
  learn: "Learn",
  quick: "Quick Answer",
  exam: "Exam Mode",
  simplify: "Simplify",
  diagram: "Diagram",
  research: "Deep Research",
};

router.post("/assistant/ask-stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  req.socket?.setTimeout(0);

  const heartbeat = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 10_000);

  function send(event: string, data: object) {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* ignore */ }
  }

  try {
    // ── Plan check ────────────────────────────────────────────────────────────
    const userId = req.userId!;
    const [plan, atLimit] = await Promise.all([
      getUserPlan(userId),
      isAtLimit(userId, "assistant"),
    ]);

    if (atLimit) {
      const planLimitVal = PLAN_LIMITS[plan]?.assistant ?? 0;
      send("error", {
        type: "quota",
        message: `You've used all ${planLimitVal} assistant queries for this month on your ${plan} plan. Upgrade to Pro for unlimited access.`,
      });
      return;
    }

    let body: z.infer<typeof AskBody>;
    try {
      body = AskBody.parse(req.body);
    } catch {
      send("error", { message: "Invalid request body" });
      return;
    }

    const hasImage = !!(body.imageBase64 && body.mimeType);
    const resolvedMode: Mode = body.mode === "auto"
      ? detectMode(body.question, hasImage)
      : (body.mode as Mode);

    // ── Image gate — Pro/Campus only ─────────────────────────────────────────
    if (hasImage && plan === "starter") {
      send("error", {
        type: "plan_gate",
        message: "Image and diagram reading is available on the Pro plan. Upgrade to unlock it.",
      });
      return;
    }

    // Track AFTER passing all gates so quota is never burned on a blocked request
    trackUsage(userId, "assistant").catch(() => {});

    // Compute remaining quota so frontend can display it to Starter users
    const planLimit = PLAN_LIMITS[plan]?.assistant ?? null;
    let queriesUsed = 0;
    if (planLimit !== null) {
      const usage = await getUsage(userId);
      queriesUsed = usage["assistant"] ?? 0;
    }
    const queriesRemaining = planLimit !== null ? Math.max(0, planLimit - queriesUsed - 1) : null;

    send("meta", {
      mode: resolvedMode,
      modeLabel: MODE_LABELS[resolvedMode],
      detected: body.mode === "auto",
      plan,
      queriesRemaining,
      planLimit,
      imageEnabled: plan !== "starter",
    });

    let ragContext = "";
    if ((resolvedMode === "research" || resolvedMode === "learn") && body.question.trim().length > 8) {
      try {
        const papers = await searchAllAcademicSources(body.question, 4, body.subject).catch(() => []);
        ragContext = buildRAGContext(papers);
      } catch { /* non-fatal */ }
    }

    type SupportedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: SupportedMime; data: string } };

    const SUPPORTED_MIMES = new Set<string>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

    const userContent: ContentBlock[] = [];

    if (hasImage) {
      const rawMime = body.mimeType ?? "image/png";
      const safeMime: SupportedMime = SUPPORTED_MIMES.has(rawMime)
        ? (rawMime as SupportedMime)
        : "image/png";
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: safeMime, data: body.imageBase64! },
      });
    }

    const questionText = [
      body.question.trim(),
      ragContext ? `\n\nAcademic reference context:\n${ragContext}` : "",
    ].filter(Boolean).join("");

    if (questionText) userContent.push({ type: "text", text: questionText });

    if (userContent.length === 0) {
      send("error", { message: "Please type a question or upload an image." });
      return;
    }

    const hasDocument = body.question.includes("--- Attached document:");
    const baseMaxTokens: Record<Mode, number> = {
      quick: 300,
      exam: 350,
      simplify: 500,
      diagram: 600,
      learn: 1200,
      research: 1400,
    };
    const maxTokens: Record<Mode, number> = hasDocument
      ? { quick: 600, exam: 600, simplify: 800, diagram: 800, learn: 2000, research: 2400 }
      : baseMaxTokens;

    const model = (resolvedMode === "diagram" || hasDocument)
      ? "claude-sonnet-4-5"
      : "claude-haiku-4-5";

    let inputTokens = 0;
    let outputTokens = 0;

    const stream = anthropic.messages.stream({
      model,
      max_tokens: maxTokens[resolvedMode],
      system: SYSTEM_PROMPTS[resolvedMode],
      messages: [{ role: "user", content: userContent }],
    });

    stream.on("text", (text) => {
      send("token", { text });
    });

    stream.on("finalMessage", (msg) => {
      inputTokens = msg.usage.input_tokens;
      outputTokens = msg.usage.output_tokens;
      recordUsage(model, inputTokens, outputTokens, `assistant-${resolvedMode}`);
      send("done", { mode: resolvedMode, modeLabel: MODE_LABELS[resolvedMode] });
    });

    stream.on("error", (err) => {
      send("error", { message: err.message?.slice(0, 200) ?? "Stream error" });
    });

    await stream.finalMessage();
  } catch (err) {
    req.log.error({ err }, "Floating assistant error");
    send("error", { message: "Failed to get answer — please try again." });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
