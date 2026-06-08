/**
 * SEO Outline Builder — Step 2 of 3-step pipeline
 * Takes research data and produces a structured 5-page article outline.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";
import { GEMINI_PRO_MODEL } from "./researcher";
import type { ResearchData } from "./researcher";

export type ClusterPageType = "hook" | "comparison" | "breakdown" | "alternative" | "trust";

export interface PageOutlineItem {
  pageNumber: 1 | 2 | 3 | 4 | 5;
  pageType: ClusterPageType;
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  targetKeywords: string[];
  searchIntent: string;
  sections: string[];
  ctaText: string;
  ctaPath: string;
  keyMessages: string[];
}

export interface ArticleOutline {
  topic: string;
  topicSlug: string;
  toolFocus: string;
  competitor: string;
  pages: PageOutlineItem[];
}

// Maps toolFocus → internal tool path + CTA copy
const TOOL_PATHS: Record<string, { name: string; path: string; cta: string; pricing: string }> = {
  "paper-writer": {
    name:    "AI Paper Writer",
    path:    "/write",
    cta:     "Write my paper with verified citations →",
    pricing: "from $4.99 · Starter from $9.99/month",
  },
  humanizer: {
    name:    "LightSpeed Humanizer",
    path:    "/humanizer",
    cta:     "Humanize my writing to 0% AI score →",
    pricing: "from $1.99 per document",
  },
  plagiarism: {
    name:    "AI & Plagiarism Checker",
    path:    "/plagiarism",
    cta:     "Check my work for AI & plagiarism →",
    pricing: "$1.99 per check",
  },
  stem: {
    name:    "STEM Solver",
    path:    "/stem",
    cta:     "Solve my STEM problem step-by-step →",
    pricing: "$1.99 per problem",
  },
  study: {
    name:    "AI Study Assistant",
    path:    "/study",
    cta:     "Start studying smarter today →",
    pricing: "included in Starter from $9.99/month",
  },
  revision: {
    name:    "Paper Revision Tool",
    path:    "/revision",
    cta:     "Improve my paper to an A grade →",
    pricing: "from $4.99 per revision",
  },
  outline: {
    name:    "Outline Builder",
    path:    "/outline",
    cta:     "Build my paper outline in seconds →",
    pricing: "$1.99 per outline",
  },
  ebook: {
    name:    "Ebook Generator",
    path:    "/ebooks",
    cta:     "Create my publish-ready ebook →",
    pricing: "$29.99/month add-on",
  },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function getToolInfo(toolFocus: string) {
  return TOOL_PATHS[toolFocus] ?? {
    name:    "LightSpeed Ghost",
    path:    "/app",
    cta:     "Get started free →",
    pricing: "from $9.99/month",
  };
}

export async function buildOutline(
  topic: string,
  research: ResearchData,
  toolFocus: string,
  competitor: string,
  geminiClient: GoogleGenerativeAI,
): Promise<ArticleOutline> {
  const topicSlug = slugify(topic);
  const tool = getToolInfo(toolFocus);

  const researchContext = [
    `Pain points: ${research.painPoints.slice(0, 5).join(" | ")}`,
    `Top questions: ${research.topQuestions.slice(0, 5).join(" | ")}`,
    `High-volume keywords: ${research.highVolumeKeywords.slice(0, 8).join(", ")}`,
    `Competitor mentions: ${research.competitorMentions.join(", ")}`,
    `Key stats: ${research.keyStats.slice(0, 4).join(" | ")}`,
    `Reddit insight: ${research.redditInsights}`,
    `Summary: ${research.summary}`,
  ].join("\n");

  const model = geminiClient.getGenerativeModel({ model: GEMINI_PRO_MODEL });

  const prompt = `You are an SEO content strategist. Build a 5-page article cluster outline for:

TOPIC: "${topic}"
TOOL TO PROMOTE: ${tool.name} at ${tool.path} (LightspeedGhost — academic AI writing platform)
COMPETITOR FOR PAGE 4: "${competitor || "ChatGPT"}"
TOPIC SLUG BASE: "${topicSlug}"

RESEARCH DATA:
${researchContext}

Create a 5-page article cluster. Each page targets a different search intent and stage of the buyer journey.
Return a JSON array of 5 page objects.

PAGE STRUCTURE:
- Page 1 (hook): Informational intent — captures "how to" / "what is" traffic. Empathetic, student-first tone.
- Page 2 (comparison): Commercial intent — "best X tools", "X alternatives", comparison tables. High-intent buyers.
- Page 3 (breakdown): Educational/navigational — "how X works", deep breakdown, builds authority.
- Page 4 (alternative): Transactional — "${competitor || "ChatGPT"} vs LightspeedGhost". Pitch our platform directly.
- Page 5 (trust): Trust/BOFU — "does X work", reviews, results, risk reversal for fence-sitters.

Return ONLY valid JSON array with this structure:
[
  {
    "pageNumber": 1,
    "pageType": "hook",
    "slug": "${topicSlug}-guide",
    "title": "...[60 chars max, include primary keyword]",
    "metaDescription": "...[155 chars max, compelling, includes keyword]",
    "h1": "...[natural language H1 targeting informational intent]",
    "targetKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "searchIntent": "informational",
    "sections": ["H2: section title 1", "H2: section title 2", "H2: section title 3", "H2: section title 4", "H2: section title 5"],
    "ctaText": "${tool.cta}",
    "ctaPath": "${tool.path}",
    "keyMessages": ["message 1 to convey", "message 2", "message 3"]
  },
  {
    "pageNumber": 2,
    "pageType": "comparison",
    "slug": "best-${topicSlug}-tools",
    ...
  },
  {
    "pageNumber": 3,
    "pageType": "breakdown",
    "slug": "${topicSlug}-explained",
    ...
  },
  {
    "pageNumber": 4,
    "pageType": "alternative",
    "slug": "${topicSlug}-lightspeedghost-alternative",
    ...
  },
  {
    "pageNumber": 5,
    "pageType": "trust",
    "slug": "${topicSlug}-review",
    ...
  }
]

IMPORTANT:
- All ctaText and ctaPath for pages 1, 2, 3, 5 must use: "${tool.cta}" and "${tool.path}"
- Page 4 ctaText should be "Try LightSpeed Ghost free →" and ctaPath "${tool.path}"
- Each slug must be unique and SEO-friendly
- Keywords must match the page intent (informational for p1, commercial for p2, educational for p3, transactional for p4, trust for p5)
- Sections must be 5 distinct H2 topics that cover the page comprehensively`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    const parsed = JSON.parse(text) as PageOutlineItem[];

    // Validate structure
    if (!Array.isArray(parsed) || parsed.length < 5) {
      throw new Error(`Expected 5-page array, got ${Array.isArray(parsed) ? parsed.length : "non-array"}`);
    }

    const pages = parsed.slice(0, 5) as PageOutlineItem[];
    logger.info({ topic, topicSlug, toolFocus, pages: pages.length }, "[seo-outliner] Outline built");

    return { topic, topicSlug, toolFocus, competitor: competitor || "ChatGPT", pages };
  } catch (err) {
    logger.error({ err, topic }, "[seo-outliner] Gemini outline failed — using fallback structure");

    // Fallback minimal outline
    const pages: PageOutlineItem[] = [
      {
        pageNumber:     1,
        pageType:       "hook",
        slug:           `${topicSlug}-guide`,
        title:          `${topic}: What Every Student Needs to Know [2025]`,
        metaDescription: `Learn everything about ${topic}. Discover how LightSpeed Ghost helps students achieve better grades with AI writing assistance.`,
        h1:             `${topic}: The Complete Student Guide`,
        targetKeywords: [topic, `${topic} for students`, `how to use ${topic}`, `${topic} help`, `${topic} guide`],
        searchIntent:   "informational",
        sections:       [`H2: What Is ${topic}`, "H2: Why It Matters", "H2: How It Works", "H2: Common Mistakes", "H2: Getting Started"],
        ctaText:        tool.cta,
        ctaPath:        tool.path,
        keyMessages:    [`${topic} can save hours of work`, `AI tools make it easier`, `LightspeedGhost is built for this`],
      },
      {
        pageNumber:     2,
        pageType:       "comparison",
        slug:           `best-${topicSlug}-tools`,
        title:          `Best ${topic} Tools for Students in 2025`,
        metaDescription: `Compare the top ${topic} tools for students. See why LightSpeed Ghost ranks #1 for academic use.`,
        h1:             `Best ${topic} Tools for Students: 2025 Comparison`,
        targetKeywords: [`best ${topic} tools`, `${topic} comparison`, `${topic} alternatives`, `top ${topic}`, `${topic} review`],
        searchIntent:   "commercial",
        sections:       ["H2: Our Evaluation Criteria", `H2: Top ${topic} Tools Compared`, "H2: LightSpeed Ghost: The Academic Choice", "H2: Pricing Overview", "H2: Our Verdict"],
        ctaText:        tool.cta,
        ctaPath:        tool.path,
        keyMessages:    [`LightspeedGhost built for academic use`, `Real citations, no hallucinations`, `Price transparency`],
      },
      {
        pageNumber:     3,
        pageType:       "breakdown",
        slug:           `${topicSlug}-explained`,
        title:          `How ${topic} Actually Works: A Complete Breakdown`,
        metaDescription: `Understand exactly how ${topic} works. Step-by-step explanation with real examples for students.`,
        h1:             `How ${topic} Works: The Complete Breakdown`,
        targetKeywords: [`how ${topic} works`, `${topic} explained`, `${topic} step by step`, `${topic} process`, `understanding ${topic}`],
        searchIntent:   "educational",
        sections:       [`H2: The Basics of ${topic}`, "H2: Step-by-Step Process", "H2: Common Misconceptions", "H2: What the Research Shows", "H2: Practical Examples"],
        ctaText:        tool.cta,
        ctaPath:        tool.path,
        keyMessages:    [`Deep understanding builds confidence`, `Myths vs. reality`, `How LightspeedGhost handles this for you`],
      },
      {
        pageNumber:     4,
        pageType:       "alternative",
        slug:           `${topicSlug}-lightspeedghost-alternative`,
        title:          `LightSpeed Ghost vs ${competitor || "ChatGPT"}: Honest 2025 Comparison`,
        metaDescription: `LightSpeed Ghost vs ${competitor || "ChatGPT"} for ${topic}. Feature-by-feature comparison with real student results.`,
        h1:             `LightSpeed Ghost vs ${competitor || "ChatGPT"} for ${topic}`,
        targetKeywords: [`${competitor || "chatgpt"} alternative`, `lightspeedghost vs ${competitor || "chatgpt"}`, `${competitor || "chatgpt"} replacement`, `better than ${competitor || "chatgpt"}`, `${topic} ${competitor || "chatgpt"} alternative`],
        searchIntent:   "transactional",
        sections:       [`H2: Why Students Look Beyond ${competitor || "ChatGPT"}`, "H2: Feature-by-Feature Comparison", "H2: Pricing Breakdown", `H2: Where ${competitor || "ChatGPT"} Falls Short for Academic Use`, "H2: Who Should Make the Switch"],
        ctaText:        "Try LightSpeed Ghost free →",
        ctaPath:        tool.path,
        keyMessages:    [`Academic-specific vs general-purpose`, `Real citations vs hallucinations`, `Purpose-built for grades`],
      },
      {
        pageNumber:     5,
        pageType:       "trust",
        slug:           `${topicSlug}-review`,
        title:          `Does ${topic} Actually Work? Real Student Results [2025]`,
        metaDescription: `Honest ${topic} review with real student results, success rates, and risk assessment. Find out if it's worth it.`,
        h1:             `Does ${topic} Work? Real Results from Real Students`,
        targetKeywords: [`${topic} review`, `does ${topic} work`, `is ${topic} legit`, `${topic} results`, `${topic} worth it`],
        searchIntent:   "trust",
        sections:       ["H2: What the Data Shows", "H2: Real Student Outcomes", "H2: What Works and What Doesn't", "H2: Red Flags to Watch", "H2: Our Honest Assessment"],
        ctaText:        tool.cta,
        ctaPath:        tool.path,
        keyMessages:    [`Transparent about limitations`, `Real success rates`, `Risk-free trial available`],
      },
    ];

    return { topic, topicSlug, toolFocus, competitor: competitor || "ChatGPT", pages };
  }
}
