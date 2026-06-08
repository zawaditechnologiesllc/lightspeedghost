/**
 * Five-Page Cluster Writer — Step 3 of 3-step pipeline
 * Generates each of the 5 cluster pages with page-type-specific prompts.
 * Each page directs users to the specific LSG tool that solves their problem.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { sanitizeContent, buildAIDisclosureLabel, validatePage } from "./compliance-checker";
import { buildPageSchemas } from "./schema-engine";
import { logLLMCost, computeCost, incrementPageCount } from "./budget-tracker";
import { GEMINI_PRO_MODEL } from "./researcher";
import { getToolInfo } from "./outliner";
import type { PageOutlineItem, ArticleOutline } from "./outliner";
import type { ResearchData } from "./researcher";

const MIN_WORDS = 900;

// ── System prompt shared by all 5 page types ─────────────────────────────────
function buildSystemPrompt(): string {
  return `You are a senior SEO content writer for LightspeedGhost — an AI-powered academic writing platform at lightspeedghost.com.

WRITING RULES (NON-NEGOTIABLE):
- Write for humans. Every page must feel genuinely helpful, not templated.
- Minimum 8 unique data points per page (statistics, numbers, benchmarks, citations, named sources).
- NEVER use: "bypass", "cheat", "cheating", "undetectable", "get away with", "avoid detection", "turnitin bypass", "gptzero bypass", "contract cheating", "do my homework", "do my assignment".
- ALWAYS use: "AI writing assistance", "improve writing quality", "natural language enhancement", "academic writing support".
- Academic integrity language REQUIRED throughout.
- Include at least one specific, worked real-world example.
- Include an E-E-A-T signal (proven methodology, citation to standards, author expertise language).

HTML FORMAT:
- Use ONLY: h1, h2, h3, p, ul, ol, table, blockquote, strong, em, a, div, span. NO <html>, <head>, <body>.
- First paragraph: directly answer the user's core question.
- CTA block: <div class="seo-cta-block">...</div> — place after 2nd H2.
- FAQ section: <div class="seo-faq-section"> with each item as <div class="seo-faq-item">.
- AI disclosure: <div class="ai-disclosure">🤖 This content was created with AI assistance and reviewed for accuracy.</div> — place at end.
- All tables: must have <caption> and <th scope="col"> (WCAG 2.2 required).
- Minimum 900 words. Target 1,100–1,300 words for depth.`;
}

// ── Page-type-specific prompts ────────────────────────────────────────────────

function buildHookPrompt(outline: PageOutlineItem, research: ResearchData, tool: ReturnType<typeof getToolInfo>): string {
  return `${buildSystemPrompt()}

---
PAGE TYPE: Hook / Traffic Magnet (Page 1 of 5)
GOAL: Capture informational search traffic. Empathise with the student, answer their question, lead them to our tool.
SEARCH INTENT: Informational ("how to", "what is", "why does")

PAGE SPEC:
Title: ${outline.title}
H1: ${outline.h1}
Slug: /seo/${outline.slug}
Meta: ${outline.metaDescription}
Target Keywords: ${outline.targetKeywords.join(", ")}
Key Messages: ${outline.keyMessages.join(" | ")}

RESEARCH INSIGHTS:
Student pain points: ${research.painPoints.slice(0, 5).join(" | ")}
Top questions students ask: ${research.topQuestions.slice(0, 4).join(" | ")}
Key statistics to cite: ${research.keyStats.slice(0, 4).join(" | ")}
Reddit community insight: ${research.redditInsights}

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening paragraph: empathise with student problem, preview the solution — 3–4 sentences]
${outline.sections.map((s) => `${s}\n[150–200 words of genuinely helpful content]`).join("\n\n")}
<div class="seo-cta-block">
  <strong>${tool.name}</strong>
  <p>[1 sentence explaining how this tool solves the exact problem described above]</p>
  <a href="${tool.path}">${tool.cta}</a>
  <p style="font-size:0.8em;opacity:0.7">${tool.pricing}</p>
</div>
[FAQ section: 5 questions students actually search for about this topic]
[AI disclosure]

INTERNAL LINKS — include at least 3 natural links to:
- ${tool.path} (primary — the relevant tool)
- /write (AI Paper Writer)
- /plagiarism (Plagiarism Checker)
- /study (Study Assistant)

Write the complete HTML content now. 900–1,300 words.`;
}

function buildComparisonPrompt(outline: PageOutlineItem, research: ResearchData, tool: ReturnType<typeof getToolInfo>): string {
  const competitors = [research.competitorMentions[0] ?? "ChatGPT", research.competitorMentions[1] ?? "QuillBot", "LightSpeed Ghost", research.competitorMentions[2] ?? "Grammarly", research.competitorMentions[3] ?? "EssayAI"];

  return `${buildSystemPrompt()}

---
PAGE TYPE: Comparison / Commercial Intent (Page 2 of 5)
GOAL: Capture "best X tools", "X vs Y" traffic. Position LightSpeed Ghost as the top choice for academic use.
SEARCH INTENT: Commercial investigation — students comparing options before buying.

PAGE SPEC:
Title: ${outline.title}
H1: ${outline.h1}
Slug: /seo/${outline.slug}
Meta: ${outline.metaDescription}
Target Keywords: ${outline.targetKeywords.join(", ")}
Tools to compare: ${competitors.join(", ")}

RESEARCH INSIGHTS:
Pain points driving tool search: ${research.painPoints.slice(0, 4).join(" | ")}
High-intent keywords: ${research.highVolumeKeywords.slice(0, 5).join(", ")}
Key statistics: ${research.keyStats.slice(0, 3).join(" | ")}

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening: why tool selection matters for academic success — 2–3 sentences]

[H2: Evaluation Criteria — bullet list of 5–6 criteria: accuracy, citation quality, detection risk, price, ease of use, academic-specific features]

[H2: Top Tools Compared]
<table><caption>Top ${outline.targetKeywords[0] ?? "academic writing"} Tools for Students 2025</caption>
<thead><tr><th scope="col">Tool</th><th scope="col">Best For</th><th scope="col">Price</th><th scope="col">Academic Citations</th><th scope="col">AI Detection Risk</th><th scope="col">Verdict</th></tr></thead>
<tbody>
[5 rows: ${competitors.join(", ")} — LightSpeed Ghost gets the best ratings for academic use]
</tbody></table>

<div class="seo-cta-block">
  <strong>${tool.name} — Built for Academic Results</strong>
  <p>[Sentence: why LSG wins the comparison for serious students]</p>
  <a href="${tool.path}">${tool.cta}</a>
  <p style="font-size:0.8em;opacity:0.7">${tool.pricing}</p>
</div>

[H2: LightSpeed Ghost — Why It Wins for Academic Use — 200 words, cite specific features]
[H2: Pricing Breakdown — compare actual prices of all 5 tools]
[H2: Which Tool Is Right for You — audience segmentation matrix]
[FAQ: 5 questions about tool selection, pricing, switching]
[AI disclosure]

INTERNAL LINKS: ${tool.path}, /write, /plagiarism, /study

Write the complete HTML content now. 1,000–1,300 words.`;
}

function buildBreakdownPrompt(outline: PageOutlineItem, research: ResearchData, tool: ReturnType<typeof getToolInfo>): string {
  return `${buildSystemPrompt()}

---
PAGE TYPE: Breakdown / Educational Depth (Page 3 of 5)
GOAL: Capture "how X works", "X step by step", "X explained" searches. Build authority through depth.
SEARCH INTENT: Educational — students want to understand, not just use.

PAGE SPEC:
Title: ${outline.title}
H1: ${outline.h1}
Slug: /seo/${outline.slug}
Meta: ${outline.metaDescription}
Target Keywords: ${outline.targetKeywords.join(", ")}
Key Messages: ${outline.keyMessages.join(" | ")}

RESEARCH INSIGHTS:
Deep questions students ask: ${research.topQuestions.slice(0, 5).join(" | ")}
Key statistics and data: ${research.keyStats.join(" | ")}
Common misconceptions: infer from pain points: ${research.painPoints.slice(0, 4).join(" | ")}

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening: why truly understanding this topic gives students an academic advantage — 2–3 sentences]

[H2: The Basics — clear definition and context, with at least 2 data points]
[H2: How It Actually Works — numbered step-by-step process, 5–7 steps, with specific technical detail]
<div class="seo-cta-block">
  <strong>Let ${tool.name} Handle This For You</strong>
  <p>[Sentence: how LSG automates the complex parts described above]</p>
  <a href="${tool.path}">${tool.cta}</a>
  <p style="font-size:0.8em;opacity:0.7">${tool.pricing}</p>
</div>
[H2: Common Misconceptions — 3–4 myths busted with evidence]
[H2: What the Research Actually Shows — cite studies, statistics, named sources]
[H2: Worked Example — walk through a real student scenario from start to finish]
[FAQ: 5 technical questions about this topic answered in depth]
[AI disclosure]

INTERNAL LINKS: ${tool.path}, /write, /plagiarism, /study

Write the complete HTML content now. 1,000–1,400 words.`;
}

function buildAlternativePrompt(outline: PageOutlineItem, research: ResearchData, competitor: string, tool: ReturnType<typeof getToolInfo>): string {
  return `${buildSystemPrompt()}

---
PAGE TYPE: Alternative / Competitor Comparison (Page 4 of 5)
GOAL: Capture "${competitor} alternative", "${competitor} vs LightspeedGhost" searches. PITCH our platform directly.
SEARCH INTENT: Transactional — students ready to switch or buy. Be direct and persuasive.

PAGE SPEC:
Title: ${outline.title}
H1: ${outline.h1}
Slug: /seo/${outline.slug}
Meta: ${outline.metaDescription}
Target Keywords: ${outline.targetKeywords.join(", ")}

LIGHTSPEEDGHOST ADVANTAGES TO HIGHLIGHT:
- Built for academic use (not a general chatbot)
- 25+ live academic databases (1B+ papers): OpenAlex, CrossRef, PubMed, Semantic Scholar, arXiv + 20 more
- Real DOI citations with verification — not hallucinated references
- AI detection reduction target: 0% AI score
- Plagiarism check ≤8% similarity built in
- 35+ paper types, 11 citation styles (APA, MLA, Harvard, Chicago, OSCOLA, Vancouver, IEEE)
- Starter plan $9.99/month — PAYG from $1.99
- Purpose-built tools: Paper Writer, Humanizer, STEM Solver, Study Assistant, Plagiarism Checker, Revision Tool

COMPETITOR (${competitor}) WEAKNESSES TO ADDRESS HONESTLY:
${research.painPoints.filter((p) => p.toLowerCase().includes(competitor.toLowerCase()) || p.toLowerCase().includes("generic") || p.toLowerCase().includes("hallucin") || p.toLowerCase().includes("citation")).slice(0, 3).join(" | ") || `Generic responses, hallucinated citations, not built for academic integrity, no plagiarism checking, no grade targeting`}

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening: acknowledge why students use ${competitor}, then pivot — 2–3 sentences]

[H2: Why Students Look Beyond ${competitor}]
[3–4 specific limitations of ${competitor} for academic use — honest, not aggressive]

[H2: Feature-by-Feature Comparison]
<table><caption>LightSpeed Ghost vs ${competitor}: Academic Writing Feature Comparison</caption>
<thead><tr><th scope="col">Feature</th><th scope="col">${competitor}</th><th scope="col">LightSpeed Ghost</th></tr></thead>
<tbody>
[8–10 rows: Academic citations, Plagiarism check, AI detection score, Paper types, Citation styles, Database access, Grade targeting, Price, Academic-specific, Customer support]
LightSpeed Ghost wins on all academic-critical features.
</tbody></table>

<div class="seo-cta-block">
  <strong>The Academic-First Alternative to ${competitor}</strong>
  <p>LightSpeed Ghost is built for one thing: helping students achieve better grades. Not a chatbot, not a general tool — a purpose-built academic writing platform.</p>
  <a href="${tool.path}">Try LightSpeed Ghost Free →</a>
  <p style="font-size:0.8em;opacity:0.7">${tool.pricing} · No credit card required for first use</p>
</div>

[H2: Pricing Breakdown — actual prices for both, honest assessment of value]
[H2: Who Should Stick With ${competitor}? — be fair: casual use, non-academic writing]
[H2: Who Should Switch to LightSpeed Ghost? — academic writers, students who need grades]
[FAQ: 5 questions about switching, data safety, price, academic integrity]
[AI disclosure]

INTERNAL LINKS: ${tool.path}, /write, /plagiarism, /study, /humanizer

Write the complete HTML content now. 1,000–1,300 words.`;
}

function buildTrustPrompt(outline: PageOutlineItem, research: ResearchData, tool: ReturnType<typeof getToolInfo>): string {
  return `${buildSystemPrompt()}

---
PAGE TYPE: Trust / Social Proof (Page 5 of 5)
GOAL: Capture "does X work", "X review", "is X legit" searches. Convert fence-sitters with credibility.
SEARCH INTENT: Trust-seeking — students need reassurance before committing.

PAGE SPEC:
Title: ${outline.title}
H1: ${outline.h1}
Slug: /seo/${outline.slug}
Meta: ${outline.metaDescription}
Target Keywords: ${outline.targetKeywords.join(", ")}
Key Messages: ${outline.keyMessages.join(" | ")}

RESEARCH INSIGHTS:
What students are skeptical about: ${research.painPoints.slice(0, 4).join(" | ")}
Trust signals that matter: reliability, accuracy, detection risk, grade improvement, price transparency
Key stats available: ${research.keyStats.join(" | ")}
Reddit community context: ${research.redditInsights}

TRUST SIGNALS TO INCLUDE (for LightSpeed Ghost):
- Powered by verified academic databases: 25+ sources, 1B+ papers
- Plagiarism ceiling: ≤8% (industry standard is ≤20%)
- AI detection: targets 0% AI score
- Grade improvement: targets First Class / A grade
- Price transparency: $9.99/month Starter, PAYG $1.99 minimum
- No lock-in: cancel anytime
- Academic integrity-compliant: writing assistance, not content generation for submission

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening: acknowledge the trust concern directly — "Skepticism is healthy. Here's what the evidence actually shows." — 2–3 sentences]

[H2: What the Data Shows — 4–5 concrete statistics about this topic with sourced context]
[H2: How LightSpeed Ghost Delivers Results — specific feature-to-outcome mapping, 3–4 examples]
<div class="seo-cta-block">
  <strong>See Results Yourself — Risk Free</strong>
  <p>[1 sentence on the low-risk trial/PAYG option]</p>
  <a href="${tool.path}">${tool.cta}</a>
  <p style="font-size:0.8em;opacity:0.7">${tool.pricing} · Cancel anytime</p>
</div>
[H2: What to Watch Out For — red flags in this space generally (not specific to LSG), builds credibility]
[H2: Honest Limitations — what LightSpeed Ghost is NOT good for, builds trust through transparency]
[H2: Our Verdict — direct recommendation with caveats]
[FAQ: 5 questions — "is it safe?", "can professors detect?", "what if I'm not satisfied?", "how does pricing work?", "is it worth it for my situation?"]
[AI disclosure]

INTERNAL LINKS: ${tool.path}, /write, /plagiarism, /humanizer, /study

Write the complete HTML content now. 1,000–1,300 words.`;
}

// ── Main cluster page generator ──────────────────────────────────────────────

export interface ClusterPageResult {
  slug:            string;
  pageType:        string;
  pageNumber:      number;
  html:            string;
  schemaJson:      string;
  wordCount:       number;
  costUsd:         number;
  validationPassed: boolean;
}

export async function generateClusterPage(
  outline:       PageOutlineItem,
  fullOutline:   ArticleOutline,
  research:      ResearchData,
  geminiClient:  GoogleGenerativeAI,
): Promise<ClusterPageResult> {
  const tool = getToolInfo(fullOutline.toolFocus);
  const model = geminiClient.getGenerativeModel({ model: GEMINI_PRO_MODEL });

  const promptMap: Record<string, string> = {
    hook:        buildHookPrompt(outline, research, tool),
    comparison:  buildComparisonPrompt(outline, research, tool),
    breakdown:   buildBreakdownPrompt(outline, research, tool),
    alternative: buildAlternativePrompt(outline, research, fullOutline.competitor, tool),
    trust:       buildTrustPrompt(outline, research, tool),
  };

  const prompt = promptMap[outline.pageType] ?? buildHookPrompt(outline, research, tool);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4000,
    },
  });

  let html = result.response.text();
  const usage = result.response.usageMetadata;
  const inputTokens  = usage?.promptTokenCount    ?? 2000;
  const outputTokens = usage?.candidatesTokenCount ?? 2500;

  // Compliance & cleanup
  html = sanitizeContent(html);
  if (!html.includes("ai-disclosure")) {
    html += `\n${buildAIDisclosureLabel()}`;
  }

  // Extract FAQs for schema
  const faqs = extractFAQs(html);

  // Build schema
  const schemaTypeMap: Record<string, string> = {
    hook: "how-to", comparison: "comparison", breakdown: "use-case",
    alternative: "comparison", trust: "use-case",
  };
  const schemas = buildPageSchemas({
    pageType:      schemaTypeMap[outline.pageType] ?? "use-case",
    title:         outline.title,
    description:   outline.metaDescription,
    slug:          outline.slug,
    faqs,
    datePublished: new Date().toISOString().split("T")[0],
  });

  const wordCount = html.split(/\s+/).filter(Boolean).length;
  const costUsd   = computeCost("gemini-2.5-pro", inputTokens, outputTokens);

  await logLLMCost({
    taskType:  `seo-cluster-${outline.pageType}`,
    model:     "gemini-2.5-pro",
    inputTokens,
    outputTokens,
    costUsd,
    pageSlug:  outline.slug,
  });

  return {
    slug:             outline.slug,
    pageType:         outline.pageType,
    pageNumber:       outline.pageNumber,
    html,
    schemaJson:       JSON.stringify(schemas),
    wordCount,
    costUsd,
    validationPassed: wordCount >= MIN_WORDS && faqs.length >= 2,
  };
}

// ── Save cluster page to DB ───────────────────────────────────────────────────

export async function saveClusterPage(
  page:       ClusterPageResult,
  outline:    PageOutlineItem,
  clusterId:  string,
  toolFocus:  string,
  autoPublish: boolean,
): Promise<void> {
  const validation = validatePage(page.html);

  await pool.query(
    `INSERT INTO seo_pages (
      slug, title, meta_description, content_html, schema_json, keywords,
      page_type, tool_focus, audience_segment,
      cluster_id, cluster_page_type, cluster_page_number,
      word_count, unique_data_points, has_faq_schema, has_ai_disclosure, integrity_check,
      llm_used, llm_cost_usd, status, published, created_at, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      meta_description = EXCLUDED.meta_description,
      content_html = EXCLUDED.content_html,
      schema_json = EXCLUDED.schema_json::jsonb,
      cluster_id = EXCLUDED.cluster_id,
      cluster_page_type = EXCLUDED.cluster_page_type,
      cluster_page_number = EXCLUDED.cluster_page_number,
      word_count = EXCLUDED.word_count,
      unique_data_points = EXCLUDED.unique_data_points,
      has_faq_schema = EXCLUDED.has_faq_schema,
      has_ai_disclosure = EXCLUDED.has_ai_disclosure,
      integrity_check = EXCLUDED.integrity_check,
      llm_used = EXCLUDED.llm_used,
      llm_cost_usd = EXCLUDED.llm_cost_usd,
      status = EXCLUDED.status,
      published = EXCLUDED.published,
      updated_at = now()`,
    [
      page.slug,
      outline.title,
      outline.metaDescription,
      page.html,
      page.schemaJson,
      outline.targetKeywords,
      `cluster-${outline.pageType}`,
      toolFocus,
      "students",
      clusterId,
      outline.pageType,
      outline.pageNumber,
      page.wordCount,
      validation.uniqueDataPoints,
      validation.hasFAQ,
      validation.hasAIDisclosure,
      validation.integrityCheck,
      "gemini-2.5-pro",
      page.costUsd,
      autoPublish ? "published" : "review",
      autoPublish,
    ],
  );

  await incrementPageCount();
}

// ── FAQ extractor (shared logic) ──────────────────────────────────────────────

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
      if (q.endsWith("?") || /^(what|how|why|when|can|is|are|does|do)\s/i.test(q)) {
        faqs.push({
          question: q,
          answer:   match[2].replace(/<[^>]+>/g, "").trim().slice(0, 300),
        });
      }
    }
  }

  return faqs;
}
