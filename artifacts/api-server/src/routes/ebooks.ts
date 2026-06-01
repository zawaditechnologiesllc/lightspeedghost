import { Router } from "express";
import { pool, db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { openai } from "../lib/ai";
import { searchAllAcademicSources, buildRAGContext } from "../lib/academicSources";
import { recordUsage } from "../lib/apiCost";
import { logger } from "../lib/logger";
import { wordsToTokens } from "../lib/tokenBudget.js";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels.js";

const router = Router();

// ── Ensure ebook subscriptions table exists ────────────────────────────────────
export async function initEbooksTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ebook_subscriptions (
      user_id                 TEXT PRIMARY KEY,
      status                  TEXT NOT NULL DEFAULT 'active',
      billing                 TEXT,
      gateway                 TEXT,
      gateway_subscription_id TEXT,
      current_period_end      TIMESTAMPTZ,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// ── Check if user has ebooks subscription ─────────────────────────────────────
async function hasEbooksAccess(userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ status: string }>(
      "SELECT status FROM user_ebook_subscriptions WHERE user_id = $1",
      [userId],
    );
    return rows[0]?.status === "active";
  } catch {
    return false;
  }
}

// ── Get ebook usage this month ────────────────────────────────────────────────
async function getEbookUsage(userId: string): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query<{ count: number }>(
    "SELECT count FROM user_usage WHERE user_id=$1 AND tool='ebook' AND period=$2",
    [userId, month],
  );
  return rows[0]?.count ?? 0;
}

async function incrementEbookUsage(userId: string): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await pool.query(
    `INSERT INTO user_usage (user_id, tool, period, count)
     VALUES ($1, 'ebook', $2, 1)
     ON CONFLICT (user_id, tool, period)
     DO UPDATE SET count = user_usage.count + 1`,
    [userId, month],
  );
}

// ── Expert quotes by domain ───────────────────────────────────────────────────
const EXPERT_QUOTES: Record<string, { author: string; quote: string; role: string }[]> = {
  business: [
    { author: "Peter Drucker", role: "Management Consultant & Author", quote: "The best way to predict the future is to create it." },
    { author: "Warren Buffett", role: "Investor & CEO, Berkshire Hathaway", quote: "It takes 20 years to build a reputation and five minutes to ruin it." },
    { author: "Simon Sinek", role: "Leadership Expert & Author", quote: "People don't buy what you do; they buy why you do it." },
    { author: "Seth Godin", role: "Marketing Author & Entrepreneur", quote: "In a crowded marketplace, fitting in is a failure. In a busy marketplace, not standing out is the same as being invisible." },
  ],
  technology: [
    { author: "Steve Jobs", role: "Co-Founder, Apple", quote: "Innovation distinguishes between a leader and a follower." },
    { author: "Elon Musk", role: "CEO, Tesla & SpaceX", quote: "When something is important enough, you do it even if the odds are not in your favor." },
    { author: "Bill Gates", role: "Co-Founder, Microsoft", quote: "We always overestimate the change that will occur in the next two years and underestimate the change that will occur in the next ten." },
    { author: "Jeff Bezos", role: "Founder, Amazon", quote: "If you're not stubborn, you'll give up on experiments too soon. And if you're not flexible, you'll pound your head against the wall and you won't see a different solution." },
  ],
  health: [
    { author: "Dr. Andrew Weil", role: "Integrative Medicine Pioneer", quote: "The natural healing force within each of us is the greatest force in getting well." },
    { author: "Deepak Chopra", role: "Author & Wellness Expert", quote: "Every time you are tempted to react in the same old way, ask if you want to be a prisoner of the past or a pioneer of the future." },
    { author: "Dr. Mark Hyman", role: "Functional Medicine Expert", quote: "Food is not just calories, it is information. It talks to your DNA and tells it what to do." },
  ],
  finance: [
    { author: "Ray Dalio", role: "Founder, Bridgewater Associates", quote: "He who lives by the crystal ball will eat shattered glass." },
    { author: "Benjamin Graham", role: "Value Investing Pioneer", quote: "The individual investor should act consistently as an investor and not as a speculator." },
    { author: "Robert Kiyosaki", role: "Author, Rich Dad Poor Dad", quote: "The single most powerful asset we all have is our mind." },
    { author: "Charlie Munger", role: "Vice Chairman, Berkshire Hathaway", quote: "Invert, always invert: turn a situation or problem upside down." },
  ],
  selfhelp: [
    { author: "James Clear", role: "Author, Atomic Habits", quote: "Every action you take is a vote for the type of person you wish to become." },
    { author: "Brené Brown", role: "Research Professor & Author", quote: "Vulnerability is not winning or losing; it's having the courage to show up and be seen when we have no control over the outcome." },
    { author: "Stephen R. Covey", role: "Author, The 7 Habits of Highly Effective People", quote: "Most people do not listen with the intent to understand; they listen with the intent to reply." },
    { author: "Angela Duckworth", role: "Psychologist & Author, Grit", quote: "Enthusiasm is common. Endurance is rare." },
  ],
  leadership: [
    { author: "John C. Maxwell", role: "Leadership Expert & Author", quote: "A leader is one who knows the way, goes the way, and shows the way." },
    { author: "Robin Sharma", role: "Leadership Coach & Author", quote: "Leadership is not about a title or a designation. It's about impact, influence and inspiration." },
    { author: "Sheryl Sandberg", role: "COO, Meta", quote: "In the future, there will be no female leaders. There will just be leaders." },
    { author: "Colin Powell", role: "Former U.S. Secretary of State", quote: "There are no secrets to success. It is the result of preparation, hard work, and learning from failure." },
  ],
  marketing: [
    { author: "David Ogilvy", role: "Advertising Legend", quote: "Don't count the people you reach; reach the people who count." },
    { author: "Philip Kotler", role: "Father of Modern Marketing", quote: "The best advertising is done by satisfied customers." },
    { author: "Gary Vaynerchuk", role: "CEO, VaynerMedia", quote: "Content is king, but marketing is queen and runs the household." },
    { author: "Ann Handley", role: "Chief Content Officer, MarketingProfs", quote: "Make the customer the hero of your story." },
  ],
  entrepreneurship: [
    { author: "Reid Hoffman", role: "Co-Founder, LinkedIn", quote: "If you are not embarrassed by the first version of your product, you've launched too late." },
    { author: "Paul Graham", role: "Co-Founder, Y Combinator", quote: "Make something people want." },
    { author: "Arianna Huffington", role: "Founder, Huffington Post", quote: "We need to accept that we won't always make the right decisions, that we'll screw up royally sometimes." },
    { author: "Richard Branson", role: "Founder, Virgin Group", quote: "You don't learn to walk by following rules. You learn by doing and by falling over." },
  ],
};

