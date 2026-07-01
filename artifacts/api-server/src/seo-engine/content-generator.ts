/**
 * SEO Content Generator — catalog page writer (single-page mode)
 * Uses Gemini 2.5 Flash (free tier).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../lib/logger";
import { logLLMCost, computeCost } from "./budget-tracker";
import { checkAcademicIntegrity, buildAIDisclosureLabel } from "./compliance-checker";
import { buildFAQSchema, buildPageSchemas } from "./schema-engine";
import type { PageSpec } from "./page-catalog";
import { GEMINI_PRO_MODEL } from "./researcher";

const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const MIN_WORD_COUNT = parseInt(process.env.SEO_MIN_WORD_COUNT ?? "800");

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are a senior academic content specialist writing for LightspeedGhost — an AI-powered academic writing and data analysis platform at lightspeedghost.com.

WRITING RULES (NON-NEGOTIABLE):
- Write for humans. Every page must feel genuinely helpful, not templated or keyword-stuffed.
- Always write the brand as "LightspeedGhost" (one word) in body copy — never "LightSpeed Ghost".
- Minimum 8 unique data points per page (statistics, specific numbers, benchmarks, examples, dates).
- Never use: "bypass", "cheat", "undetectable", "get away with", "avoid detection", "turnitin bypass".
- Always use integrity-first framing: "AI writing assistance", "improve writing quality", "academic writing support".
- Academic integrity language REQUIRED throughout.
- Include at least one worked example or process walkthrough; if it uses a persona, label it explicitly "illustrative" or "hypothetical".
- Include an E-E-A-T trust signal (proven methodology, reference to a recognised standard, expertise language).

DO NOT (each gets the whole domain demoted or destroys reader trust):
- DO NOT frame the product around evading AI detectors. NEVER promise "0% AI score", "undetectable", "beat detectors", or "avoid AI detection". Describe the Humanizer ONLY as improving genuine writing quality and reducing FALSE AI-detection flags so writing reads naturally; note that detectors are unreliable.
- DO NOT invent testimonials, reviews, named students, or success stories presented as real. Label any example scenario as illustrative/hypothetical.
- DO NOT fabricate specific sources, citations, journal names, or "(Source: …)" tags. Use "studies suggest" / "industry estimates", or reference only well-known real organisations.
- DO NOT claim a free trial or "no credit card required" unless given to you. Keep pricing to the exact figures provided.
- DO NOT keyword-stuff. Write in natural second person ("your essay") — never the broken first-person form ("my essay", "build my bibliography").

FORMAT — output CLEAN HTML ONLY, NEVER Markdown:
- NEVER use Markdown: no ** for bold, no # headings, no "1."/"-"/"*" list markers, no [text](url) links. Use HTML tags ONLY (bold = <strong>, lists = <ul>/<ol>/<li>, links = <a href>).
- Use clean HTML tags: h1, h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, caption, blockquote, strong, em, a, div, span. Do NOT include <html>, <head>, <body> tags. Every body paragraph wrapped in <p>.
- First paragraph must directly answer the user's question.
- CTA block after the second h2 — use EXACTLY: <div class="seo-cta-block"><div class="seo-cta-block__text"><h3>[headline]</h3><p>[one sentence]</p></div><a class="seo-cta-block__btn" href="[path]">[CTA]</a></div>
- FAQ section (minimum 4 questions) must use class="seo-faq-section" with each item class="seo-faq-item" (<h3> question + <p> answer).
- AI disclosure label at the end: <div class="ai-disclosure">🤖 This page was created with AI writing assistance and reviewed for accuracy and compliance.</div>
- All tables must have <caption> and <th scope="col"> (WCAG 2.2).
- Minimum 800 words. Technical/data/finance pages: minimum 1000 words.`;
}

// ── Page-specific user prompt ─────────────────────────────────────────────────
function buildPagePrompt(spec: PageSpec): string {
  const ctaMap: Record<string, string> = {
    "paper-writer":     "Get AI writing assistance for your paper — from $4.99",
    humanizer:          "Improve your writing naturalness — from $1.99",
    stem:               "Solve this step by step — $1.99 per problem",
    "data-analysis":    `Get your ${spec.softwareFocus ?? "statistical"} analysis done — from $9.99`,
    "financial-analysis": "Financial statement analysis with interpretation — from $19.99",
    citation:           "Generate perfect citations instantly",
    ebook:              "Create your ebook with AI — $29.99/month",
    plagiarism:         "Check AI and plagiarism — $1.99 per check",
    revision:           "Improve your draft to First/A grade — from $4.99",
    outline:            "Generate your paper outline — $1.99",
  };

  const cta = ctaMap[spec.toolFocus ?? ""] ?? "Get started from $4.99/month";

  const contextLines: string[] = [
    `SLUG: /seo/${spec.slug}`,
    `PAGE TYPE: ${spec.type}`,
    `TITLE: ${spec.title}`,
    `META DESCRIPTION: ${spec.metaDescription}`,
    `PRIMARY KEYWORDS: ${spec.keywords.slice(0, 3).join(", ")}`,
    `CTA TEXT: "${cta}"`,
    `TOOL FOCUS: ${spec.toolFocus ?? "general"}`,
  ];

  if (spec.softwareFocus)  contextLines.push(`SOFTWARE: ${spec.softwareFocus}`);
  if (spec.paperTypeFocus) contextLines.push(`PAPER TYPE: ${spec.paperTypeFocus}`);
  if (spec.financialFocus) contextLines.push(`FINANCIAL FOCUS: ${spec.financialFocus}`);
  if (spec.audienceSegment) contextLines.push(`AUDIENCE: ${spec.audienceSegment}`);

  return `${contextLines.join("\n")}

Write a complete, genuinely helpful, 900–1,200 word SEO page for LightspeedGhost targeting the above keyword cluster.

REQUIRED SECTIONS:
1. <h1> — Primary keyword in natural language
2. Opening paragraph (direct, first-paragraph answer)
3. At least 4 <h2> sections with substantive content
4. CTA block (class="seo-cta-block") after the second <h2>
5. Comparison or data table (WCAG-compliant with <caption>)
6. Worked example or process walkthrough (label any persona "illustrative/hypothetical")
7. FAQ section (class="seo-faq-section") with exactly 5 questions and detailed answers
8. AI disclosure notice (class="ai-disclosure")

INTERNAL LINKS (MANDATORY): weave at least 4 in-context <a href> links into sentences (NOT a list at the end), including at least one money page and /pricing. Use ONLY these real paths: /write, /stem, /humanizer, /plagiarism, /pricing, /study, /outline, /revision. Do NOT invent /seo/ slugs.

UNIQUE DATA POINTS required (pick 8+ relevant ones):
- Citation ratio: 1 citation per 150–200 words
- LightspeedGhost supports 35+ paper types and 11 citation styles
- Humanizer improves natural readability and reduces FALSE AI-detection flags (NEVER frame as "0% AI score" or evading detection)
- Plagiarism ceiling: 8% maximum similarity
- Data analysis covers 28+ software tools and 100+ statistical methods
- Financial analysis covers IFRS 1–17 standards
- Plans from $9.99/month; PAYG from $1.99
- 25+ live academic databases (1B+ papers)
- Grade-focused tooling toward A / First Class standard

TRANSACTIONAL KEYWORDS — use sparingly and naturally ONLY:
Fold in at most 5–6 of these where they read naturally, in second person ("your", never "my"). Never force them, never use the first-person "my" form, never list them raw.
get writing help, improve your grade, check your paper, cite your sources, format your paper, compare AI tools, revise your essay, create your outline, score higher`;
}

// ── Generate with Gemini 2.5 Pro ──────────────────────────────────────────────
async function generateWithGemini(spec: PageSpec): Promise<{ html: string; inputTokens: number; outputTokens: number }> {
  if (!geminiClient) throw new Error("GEMINI_API_KEY not configured");

  const model = geminiClient.getGenerativeModel({ model: GEMINI_PRO_MODEL });

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{ text: buildSystemPrompt() + "\n\n---\n\n" + buildPagePrompt(spec) }],
    }],
    generationConfig: {
      temperature: 0.7,
      // gemini-2.5-pro is a thinking model — reasoning tokens count against this
      // budget, so it needs generous headroom or it returns empty responses.
      maxOutputTokens: 16384,
    },
  });

  const html  = result.response.text();
  const usage = result.response.usageMetadata;

  if (!html || html.trim().length < 200) {
    throw new Error(`Gemini returned ${html ? "near-empty" : "empty"} content (finishReason: ${result.response.candidates?.[0]?.finishReason ?? "unknown"})`);
  }

  return {
    html,
    inputTokens:  usage?.promptTokenCount    ?? 800,
    outputTokens: usage?.candidatesTokenCount ?? 1500,
  };
}

// ── Extract FAQs ──────────────────────────────────────────────────────────────
function extractFAQs(html: string): Array<{ question: string; answer: string }> {
  const faqs: Array<{ question: string; answer: string }> = [];
  const faqRegex = /<div[^>]*class="seo-faq-item"[^>]*>([\s\S]*?)<\/div>/gi;
  const qRegex   = /<(?:h[2-4]|strong|dt)[^>]*>(.*?)<\/(?:h[2-4]|strong|dt)>/i;
  const aRegex   = /<p>([\s\S]*?)<\/p>/i;

  let match;
  while ((match = faqRegex.exec(html)) !== null && faqs.length < 6) {
    const block = match[1];
    const q = qRegex.exec(block);
    const a = aRegex.exec(block);
    if (q && a) {
      faqs.push({
        question: q[1].replace(/<[^>]+>/g, "").trim(),
        answer:   a[1].replace(/<[^>]+>/g, "").trim(),
      });
    }
  }

  if (faqs.length < 2) {
    const h3Regex = /<h3[^>]*>(.*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
    while ((match = h3Regex.exec(html)) !== null && faqs.length < 5) {
      const q = match[1].replace(/<[^>]+>/g, "").trim();
      if (q.endsWith("?") || /^(what|how|why|when|can|is|are)/i.test(q)) {
        faqs.push({
          question: q,
          answer:   match[2].replace(/<[^>]+>/g, "").trim().slice(0, 300),
        });
      }
    }
  }

  return faqs;
}

// ── Main generation function ──────────────────────────────────────────────────
export interface GenerationResult {
  html:            string;
  schemaJson:      string;
  wordCount:       number;
  model:           string;
  costUsd:         number;
  inputTokens:     number;
  outputTokens:    number;
  faqs:            Array<{ question: string; answer: string }>;
  validationPassed: boolean;
  /** True if the academic-integrity sanitiser rewrote the text — the page
   *  should be flagged for human review, not treated as clean. */
  integrityRewritten: boolean;
}

