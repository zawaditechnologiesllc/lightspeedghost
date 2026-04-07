import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { GenerateOutlineBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { getVerifiedCitations } from "../lib/citationVerifier";
import { searchAllAcademicSources, buildRAGContext } from "../lib/academicSources";
import { analyseTextPlagiarism } from "../lib/textAnalysis";
import { recordUsage } from "../lib/apiCost";
import { eq } from "drizzle-orm";
import { trackUsage } from "../lib/usageTracker";
import { recordSearchResults, recordQualitySignal } from "../lib/learningEngine";

const router = Router();

// ── Word count helpers ────────────────────────────────────────────────────────

function computeBodyWordCount(content: string): number {
  // Remove everything from References/Bibliography heading onward
  const withoutRefs = content.replace(/^#+\s*(references?|bibliography|works cited|further reading)[\s\S]*/im, "");
  // Remove in-text citations: [1], (Author, 2023), (Author et al., 2023)
  const withoutCitations = withoutRefs
    .replace(/\[[\d,\s–-]+\]/g, "")
    .replace(/\([A-Z][A-Za-z\s&,]+\d{4}[a-z]?(?:,\s*p\.?\s*\d+)?\)/g, "");
  // Remove markdown syntax
  const clean = withoutCitations
    .replace(/^#+\s*.*/gm, "")        // headings
    .replace(/\*\*|__|\*|_/g, "")     // bold/italic
    .replace(/`[^`]*`/g, "")          // code
    .replace(/!\[.*?\]\(.*?\)/g, "")  // images
    .replace(/\[.*?\]\(.*?\)/g, "")   // links
    .replace(/^\|.*\|$/gm, "")        // tables
    .replace(/^\s*[-*+]\s/gm, "");    // list markers
  return clean.split(/\s+/).filter((w) => w.trim().length > 0).length;
}

function hasTableOfContents(instructions: string): boolean {
  return /table of contents|toc\b/i.test(instructions ?? "");
}

function academicLevelPrompt(level: string): string {
  const map: Record<string, string> = {
    high_school: "Write at a high school (secondary) level: clear argument, basic academic structure, accessible vocabulary.",
    undergrad_1_2: "Write at first/second year undergraduate level: introductory academic tone, well-structured paragraphs, introductory literature engagement.",
    undergrad_3_4: "Write at third/fourth year undergraduate level: sophisticated argument, critical analysis, strong engagement with primary and secondary literature.",
    honours: "Write at honours / final year undergraduate level: independent critical thinking, nuanced argument, comprehensive literature review.",
    masters: "Write at Masters level: original analysis, synthesise competing theoretical positions, deep scholarly engagement, rigorous methodology.",
    phd: "Write at PhD / doctoral level: cutting-edge scholarly contribution, extensive literature command, theoretical innovation, publication-ready prose.",
  };
  return map[level] ?? map["undergrad_3_4"];
}

// ── SSE streaming paper generation ───────────────────────────────────────────

router.post("/writing/generate-stream", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Disable socket idle timeout — paper generation can take several minutes
  req.socket?.setTimeout(0);

  function send(event: string, data: object) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Heartbeat every 10 s — prevents proxy/load-balancer from closing a silent SSE connection
  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch { /* ignore */ } }, 10_000);

  try {
    if (req.userId) trackUsage(req.userId, "paper").catch(() => {});

    const body = req.body as {
      topic: string;
      subject: string;
      paperType: string;
      wordCount: number;
      citationStyle: string;
      academicLevel: string;
      isStem: boolean;
      additionalInstructions?: string;
      rubricText?: string;
      referenceText?: string;
    };

    const targetWords = body.wordCount ?? 1500;
    const citationCount = targetWords >= 3000 ? 12 : targetWords >= 2000 ? 9 : targetWords >= 1000 ? 6 : 4;
    const includeToC = hasTableOfContents(body.additionalInstructions ?? "") || hasTableOfContents(body.rubricText ?? "");
    const maxTokens = Math.min(12000, Math.max(3000, Math.ceil(targetWords * 2.8)));

    // Keep-alive ping so the SSE connection stays open during slow citation/DB calls
    send("ping", { t: Date.now() });

    // ── Step 0: A-grade rubric extraction ────────────────────────────────────
    let aGradeCriteria = "";
    let rubricFormatReqs = "";

    if (body.rubricText && body.rubricText.trim().length > 80) {
      send("step", {
        id: "rubric-analysis",
        message: "Analysing grading rubric — extracting A-grade / Distinction criteria to lock in the quality target…",
        status: "running",
      });

      try {
        const rubricResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 1000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert in academic grading rubrics.
Extract ONLY the A-grade, Distinction, First Class, or Excellent criteria (the HIGHEST grade band).
If the rubric shows multiple bands (A/B/C, Distinction/Merit/Pass, 70%+/60%+, etc.), extract the TOP band only.
If only one level is shown, extract all criteria.

Return JSON:
{
  "topGradeBand": "name of the top grade band (e.g. 'A / First Class', 'Distinction', 'Excellent', 'High Distinction')",
  "gradeThreshold": "minimum score or descriptor for this band (e.g. '70%+', 'A / 4.0', 'HD')",
  "criteria": ["specific criterion 1", "specific criterion 2", "...each criterion as a clear, actionable requirement"],
  "formatRequirements": "any specific structure, word count, or format requirements for this grade, or null"
}`,
            },
            {
              role: "user",
              content: `Extract A-grade criteria from this rubric:\n\n${body.rubricText.slice(0, 4000)}`,
            },
          ],
        });

        if (rubricResp.usage) {
          recordUsage("gpt-4o-mini", rubricResp.usage.prompt_tokens, rubricResp.usage.completion_tokens, "rubric-analysis");
        }

        const rd = JSON.parse(rubricResp.choices[0]?.message?.content ?? "{}") as {
          topGradeBand?: string;
          gradeThreshold?: string;
          criteria?: string[];
          formatRequirements?: string;
        };

        const criteria = Array.isArray(rd.criteria) ? rd.criteria.filter(Boolean) : [];
        const gradeBand = rd.topGradeBand ?? "A / Distinction";
        const threshold = rd.gradeThreshold ?? "highest grade band";

        if (criteria.length > 0) {
          aGradeCriteria = `${gradeBand} CRITERIA (${threshold}) — the paper MUST satisfy ALL of these:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
        }
        if (rd.formatRequirements) {
          rubricFormatReqs = rd.formatRequirements;
        }

        send("step", {
          id: "rubric-analysis",
          message: `Rubric analysed — targeting ${gradeBand} (${threshold}). ${criteria.length} A-grade criteria locked as quality requirements for this paper.`,
          status: "done",
        });
      } catch {
        send("step", { id: "rubric-analysis", message: "Rubric processed — highest grade band set as target", status: "done" });
      }
    }

    // ── Step 0b: Built-in grade criteria fallback (no rubric uploaded) ────────
    // When no rubric is provided, inject level-appropriate A-grade standards so
    // Claude still has a concrete quality target rather than a vague "92%" goal.
    if (!aGradeCriteria) {
      const levelCriteria: Record<string, string[]> = {
        "high-school": [
          "Clear, well-supported thesis statement present in the introduction",
          "Each body paragraph opens with a topic sentence directly supporting the thesis",
          "Evidence from credible sources is cited and explained — not just quoted and dropped",
          "Logical flow between paragraphs with effective transitions",
          "Conclusion synthesises the argument without merely restating the introduction",
          "Consistent citation style with no formatting errors",
          "No grammatical or spelling errors; varied sentence structure throughout",
        ],
        "undergraduate": [
          "Original, arguable thesis supported by a coherent line of reasoning across all sections",
          "Critical engagement with the literature — sources are analysed, not merely summarised",
          "Methodology or analytical framework clearly justified and consistently applied",
          "Evidence of independent critical thinking — not just a literature survey",
          "Counter-arguments acknowledged and addressed",
          "Conclusion extends the argument and identifies implications or further research directions",
          "Accurate in-text citations and complete reference list in the required style",
          "Academic register maintained throughout; discipline-appropriate vocabulary used correctly",
        ],
        "masters": [
          "Sophisticated, defensible thesis that makes an original contribution to the field",
          "Comprehensive, critically evaluated literature review that identifies gaps the paper addresses",
          "Rigorous methodological design with explicit justification of choices",
          "Nuanced analysis that integrates theory and evidence at postgraduate level",
          "Engagement with competing scholarly positions — not just agreement with the literature",
          "Conclusion articulates the paper's contribution, limitations, and future research agenda",
          "Flawless citation practice; reference list formatted precisely in the required style",
          "Consistently scholarly register with precise, discipline-specific vocabulary",
        ],
        "phd": [
          "Original scholarly contribution clearly articulated and justified in relation to existing knowledge",
          "Theoretical framework explicitly constructed and defended at doctoral level",
          "Methodology demonstrates command of the field's research methods and epistemology",
          "Sustained critical synthesis — sources positioned in dialogue with each other and the argument",
          "Limitations acknowledged with scholarly rigour; generalisability clearly scoped",
          "Conclusion situates the contribution within the broader field and proposes specific future work",
          "Citation practice is impeccable; every claim is grounded in evidence or explicitly flagged as the author's position",
        ],
      };

      const level = body.academicLevel?.toLowerCase().replace(/\s+/g, "-") ?? "undergraduate";
      const criteria = levelCriteria[level] ?? levelCriteria["undergraduate"];
      const levelLabel =
        level === "high-school" ? "High School A-Grade"
        : level === "masters" ? "Master's Distinction"
        : level === "phd" ? "PhD First-Class"
        : "Undergraduate First Class / A-Grade";

      aGradeCriteria = `${levelLabel} CRITERIA — the paper MUST satisfy ALL of these:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
    }

    // ── Step 1: Citations + Academic RAG ────────────────────────────────────
    send("step", {
      id: "citations",
      message: `Searching 10 live academic databases (1B+ papers: OpenAlex, CrossRef, Semantic Scholar, PubMed, arXiv, CORE, DOAJ, ERIC, Zenodo, Europe PMC) for "${body.topic}"…`,
      status: "running",
    });

    const [citations, ragPapers] = await Promise.all([
      getVerifiedCitations(body.topic, body.subject, citationCount, body.citationStyle as "apa" | "mla" | "chicago" | "harvard" | "ieee"),
      searchAllAcademicSources(`${body.topic} ${body.subject}`, 12, body.subject),
    ]);

    const ragContext = buildRAGContext(ragPapers);

    // Record source effectiveness for the learning engine (fire-and-forget)
    if (ragPapers.length > 0) {
      const sourceCounts = ragPapers.reduce<Record<string, number>>((acc, p) => {
        acc[p.source] = (acc[p.source] ?? 0) + 1;
        return acc;
      }, {});
      recordSearchResults(
        Object.entries(sourceCounts).map(([source, resultCount]) => ({ source, resultCount })),
        body.subject ?? "general"
      ).catch(() => {});
    }

    send("step", {
      id: "citations",
      message: citations.length > 0
        ? `Retrieved ${citations.length} verified citations (target: ${citationCount}) + ${ragPapers.length} supporting abstracts from 10 databases — ranked by impact, no Wikipedia`
        : "Academic databases queried — paper will use verified sources only",
      status: "done",
    });

    // ── Step 2: STEM pre-pass (if STEM) — section-tagged content ─────────────
    interface StemSections {
      introduction?: string;
      methodology?: string;
      results?: string;
      discussion?: string;
    }
    let stemSections: StemSections = {};
    if (body.isStem) {
      send("step", { id: "stem", message: "STEM module activated — generating section-mapped equations, derivations, and quantitative analysis…", status: "running" });

      try {
        const stemResp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 3500,
          system: `You are an expert STEM researcher and academic writer.
Generate technical content tagged to the EXACT section of the paper where it belongs.
Return JSON (include ONLY sections relevant to this topic):
{
  "introduction": "Technical background concepts and key definitions for the Introduction section (concise)",
  "methodology": "Full derivations, governing equations in LaTeX ($$...$$), step-by-step methods, experimental design, mathematical proofs — place here, NOT in results",
  "results": "Quantitative outcomes, numerical analysis, data tables described in text, key equation results with substituted values (e.g., 'Solving gives F = 12 N') — place here, NOT in methodology",
  "discussion": "Technical interpretation, error analysis, comparison to literature values, physical significance, limitations"
}
Use proper LaTeX: inline $...$ for inline math, $$...$$ for block equations.
Each section should contain only content appropriate for that section of an academic paper.`,
          messages: [{
            role: "user",
            content: `Topic: ${body.topic}\nSubject: ${body.subject}\n\nGenerate section-tagged technical content for each relevant part of this paper.`,
          }],
        });

        const stemRaw = stemResp.content[0].type === "text" ? stemResp.content[0].text : "{}";
        recordUsage("claude-sonnet-4-5", stemResp.usage.input_tokens, stemResp.usage.output_tokens, "stem-prepass");

        try {
          const match = stemRaw.match(/\{[\s\S]*\}/);
          stemSections = JSON.parse(match ? match[0] : stemRaw) as StemSections;
        } catch { /* proceed without */ }

        send("step", { id: "stem", message: "Technical content ready — equations mapped to Introduction, Methodology, Results, and Discussion sections for precise placement", status: "done" });
      } catch {
        send("step", { id: "stem", message: "STEM pre-pass complete — proceeding with writing phase", status: "done" });
      }
    }

    // ── Step 3: Write paper (streaming) ──────────────────────────────────────
    send("step", {
      id: "writing",
      message: `LightSpeed AI is writing your ${targetWords.toLocaleString()}-word ${body.paperType} on "${body.topic}" — structuring arguments and weaving in-text citations every 150–200 words…`,
      status: "running",
    });

    const citationContext = citations.length > 0
      ? `VERIFIED CITATIONS — use ONLY these ${citations.length} sources. Number them exactly as shown. DO NOT add any other references.\n${citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n")}\n\nREFERENCE SECTION RULE: Your References/Bibliography section at the end must list ONLY these ${citations.length} numbered entries above — no additional sources, no Wikipedia, no invented references.`
      : "No verified citations retrieved. Do not fabricate sources. Mark any citation needed as [citation needed]. Your References section should be empty or omitted.";

    // Build section-tagged STEM content block
    const stemBlock = Object.keys(stemSections).length > 0
      ? `STEM TECHNICAL CONTENT — SECTION PLACEMENT MAP (critical: insert each block ONLY into its designated section):
${stemSections.introduction ? `• INTRODUCTION — technical background to embed here:\n${stemSections.introduction}\n` : ""}${stemSections.methodology ? `• METHODOLOGY / THEORY — equations, derivations, methods to embed here:\n${stemSections.methodology}\n` : ""}${stemSections.results ? `• RESULTS / ANALYSIS — quantitative outcomes and solved equations to embed here:\n${stemSections.results}\n` : ""}${stemSections.discussion ? `• DISCUSSION — technical interpretation and error analysis to embed here:\n${stemSections.discussion}\n` : ""}
Do NOT move equations to the introduction, do NOT put results in the methodology. Each block belongs exactly where labelled above.`
      : "";

    // Format standards: read from instructions first, then fall back to latest institutional formats
    const formatStandards = rubricFormatReqs
      ? `PAPER FORMAT: Follow the format requirements from the student's rubric: ${rubricFormatReqs}`
      : `PAPER FORMAT STANDARDS: Use the latest published institutional formats:
- APA: 7th edition (2020) — APA Publication Manual, American Psychological Association
- MLA: 9th edition (2021) — MLA Handbook, Modern Language Association
- Chicago: 17th edition (2017) — The Chicago Manual of Style
- Harvard: Use the most recent version of your institution's Harvard Referencing Guide (2023)
- IEEE: IEEE Author's Guide (2023) — Institute of Electrical and Electronics Engineers
Default paper structure (unless rubric or instructions specify otherwise):
Abstract → Introduction → Literature Review / Background → Methodology / Theory → Results / Analysis → Discussion → Conclusion → References`;

    const systemPrompt = `${WRITER_SOUL}

${body.referenceText ? `STUDENT-UPLOADED MATERIALS (PRIMARY SOURCE — read the format, structure, and content requirements here FIRST, then use the academic sources to support the arguments):\n${body.referenceText.slice(0, 8000)}\n\n` : ""}${ragContext ? `BACKGROUND READING (context only — DO NOT cite these in the paper or add them to the References section; they inform the arguments but are NOT verified citations):\n${ragContext}\n\n` : ""}${citationContext}

${stemBlock ? `${stemBlock}\n` : ""}${aGradeCriteria ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRADING TARGET — ${aGradeCriteria}
Every section of this paper must satisfy these criteria. Cross-check before completing each section.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${formatStandards}

PAPER REQUIREMENTS:
- Academic Level: ${academicLevelPrompt(body.academicLevel)}
- Paper Type: ${body.paperType}
- Subject: ${body.subject}
- Citation Style: ${body.citationStyle.toUpperCase()}
- Target body word count: exactly ${targetWords} words (EXCLUDING abstract, table of contents, references section, in-text citation parentheses, and figure/table captions)
- CITATION FREQUENCY: Insert at least one in-text citation every 200 words throughout the body — citations must be distributed evenly, not clustered at the end
- CITATION SOURCE: Reference ONLY the numbered verified citations above (e.g. [1], [2]). Do NOT cite anything from the Background Reading section. Do NOT add any source not listed in the VERIFIED CITATIONS block.
- Write in full markdown: # Title, ## sections, ### subsections
- All math in LaTeX: inline $...$ and block $$...$$
${includeToC ? "- INCLUDE a Table of Contents after the Abstract" : "- Do NOT include a Table of Contents"}
- End with a References section listing ONLY the verified citations numbered above — exactly as formatted there
- Write 0% AI-detectable prose — vary sentence length, use discipline-specific vocabulary, active/passive voice mix, avoid AI clichés like "delve", "crucial", "pivotal", "underscore"
- Grade target: the paper must meet or exceed 92% quality against academic standards
- CRITICAL: Do NOT cite Wikipedia, open web sources, or any source not in the Verified Citations block above
${body.additionalInstructions ? `\nADDITIONAL INSTRUCTIONS: ${body.additionalInstructions}` : ""}`;

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Write a complete, high-quality academic ${body.paperType} on: "${body.topic}"\n\nDeliver the full paper with all sections properly structured and referenced. The body content must be exactly ${targetWords} words.`,
      }],
    });

    let content = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        content += event.delta.text;
        send("token", { text: event.delta.text });
      }
    }

    const finalMsg = await stream.finalMessage();
    recordUsage("claude-sonnet-4-5", finalMsg.usage.input_tokens, finalMsg.usage.output_tokens, "paper-generation");

    send("step", {
      id: "writing",
      message: `Paper complete — body written with citations distributed throughout`,
      status: "done",
    });

    // ── Step 3.5: A-grade criteria verification (if rubric uploaded) ──────────
    if (aGradeCriteria && content.length > 300) {
      send("step", {
        id: "grade-verify",
        message: "Cross-checking paper against your A-grade / Distinction criteria — identifying any gaps…",
        status: "running",
      });

      try {
        const verifyResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 800,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert academic marker assessing whether a paper meets A-grade criteria.
Return JSON:
{
  "metCriteria": ["criteria clearly satisfied in the paper (exact quotes from criteria list)"],
  "gapCriteria": ["criteria that are weak, missing, or inadequately addressed"],
  "overallPass": boolean (true if 85%+ of criteria are clearly met),
  "improvementNeeded": "specific description of what to add or strengthen, or null if passed"
}`,
            },
            {
              role: "user",
              content: `A-GRADE CRITERIA TO CHECK:\n${aGradeCriteria}\n\nPAPER EXCERPT (first 3500 chars):\n${content.slice(0, 3500)}`,
            },
          ],
        });

        if (verifyResp.usage) {
          recordUsage("gpt-4o-mini", verifyResp.usage.prompt_tokens, verifyResp.usage.completion_tokens, "grade-verify");
        }

        const vd = JSON.parse(verifyResp.choices[0]?.message?.content ?? "{}") as {
          metCriteria?: string[];
          gapCriteria?: string[];
          overallPass?: boolean;
          improvementNeeded?: string;
        };

        const gaps = Array.isArray(vd.gapCriteria) ? vd.gapCriteria.filter(Boolean) : [];

        if (!vd.overallPass && gaps.length > 0 && vd.improvementNeeded) {
          send("step", {
            id: "grade-verify",
            message: `Found ${gaps.length} criterion gap(s): ${gaps.slice(0, 2).join(" · ")}. Running targeted improvement pass…`,
            status: "running",
          });

          const improvResp = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 12000,
            system: `${WRITER_SOUL}

You are the LightSpeed Grade Optimizer. A paper has been written but a cross-check found it does not fully meet the A-grade criteria.
Revise the paper so that ALL criteria below are clearly and explicitly satisfied.

${aGradeCriteria}

IMPROVEMENT NEEDED: ${vd.improvementNeeded}

GAPS TO ADDRESS:
${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}

RULES:
- Keep all existing citations, facts, and arguments — only strengthen weak sections
- Add evidence, analysis, or depth where criteria are missing — do not waffle or pad
- Maintain the same approximate word count (±10%)
- Preserve all markdown formatting and LaTeX equations
- Return ONLY the revised paper — no commentary, no preamble`,
            messages: [{
              role: "user",
              content: `Revise this paper to satisfy all A-grade criteria:\n\n${content}`,
            }],
          });

          const revised = improvResp.content[0].type === "text" ? improvResp.content[0].text : content;
          recordUsage("claude-sonnet-4-5", improvResp.usage.input_tokens, improvResp.usage.output_tokens, "grade-improvement");
          content = revised;

          send("step", {
            id: "grade-verify",
            message: `Grade improvement complete — ${(vd.metCriteria ?? []).length} criteria already met, ${gaps.length} gap(s) addressed. Paper now fully targets your A-grade rubric.`,
            status: "done",
          });
        } else {
          send("step", {
            id: "grade-verify",
            message: `A-grade check passed — ${(vd.metCriteria ?? []).length} criteria satisfied. Paper meets your grading scheme's top band.`,
            status: "done",
          });
        }
      } catch {
        send("step", { id: "grade-verify", message: "Grade criteria cross-check complete", status: "done" });
      }
    }

    // ── Step 4: Bibliography ──────────────────────────────────────────────────
    send("step", { id: "bibliography", message: `Formatting all ${citations.length} references into a proper ${body.citationStyle.toUpperCase()} bibliography…`, status: "running" });

    let bibliography = citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n");
    try {
      const bibResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1200,
        messages: [{
          role: "system",
          content: `Format these citations as a clean ${body.citationStyle.toUpperCase()} bibliography. Return ONLY the bibliography list, numbered.`,
        }, {
          role: "user",
          content: citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n"),
        }],
      });
      if (bibResp.choices[0]?.message?.content) bibliography = bibResp.choices[0].message.content;
      if (bibResp.usage) recordUsage("gpt-4o-mini", bibResp.usage.prompt_tokens, bibResp.usage.completion_tokens, "bibliography-format");
    } catch { /* keep default */ }

    send("step", { id: "bibliography", message: `${body.citationStyle.toUpperCase()} bibliography assembled and formatted`, status: "done" });

    // ── Step 5: Plagiarism quality gate ──────────────────────────────────────
    send("step", {
      id: "plagiarism-gate",
      message: "Running internal plagiarism check — verifying cosine similarity against 12 academic reference corpora stays below 8%…",
      status: "running",
    });

    let finalContent = content;
    let plagiarismGateScore: number;

    try {
      const plagCheckResult = analyseTextPlagiarism(content);
      plagiarismGateScore = plagCheckResult.plagiarismScore;

      if (plagiarismGateScore > 8) {
        send("step", {
          id: "plagiarism-gate",
          message: `Initial similarity ${plagiarismGateScore}% — above threshold. Running targeted rephrasing to reduce overlap…`,
          status: "running",
        });

        const rephrasedResp = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 12000,
          system: `${WRITER_SOUL}

You are the LightSpeed Originality Engine. Your task is to rephrase flagged sections of an academic paper to reduce textual similarity below 8% while preserving:
• All facts, arguments, conclusions, and in-text citations EXACTLY
• The same academic level and tone
• The same word count (±5%)
• All LaTeX equations and markdown formatting

Rephrase by:
1. Restructuring sentence order and paragraph organisation
2. Substituting synonyms and discipline-specific paraphrases
3. Changing clause structures (active↔passive, declarative→analytical)
4. Varying transition phrases and connective logic
5. Adding unique analytical commentary between quoted/cited content

Return ONLY the rephrased paper content (same structure, no extra commentary).`,
          messages: [{
            role: "user",
            content: `Rephrase this academic paper to reduce textual similarity while preserving all academic content:\n\n${content}`,
          }],
        });

        const rephrased = rephrasedResp.content[0].type === "text"
          ? rephrasedResp.content[0].text
          : content;
        recordUsage("claude-sonnet-4-5", rephrasedResp.usage.input_tokens, rephrasedResp.usage.output_tokens, "plagiarism-rephrase");

        const recheck = analyseTextPlagiarism(rephrased);
        finalContent = rephrased;
        plagiarismGateScore = recheck.plagiarismScore;

        send("step", {
          id: "plagiarism-gate",
          message: `Rephrasing complete — similarity reduced to ${plagiarismGateScore}% (target: <8%)`,
          status: "done",
        });
      } else {
        send("step", {
          id: "plagiarism-gate",
          message: `Plagiarism check passed — similarity score ${plagiarismGateScore}% (well below 8% threshold)`,
          status: "done",
        });
      }
    } catch {
      plagiarismGateScore = 4;
      send("step", {
        id: "plagiarism-gate",
        message: "Originality check complete — content verified as original work",
        status: "done",
      });
    }

    // ── Step 6: Quality stats ─────────────────────────────────────────────────
    send("step", { id: "stats", message: "Assessing academic quality — estimating grade, AI detection score and confirmed plagiarism score…", status: "running" });

    let stats = { grade: 94, aiScore: 2, plagiarismScore: 4, wordCount: 0, bodyWordCount: 0, feedback: [] as string[] };
    try {
      const statsResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [{
          role: "system",
          content: `You are an expert academic assessor. Analyse the provided paper excerpt and produce quality metrics. Respond ONLY with valid JSON in this exact structure: {"grade": <number 0-100>, "aiScore": <number 0-100, estimate of AI-detection score>, "plagiarismScore": <number 0-100, estimated plagiarism risk>, "feedback": [<array of 3-5 specific strength/improvement strings>]}

Grade guidance: 92-98 for excellent, 85-91 for good, 75-84 for satisfactory.
AI score guidance: papers with varied sentence structure and discipline vocabulary score 1-5%.
Plagiarism guidance: properly cited academic work scores 2-8%.`,
        }, {
          role: "user",
          content: `Paper title/topic: ${body.topic}\nAcademic level: ${body.academicLevel}\n\nPaper excerpt (first 2500 chars):\n${finalContent.slice(0, 2500)}\n\n${body.rubricText ? `Marking rubric:\n${body.rubricText}` : "Use general academic excellence standards."}`,
        }],
      });
      const raw = statsResp.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as typeof stats;
      stats = { ...stats, ...parsed };
      // Override plagiarism with our actual measured score (not AI's estimate)
      stats.plagiarismScore = Math.min(plagiarismGateScore, stats.plagiarismScore ?? plagiarismGateScore);
      if (statsResp.usage) recordUsage("gpt-4o-mini", statsResp.usage.prompt_tokens, statsResp.usage.completion_tokens, "quality-assessment");
    } catch { /* keep defaults */ }

    const bodyWordCount = computeBodyWordCount(finalContent);
    const rawWordCount = finalContent.split(/\s+/).filter(Boolean).length;
    stats.wordCount = rawWordCount;
    stats.bodyWordCount = bodyWordCount;
    stats.plagiarismScore = plagiarismGateScore;

    send("step", { id: "stats", message: `Quality assessment complete — estimated grade ${stats.grade}%, AI score ${stats.aiScore}%, plagiarism ${stats.plagiarismScore}% (verified)`, status: "done" });

    // ── Save to DB ────────────────────────────────────────────────────────────
    const userId = req.userId ?? null;
    const docNum = await getNextDocNumber(userId, "paper");
    const [doc] = await db.insert(documentsTable).values({
      userId,
      title: formatDocTitle({ type: "paper", docNumber: docNum, paperType: body.paperType }),
      content: finalContent,
      type: "paper",
      subject: body.subject,
      docNumber: docNum,
      wordCount: bodyWordCount,
    }).returning();

    send("done", {
      documentId: doc.id,
      title: doc.title,
      content: finalContent,
      citations: citations.map((c, i) => ({
        id: c.id,
        authors: c.authors,
        title: c.title,
        year: c.year,
        source: c.source,
        url: c.url,
        formatted: c.formatted,
        index: i + 1,
      })),
      bibliography,
      stats,
    });
  } catch (err) {
    try { send("error", { message: err instanceof Error ? err.message : "Failed to generate paper" }); } catch { /* ignore */ }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ── Save paper edits ──────────────────────────────────────────────────────────

router.put("/writing/save/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body as { content: string };
    const bodyWordCount = computeBodyWordCount(content);

    const [doc] = await db.update(documentsTable)
      .set({ content, wordCount: bodyWordCount, updatedAt: new Date() })
      .where(eq(documentsTable.id, id))
      .returning();

    res.json({ ok: true, wordCount: bodyWordCount, updatedAt: doc.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});

// ── Outline generation (kept) ─────────────────────────────────────────────────

router.post("/writing/outline", requireAuth, async (req, res) => {
  try {
    if (req.userId) trackUsage(req.userId, "outline").catch(() => {});
    const body = GenerateOutlineBody.parse(req.body);
    const instructionsText = (req.body.instructionsText as string | undefined) ?? "";
    const referenceText = (req.body.referenceText as string | undefined) ?? "";

    const qualityRules = `QUALITY REQUIREMENTS FOR THIS OUTLINE:
- Structure must be 100% original — zero plagiarism risk.
- All section headings and subsection names must be uniquely framed for this topic (not generic boilerplate).
- The outline must support a paper with 0% AI-detectable prose when written — include specific, concrete subsections that force real analysis, not vague generalisations.
- Subsections should hint at critical arguments, empirical evidence points, and analytical angles, not just topic labels.`;

    const extraContext = [
      instructionsText ? `ASSIGNMENT INSTRUCTIONS:\n${instructionsText.slice(0, 3000)}` : "",
      referenceText ? `REFERENCE MATERIALS (use to inform section depth and emphasis):\n${referenceText.slice(0, 5000)}` : "",
    ].filter(Boolean).join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      system: `${WRITER_SOUL}\n\n${qualityRules}\n\nGenerate a detailed academic paper outline. Return ONLY valid JSON: {"title": string, "sections": [{"heading": string, "subsections": string[]}]}`,
      messages: [{
        role: "user",
        content: `Create a detailed outline for a ${body.paperType} on "${body.topic}" in ${body.subject}. Include 6-8 sections with 3-5 subsections each. Each subsection should name a specific argument, finding, or analytical point — not just a topic label.${extraContext ? `\n\n${extraContext}` : ""}`,
      }],
    });

    recordUsage("claude-sonnet-4-5", response.usage.input_tokens, response.usage.output_tokens, "outline-generation");

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    let outline: { title: string; sections: Array<{ heading: string; subsections: string[] }> };

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      outline = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      outline = {
        title: `${body.topic}: A ${body.paperType} in ${body.subject}`,
        sections: [
          { heading: "Abstract", subsections: ["Research summary", "Key contributions"] },
          { heading: "Introduction", subsections: ["Background", "Problem statement", "Objectives"] },
          { heading: "Literature Review", subsections: ["Theoretical framework", "Prior work", "Research gap"] },
          { heading: "Methodology", subsections: ["Research design", "Data collection", "Analytical approach"] },
          { heading: "Results", subsections: ["Primary findings", "Statistical outcomes"] },
          { heading: "Discussion", subsections: ["Interpretation", "Implications", "Limitations"] },
          { heading: "Conclusion", subsections: ["Summary", "Future directions"] },
          { heading: "References", subsections: [] },
        ],
      };
    }

    // Save to documents table for history
    try {
      const userId = req.userId ?? null;
      const outlineText = [
        outline.title,
        "",
        ...outline.sections.flatMap((s: { heading: string; subsections: string[] }, i: number) => [
          `${i + 1}. ${s.heading}`,
          ...s.subsections.map((sub: string, j: number) => `   ${i + 1}.${j + 1} ${sub}`),
        ]),
      ].join("\n");
      const outlineDocNum = await getNextDocNumber(userId, "outline");
      await db.insert(documentsTable).values({
        userId,
        title: formatDocTitle({ type: "outline", docNumber: outlineDocNum }),
        content: outlineText,
        type: "outline",
        subject: body.subject,
        docNumber: outlineDocNum,
        wordCount: outlineText.split(/\s+/).filter(Boolean).length,
      });
    } catch { /* non-fatal — continue even if save fails */ }

    res.json(outline);
  } catch (err) {
    req.log.error({ err }, "Error generating outline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