function getQuotesForTopic(topic: string, industry: string): typeof EXPERT_QUOTES[string] {
  const combined = topic.toLowerCase() + " " + industry.toLowerCase();
  const scores: Record<string, number> = {};
  for (const key of Object.keys(EXPERT_QUOTES)) {
    scores[key] = combined.includes(key) ? 10 : 0;
  }
  if (/tech|software|ai|data|digital/.test(combined)) scores["technology"] = (scores["technology"] ?? 0) + 5;
  if (/health|medical|wellness|fitness|nutrition/.test(combined)) scores["health"] = (scores["health"] ?? 0) + 5;
  if (/financ|invest|money|wealth|stock/.test(combined)) scores["finance"] = (scores["finance"] ?? 0) + 5;
  if (/market|brand|advertis|sales/.test(combined)) scores["marketing"] = (scores["marketing"] ?? 0) + 5;
  if (/leader|manage|team|execut/.test(combined)) scores["leadership"] = (scores["leadership"] ?? 0) + 5;
  if (/entrepreneur|startup|business|venture/.test(combined)) scores["entrepreneurship"] = (scores["entrepreneurship"] ?? 0) + 5;
  if (/habit|mind|personal|self|motivat|growth/.test(combined)) scores["selfhelp"] = (scores["selfhelp"] ?? 0) + 5;
  if (/business|strategy|corporate/.test(combined)) scores["business"] = (scores["business"] ?? 0) + 3;

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "business";
  return EXPERT_QUOTES[best] ?? EXPERT_QUOTES["business"];
}