export async function generatePageContent(spec: PageSpec, retryCount = 0): Promise<GenerationResult> {
  let html: string;
  let inputTokens: number;
  let outputTokens: number;

  try {
    ({ html, inputTokens, outputTokens } = await generateWithGemini(spec));
  } catch (err) {
    logger.error({ err, slug: spec.slug }, "[seo-gen] Generation failed");
    if (retryCount < 2) {
      logger.info({ slug: spec.slug, retryCount }, "[seo-gen] Retrying");
      await new Promise((r) => setTimeout(r, 2000));
      ({ html, inputTokens, outputTokens } = await generateWithGemini(spec));
    } else {
      throw err;
    }
  }

  const integrity = checkAcademicIntegrity(html);
  html = integrity.sanitized;
  if (integrity.rewritten) {
    logger.warn(
      { slug: spec.slug, violations: integrity.violations },
      "[seo-gen] Content auto-sanitised for academic integrity — flagging page for human review",
    );
  }
  if (!html.includes("ai-disclosure")) {
    html += `\n${buildAIDisclosureLabel()}`;
  }

  const faqs = extractFAQs(html);
  const schemas = buildPageSchemas({
    pageType:      spec.type,
    title:         spec.title,
    description:   spec.metaDescription,
    slug:          spec.slug,
    faqs,
    datePublished: new Date().toISOString().split("T")[0],
  });

  const wordCount = html.split(/\s+/).filter(Boolean).length;
  const costUsd   = computeCost(GEMINI_PRO_MODEL, inputTokens, outputTokens);

  await logLLMCost({
    taskType:  `seo-page-${spec.type}`,
    model:     GEMINI_PRO_MODEL,
    inputTokens,
    outputTokens,
    costUsd,
    pageSlug:  spec.slug,
  });

  const validationPassed = wordCount >= MIN_WORD_COUNT && faqs.length >= 2;

  return {
    html,
    schemaJson:  JSON.stringify(schemas),
    wordCount,
    model:       GEMINI_PRO_MODEL,
    costUsd,
    inputTokens,
    outputTokens,
    faqs,
    validationPassed,
    integrityRewritten: integrity.rewritten,
  };
}
