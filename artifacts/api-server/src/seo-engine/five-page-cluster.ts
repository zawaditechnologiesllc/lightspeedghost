/**
 * Five-Page Cluster Writer — Step 3 of 3-step pipeline
 * Generates each of the 5 cluster pages with page-type-specific prompts.
 * Each page directs users to the specific LSG tool that solves their problem.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { checkAcademicIntegrity, buildAIDisclosureLabel, validatePage } from "./compliance-checker";
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
- Write for humans. Every page must feel genuinely helpful, not templated or keyword-stuffed.
- Always write the brand as "LightspeedGhost" (one word) in body copy — never "LightSpeed Ghost".
- Minimum 8 unique data points per page (statistics, numbers, benchmarks, citations, named sources).
- NEVER use: "bypass", "cheat", "cheating", "undetectable", "get away with", "avoid detection", "turnitin bypass", "gptzero bypass", "contract cheating", "do my homework", "do my assignment".
- ALWAYS use integrity-first framing: "AI writing assistance", "improve writing quality", "academic writing support".
- Academic integrity language REQUIRED throughout.
- E-E-A-T: include a credibility signal (proven methodology, reference to a recognised standard, expertise language).

DO NOT (each of these gets the whole domain demoted or destroys reader trust):
- DO NOT frame the product around evading AI detectors. NEVER promise "0% AI score", "undetectable", "beat detectors", or "avoid AI detection". Describe the Humanizer ONLY as improving genuine writing quality and reducing FALSE AI-detection flags, so the writing reads naturally and reflects the student's own voice. State plainly that AI detectors are unreliable and produce false positives.
- DO NOT invent testimonials, reviews, named students, or success stories and present them as real. If you use an example persona or scenario, label it explicitly as "illustrative" or "hypothetical".
- DO NOT fabricate specific sources, citations, journal names, or "(Source: …)" tags. Use "studies suggest" / "industry estimates", or reference only well-known real organisations.
- DO NOT claim a free trial, "no credit card required", or any offer that was not provided to you. Keep pricing claims to the exact figures given.
- DO NOT keyword-stuff. Write in natural second person ("your essay", "your citations") — never the broken first-person form ("my essay", "build my bibliography").

HTML FORMAT — output CLEAN HTML ONLY, NEVER Markdown:
- NEVER use Markdown: no ** for bold, no # headings, no "1."/"-"/"*" list markers, no [text](url) links. Use HTML tags ONLY.
- Bold = <strong>, italics = <em>, lists = <ul>/<ol> with <li>, links = <a href="…">. Every body paragraph wrapped in <p>…</p>.
- Use ONLY these tags: h1, h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, caption, blockquote, strong, em, a, div, span. NO <html>, <head>, <body>.
- First paragraph: directly answer the user's core question.
- CTA block — use EXACTLY this structure, placed after the 2nd H2:
  <div class="seo-cta-block"><div class="seo-cta-block__text"><h3>[headline]</h3><p>[one sentence]</p></div><a class="seo-cta-block__btn" href="[tool path]">[CTA text]</a></div>
- FAQ section: <div class="seo-faq-section"> containing one <h2> then each item as <div class="seo-faq-item"><h3>[question]</h3><p>[answer]</p></div>.
- AI disclosure (very end): <div class="ai-disclosure">🤖 This page was created with AI writing assistance and reviewed for accuracy and compliance.</div>
- All tables: <caption> + <th scope="col"> (WCAG 2.2 required).
- Minimum 900 words. Target 1,100–1,300 words for depth.

INTERNAL LINKS (MANDATORY): weave at least 4 in-context <a href> links into sentences (NOT a list dumped at the end). At minimum link the relevant tool path plus /write, /plagiarism, and /pricing. Use ONLY these real paths: /write, /stem, /humanizer, /plagiarism, /pricing, /study, /outline, /revision. Do NOT invent /seo/ slugs.

TRANSACTIONAL KEYWORDS — use sparingly and naturally ONLY: you may fold in a FEW of these where they read naturally, in second person — e.g. "get writing help", "improve your grade", "check your paper", "cite your sources", "format your paper", "compare AI tools". Use at most 5–6 across the whole page. Never force them, never use the first-person "my" form, never list them raw.`;
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
  <div class="seo-cta-block__text">
    <h3>${tool.name}</h3>
    <p>[1 sentence explaining how this tool solves the exact problem described above. ${tool.pricing}]</p>
  </div>
  <a class="seo-cta-block__btn" href="${tool.path}">${tool.cta}</a>
</div>
[FAQ section: 5 questions students actually search for about this topic]
[AI disclosure]

INTERNAL LINKS — weave at least 4 in-context links into sentences:
- ${tool.path} (primary — the relevant tool)
- /write (AI Paper Writer)
- /plagiarism (Plagiarism Checker)
- /pricing (plans)

Write the complete HTML content now. 900–1,300 words.`;
}

function buildComparisonPrompt(outline: PageOutlineItem, research: ResearchData, tool: ReturnType<typeof getToolInfo>): string {
  const competitors = [research.competitorMentions[0] ?? "ChatGPT", research.competitorMentions[1] ?? "QuillBot", "LightspeedGhost", research.competitorMentions[2] ?? "Grammarly", research.competitorMentions[3] ?? "EssayAI"];

  return `${buildSystemPrompt()}

---
PAGE TYPE: Comparison / Commercial Intent (Page 2 of 5)
GOAL: Capture "best X tools", "X vs Y" traffic. Position LightspeedGhost as the top choice for academic use.
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
<table><caption>Top ${outline.targetKeywords[0] ?? "academic writing"} Tools for Students</caption>
<thead><tr><th scope="col">Tool</th><th scope="col">Best For</th><th scope="col">Price</th><th scope="col">Academic Citations</th><th scope="col">Natural Readability</th><th scope="col">Verdict</th></tr></thead>
<tbody>
[5 rows: ${competitors.join(", ")} — LightspeedGhost rates best for academic use; be fair to the others]
</tbody></table>

<div class="seo-cta-block">
  <div class="seo-cta-block__text">
    <h3>${tool.name} — Built for Academic Results</h3>
    <p>[Sentence: why LightspeedGhost wins the comparison for serious students. ${tool.pricing}]</p>
  </div>
  <a class="seo-cta-block__btn" href="${tool.path}">${tool.cta}</a>
</div>

[H2: Why LightspeedGhost Wins for Academic Use — 200 words, cite specific features]
[H2: Pricing Breakdown — compare actual prices of all 5 tools, honestly]
[H2: Which Tool Is Right for You — audience segmentation matrix]
[FAQ: 5 questions about tool selection, pricing, switching]
[AI disclosure]

INTERNAL LINKS (weave 4+ into sentences): ${tool.path}, /write, /plagiarism, /pricing

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
  <div class="seo-cta-block__text">
    <h3>Let ${tool.name} Handle the Heavy Lifting</h3>
    <p>[Sentence: how LightspeedGhost streamlines the complex parts described above. ${tool.pricing}]</p>
  </div>
  <a class="seo-cta-block__btn" href="${tool.path}">${tool.cta}</a>
</div>
[H2: Common Misconceptions — 3–4 myths busted with evidence]
[H2: What the Research Actually Shows — cite real studies and statistics; do NOT fabricate sources]
[H2: Worked Example — an explicitly illustrative/hypothetical student scenario (label it as such)]
[FAQ: 5 technical questions about this topic answered in depth]
[AI disclosure]

INTERNAL LINKS (weave 4+ into sentences): ${tool.path}, /write, /plagiarism, /pricing

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
- Humanizer improves natural readability and reduces FALSE AI-detection flags (NEVER frame as evading detection or "0% AI score")
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
<table><caption>LightspeedGhost vs ${competitor}: Academic Writing Feature Comparison</caption>
<thead><tr><th scope="col">Feature</th><th scope="col">${competitor}</th><th scope="col">LightspeedGhost</th></tr></thead>
<tbody>
[8–10 rows: Academic citations, Plagiarism check, Natural readability, Paper types, Citation styles, Database access, Grade-focused tooling, Price, Academic-specific tools, Support]
Be fair to ${competitor}; LightspeedGhost leads on academic-critical features.
</tbody></table>

<div class="seo-cta-block">
  <div class="seo-cta-block__text">
    <h3>The Academic-First Alternative to ${competitor}</h3>
    <p>LightspeedGhost is purpose-built for academic work — verifiable citations, originality, and the right formatting. ${tool.pricing}</p>
  </div>
  <a class="seo-cta-block__btn" href="${tool.path}">${tool.cta}</a>
</div>

[H2: Pricing Breakdown — actual prices for both, honest assessment of value]
[H2: Who Should Stick With ${competitor}? — be fair: casual use, non-academic writing]
[H2: Who Should Switch to LightspeedGhost? — academic writers, students who need grades]
[FAQ: 5 questions about switching, data safety, price, academic integrity]
[AI disclosure]

INTERNAL LINKS (weave 4+ into sentences): ${tool.path}, /write, /plagiarism, /humanizer, /pricing

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

TRUST SIGNALS TO INCLUDE (for LightspeedGhost):
- Powered by verified academic databases: 25+ sources, 1B+ papers
- Plagiarism ceiling: ≤8% (industry standard is ≤20%)
- Writing reads naturally and reflects the student's own voice; the Humanizer reduces FALSE AI-detection flags (NEVER frame as "0% AI score" or evading detection — note that detectors are unreliable)
- Grade-focused tooling that helps lift a draft toward First Class / A standard
- Price transparency: $9.99/month Starter, PAYG $1.99 minimum
- No lock-in: cancel anytime
- Academic integrity-compliant: writing assistance you review and edit, not content for verbatim submission

REQUIRED STRUCTURE:
<h1>${outline.h1}</h1>
[Opening: acknowledge the trust concern directly — "Skepticism is healthy. Here's what the evidence actually shows." — 2–3 sentences]

[H2: What the Data Shows — 4–5 concrete statistics with honest, real context; do NOT fabricate sources or "(Source: …)" tags. Note any figures are directional.]
[H2: How LightspeedGhost Delivers Results — specific feature-to-outcome mapping, 3–4 examples]
<div class="seo-cta-block">
  <div class="seo-cta-block__text">
    <h3>See the Results for Yourself</h3>
    <p>[1 sentence on the low-risk pay-as-you-go option. ${tool.pricing} · Cancel anytime]</p>
  </div>
  <a class="seo-cta-block__btn" href="${tool.path}">${tool.cta}</a>
</div>
[H2: What to Watch Out For — red flags in this space generally (not specific to LightspeedGhost), builds credibility]
[H2: Honest Limitations — what LightspeedGhost is NOT good for, builds trust through transparency]
[H2: Our Verdict — direct recommendation with caveats]
[FAQ: 5 questions — "is it safe?", "can professors detect AI writing?", "what if I'm not satisfied?", "how does pricing work?", "is it worth it for my situation?"]
[AI disclosure]

INTERNAL LINKS (weave 4+ into sentences): ${tool.path}, /write, /plagiarism, /humanizer, /pricing

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
  /** True if the academic-integrity sanitiser rewrote the text — flag for review. */
  integrityRewritten: boolean;
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

  // gemini-2.5-pro is a thinking model — reasoning tokens count against
  // maxOutputTokens, so it needs generous headroom or it returns empty
  // responses. One retry covers transient empty/truncated outputs.
  let html = "";
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384,
      },
    });
    html = result.response.text();
    usage = result.response.usageMetadata;
    if (html && html.trim().length >= 200) break;
    if (attempt === 2) {
      throw new Error(`Gemini returned ${html ? "near-empty" : "empty"} content after 2 attempts (finishReason: ${result.response.candidates?.[0]?.finishReason ?? "unknown"})`);
    }
    await new Promise((r) => setTimeout(r, 20_000)); // respect 5 req / 5 min free-tier window
  }

  const inputTokens  = usage?.promptTokenCount    ?? 2000;
  const outputTokens = usage?.candidatesTokenCount ?? 2500;

  // Compliance & cleanup
  const integrity = checkAcademicIntegrity(html);
  html = integrity.sanitized;
  if (integrity.rewritten) {
    logger.warn(
      { slug: outline.slug, violations: integrity.violations },
      "[seo-cluster] Content auto-sanitised for academic integrity — flagging page for human review",
    );
  }
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
  const costUsd   = computeCost(GEMINI_PRO_MODEL, inputTokens, outputTokens);

  await logLLMCost({
    taskType:  `seo-cluster-${outline.pageType}`,
    model:     GEMINI_PRO_MODEL,
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
    integrityRewritten: integrity.rewritten,
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
      // Flag sanitiser-rewritten pages as failing so a human reviews the edit.
      validation.integrityCheck && !page.integrityRewritten,
      GEMINI_PRO_MODEL,
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