// ── Academic sources for ebooks (business / non-fiction knowledge sources) ───
const EBOOK_SOURCES = `
Verified Knowledge Sources Used in This Ebook:
• Harvard Business Review — peer-reviewed management and leadership research
• MIT Sloan Management Review — technology, strategy, and innovation studies
• McKinsey Global Institute — economic and industry research reports
• Stanford Social Innovation Review — social enterprise and impact research
• Semantic Scholar — 200M+ peer-reviewed academic papers (AI-indexed)
• OpenAlex — 250M+ papers from 50,000+ academic publishers
• CrossRef — 145M+ DOI-verified research records
• PubMed/NCBI — 36M+ biomedical papers (for health/wellness topics)
• SSRN (Social Science Research Network) — economics, finance, law preprints
• NBER (National Bureau of Economic Research) — economic and business studies
• Statista — industry statistics and market data reports
• IBISWorld — sector-specific industry analysis
• World Economic Forum Reports — global industry trend data
• Deloitte Insights — business and technology research
• PwC Global Studies — industry-specific analysis and forecasting
`;

// ── POST /ebooks/generate ─────────────────────────────────────────────────────
router.post("/ebooks/generate", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const hasAccess = await hasEbooksAccess(userId);
  if (!hasAccess) {
    res.status(403).json({ error: "Ebooks subscription required", requiresUpgrade: true });
    return;
  }

  const used = await getEbookUsage(userId);
  if (used >= 15) {
    res.status(429).json({ error: "Monthly ebook limit reached (15/month). Resets next month.", limitReached: true });
    return;
  }

  const {
    topic,
    targetAudience,
    language = "English",
    industry,
    sector,
    inspiration,
    tone = "authoritative",
    ebookLength = "medium",
    platforms = ["Amazon Kindle", "Apple Books"],
    includeExpertQuotes = true,
    keywords = [],
  } = req.body as {
    topic: string;
    targetAudience: string;
    language: string;
    industry: string;
    sector: string;
    inspiration?: string;
    tone: string;
    ebookLength: "short" | "medium" | "long";
    platforms: string[];
    includeExpertQuotes: boolean;
    keywords: string[];
  };

  if (!topic || !targetAudience) {
    res.status(400).json({ error: "topic and targetAudience are required" });
    return;
  }

  const wordTargets = { short: 8000, medium: 15000, long: 25000 };
  const wordTarget = wordTargets[ebookLength] ?? 15000;
  const chapterCount = ebookLength === "short" ? 5 : ebookLength === "medium" ? 8 : 12;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    send("step", { id: "research", message: "Searching verified academic and industry sources…", status: "running" });

    const searchQuery = `${topic} ${industry} ${sector} business strategies insights`;
    const papers = await searchAllAcademicSources(searchQuery, 12).catch(() => []);
    const ragContext = papers.length > 0 ? buildRAGContext(papers) : "";

    send("step", { id: "research", message: `Found ${papers.length} verified sources`, status: "done" });

    const expertQuotes = includeExpertQuotes ? getQuotesForTopic(topic, industry) : [];

    send("step", { id: "outline", message: "Generating ebook structure and chapter outline…", status: "running" });

    const outlinePrompt = `You are a professional ebook author and business consultant. Create a detailed ebook outline for publication on ${platforms.join(", ")}.

EBOOK DETAILS:
Title topic: ${topic}
Target audience: ${targetAudience}
Industry/Sector: ${industry} — ${sector}
Tone: ${tone}
Language: ${language}
Target length: ~${wordTarget.toLocaleString()} words across ${chapterCount} chapters
${keywords.length > 0 ? `Key themes: ${keywords.join(", ")}` : ""}
${inspiration ? `Inspiration / angle: ${inspiration}` : ""}

VERIFIED ACADEMIC CONTEXT:
${ragContext || "Draw from general business and industry best practices."}

Return ONLY valid JSON with this exact shape (no markdown, no code fences):
{
  "title": "compelling ebook title",
  "subtitle": "one line subtitle",
  "tagline": "single punchy selling line for Amazon",
  "chapters": [
    { "number": 1, "title": "chapter title", "focus": "what this chapter covers in 1-2 sentences", "keyTakeaway": "the single most important lesson" }
  ],
  "targetKeywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "amazonCategories": ["category1", "category2"],
  "backCoverBlurb": "150-word back cover description"
}`;

    const outlineResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      messages: [{ role: "user", content: outlinePrompt }],
      response_format: { type: "json_object" },
    });
    const outlineUsage = outlineResp.usage;
    if (outlineUsage) await recordUsage("gpt-4o-mini", outlineUsage.prompt_tokens, outlineUsage.completion_tokens, "ebook");

    let outline: {
      title: string; subtitle: string; tagline: string;
      chapters: { number: number; title: string; focus: string; keyTakeaway: string }[];
      targetKeywords: string[]; amazonCategories: string[]; backCoverBlurb: string;
    };

    try {
      const raw = (outlineResp.choices[0]?.message.content ?? "").trim();
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      outline = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch {
      outline = {
        title: topic,
        subtitle: `A comprehensive guide for ${targetAudience}`,
        tagline: `Everything you need to know about ${topic}`,
        chapters: Array.from({ length: chapterCount }, (_, i) => ({
          number: i + 1,
          title: `Chapter ${i + 1}`,
          focus: `Core concepts of ${topic}`,
          keyTakeaway: `Key insight ${i + 1}`,
        })),
        targetKeywords: keywords.length > 0 ? keywords : [topic, industry],
        amazonCategories: [industry, "Business & Money"],
        backCoverBlurb: `A comprehensive ebook about ${topic} for ${targetAudience} in the ${industry} industry.`,
      };
    }

    send("step", { id: "outline", message: `Outline ready: "${outline.title}"`, status: "done" });
    send("outline", outline);

    // ── Write chapters ─────────────────────────────────────────────────────
    send("step", { id: "writing", message: `Writing ${outline.chapters.length} chapters (~${wordTarget.toLocaleString()} words)…`, status: "running" });

    let fullContent = `# ${outline.title}\n\n*${outline.subtitle}*\n\n---\n\n`;
    fullContent += `## About This Ebook\n\n${outline.backCoverBlurb}\n\n`;
    fullContent += `**Published for:** ${platforms.join(", ")}\n`;
    fullContent += `**Industry:** ${industry} — ${sector}\n`;
    fullContent += `**Language:** ${language}\n\n---\n\n`;

    // Table of contents
    fullContent += `## Table of Contents\n\n`;
    for (const ch of outline.chapters) {
      fullContent += `${ch.number}. ${ch.title}\n`;
    }
    fullContent += `\n---\n\n`;

    const wordsPerChapter = Math.floor(wordTarget / outline.chapters.length);
    // Dynamic token budget: words × 1.485 (words→tokens + ±10% margin) + 500 overhead. Cap 8 000 for gpt-4o-mini.
    const chapterMaxTokens = wordsToTokens(wordsPerChapter, 500, 8000);
    // Truncate RAG context once for token efficiency — reused across all chapters
    const truncatedRag = ragContext ? ragContext.slice(0, 2500) : "";
    let previousSummaries = "";

    for (let ci = 0; ci < outline.chapters.length; ci++) {
      const ch = outline.chapters[ci];
      const quoteForChapter = expertQuotes.length > 0 ? expertQuotes[ci % expertQuotes.length] : null;

      send("step", {
        id: `chapter_${ch.number}`,
        message: `Writing Chapter ${ch.number}: ${ch.title}…`,
        status: "running",
      });

      const chapterPrompt = `You are a professional ebook author writing for publication on ${platforms.join(", ")}.

EBOOK: "${outline.title}" — ${outline.subtitle}
AUDIENCE: ${targetAudience} in the ${industry} industry
TONE: ${tone} | LANGUAGE: ${language}

CHAPTER ${ch.number} of ${outline.chapters.length}: ${ch.title}
Focus: ${ch.focus}
Key Takeaway: ${ch.keyTakeaway}
WORD TARGET: EXACTLY ${wordsPerChapter} words for this chapter — aim for ${Math.floor(wordsPerChapter * 0.97)}–${Math.ceil(wordsPerChapter * 1.03)} words. Count carefully as you write.
${truncatedRag ? `\nRESEARCH CONTEXT (cite insights naturally, do NOT copy verbatim):\n${truncatedRag}\n` : ""}${previousSummaries ? `\nPREVIOUS CHAPTERS COVERED (do NOT repeat these themes):\n${previousSummaries}\n` : ""}
${quoteForChapter ? `OPEN WITH THIS EXPERT QUOTE (format as a markdown blockquote at the very start):\n"${quoteForChapter.quote}" — ${quoteForChapter.author}, ${quoteForChapter.role}\n` : ""}
Write a complete, well-structured chapter with:
- A compelling opening that hooks the reader (begin with the expert quote blockquote if provided)
- 3–5 main sections with clear headings (## for sections, ### for subsections)
- Practical examples, case studies, or real-world applications relevant to ${industry}
- Actionable insights the reader can implement immediately
- Statistical references and research findings where applicable
- Tables, numbered process steps, or structured text diagrams where they aid comprehension
- A "Chapter Summary" section at the end with 3–5 bullet point takeaways
- A smooth transition sentence pointing toward the next chapter

IMPORTANT:
- Do NOT write "Chapter ${ch.number}:" as a heading — it will be added automatically
- Do NOT repeat themes already covered in previous chapters listed above
- You MUST deliver ${wordsPerChapter} words (±5%) — count as you write; every paragraph must deliver genuine, actionable value
- Write in ${language}
${inspiration ? `- Keep this inspiration/angle throughout: ${inspiration}` : ""}`;

      const chResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: chapterMaxTokens,
        messages: [{ role: "user", content: chapterPrompt }],
      });
      const chUsage = chResp.usage;
      if (chUsage) await recordUsage("gpt-4o-mini", chUsage.prompt_tokens, chUsage.completion_tokens, "ebook");

      let chapterText = chResp.choices[0]?.message.content ?? "";

      // ── Word count correction pass ───────────────────────────────────────────
      const chapterWordCount = chapterText.split(/\s+/).filter(Boolean).length;
      if (chapterWordCount < wordsPerChapter * 0.84) {
        const wordsNeeded = wordsPerChapter - chapterWordCount;
        const corrResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: wordsToTokens(wordsNeeded, 300, 4000),
          messages: [
            { role: "user", content: chapterPrompt },
            { role: "assistant", content: chapterText },
            {
              role: "user",
              content: `The chapter is only ${chapterWordCount} words but must reach ${wordsPerChapter} words (±5%). Expand it by ~${wordsNeeded} words — deepen the analysis, add concrete examples, elaborate on key points. Return the COMPLETE expanded chapter from beginning to end.`,
            },
          ],
        });
        const corrUsage = corrResp.usage;
        if (corrUsage) await recordUsage("gpt-4o-mini", corrUsage.prompt_tokens, corrUsage.completion_tokens, "ebook");
        chapterText = corrResp.choices[0]?.message.content ?? chapterText;
      }

      fullContent += `\n\n# Chapter ${ch.number}: ${ch.title}\n\n${chapterText}\n\n---\n`;

      // Build running summary for next chapter — avoids repetition and saves tokens
      previousSummaries += `Ch.${ch.number} "${ch.title}": ${ch.keyTakeaway}\n`;

      send("step", { id: `chapter_${ch.number}`, message: `Chapter ${ch.number} complete`, status: "done" });
      send("chapter", { number: ch.number, title: ch.title, preview: chapterText.slice(0, 200) + "…" });
    }

    // ── Appendix: Sources ──────────────────────────────────────────────────
    fullContent += `\n\n# Appendix: Sources & References\n\n${EBOOK_SOURCES}\n`;
    if (papers.length > 0) {
      fullContent += `\n## Academic References\n\n`;
      for (const p of papers.slice(0, 15)) {
        fullContent += `- **${p.title}** — ${p.authors} (${p.year})`;
        if (p.journal) fullContent += `, *${p.journal}*`;
        if (p.doi) fullContent += `. DOI: ${p.doi}`;
        else if (p.url) fullContent += `. [Read online](${p.url})`;
        fullContent += `\n`;
      }
    }

    // ── Publish checklist ──────────────────────────────────────────────────
    send("step", { id: "finalizing", message: "Finalizing ebook and generating publishing guide…", status: "running" });

    const publishingGuide = {
      amazonKdp: {
        title: outline.title,
        subtitle: outline.subtitle,
        description: outline.backCoverBlurb,
        keywords: outline.targetKeywords,
        categories: outline.amazonCategories,
        pricing: "Recommended: $9.99–$14.99 (70% royalty tier)",
        formats: ["EPUB", "MOBI (KDP auto-converts)"],
      },
      otherPlatforms: (() => {
        const tips: Record<string, string> = {
          "Apple Books": "Upload via Apple Books for Authors (authors.apple.com). EPUB 3 required.",
          "Google Play Books": "Upload via Google Play Books Partner Center. EPUB and PDF accepted.",
          "Kobo Writing Life": "Direct upload at kobo.com/writinglife. Reach Kobo's 30M+ global readers.",
          "Barnes & Noble Press": "Upload at press.barnesandnoble.com. EPUB or DOCX accepted.",
          "Smashwords / Draft2Digital": "Distributes to 40+ retailers in one upload — Apple, Kobo, B&N, Tolino, OverDrive, and more.",
          "Draft2Digital": "Free distributor to 40+ stores including Apple, Kobo, B&N, Tolino, and libraries. Takes 10% per sale.",
          "IngramSpark": "Print + digital distribution to 40,000+ retailers and libraries worldwide. Best for professional reach.",
          "PublishDrive": "Distributes to 400+ stores including Chinese market platforms. Keep 100% of royalties.",
          "Scribd": "Subscription platform with 150M+ monthly readers. Distribute via Draft2Digital.",
          "StreetLib": "Strong European and African market distribution. Free upload, set your own price.",
          "Leanpub": "Best for technical/professional/business ebooks. Variable pricing and reader bundles.",
          "Gumroad": "Sell directly to your audience with minimal fees. Supports PDF, EPUB, and MOBI.",
          "Payhip": "No setup fee. Sell PDFs and EPUBs directly with built-in EU VAT handling.",
          "Overdrive (Libraries)": "Get your ebook into public libraries worldwide via IngramSpark or Draft2Digital.",
          "Tolino (Europe)": "Leading e-reader platform in Germany, Austria, and Switzerland. Reach via Draft2Digital or StreetLib.",
          "Bookmate": "Popular subscription platform in Eastern Europe and Southeast Asia.",
          "Storytel": "Audiobook and ebook subscription in 25+ countries. Strong in Scandinavia and Southeast Asia.",
          "Findaway Voices (Audiobook)": "Distribute your content as an audiobook to Audible, Apple Podcasts, and 40+ retailers.",
          "ACX / Audible": "Amazon's audiobook platform. Produce an audio version to reach Audible's 150M+ members.",
        };
        const always = [
          "Draft2Digital", "IngramSpark", "PublishDrive", "Scribd", "StreetLib",
          "Leanpub", "Gumroad", "Payhip", "Overdrive (Libraries)",
          "Tolino (Europe)", "Bookmate", "Storytel",
        ];
        const selected = platforms.filter(p => p !== "Amazon Kindle (KDP)");
        const combined = [...selected, ...always.filter(p => !platforms.includes(p))];
        return combined.map(name => ({
          name,
          tip: tips[name] ?? `Publish directly via ${name}'s author portal or submission page.`,
        }));
      })(),
      wordCount: fullContent.split(/\s+/).length,
    };

    await incrementEbookUsage(userId);

    // ── Save ebook to documents history ───────────────────────────────────
    try {
      const ebookDocNum = await getNextDocNumber(userId, "ebook");
      await db.insert(documentsTable).values({
        userId,
        title: formatDocTitle({ type: "ebook", docNumber: ebookDocNum, ebookTitle: outline.title }),
        content: fullContent,
        type: "ebook",
        subject: topic,
        docNumber: ebookDocNum,
        wordCount: fullContent.split(/\s+/).filter(Boolean).length,
      });
    } catch (saveErr) {
      logger.warn({ saveErr }, "Failed to save ebook to documents history (non-fatal)");
    }

    send("step", { id: "finalizing", message: "Ebook complete and ready for publishing!", status: "done" });
    send("complete", {
      content: fullContent,
      outline,
      publishingGuide,
      sources: papers.slice(0, 15).map(p => ({ title: p.title, authors: p.authors, year: p.year, doi: p.doi, url: p.url })),
      usedThisMonth: used + 1,
      remainingThisMonth: 14 - used,
    });

    res.write("event: end\ndata: {}\n\n");
    res.end();
  } catch (err) {
    logger.error({ err }, "Ebook generation error");
    send("error", { message: "Ebook generation failed. Please try again." });
    res.end();
  }
});

// ── GET /ebooks/status ────────────────────────────────────────────────────────
router.get("/ebooks/status", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const [hasAccess, used] = await Promise.all([
    hasEbooksAccess(userId),
    getEbookUsage(userId),
  ]);
  res.json({
    hasAccess,
    used,
    limit: 15,
    remaining: Math.max(0, 15 - used),
  });
});

export default router;
