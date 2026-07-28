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
// Pricing reflects the live plan structure: a $0 Free plan (includes the
// AI & Plagiarism Checker, which never touches an LLM), Pro at $29.99/month,
// a custom Institution plan, and Pay-As-You-Go from $1.99 with no subscription.
const TOOL_PATHS: Record<string, { name: string; path: string; cta: string; pricing: string }> = {
  "paper-writer": {
    name:    "AI Paper Writer",
    path:    "/write",
    cta:     "Write my paper with verified citations →",
    // Priced by length so long, high-value papers monetise well: short posts
    // $3.99, essays $7.99, research papers $14.99, research proposals $24.99,
    // and full dissertations/theses (6,000–15,000 words) $59.99 — no
    // subscription needed. All lengths are also included in Pro at $29.99/month.
    pricing: "Pay-as-you-go by length: $3.99 short posts · $7.99 essays · $14.99 research papers · $24.99 proposals · $59.99 dissertations & theses — or included in Pro $29.99/month",
  },
  dissertation: {
    name:    "AI Dissertation & Thesis Writer",
    path:    "/write",
    cta:     "Draft my dissertation with verified citations →",
    pricing: "Pay-as-you-go $59.99 per dissertation/thesis (6,000–15,000 words, 35+ live databases, real DOI citations) · $24.99 research proposals · or Pro $29.99/month",
  },
  humanizer: {
    name:    "LightSpeed Humanizer",
    path:    "/humanizer",
    cta:     "Humanize my writing to a natural academic voice →",
    pricing: "Pay-as-you-go from $1.99 · included in Pro $29.99/month",
  },
  plagiarism: {
    name:    "AI & Plagiarism Checker",
    path:    "/plagiarism",
    cta:     "Check my work free for AI & plagiarism →",
    pricing: "Free — never touches an AI model (Pro adds 20 deep scans/month)",
  },
  stem: {
    name:    "STEM Solver",
    path:    "/stem",
    cta:     "Solve my STEM problem step-by-step →",
    pricing: "Pay-as-you-go $1.99 per problem · included in Pro $29.99/month",
  },
  study: {
    name:    "AI Study Assistant",
    path:    "/study",
    cta:     "Start studying smarter today →",
    pricing: "Study day pass $2.99 · included in Pro $29.99/month",
  },
  revision: {
    name:    "Paper Revision Tool",
    path:    "/revision",
    cta:     "Improve my paper to an A grade →",
    pricing: "Pay-as-you-go from $1.99 · included in Pro $29.99/month",
  },
  outline: {
    name:    "Outline Builder",
    path:    "/outline",
    cta:     "Build my paper outline in seconds →",
    pricing: "Pay-as-you-go $1.99 per outline · included in Pro $29.99/month",
  },
  ebook: {
    name:    "Ebook Generator",
    path:    "/ebooks",
    cta:     "Create my publish-ready ebook →",
    pricing: "$29.99/month ebook plan (separate from academic plans)",
  },
};

// Low-value words dropped from slugs to keep them short and keyword-focused
// (Google guidance + Neil Patel: concise, descriptive, hyphenated URLs). We KEEP
// high-intent words like how/what/why/best/free/vs because they carry search
// intent ("how-to-write-an-essay", "best-ai-essay-writer").
const SLUG_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "as",
  "at", "is", "are", "be", "this", "that", "your", "you",
]);

// Google-friendly slug: lowercase, ASCII, hyphen-separated, no stop words, no
// mid-word truncation, no leading/trailing hyphens, never empty. Accepts raw LLM
// output (titles, punctuation, emoji, years) and always returns a clean slug.
export function slugify(text: string, maxLen = 60): string {
  const words = String(text ?? "")
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents: é → e
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")                              // don't → dont (no stray hyphen)
    .replace(/[^a-z0-9]+/g, " ")                        // everything else → space
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // Drop stop words, but never strip the slug down to nothing.
  let kept = words.filter((w) => !SLUG_STOPWORDS.has(w));
  if (kept.length < 3) kept = words;

  // Assemble up to maxLen on WORD boundaries — never cut a word in half.
  const out: string[] = [];
  let len = 0;
  for (const w of kept) {
    const add = (out.length ? 1 : 0) + w.length;
    if (len + add > maxLen) break;
    out.push(w);
    len += add;
  }
  const finalWords = out.length ? out : kept.slice(0, 6);
  return finalWords.join("-").replace(/^-+|-+$/g, "") || "page";
}

export function getToolInfo(toolFocus: string) {
  return TOOL_PATHS[toolFocus] ?? {
    name:    "LightSpeed Ghost",
    path:    "/app",
    cta:     "Get started free →",
    pricing: "Free plan forever · Pro $29.99/month · Pay-as-you-go from $1.99",
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
    `Top questions (answer these directly): ${research.topQuestions.slice(0, 8).join(" | ")}`,
    `Google autocomplete (real live searches — target these long-tail queries): ${(research.googleSuggests ?? []).slice(0, 15).join(" | ")}`,
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
        // Thinking-model headroom — see researcher.ts
        maxOutputTokens: 8192,
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

    // Never trust the model's raw slug — sanitise every one through slugify and
    // guarantee they're unique within the cluster (a duplicate slug would
    // cannibalise itself and lose one page to an overwrite).
    const seen = new Set<string>();
    for (const p of pages) {
      let s = slugify(p.slug || `${topicSlug}-${p.pageType}`);
      if (seen.has(s)) {
        const base = s.slice(0, 52);
        let n = 2;
        while (seen.has(`${base}-${p.pageType || n}`)) n++;
        s = `${base}-${p.pageType || n}`;
      }
      seen.add(s);
      p.slug = s;
    }
    logger.info({ topic, topicSlug, toolFocus, pages: pages.length }, "[seo-outliner] Outline built");

    return { topic, topicSlug, toolFocus, competitor: competitor || "ChatGPT", pages };
  } catch (err) {
    logger.error({ err, topic }, "[seo-outliner] Gemini outline failed — using fallback structure");

    const YEAR = new Date().getFullYear(); // titles stay current automatically
    // Fallback minimal outline
    const pages: PageOutlineItem[] = [
      {
        pageNumber:     1,
        pageType:       "hook",
        slug:           `${topicSlug}-guide`,
        title:          `${topic}: What Every Student Needs to Know [${YEAR}]`,
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
        title:          `Best ${topic} Tools for Students in ${YEAR}`,
        metaDescription: `Compare the top ${topic} tools for students. See why LightSpeed Ghost ranks #1 for academic use.`,
        h1:             `Best ${topic} Tools for Students: ${YEAR} Comparison`,
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
        title:          `LightSpeed Ghost vs ${competitor || "ChatGPT"}: Honest ${YEAR} Comparison`,
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
        title:          `Does ${topic} Actually Work? Real Student Results [${YEAR}]`,
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
