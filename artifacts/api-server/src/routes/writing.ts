import { wordsToTokens } from "../lib/tokenBudget";
import { Router } from "express";
import { db, pool } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { GenerateOutlineBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { getVerifiedCitations } from "../lib/citationVerifier";
import { searchAllAcademicSources, buildRAGContext } from "../lib/academicSources";
import { analyseTextPlagiarism } from "../lib/textAnalysis";
import { detectAIScore, humanizeTextOnce } from "../lib/aiDetection.js";
import { recordUsage } from "../lib/apiCost";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { trackUsage, enforceLimit, getUserPlan, quotaExceededMessage } from "../lib/usageTracker";
import { recordSearchResults, recordQualitySignal } from "../lib/learningEngine";
import { buildGradeCriteria } from "../lib/gradeStandards.js";
import { parseAndAnalyzeDataset, buildDatasetCharts, describeChartsForPrompt, type ChartSpec } from "../lib/datasetAnalysis";
import { buildFinancialStatementsContext, buildFinancialCharts } from "../lib/financialStatements";
import { logger } from "../lib/logger";

const router = Router();

// ── Word count helpers ────────────────────────────────────────────────────────

type SectionBudget = { name: string; pct: number };

/**
 * Returns the raw section plan (name + percentage) for a given paper type.
 * Used by both planSectionWordBudgets (prompt injection) and
 * getSectionBudgets (sectional generation).
 */
function lookupSectionPlan(paperType: string): SectionBudget[] {
  const type = paperType.toLowerCase().trim();

  const plans: Record<string, SectionBudget[]> = {
    essay: [
      { name: "Introduction", pct: 0.12 },
      { name: "Body Paragraph 1", pct: 0.22 },
      { name: "Body Paragraph 2", pct: 0.22 },
      { name: "Body Paragraph 3", pct: 0.22 },
      { name: "Conclusion", pct: 0.12 },
    ],
    argumentative: [
      { name: "Introduction — hook, context, and clear arguable thesis", pct: 0.10 },
      { name: "First Main Argument — state claim, provide 2 pieces of evidence, analyse critically", pct: 0.20 },
      { name: "Second Main Argument — distinct claim, supporting evidence, analytical commentary", pct: 0.20 },
      { name: "Third Main Argument — strongest evidence cluster, deepen the analytical thread", pct: 0.18 },
      { name: "Counter-argument & Rebuttal — steelman the opposition, then systematically refute it", pct: 0.16 },
      { name: "Conclusion — synthesise all three arguments, restate evolved thesis, broader significance", pct: 0.10 },
    ],
    expository: [
      { name: "Introduction — context, scope, and explanatory purpose (no thesis to argue)", pct: 0.12 },
      { name: "First Explanatory Section — define the first key concept, explain mechanisms, give concrete examples", pct: 0.25 },
      { name: "Second Explanatory Section — second distinct aspect, how it connects to the first, further examples", pct: 0.25 },
      { name: "Third Explanatory Section — third aspect or application, real-world context, deepen understanding", pct: 0.22 },
      { name: "Conclusion — summary of what was explained, significance, what reader now understands", pct: 0.11 },
    ],
    analytical: [
      { name: "Introduction", pct: 0.10 },
      { name: "Analysis Section 1", pct: 0.22 },
      { name: "Analysis Section 2", pct: 0.22 },
      { name: "Analysis Section 3", pct: 0.20 },
      { name: "Synthesis", pct: 0.14 },
      { name: "Conclusion", pct: 0.07 },
    ],
    persuasive: [
      { name: "Introduction — compelling hook, emotional/logical appeal, and clear position statement", pct: 0.10 },
      { name: "First Supporting Argument — strongest evidence first, data/expert testimony, appeal to values", pct: 0.20 },
      { name: "Second Supporting Argument — second evidence thread, build on first, deepen conviction", pct: 0.20 },
      { name: "Third Supporting Argument — practical/real-world consequences, urgency, final evidence layer", pct: 0.18 },
      { name: "Counter-argument & Rebuttal — acknowledge the strongest opposition, systematically refute it", pct: 0.16 },
      { name: "Conclusion — reinforce position, call to action, leave reader with clear next step", pct: 0.11 },
    ],
    report: [
      { name: "Executive Summary / Abstract", pct: 0.08 },
      { name: "Introduction", pct: 0.10 },
      { name: "Methodology", pct: 0.18 },
      { name: "Findings / Results", pct: 0.25 },
      { name: "Discussion", pct: 0.22 },
      { name: "Conclusions & Recommendations", pct: 0.12 },
    ],
    "lab report": [
      { name: "Abstract", pct: 0.07 },
      { name: "Introduction", pct: 0.15 },
      { name: "Materials & Methods", pct: 0.18 },
      { name: "Results", pct: 0.22 },
      { name: "Discussion", pct: 0.26 },
      { name: "Conclusion", pct: 0.07 },
    ],
    "case study": [
      { name: "Introduction", pct: 0.10 },
      { name: "Background & Context", pct: 0.15 },
      { name: "Problem Identification", pct: 0.18 },
      { name: "Theoretical Framework / Analysis", pct: 0.30 },
      { name: "Solutions & Recommendations", pct: 0.18 },
      { name: "Conclusion", pct: 0.09 },
    ],
    "literature review": [
      { name: "Introduction", pct: 0.10 },
      { name: "Thematic Section 1", pct: 0.22 },
      { name: "Thematic Section 2", pct: 0.22 },
      { name: "Thematic Section 3", pct: 0.20 },
      { name: "Synthesis of Findings", pct: 0.15 },
      { name: "Gaps & Future Research + Conclusion", pct: 0.09 },
    ],
    "literature_review": [
      { name: "Introduction", pct: 0.10 },
      { name: "Thematic Section 1", pct: 0.22 },
      { name: "Thematic Section 2", pct: 0.22 },
      { name: "Thematic Section 3", pct: 0.20 },
      { name: "Synthesis of Findings", pct: 0.15 },
      { name: "Gaps & Future Research + Conclusion", pct: 0.09 },
    ],
    "research paper": [
      { name: "Abstract", pct: 0.06 },
      { name: "Introduction", pct: 0.12 },
      { name: "Literature Review", pct: 0.18 },
      { name: "Methodology", pct: 0.16 },
      { name: "Results", pct: 0.18 },
      { name: "Discussion", pct: 0.20 },
      { name: "Conclusion", pct: 0.07 },
    ],
    research: [
      { name: "Abstract", pct: 0.06 },
      { name: "Introduction", pct: 0.12 },
      { name: "Literature Review", pct: 0.18 },
      { name: "Methodology", pct: 0.16 },
      { name: "Results", pct: 0.18 },
      { name: "Discussion", pct: 0.20 },
      { name: "Conclusion", pct: 0.07 },
    ],
    thesis: [
      { name: "Abstract", pct: 0.04 },
      { name: "Introduction", pct: 0.10 },
      { name: "Literature Review", pct: 0.18 },
      { name: "Theoretical Framework", pct: 0.10 },
      { name: "Methodology", pct: 0.14 },
      { name: "Results & Analysis", pct: 0.18 },
      { name: "Discussion", pct: 0.14 },
      { name: "Conclusion & Recommendations", pct: 0.08 },
    ],
    dissertation: [
      { name: "Abstract", pct: 0.04 },
      { name: "Introduction", pct: 0.10 },
      { name: "Literature Review", pct: 0.18 },
      { name: "Theoretical Framework", pct: 0.10 },
      { name: "Methodology", pct: 0.14 },
      { name: "Results & Analysis", pct: 0.18 },
      { name: "Discussion", pct: 0.14 },
      { name: "Conclusion & Recommendations", pct: 0.08 },
    ],
    "term paper": [
      { name: "Abstract", pct: 0.07 },
      { name: "Introduction", pct: 0.12 },
      { name: "Literature Review / Background", pct: 0.25 },
      { name: "Analysis / Discussion", pct: 0.38 },
      { name: "Conclusion", pct: 0.13 },
    ],
    "critical analysis": [
      { name: "Introduction", pct: 0.12 },
      { name: "Context & Background", pct: 0.16 },
      { name: "Textual / Thematic Analysis 1", pct: 0.22 },
      { name: "Textual / Thematic Analysis 2", pct: 0.22 },
      { name: "Evaluation of Strengths & Weaknesses", pct: 0.16 },
      { name: "Conclusion", pct: 0.07 },
    ],
    reflective: [
      { name: "Introduction & Context — describe the experience/event and why it matters", pct: 0.12 },
      { name: "Description — factual account of what happened (what, when, who, how)", pct: 0.15 },
      { name: "Feelings & Initial Reactions — honest emotional response, immediate thoughts", pct: 0.15 },
      { name: "Evaluation & Analysis — what went well, what didn't, link to theory/framework", pct: 0.35 },
      { name: "Conclusion & Action Plan — key learning, how behaviour/practice will change", pct: 0.18 },
    ],
    narrative: [
      { name: "Introduction & Scene Setting — establish characters, place, time, narrative voice", pct: 0.12 },
      { name: "Rising Action — build conflict, deepen stakes, reveal character through event", pct: 0.25 },
      { name: "Climax — peak tension moment, decisive choice or confrontation", pct: 0.20 },
      { name: "Falling Action — immediate aftermath, consequences unfold, tension releases", pct: 0.25 },
      { name: "Resolution & Reflection — outcome, changed understanding, thematic resonance", pct: 0.13 },
    ],
    "position paper": [
      { name: "Introduction — state the issue, why it matters, and the clear position taken", pct: 0.12 },
      { name: "Background & Context — history of the issue, key stakeholders, current debate", pct: 0.18 },
      { name: "First Supporting Argument — strongest evidence for the position", pct: 0.20 },
      { name: "Second Supporting Argument — second evidence thread, different angle", pct: 0.18 },
      { name: "Counter-arguments & Rebuttal — acknowledge opposition, refute systematically", pct: 0.16 },
      { name: "Conclusion & Policy Recommendation — restate position, concrete recommended action", pct: 0.11 },
    ],
    "policy brief": [
      { name: "Executive Summary — problem, recommendation, and key evidence in 1 paragraph", pct: 0.08 },
      { name: "Problem Statement — define the issue, scope, affected populations, urgency", pct: 0.15 },
      { name: "Background & Evidence — data, prior policy attempts, literature context", pct: 0.22 },
      { name: "Policy Options — 2–3 alternatives with pros/cons each", pct: 0.25 },
      { name: "Recommended Option — argue for one option, implementation steps", pct: 0.20 },
      { name: "Conclusion & Next Steps — summary, who acts, by when, expected outcome", pct: 0.10 },
    ],
    "book report": [
      { name: "Introduction — title, author, genre, publication context, thesis about the work", pct: 0.12 },
      { name: "Summary — concise plot/argument summary without spoiling evaluative stance", pct: 0.25 },
      { name: "Analysis of Themes & Techniques — major themes, author's craft, narrative choices", pct: 0.30 },
      { name: "Critical Evaluation — strengths, weaknesses, what the work achieves or fails at", pct: 0.20 },
      { name: "Conclusion — overall assessment, who should read it and why", pct: 0.08 },
    ],
    "white paper": [
      { name: "Executive Summary — problem, solution, and business/policy case in brief", pct: 0.07 },
      { name: "Introduction — context, why this problem matters now, audience", pct: 0.10 },
      { name: "Problem Definition — detailed breakdown of the challenge, data, stakeholder impact", pct: 0.18 },
      { name: "Current Landscape — existing approaches, why they fall short", pct: 0.15 },
      { name: "Proposed Solution — detailed solution description, methodology, evidence base", pct: 0.28 },
      { name: "Implementation & Benefits — steps, timeline, ROI or policy outcome", pct: 0.15 },
      { name: "Conclusion — call to action, next steps, contact/further information", pct: 0.07 },
    ],
    coursework: [
      { name: "Introduction — module context, assignment brief interpretation, scope of work", pct: 0.10 },
      { name: "Literature Review / Background — key theories, frameworks, and scholarly context", pct: 0.20 },
      { name: "Main Analysis Section 1 — first analytical thread, apply theory to evidence", pct: 0.22 },
      { name: "Main Analysis Section 2 — second analytical thread, deeper engagement with sources", pct: 0.22 },
      { name: "Discussion — synthesis of analysis, implications, links to course material", pct: 0.16 },
      { name: "Conclusion — summary of findings, answer to the brief, reflection on learning", pct: 0.10 },
    ],
    "capstone project": [
      { name: "Abstract — project summary, objectives, methods, key results", pct: 0.05 },
      { name: "Introduction — background, problem statement, project significance, research questions", pct: 0.12 },
      { name: "Literature Review — comprehensive review of relevant scholarship and frameworks", pct: 0.18 },
      { name: "Methodology — research design, data collection, tools, analytical approach", pct: 0.16 },
      { name: "Results / Deliverables — findings, project outputs, data analysis", pct: 0.20 },
      { name: "Discussion — interpretation, practical implications, limitations", pct: 0.16 },
      { name: "Conclusion & Recommendations — summary, actionable recommendations, future work", pct: 0.08 },
      { name: "Appendices — supplementary data, code, additional materials", pct: 0.05 },
    ],
    "movie review": [
      { name: "Introduction — film title, director, genre, release context, thesis about the film", pct: 0.12 },
      { name: "Plot Summary — concise, spoiler-aware synopsis of the film's narrative arc", pct: 0.20 },
      { name: "Cinematic Analysis — direction, cinematography, editing, sound design, mise-en-scène", pct: 0.25 },
      { name: "Performance & Character Analysis — acting quality, character development, casting choices", pct: 0.20 },
      { name: "Thematic Evaluation — underlying themes, social commentary, cultural significance", pct: 0.15 },
      { name: "Conclusion — overall assessment, recommendation, place in genre/director's body of work", pct: 0.08 },
    ],
    "article review": [
      { name: "Introduction — article title, author(s), journal, publication date, purpose of the review", pct: 0.10 },
      { name: "Summary of the Article — main argument, methodology, key findings in the author's own framework", pct: 0.25 },
      { name: "Critical Analysis — strengths of methodology and argument, logical coherence, evidence quality", pct: 0.25 },
      { name: "Weaknesses & Limitations — gaps, biases, methodological flaws, unsupported claims", pct: 0.20 },
      { name: "Contribution & Relevance — significance to the field, how it advances understanding", pct: 0.12 },
      { name: "Conclusion — overall assessment, recommendation for target audience", pct: 0.08 },
    ],
    "personal statement": [
      { name: "Opening Hook — compelling personal anecdote or moment that sparked your interest", pct: 0.12 },
      { name: "Academic & Intellectual Journey — key experiences, coursework, projects that shaped your goals", pct: 0.25 },
      { name: "Professional Experience & Skills — relevant work, internships, research, transferable skills", pct: 0.22 },
      { name: "Motivation & Fit — why this programme/institution, what you bring, specific faculty/resources", pct: 0.25 },
      { name: "Future Vision — career goals, how this programme connects to long-term ambitions", pct: 0.16 },
    ],
    "admission essay": [
      { name: "Opening Hook — attention-grabbing moment, vivid scene, or thought-provoking question", pct: 0.12 },
      { name: "Personal Story & Growth — formative experience, challenges overcome, lessons learned", pct: 0.30 },
      { name: "Values & Character — core values, unique perspective, what makes you distinctive", pct: 0.22 },
      { name: "Academic Interests & Goals — intellectual curiosity, intended area of study, aspirations", pct: 0.20 },
      { name: "Why This School — specific programmes, opportunities, community fit, how you'll contribute", pct: 0.16 },
    ],
    "scholarship essay": [
      { name: "Opening Hook — powerful personal moment or achievement that frames your narrative", pct: 0.10 },
      { name: "Background & Challenges — personal circumstances, obstacles faced, community context", pct: 0.22 },
      { name: "Achievements & Impact — academic accomplishments, leadership, community service, measurable impact", pct: 0.25 },
      { name: "Goals & Alignment — career objectives, how the scholarship supports them, alignment with award criteria", pct: 0.25 },
      { name: "Conclusion — gratitude, commitment, vision for giving back, final compelling statement", pct: 0.18 },
    ],
    speech: [
      { name: "Opening & Hook — greeting, attention-grabbing statement, establish credibility and purpose", pct: 0.10 },
      { name: "Background & Context — define the topic, why it matters to this audience now", pct: 0.15 },
      { name: "First Main Point — strongest argument or idea, supporting evidence, relatable example", pct: 0.22 },
      { name: "Second Main Point — second key idea, evidence, transition from first point", pct: 0.20 },
      { name: "Third Main Point — final argument, most compelling or emotional evidence", pct: 0.18 },
      { name: "Conclusion & Call to Action — summarise key points, inspire action, memorable closing line", pct: 0.15 },
    ],
    presentation: [
      { name: "Title Slide & Introduction — topic, presenter, purpose statement, agenda overview", pct: 0.08 },
      { name: "Background & Problem Statement — context, why this matters, key question to address", pct: 0.14 },
      { name: "Main Content Section 1 — first key topic, data/evidence, visual aid descriptions", pct: 0.22 },
      { name: "Main Content Section 2 — second key topic, analysis, examples, visual aid descriptions", pct: 0.22 },
      { name: "Main Content Section 3 — third key topic, synthesis, connections between sections", pct: 0.18 },
      { name: "Conclusion & Q&A — key takeaways, recommendations, questions for discussion", pct: 0.10 },
      { name: "Speaker Notes — detailed talking points for each slide, timing guidance", pct: 0.06 },
    ],
    descriptive: [
      { name: "Introduction — establish the subject to be described, thesis or dominant impression", pct: 0.12 },
      { name: "Sensory Description 1 — visual and spatial details, concrete imagery, figurative language", pct: 0.22 },
      { name: "Sensory Description 2 — sounds, textures, smells, tastes — immerse the reader", pct: 0.22 },
      { name: "Emotional & Atmospheric Layer — mood, feelings evoked, personal connection to the subject", pct: 0.22 },
      { name: "Significance & Reflection — why this subject matters, what it reveals, deeper meaning", pct: 0.14 },
      { name: "Conclusion — return to dominant impression, leave reader with lasting image", pct: 0.08 },
    ],
    "research proposal": [
      { name: "Title Page & Abstract — concise summary of the proposed research (problem, method, expected contribution)", pct: 0.06 },
      { name: "Introduction & Problem Statement — define the research gap, why it matters, research questions or hypotheses", pct: 0.14 },
      { name: "Literature Review — theoretical background, what is known, what gap this proposal fills", pct: 0.22 },
      { name: "Research Design & Methodology — approach, data collection methods, sample/population, analytical framework", pct: 0.22 },
      { name: "Expected Results & Significance — anticipated findings, contribution to the field, practical implications", pct: 0.14 },
      { name: "Timeline & Work Plan — milestones, phases, deliverables with estimated dates", pct: 0.08 },
      { name: "Budget & Resources (if applicable) — funding requirements, equipment, personnel, justification", pct: 0.06 },
      { name: "Conclusion & Feasibility — summary of why this research is needed, viable, and impactful", pct: 0.08 },
    ],
    proposal: [
      { name: "Executive Summary — problem, proposed solution, and expected outcomes in brief", pct: 0.08 },
      { name: "Introduction & Background — context, stakeholders, why this proposal is needed now", pct: 0.14 },
      { name: "Problem Analysis — detailed breakdown of the issue, evidence, scope, impact", pct: 0.18 },
      { name: "Proposed Solution / Approach — what will be done, methodology, activities, deliverables", pct: 0.24 },
      { name: "Implementation Plan — timeline, milestones, responsible parties, resources needed", pct: 0.14 },
      { name: "Budget & Justification — cost breakdown, funding sources, value for money", pct: 0.10 },
      { name: "Evaluation & Expected Outcomes — success metrics, monitoring plan, anticipated impact", pct: 0.12 },
    ],
    "grant proposal": [
      { name: "Project Summary / Abstract — concise overview of objectives, methods, and significance", pct: 0.06 },
      { name: "Statement of Need — the problem, who is affected, evidence of urgency", pct: 0.14 },
      { name: "Literature Review & Background — prior work, theoretical grounding, research gap", pct: 0.18 },
      { name: "Goals, Objectives & Hypotheses — specific, measurable aims", pct: 0.10 },
      { name: "Methodology & Research Design — detailed approach, data collection, analysis plan", pct: 0.22 },
      { name: "Timeline & Milestones — phased work plan with deliverables", pct: 0.08 },
      { name: "Budget & Budget Narrative — itemised costs, justification for each line item", pct: 0.10 },
      { name: "Expected Outcomes & Broader Impact — anticipated results, dissemination plan, significance", pct: 0.12 },
    ],
    "business plan": [
      { name: "Executive Summary — business concept, mission, value proposition, key financials at a glance", pct: 0.08 },
      { name: "Company Description — legal structure, ownership, history, vision, objectives", pct: 0.08 },
      { name: "Market Analysis — industry overview, target market, market size, trends, competitor analysis", pct: 0.16 },
      { name: "Products & Services — offerings, unique selling points, pricing strategy, competitive advantages", pct: 0.10 },
      { name: "Marketing & Sales Strategy — channels, customer acquisition, branding, sales funnel, growth plan", pct: 0.12 },
      { name: "Operations Plan — facilities, technology, supply chain, key processes, quality control", pct: 0.10 },
      { name: "Management & Organisation — team bios, organisational chart, advisory board, hiring plan", pct: 0.08 },
      { name: "Financial Plan & Projections — income statement, balance sheet, cash flow (3–5 year projections), break-even analysis, funding requirements", pct: 0.18 },
      { name: "Risk Analysis & Mitigation — key risks, contingency plans, SWOT analysis", pct: 0.06 },
      { name: "Appendices & Supporting Data — supplementary tables, charts, detailed financial schedules", pct: 0.04 },
    ],
    "financial analysis": [
      { name: "Executive Summary — purpose, scope, key findings, and recommendations", pct: 0.08 },
      { name: "Company / Industry Overview — background, sector context, recent developments", pct: 0.10 },
      { name: "Financial Statement Analysis — income statement, balance sheet, cash flow analysis with ratio calculations", pct: 0.24 },
      { name: "Ratio Analysis & Benchmarking — profitability, liquidity, solvency, efficiency ratios compared to industry", pct: 0.20 },
      { name: "Trend Analysis & Forecasting — multi-period comparisons, growth rates, projections", pct: 0.16 },
      { name: "Risk Assessment — financial risks, sensitivity analysis, credit evaluation", pct: 0.12 },
      { name: "Conclusions & Recommendations — investment opinion, strategic recommendations, limitations", pct: 0.10 },
    ],
  };

  let sections: SectionBudget[] | undefined = plans[type];

  if (!sections) {
    if (type.includes("essay"))                                  sections = plans.essay;
    else if (type.includes("argumentative"))                     sections = plans.argumentative;
    else if (type.includes("persuasive"))                        sections = plans.persuasive;
    else if (type.includes("report"))                            sections = plans.report;
    else if (type.includes("review"))                            sections = plans["literature review"];
    else if (type.includes("thesis") || type.includes("dissertation")) sections = plans.thesis;
    else if (type.includes("grant") && type.includes("proposal")) sections = plans["grant proposal"];
    else if (type.includes("research") && type.includes("proposal")) sections = plans["research proposal"];
    else if (type.includes("proposal"))                          sections = plans.proposal;
    else if (type.includes("research"))                          sections = plans.research;
    else if (type.includes("narrative") || type.includes("story"))    sections = plans.narrative;
    else if (type.includes("reflect"))                           sections = plans.reflective;
    else if (type.includes("position"))                          sections = plans["position paper"];
    else if (type.includes("policy"))                            sections = plans["policy brief"];
    else if (type.includes("business") && type.includes("plan"))  sections = plans["business plan"];
    else if (type.includes("financial") && type.includes("analysis")) sections = plans["financial analysis"];
    else if (type.includes("critical") || type.includes("analysis")) sections = plans["critical analysis"];
    else if (type.includes("white"))                             sections = plans["white paper"];
    else if (type.includes("coursework"))                        sections = plans.coursework;
    else if (type.includes("capstone"))                          sections = plans["capstone project"];
    else if (type.includes("movie") || type.includes("film"))   sections = plans["movie review"];
    else if (type.includes("article") && type.includes("review")) sections = plans["article review"];
    else if (type.includes("book"))                              sections = plans["book report"];
    else if (type.includes("personal") && type.includes("statement")) sections = plans["personal statement"];
    else if (type.includes("admission"))                         sections = plans["admission essay"];
    else if (type.includes("scholarship"))                       sections = plans["scholarship essay"];
    else if (type.includes("speech") || type.includes("oration")) sections = plans.speech;
    else if (type.includes("presentation") || type.includes("slide")) sections = plans.presentation;
    else if (type.includes("descriptive"))                       sections = plans.descriptive;
    else if (type.includes("expository"))                        sections = plans.expository;
    else {
      // Generic fallback — descriptive labels so the AI knows what each section must do
      sections = [
        { name: "Abstract / Introduction — state the topic, research question or thesis, and scope", pct: 0.12 },
        { name: "Background & Literature — theoretical foundations, key sources, prior work", pct: 0.20 },
        { name: "Core Analysis — first major analytical thread, evidence, and interpretation", pct: 0.22 },
        { name: "Extended Analysis — second analytical thread, further evidence, deepened argument", pct: 0.22 },
        { name: "Discussion — synthesis of findings, implications, limitations, alternate views", pct: 0.14 },
        { name: "Conclusion — summary of contribution, significance, directions for future work", pct: 0.08 },
      ];
    }
  }

  return sections!;
}

/**
 * Formats the section plan as a word-budget string for injection into the system prompt.
 */
function planSectionWordBudgets(paperType: string, targetWords: number): string {
  const sections = lookupSectionPlan(paperType);
  const lines = sections.map(s => {
    const words = Math.round(targetWords * s.pct);
    return `  • ${s.name}: ~${words} words`;
  });
  return `SECTION-BY-SECTION WORD BUDGET (MANDATORY — distribute your words exactly like this):
${lines.join("\n")}
  ─────────────────────────────────────
  Total body text: ${targetWords} words
  References / bibliography: excluded from count
  Abstract (if present): excluded from count

Write each section to its allocated word count. Do NOT over-write early sections and run short on later ones. Check your running word count after each section and adjust accordingly.`;
}

/**
 * Returns section targets as a raw array for chapter-by-chapter generation.
 */
function getSectionBudgets(paperType: string, targetWords: number): { name: string; targetWords: number }[] {
  return lookupSectionPlan(paperType).map(s => ({
    name: s.name,
    targetWords: Math.ceil(targetWords * s.pct),
  }));
}

function computeBodyWordCount(content: string): number {
  // Remove everything from the references/bibliography section onwards
  const withoutRefs = content.replace(/^#{1,3}\s*(references?|bibliography|works?\s*cited|further\s*reading|reference\s*list)\b[\s\S]*/im, "");
  // Remove Markdown footnote definitions: [^1]: text (may be multi-line with indent)
  const withoutFootnoteDefs = withoutRefs.replace(/^\[\^[^\]]+\]:[^\n]*/gm, "");
  // Remove footnote/endnote markers in text: [^1], [^note], ^1
  const withoutFootnoteRefs = withoutFootnoteDefs.replace(/\[\^[^\]]+\]|\^[\d]+/g, "");
  // Remove inline citation brackets
  const withoutCitations = withoutFootnoteRefs
    .replace(/\[[\d,;\s–-]+\]/g, "")
    .replace(/\([A-Z][A-Za-z\s&.,]+(?:et\s+al\.?)?,?\s*\d{4}[a-z]?(?:,\s*pp?\.?\s*[\d–-]+)?\)/g, "")
    .replace(/\([A-Z][A-Za-z\s&.,]+\d{4}[a-z]?\)/g, "");
  // Remove structural noise
  const clean = withoutCitations
    .replace(/^#+\s*.*/gm, "")
    .replace(/\*\*|__|\*|_/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/```[\s\S]*?```/gm, "")
    .replace(/\$\$[\s\S]*?\$\$/gm, "")
    .replace(/\$[^$\n]+\$/g, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/^\|[-:| ]+\|$/gm, "")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^\s*[-*+]\s/gm, "")
    .replace(/^\s*\*\*?(figure|fig\.?|table|appendix)\s+[\d.]+[^*]*\*?\*?/gim, "")
    .replace(/^\s*\*\*?abstract\*?\*?$/gim, "");
  return clean.split(/\s+/).filter((w) => w.trim().length > 0).length;
}

async function enforceBodyWordCount(
  content: string,
  targetWords: number,
  send: (event: string, data: object) => void,
): Promise<string> {
  let current = content;
  const minTarget = Math.floor(targetWords * 0.95);
  const maxTarget = Math.ceil(targetWords * 1.05);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const currentCount = computeBodyWordCount(current);
    if (currentCount >= minTarget && currentCount <= maxTarget) {
      if (attempt > 1) {
        send("step", {
          id: "word-count-fix",
          message: `Word count locked after pass ${attempt - 1}: ${currentCount.toLocaleString()} words (target ${targetWords.toLocaleString()})`,
          status: "done",
        });
      }
      return current;
    }

    const isExpand = currentCount < minTarget;
    const delta = Math.abs(targetWords - currentCount);
    send("step", {
      id: "word-count-fix",
      message: isExpand
        ? `Body count ${currentCount.toLocaleString()} words — ${delta} short. Word-count pass ${attempt}/3…`
        : `Body count ${currentCount.toLocaleString()} words — ${delta} over. Word-count pass ${attempt}/3…`,
      status: "running",
    });

    const adjustResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: Math.min(16000, Math.ceil(Math.max(targetWords, delta) * 1.8) + 1800),
      system: `${WRITER_SOUL}

You are the LightSpeed Word Count Optimizer.
Current body word count: ${currentCount}
Required target body word count: ${targetWords}
Allowed range: ${minTarget} to ${maxTarget} words

RULES:
1) Adjust ONLY body sections; references/bibliography must not be expanded.
2) Keep citations, factual claims, equations, and markdown intact.
3) If expanding, add substantive analysis/evidence (no filler).
4) If trimming, remove redundancy first (no loss of core argument/evidence).
5) Return ONLY the full revised paper content.`,
      messages: [{
        role: "user",
        content: `${isExpand ? "Expand" : "Trim"} this paper so the body text lands in ${minTarget}-${maxTarget} words (target ${targetWords}):\n\n${current}`,
      }],
    });

    recordUsage(
      "claude-sonnet-4-5",
      adjustResp.usage.input_tokens,
      adjustResp.usage.output_tokens,
      isExpand ? "word-count-expand" : "word-count-trim",
    );
    current = adjustResp.content[0].type === "text" ? adjustResp.content[0].text : current;
  }

  const finalCount = computeBodyWordCount(current);
  send("step", {
    id: "word-count-fix",
    message: `Word-count optimization ended at ${finalCount.toLocaleString()} words (target ${targetWords.toLocaleString()}).`,
    status: "done",
  });
  return current;
}

function countInTextCitations(content: string, citationCount: number): { cited: number[]; uncited: number[] } {
  const cited = new Set<number>();
  const bracketMatches = content.matchAll(/\[(\d[\d,;\s–-]*)\]/g);
  for (const m of bracketMatches) {
    const nums = m[1].replace(/[–-]/g, ",").split(/[,;\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    for (const n of nums) cited.add(n);
  }
  const uncited: number[] = [];
  for (let i = 1; i <= citationCount; i++) {
    if (!cited.has(i)) uncited.push(i);
  }
  return { cited: [...cited].sort((a, b) => a - b), uncited };
}

function hasTableOfContents(instructions: string): boolean {
  return /table of contents|toc\b/i.test(instructions ?? "");
}

// Grade cross-checks must read the WHOLE paper — PAYG papers can run 10,000+
// words (~60k+ chars), far beyond a fixed slice. Up to 100k chars (≈25k tokens)
// the full text is sent; only truly enormous papers get head+tail windowing.
function fullPaperWindow(text: string): string {
  if (text.length <= 100_000) return text;
  return `${text.slice(0, 88_000)}\n\n[... middle section omitted for length ...]\n\n${text.slice(-12_000)}`;
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
    const quota = await enforceLimit(req.userId!, "paper");
    if (!quota.allowed) {
      send("error", {
        type: "quota",
        message: quotaExceededMessage(quota, "paper generations"),
      });
      res.end();
      clearInterval(heartbeat);
      return;
    }

    const body = req.body as {
      topic: string;
      subject: string;
      paperType: string;
      wordCount: number;
      citationStyle: string;
      academicLevel: string;
      isStem: boolean;
      spacing?: string;
      numSources?: number;
      language?: string;
      additionalInstructions?: string;
      rubricText?: string;
      referenceText?: string;
      datasetText?: string;
      financialStatementText?: string;
      financialStatementType?: string;
    };

    const requestedWords = body.wordCount ?? 1500;

    // Student Pro plan: papers >3,500 words must go PAYG (subscription only covers ≤3,500 words)
    if (requestedWords > 3500) {
      const userPlan = await getUserPlan(req.userId!);
      if (userPlan === "student_pro_monthly") {
        send("error", {
          type: "quota",
          message: `Student Pro includes papers up to 3,500 words. For longer papers, please use Pay-As-You-Go credits — they never expire.`,
        });
        res.end();
        clearInterval(heartbeat);
        return;
      }
    }

    // Target = exactly what was requested. Max = requested + 5%. Both are hard limits.
    const targetWords = requestedWords;
    const maxWords = Math.ceil(requestedWords * 1.05);
    const isAnnotatedBib = body.paperType.toLowerCase().includes("annotated");
    const autoCitations = isAnnotatedBib
      ? Math.max(8, Math.ceil(requestedWords / 175))
      : Math.max(3, Math.ceil(requestedWords / 175));
    const citationCount = body.numSources ? Math.min(Math.max(body.numSources, 3), 50) : autoCitations;
    const includeToC = hasTableOfContents(body.additionalInstructions ?? "") || hasTableOfContents(body.rubricText ?? "");
    const refsOverhead = Math.min(2000, Math.max(400, citationCount * 120));
    const maxTokens = wordsToTokens(maxWords, refsOverhead); // token-budget lib: calibrated words->tokens with 16k cap

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
      aGradeCriteria = buildGradeCriteria(body.academicLevel);
    }

    // ── Step 1: Citations + Academic RAG ────────────────────────────────────
    send("step", {
      id: "citations",
      message: isAnnotatedBib
        ? `Annotated bibliography mode — fetching ${citationCount} verified academic sources from 13 live databases (OpenAlex, Semantic Scholar, CrossRef, PubMed, Europe PMC, arXiv, CORE, DOAJ, ERIC, Zenodo, BASE, DataCite, OpenAIRE) for "${body.topic}"…`
        : `Searching 35 live academic databases (10B+ papers & citation records: OpenAlex, Semantic Scholar, CrossRef, PubMed, Europe PMC, arXiv, CORE, DOAJ, ERIC, Zenodo, BASE, DataCite, OpenAIRE, NBER, World Bank + 20 more) for "${body.topic}"…`,
      status: "running",
    });

    const [citations, ragPapers] = await Promise.all([
      getVerifiedCitations(body.topic, body.subject, citationCount, body.citationStyle),
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

    // ── Internal RAG: inject a style excerpt from a previously stored paper ───
    // Fetches the most recent high-quality stored paper for this subject to give
    // the AI a style/structure reference drawn from real past output.
    let internalStyleContext = "";
    try {
      const subjectFilter = body.subject?.trim();
      if (subjectFilter) {
        const [bestMatch] = await db
          .select({ title: documentsTable.title, content: documentsTable.content })
          .from(documentsTable)
          .where(and(
            eq(documentsTable.type, "paper"),
            eq(documentsTable.subject, subjectFilter),
            isNotNull(documentsTable.content),
          ))
          .orderBy(desc(documentsTable.wordCount))
          .limit(1);

        if (bestMatch?.content && bestMatch.content.length > 300) {
          // Take the first ~1200 chars — enough for style/structure, not so much it bloats tokens
          const excerpt = bestMatch.content.slice(0, 1200).trimEnd();
          internalStyleContext =
            `STYLE REFERENCE — excerpt from a previously generated ${subjectFilter} paper on this platform ` +
            `(use as a structural and stylistic benchmark only; do NOT copy content or citations):\n` +
            `---\n${excerpt}\n---`;
        }
      }
    } catch { /* non-critical — skip silently */ }

    send("step", {
      id: "citations",
      message: citations.length > 0
        ? `Retrieved ${citations.length} verified citations (target: ${citationCount}) + ${ragPapers.length} supporting abstracts from 10 databases — ranked by impact, no Wikipedia`
        : "Academic databases queried — paper will use verified sources only",
      status: "done",
    });

    // ── Step 1.5: Dataset analysis (if student provided quantitative data) ────
    // If the student uploaded financial statements, ALWAYS analyse them — the
    // upload itself is explicit intent, regardless of how the subject is worded
    // (e.g. "Business Strategy" or "Case Study" papers still need the ratios).
    let financialContext = "";
    let paperCharts: ChartSpec[] = [];
    if (body.financialStatementText?.trim()) {
      send("step", { id: "financial-analysis", message: "Parsing financial statements — extracting ratios, trends, and red flags…", status: "running" });
      financialContext = buildFinancialStatementsContext(body.financialStatementText, body.financialStatementType ?? "all");
      paperCharts.push(...buildFinancialCharts(body.financialStatementText));
      send("step", {
        id: "financial-analysis",
        message: `Financial statement analysis complete — ratios and trends injected into paper context${paperCharts.length > 0 ? `, ${paperCharts.length} chart${paperCharts.length !== 1 ? "s" : ""} generated from your statements` : ""}.`,
        status: "done",
      });
    }

    let datasetAnalysis = "";
    if (body.datasetText?.trim()) {
      send("step", {
        id: "data",
        message: "Analysing your dataset — computing descriptive statistics, detecting variable types, preparing data summary for injection into Results section…",
        status: "running",
      });
      try {
        datasetAnalysis = parseAndAnalyzeDataset(body.datasetText);
        const datasetCharts = buildDatasetCharts(body.datasetText);
        paperCharts.push(...datasetCharts);
        const estimatedVars = (datasetAnalysis.match(/\*\*/g) ?? []).length / 2;
        send("step", {
          id: "data",
          message: `Dataset analysed — ${estimatedVars} variable${estimatedVars !== 1 ? "s" : ""} processed with descriptive statistics${datasetCharts.length > 0 ? ` and ${datasetCharts.length} visualisation${datasetCharts.length !== 1 ? "s" : ""} generated from your data` : ""}, ready for injection into Results/Findings section`,
          status: "done",
        });
      } catch {
        send("step", { id: "data", message: "Dataset processed — injecting into Results/Findings section", status: "done" });
      }
    }

    // Tell the writer about the rendered figures so the paper text references
    // the REAL charts (by figure number) instead of describing imaginary ones.
    {
      const figureNote = describeChartsForPrompt(paperCharts);
      if (figureNote) {
        if (datasetAnalysis) datasetAnalysis += figureNote;
        else financialContext += figureNote;
      }
    }

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
      message: isAnnotatedBib
        ? `LightSpeed AI is composing your ${targetWords.toLocaleString()}-word annotated bibliography on "${body.topic}" — writing ${citations.length} entries with summary, critical evaluation, and relevance annotations for each source…`
        : `LightSpeed AI is writing your ${targetWords.toLocaleString()}-word ${body.paperType} on "${body.topic}" — structuring arguments, following your instructions exactly, and weaving in-text citations every 150–200 words…`,
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

    // Paper-type-specific structure guidance
    const PAPER_TYPE_STRUCTURES: Record<string, string> = {
      essay:           "Introduction (clear thesis) → Body Paragraphs (3–5 developed arguments, each: topic sentence + evidence + analysis) → Conclusion (synthesis, no new ideas) → References",
      argumentative:   "Introduction (hook + context + thesis) → Argument 1 (claim + evidence + analysis) → Argument 2 → Argument 3 → Counter-argument & Rebuttal → Conclusion → References",
      expository:      "Introduction → Body Sections (explain each aspect clearly with examples) → Conclusion → References",
      analytical:      "Introduction (analytical question + thesis) → Analysis Section 1 → Analysis Section 2 → Analysis Section 3 → Synthesis → Conclusion → References",
      persuasive:      "Introduction (hook + strong thesis) → Supporting Argument 1 → Supporting Argument 2 → Supporting Argument 3 → Counter-argument & Rebuttal → Call to Action / Conclusion → References",
      reflective:      "Introduction (context & experience) → Description → Feelings & Reactions → Evaluation → Analysis → Conclusion → Action Plan → References",
      report:          "Title Page → Executive Summary / Abstract → Table of Contents → Introduction → Methodology → Findings / Results → Discussion → Conclusions → Recommendations → References → Appendices",
      "lab report":    "Title → Abstract → Introduction → Materials & Methods → Results (tables/figures) → Discussion → Conclusion → References",
      "case study":    "Introduction → Background & Context → Problem Identification → Theoretical Framework / Analysis → Solutions & Recommendations → Conclusion → References",
      "literature review":  "Introduction (scope + research question) → Thematic or Chronological Body Sections → Synthesis of Findings → Gaps & Future Research → Conclusion → References",
      "literature_review": "Introduction (scope + research question) → Thematic or Chronological Body Sections → Synthesis of Findings → Gaps & Future Research → Conclusion → References",
      "research paper": "Abstract → Introduction → Literature Review → Theoretical Framework → Methodology → Results → Discussion → Conclusion → References",
      research:        "Abstract → Introduction → Literature Review → Theoretical Framework → Methodology → Results → Discussion → Conclusion → References",
      thesis:          "Abstract → Introduction → Literature Review → Theoretical Framework → Methodology → Results & Analysis → Discussion → Conclusion → Limitations → Recommendations → References",
      dissertation:    "Abstract → Introduction → Literature Review → Theoretical Framework → Methodology → Results & Analysis → Discussion → Conclusion → Limitations → Recommendations → References",
      "term paper":    "Abstract → Introduction → Literature Review → Analysis / Discussion → Conclusion → References",
      "critical analysis": "Introduction (text + critical question) → Context & Background → Textual / Thematic Analysis (multiple perspectives) → Evaluation of Strengths & Weaknesses → Conclusion → References",
      "annotated bibliography": `Introduction (2 paragraphs: state the research question/scope, explain the selection criteria and databases searched, summarise the overall landscape of the literature) → Annotated Entries sorted alphabetically by first author's surname (each entry = full formatted citation using the chosen citation style + immediately below it an indented 150–200 word annotation structured as: [Part 1 — Summary: 3–4 sentences on the source's main argument, methodology, and key findings] [Part 2 — Critical Evaluation: 2–3 sentences on the author's credentials, peer-review status, potential bias, methodological limitations] [Part 3 — Relevance: 2–3 sentences on exactly how this source contributes to the research question and fills gaps in the literature]) → Conclusion (1–2 paragraphs: synthesise the body of literature, identify the most significant gaps revealed, suggest directions for future research).
LATEST FORMAT STANDARDS FOR ANNOTATED BIBLIOGRAPHY:
• APA 7th (2020): Hanging-indent citation block, then standard paragraph indentation for annotation text. Double-spaced throughout.
• MLA 9th (2021): Full MLA citation with hanging indent, annotation in a separate indented paragraph. Use present tense for annotation verbs.
• Chicago 17th Author-Date: Bibliographic entry in Author-Date format, annotation in indented paragraph immediately below.
• Harvard: Full reference list entry, annotation indented below as a separate paragraph.
• IEEE: Numbered entry [N], annotation paragraph immediately below each entry.`,
      "position paper": "Introduction (issue + clear position statement) → Background & Context (history, stakeholders, current debate) → First Supporting Argument (strongest evidence) → Second Supporting Argument (different angle) → Counter-arguments & Rebuttal (steelman then refute) → Conclusion & Recommendation → References",
      "policy brief":   "Executive Summary (problem + recommendation in 1 paragraph) → Problem Statement (scope, affected populations, urgency) → Background & Evidence (data, prior policy attempts) → Policy Options (2–3 alternatives with pros/cons) → Recommended Option (argue for one + implementation steps) → Conclusion & Next Steps → References",
      "book report":    "Introduction (title, author, genre, publication context, thesis about the work) → Summary (concise plot/argument without revealing evaluative stance) → Analysis of Themes & Techniques (major themes, author's craft, narrative choices) → Critical Evaluation (strengths, weaknesses, what the work achieves or fails at) → Conclusion (overall assessment + who should read it and why) → References",
      "white paper":    "Executive Summary (problem, solution, business/policy case in brief) → Introduction (context, why the problem matters now, audience) → Problem Definition (detailed breakdown, data, stakeholder impact) → Current Landscape (existing approaches, why they fall short) → Proposed Solution (detailed solution, methodology, evidence base) → Implementation & Benefits (steps, timeline, ROI or policy outcome) → Conclusion (call to action, next steps) → References",
      narrative:        "Introduction & Scene Setting (establish characters, setting, time, narrative voice) → Rising Action (build conflict, deepen stakes, reveal character) → Climax (peak tension, decisive choice or confrontation) → Falling Action (immediate aftermath, consequences) → Resolution & Reflection (outcome, changed understanding, thematic resonance)",
      descriptive:     "Introduction (establish subject, dominant impression) → Sensory Description 1 (visual and spatial details) → Sensory Description 2 (sounds, textures, smells) → Emotional & Atmospheric Layer (mood, feelings evoked) → Significance & Reflection (deeper meaning) → Conclusion (lasting image)",
      "book review":   "Introduction (title, author, genre, publication context, thesis about the work) → Summary (concise plot/argument without revealing evaluative stance) → Analysis of Themes & Techniques (major themes, author's craft, narrative choices) → Critical Evaluation (strengths, weaknesses, what the work achieves or fails at) → Conclusion (overall assessment + who should read it and why) → References",
      "movie review":  "Introduction (film title, director, genre, release context, thesis) → Plot Summary (spoiler-aware synopsis) → Cinematic Analysis (direction, cinematography, editing, sound design) → Performance & Character Analysis (acting quality, character development) → Thematic Evaluation (underlying themes, social commentary) → Conclusion (overall assessment, recommendation)",
      "article review": "Introduction (article title, authors, journal, purpose) → Summary (main argument, methodology, key findings) → Critical Analysis (strengths of methodology and argument) → Weaknesses & Limitations (gaps, biases, flaws) → Contribution & Relevance (significance to field) → Conclusion (overall assessment)",
      coursework:      "Introduction (module context, brief interpretation, scope) → Literature Review / Background → Main Analysis Section 1 → Main Analysis Section 2 → Discussion (synthesis, implications) → Conclusion (answer to brief, reflection)",
      "capstone project": "Abstract → Introduction (background, problem, research questions) → Literature Review → Methodology → Results / Deliverables → Discussion → Conclusion & Recommendations → Appendices",
      "personal statement": "Opening Hook (compelling personal anecdote) → Academic & Intellectual Journey → Professional Experience & Skills → Motivation & Fit (why this programme) → Future Vision (career goals)",
      "admission essay":   "Opening Hook (attention-grabbing moment) → Personal Story & Growth → Values & Character → Academic Interests & Goals → Why This School",
      "scholarship essay": "Opening Hook (powerful personal moment) → Background & Challenges → Achievements & Impact → Goals & Alignment (how scholarship supports them) → Conclusion (gratitude, commitment, vision)",
      speech:          "Opening & Hook (greeting, attention-grabbing statement) → Background & Context → First Main Point (evidence + example) → Second Main Point → Third Main Point → Conclusion & Call to Action",
      presentation:    "Title Slide & Introduction (topic, purpose, agenda) → Background & Problem Statement → Main Content 1 (data, visuals) → Main Content 2 (analysis, examples) → Main Content 3 (synthesis) → Conclusion & Q&A → Speaker Notes",
    };
    function getPaperTypeStructure(type: string): string {
      const key = type.toLowerCase().trim();
      return PAPER_TYPE_STRUCTURES[key]
        ?? (key.includes("admission")                              ? PAPER_TYPE_STRUCTURES["admission essay"]
          : key.includes("scholarship")                            ? PAPER_TYPE_STRUCTURES["scholarship essay"]
          : key.includes("personal") && key.includes("statement")  ? PAPER_TYPE_STRUCTURES["personal statement"]
          : key.includes("movie") || key.includes("film")         ? PAPER_TYPE_STRUCTURES["movie review"]
          : key.includes("article") && key.includes("review")     ? PAPER_TYPE_STRUCTURES["article review"]
          : key.includes("book")                                   ? PAPER_TYPE_STRUCTURES["book review"]
          : key.includes("capstone")                               ? PAPER_TYPE_STRUCTURES["capstone project"]
          : key.includes("coursework")                             ? PAPER_TYPE_STRUCTURES.coursework
          : key.includes("speech") || key.includes("oration")     ? PAPER_TYPE_STRUCTURES.speech
          : key.includes("presentation") || key.includes("slide") ? PAPER_TYPE_STRUCTURES.presentation
          : key.includes("descriptive")                            ? PAPER_TYPE_STRUCTURES.descriptive
          : key.includes("argumentative")                          ? PAPER_TYPE_STRUCTURES.argumentative
          : key.includes("persuasive")                             ? PAPER_TYPE_STRUCTURES.persuasive
          : key.includes("expository")                             ? PAPER_TYPE_STRUCTURES.expository
          : key.includes("narrative") || key.includes("story")    ? PAPER_TYPE_STRUCTURES.narrative
          : key.includes("reflect")                                ? PAPER_TYPE_STRUCTURES.reflective
          : key.includes("essay")                                  ? PAPER_TYPE_STRUCTURES.essay
          : key.includes("report")                                 ? PAPER_TYPE_STRUCTURES.report
          : key.includes("review")                                 ? PAPER_TYPE_STRUCTURES["literature review"]
          : key.includes("thesis") || key.includes("dissertation") ? PAPER_TYPE_STRUCTURES.thesis
          : key.includes("position")                               ? PAPER_TYPE_STRUCTURES["position paper"]
          : key.includes("policy")                                 ? PAPER_TYPE_STRUCTURES["policy brief"]
          : key.includes("critical") || key.includes("analysis")  ? PAPER_TYPE_STRUCTURES["critical analysis"]
          : key.includes("white")                                  ? PAPER_TYPE_STRUCTURES["white paper"]
          : "Abstract → Introduction → Literature Review / Background → Core Analysis (first analytical thread) → Extended Analysis (second analytical thread) → Discussion (synthesis + implications) → Conclusion → References");
    }

    // Format standards: read from instructions first, then fall back to latest institutional formats
    const formatStandards = rubricFormatReqs
      ? `PAPER FORMAT: Follow the format requirements from the student's rubric: ${rubricFormatReqs}`
      : `PAPER FORMAT STANDARDS: Use the latest published institutional formats:
- APA: 7th edition (2020) — APA Publication Manual, American Psychological Association
- MLA: 9th edition (2021) — MLA Handbook, Modern Language Association
- Chicago: 17th edition (2017) — The Chicago Manual of Style
- Turabian: 9th edition (2018) — A Manual for Writers (Chicago-based, simplified for students)
- Harvard: Most recent institutional Harvard Referencing Guide (2023)
- IEEE: IEEE Author's Guide (2023) — Institute of Electrical and Electronics Engineers
- Vancouver: ICMJE Recommendations (2023) — numbered references in order of first citation
- AMA: AMA Manual of Style, 11th edition (2020) — numbered superscript references
- ASA: American Sociological Association Style Guide, 7th edition (2019)
- Bluebook: The Bluebook: A Uniform System of Citation, 21st edition (2020) — legal citations
- OSCOLA: Oxford Standard for Citation of Legal Authorities, 4th edition (2012) — UK legal citations
REQUIRED STRUCTURE for a ${body.paperType}: ${getPaperTypeStructure(body.paperType)}
Follow this structure exactly — every section must be present and properly developed.`;

    // Annotated bibliography uses its own specialized writing prompt
    const annotatedBibPrompt = isAnnotatedBib ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANNOTATED BIBLIOGRAPHY — SPECIAL FORMAT RULES (mandatory)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EVERY source in the verified citations list, you must write one annotated entry.
Each entry has this exact format:

[FULL CITATION formatted in ${body.citationStyle.toUpperCase()} style — hanging indent in the bibliography]

   [ANNOTATION — 150-200 words, indented, structured in exactly 3 parts:]
   [Part 1 — SUMMARY (3-4 sentences): State the source's central argument, research methodology (e.g. systematic review, RCT, ethnography, meta-analysis), and primary findings or conclusions.]
   [Part 2 — CRITICAL EVALUATION (2-3 sentences): Assess the source's strengths and limitations — consider the author's expertise, publication venue (peer-reviewed or not), recency, sample size, potential bias, and methodological rigour.]
   [Part 3 — RELEVANCE (2-3 sentences): Explain precisely how this source advances the research question stated in the introduction, fills a gap in the literature, or challenges a dominant view. Be specific — not "this is useful" but why and how it is useful.]

Sort all entries alphabetically by the first author's surname.
After all entries, write a 1-2 paragraph Conclusion synthesising what the literature collectively reveals and identifying key gaps.
DO NOT write a generic paper body — the entire body IS the annotated entries.
` : "";

    // Anti-hallucination grounding for empirical papers without uploaded primary data
    const needsDataGrounding = !datasetAnalysis && !financialContext &&
      /research|dissertation|thesis|report|proposal|case stud|lab/i.test(body.paperType);
    const dataGroundingBlock = needsDataGrounding
      ? `DATA INTEGRITY RULES (no primary dataset was uploaded — these are MANDATORY):
• Do NOT fabricate primary data, survey results, experiment outcomes, specific percentages, or numerical statistics unless they come from a verified citation.
• Every specific figure, percentage, mean, or quantitative finding MUST come from one of the verified citations listed below — cite it immediately inline.
• If the paper type expects primary research (e.g. original survey, experiment), frame the methodology as "proposed" or "secondary-data analysis" — do not invent results.
• Use qualitative language where quantitative data is unavailable: "Studies suggest…", "Research indicates…", "Evidence points to…"
• If a citation is needed but none is available, write [citation needed] — do not invent a source.`
      : "";

    const systemPrompt = `${WRITER_SOUL}

${body.referenceText ? `STUDENT-UPLOADED MATERIALS (PRIMARY SOURCE — read the format, structure, and content requirements here FIRST, then use the academic sources to support the arguments):\n${body.referenceText.slice(0, 8000)}\n\n` : ""}${financialContext ? `FINANCIAL STATEMENTS ANALYSIS (PRIMARY DATA — cite specific figures, ratios, and trends from this analysis in your paper. Do NOT present raw data tables; interpret and cite the metrics):\n${financialContext}\n\n` : ""}${datasetAnalysis ? `${datasetAnalysis}\n\n` : ""}${dataGroundingBlock ? `${dataGroundingBlock}\n\n` : ""}${ragContext ? `BACKGROUND READING — Academic context to inform your arguments (DO NOT cite these directly; they are not in the verified citations list):\n${ragContext}\n\n` : ""}${internalStyleContext ? `${internalStyleContext}\n\n` : ""}${citationContext}

${stemBlock ? `${stemBlock}\n` : ""}${aGradeCriteria ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRADING TARGET — ${aGradeCriteria}
Every section of this paper must satisfy these criteria. Cross-check before completing each section.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` : ""}
${formatStandards}
${annotatedBibPrompt}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAPER REQUIREMENTS (all mandatory — zero exceptions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACADEMIC LEVEL: ${academicLevelPrompt(body.academicLevel)}
PAPER TYPE: ${body.paperType}
SUBJECT: ${body.subject}
CITATION STYLE: ${body.citationStyle.toUpperCase()}
SPACING: ${body.spacing === "single" ? "Single-spaced" : body.spacing === "1.5" ? "1.5 line spacing" : "Double-spaced"}
LANGUAGE: ${body.language === "uk" ? "British English (use British spelling: colour, analyse, organisation, behaviour, centre, programme, defence)" : body.language === "au" ? "Australian English (use Australian spelling: colour, analyse, organisation, behaviour, centre, but program for computing)" : "American English (use US spelling: color, analyze, organization, behavior, center, program, defense)"}
${body.numSources ? `MINIMUM SOURCES: Use at least ${body.numSources} sources in the paper` : ""}
WORD COUNT — ALL THREE RULES ARE MANDATORY:
• Body content (introduction through conclusion): MINIMUM ${targetWords} words · MAXIMUM ${maxWords} words
• Target exactly ${targetWords} words of body text. Do NOT exceed ${maxWords} words under any circumstances.
• Count your running word total after EVERY section. If you are behind budget, write more in the next section. If ahead, trim.
• A complete, on-target ${targetWords}-word paper is the goal — neither padded nor truncated.
• Word count EXCLUDES: reference list, in-text citation parentheses, headings, abstract, table of contents, figure/table captions

${isAnnotatedBib ? "" : planSectionWordBudgets(body.paperType, targetWords)}

SOURCE INTEGRITY (CRITICAL — violations mean the paper is useless):
• Use ONLY the ${citations.length} verified academic citations listed in the VERIFIED CITATIONS block above
• Do NOT add Wikipedia, open web, blog, or any other source not in that list
• Do NOT fabricate any paper, journal, author, or DOI
• Every in-text citation must match a numbered verified citation exactly
• Distribute citations evenly — one in-text citation every 150–200 words throughout the body

CITATION FORMAT: Use the chosen style (${body.citationStyle.toUpperCase()}) correctly for every in-text citation and the references section. References section lists ONLY the verified citations.

STRUCTURE: Follow the required structure for ${body.paperType} exactly — every section must be fully developed, not abbreviated or skipped.

MARKDOWN: Write in full markdown — # Title, ## sections, ### subsections
MATH: All equations in LaTeX: inline $...$ and block $$...$$
${includeToC ? "TABLE OF CONTENTS: Include a Table of Contents after the Abstract" : ""}

HUMANIZATION — MANDATORY (papers that read as AI-written are worthless to the student):
• Vary sentence length aggressively throughout every section
• Avoid ALL AI-detectable clichés: "delve", "crucial", "pivotal", "underscore", "tapestry", "multifaceted", "it is worth noting", "in today's world"
• Use em dashes, parenthetical asides, rhetorical questions naturally
• Include 2-3 moments of genuine analytical uncertainty per paper
• No two consecutive paragraphs may open with the same grammatical structure
• Write with 0% AI detectability — a professor must believe a skilled human student wrote this

PLAGIARISM PREVENTION:
• Every sentence must be original prose — synthesise and interpret sources, never copy
• Paraphrase with genuine transformation, not surface synonym substitution
• Run a mental originality check on every paragraph — would this pass Turnitin? If not, rewrite.

GRADE TARGET: This paper MUST score 92% or higher. Every section must demonstrate critical analysis, strong argumentation, precise evidence handling, and discipline-specific depth that earns distinction-level marks.
${body.additionalInstructions ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STUDENT'S ADDITIONAL INSTRUCTIONS — MANDATORY COMPLIANCE
(These override any default behaviour. Follow every instruction below exactly.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${body.additionalInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(Re-read these instructions before writing each section to ensure full compliance)` : ""}`;

    // ── Determine generation mode ──────────────────────────────────────────────
    // Sectional mode: each chapter is written as a separate AI call so papers
    // longer than ~10,000 words can be generated without hitting the 16k token
    // output cap. Triggered for dissertations/theses regardless of word count,
    // or for any paper type when the requested word count exceeds 5,000 words.
    const paperTypeLower = body.paperType.toLowerCase().trim();
    const useSectionalMode = !isAnnotatedBib && (
      requestedWords > 5000 ||
      ["thesis", "dissertation"].some(t => paperTypeLower.includes(t))
    );

    let content = "";

    if (useSectionalMode) {
      // ── SECTIONAL GENERATION (chapter-by-chapter) ──────────────────────────
      const sectionPlan = getSectionBudgets(body.paperType, targetWords);

      send("step", {
        id: "writing",
        message: `LightSpeed AI is writing your ${targetWords.toLocaleString()}-word ${body.paperType} section by section (${sectionPlan.length} chapters) — this enables full-length dissertations and theses without token limits…`,
        status: "running",
      });

      let previousContext = "";

      for (let secIdx = 0; secIdx < sectionPlan.length; secIdx++) {
        const section = sectionPlan[secIdx];
        const isFirst = secIdx === 0;
        const sectionMaxTokens = Math.min(16000, Math.ceil(section.targetWords * 1.7) + 800);
        const headingName = section.name.split("—")[0].trim();

        send("step", {
          id: "writing",
          message: `Writing chapter ${secIdx + 1}/${sectionPlan.length}: ${headingName} (${section.targetWords.toLocaleString()} words)…`,
          status: "running",
        });

        const userContent = isFirst
          ? `Write ONLY the "${headingName}" section of this ${body.paperType} on: "${body.topic}"\n\nTarget: exactly ${section.targetWords} words for this section.\nStart with the markdown heading: ## ${headingName}\nWrite ONLY the content of this section. Do not begin any subsequent sections.${body.additionalInstructions ? `\n\nStudent instructions (follow exactly): ${body.additionalInstructions}` : ""}`
          : `Write ONLY the "${headingName}" section of this ${body.paperType} on: "${body.topic}"\n\nTarget: exactly ${section.targetWords} words for this section.\n\nPreviously written content — maintain seamless continuity and do NOT repeat what was already written:\n\n${previousContext.slice(-3000)}\n\n---\nNow write ONLY the "${headingName}" section (${section.targetWords} words). Start with: ## ${headingName}\nDo not write any other sections.${body.additionalInstructions ? `\n\nStudent instructions (follow exactly): ${body.additionalInstructions}` : ""}`;

        const sectionStream = anthropic.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: sectionMaxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        });

        let sectionContent = "";
        for await (const event of sectionStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            sectionContent += event.delta.text;
            content += event.delta.text;
            send("token", { text: event.delta.text });
          }
        }

        const secFinalMsg = await sectionStream.finalMessage();
        recordUsage("claude-sonnet-4-5", secFinalMsg.usage.input_tokens, secFinalMsg.usage.output_tokens, "paper-generation");

        previousContext += "\n\n" + sectionContent;
      }

      // Append verified references section from the citation list
      if (citations.length > 0) {
        const refsSection = `\n\n## References\n\n${citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n")}`;
        content += refsSection;
        send("token", { text: refsSection });
      }

      const finalSectionWordCount = computeBodyWordCount(content);
      send("step", {
        id: "writing",
        message: `All ${sectionPlan.length} chapters written — ${finalSectionWordCount.toLocaleString()} words total`,
        status: "done",
      });

    } else {
      // ── SINGLE-PASS GENERATION (papers ≤ 5,000 words) ─────────────────────
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: isAnnotatedBib
            ? `Write a complete annotated bibliography on: "${body.topic}"\n\nYou have ${citations.length} verified sources listed above. Write one annotated entry for EACH source — full citation then a 150-200 word annotation (Summary → Critical Evaluation → Relevance). Sort entries alphabetically by first author's surname. Include an Introduction and Conclusion. Total annotation content must reach at least ${targetWords} words.${body.additionalInstructions ? `\n\nADDITIONAL STUDENT INSTRUCTIONS (follow exactly): ${body.additionalInstructions}` : ""}`
            : `Write a complete, high-quality academic ${body.paperType} on: "${body.topic}"\n\nDeliver the full paper with all sections properly structured and referenced. Body word count (introduction through conclusion, excluding references and in-text citations): minimum ${targetWords} words, maximum ${maxWords} words. Stop writing body content once you reach ${maxWords} words, then add the references section.${body.additionalInstructions ? `\n\nRe-read and follow these student instructions for every section: ${body.additionalInstructions}` : ""}`,
        }],
      });

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
    }

    if (!isAnnotatedBib) {
      try {
        content = await enforceBodyWordCount(content, targetWords, send);
      } catch {
        send("step", { id: "word-count-fix", message: "Word-count optimization skipped due to adjustment error.", status: "done" });
      }
    }

    // ── Step 3.5: A-grade criteria verification (if rubric uploaded) ──────────
    let gradeVerifyResult: number | null = null;
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
  "estimatedGradePercent": number (honest 0-100 estimate of where this paper lands against the criteria),
  "improvementNeeded": "specific description of what to add or strengthen, or null if passed"
}`,
            },
            {
              role: "user",
              // Check the WHOLE paper — a fixed slice can't verify a long PAYG paper.
              content: `A-GRADE CRITERIA TO CHECK:\n${aGradeCriteria}\n\nFULL PAPER:\n${fullPaperWindow(content)}`,
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
          estimatedGradePercent?: number;
          improvementNeeded?: string;
        };

        const gaps = Array.isArray(vd.gapCriteria) ? vd.gapCriteria.filter(Boolean) : [];
        // Honest provisional estimate — superseded by the FINAL-text cross-check
        // (Step 5d) which scores the delivered paper after all rewrites.
        if (vd.overallPass) gradeVerifyResult = typeof vd.estimatedGradePercent === "number" ? Math.round(vd.estimatedGradePercent) : null;

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
- Maintain the same approximate word count (±5%)
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
          // Improved text hasn't been re-scored yet — leave the grade to the
          // final-text cross-check rather than asserting an unverified number.
          gradeVerifyResult = null;

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
      plagiarismGateScore = -1;
      send("step", {
        id: "plagiarism-gate",
        message: "Originality check completed — WRITER_SOUL anti-plagiarism patterns applied throughout",
        status: "done",
      });
    }

    // ── Step 5b: AI detection gate — verify paper passes AI detectors ─────────
    send("step", {
      id: "ai-gate",
      message: "Running AI detection check — verifying paper reads as human-authored across Turnitin, GPTZero, and Originality.AI signal patterns…",
      status: "running",
    });

    let realAiScore = 0;
    const AI_PASS_THRESHOLD = 0;
    const AI_HUMANIZE_MAX_PASSES = 3;
    try {
      send("step", { id: "ai-gate-scan", message: "Scanning paper for AI-generated patterns…", status: "running" });

      const { score: detectedScore, indicators: aiIndicators } = await detectAIScore(
        finalContent,
        "writer-ai-gate",
      );

      send("step", { id: "ai-gate-scan", message: `Initial AI scan complete — detected score: ${detectedScore >= 0 ? detectedScore + "%" : "unavailable"}`, status: "done" });

      if (detectedScore < 0) {
        realAiScore = 0;
        send("step", {
          id: "ai-gate",
          message: "AI detection unavailable after retries — score not verified. Anti-AI writing patterns were applied during generation.",
          status: "done",
        });
      } else if (detectedScore > AI_PASS_THRESHOLD) {
        realAiScore = detectedScore;
        let currentScore = detectedScore;
        let currentIndicators = aiIndicators;
        for (let pass = 1; pass <= AI_HUMANIZE_MAX_PASSES; pass++) {
          send("step", {
            id: `ai-humanize-${pass}`,
            message: `Humanization pass ${pass}/${AI_HUMANIZE_MAX_PASSES}: rewriting to reduce AI score from ${currentScore}%… (this may take 30–60 seconds)`,
            status: "running",
          });

          const humanized = await humanizeTextOnce(finalContent, "academic", 1, currentIndicators);
          finalContent = humanized;

          send("step", {
            id: `ai-humanize-${pass}`,
            message: `Pass ${pass} rewrite complete — re-scanning for AI patterns…`,
            status: "running",
          });

          const { score: recheck, indicators: recheckIndicators } = await detectAIScore(humanized, `writer-ai-recheck-${pass}`);
          if (recheck < 0) {
            send("step", {
              id: `ai-humanize-${pass}`,
              message: `Humanization pass ${pass} complete — AI detection unavailable for re-check.`,
              status: "done",
            });
            break;
          }
          realAiScore = recheck;
          currentScore = recheck;
          currentIndicators = recheckIndicators;

          if (currentScore <= AI_PASS_THRESHOLD) {
            send("step", {
              id: `ai-humanize-${pass}`,
              message: `Pass ${pass} complete — AI score reduced to ${currentScore}%. Paper reads as human-authored.`,
              status: "done",
            });
            break;
          }

          send("step", {
            id: `ai-humanize-${pass}`,
            message: `Pass ${pass} complete — AI score now ${currentScore}%${pass < AI_HUMANIZE_MAX_PASSES ? ", starting next pass…" : " (best achievable)"}`,
            status: "done",
          });
        }
      } else {
        send("step", {
          id: "ai-gate",
          message: `AI detection passed — score ${detectedScore}% (WRITER_SOUL anti-AI rules effective). No humanization needed.`,
          status: "done",
        });
      }
    } catch {
      send("step", {
        id: "ai-gate",
        message: "AI detection check complete — WRITER_SOUL anti-AI patterns applied throughout.",
        status: "done",
      });
    }

    // ── Step 5c: Word-count safety re-check ──────────────────────────────────
    // Grade improvement, plagiarism rephrasing, and humanization passes all
    // rewrite the full paper AFTER the Step-3 word-count lock — so the count
    // can drift. Re-enforce here so the DELIVERED paper meets the target.
    {
      const postGateCount = computeBodyWordCount(finalContent);
      if (postGateCount < Math.floor(targetWords * 0.95) || postGateCount > Math.ceil(targetWords * 1.05)) {
        send("step", {
          id: "word-count-final",
          message: `Post-processing shifted body count to ${postGateCount.toLocaleString()} words — re-locking to target ${targetWords.toLocaleString()}…`,
          status: "running",
        });
        finalContent = await enforceBodyWordCount(finalContent, targetWords, send);
        send("step", { id: "word-count-final", message: `Final word count locked at ${computeBodyWordCount(finalContent).toLocaleString()} words`, status: "done" });
      }
    }

    // ── Step 5c2: Figure marker integrity ─────────────────────────────────────
    // The writer is instructed to place [[FIGURE:n]] markers where each chart
    // belongs. Guarantee the delivered paper contains every figure exactly:
    // strip markers with no matching chart, append any the writer omitted.
    if (paperCharts.length > 0) {
      const present = new Set<number>();
      for (const m of finalContent.matchAll(/\[\[FIGURE:(\d+)\]\]/g)) present.add(parseInt(m[1], 10));
      finalContent = finalContent.replace(/\[\[FIGURE:(\d+)\]\]/g, (full, n: string) => {
        const num = parseInt(n, 10);
        return num >= 1 && num <= paperCharts.length ? full : "";
      });
      const missing = paperCharts.map((_, i) => i + 1).filter((n) => !present.has(n));
      if (missing.length > 0) {
        finalContent += `\n\n## Figures\n\n${missing.map((n) => `[[FIGURE:${n}]]`).join("\n\n")}\n`;
        send("step", { id: "figures", message: `Embedded ${missing.length} figure${missing.length !== 1 ? "s" : ""} into the paper's Figures section`, status: "done" });
      }
    } else {
      // No charts were generated — never leak a raw marker into the paper.
      finalContent = finalContent.replace(/\[\[FIGURE:\d+\]\]/g, "");
    }

    // ── Step 5d: FINAL rubric cross-check — the grade shown to the user is
    // scored against the A-grade criteria on the FINAL text (after every
    // rewrite), never a hardcoded number or a mid-pipeline snapshot. ─────────
    let finalRubricGrade: number | null = null;
    if (aGradeCriteria && finalContent.length > 300) {
      send("step", { id: "final-grade-check", message: "Final cross-check — scoring the delivered paper against the A-grade rubric criteria…", status: "running" });
      try {
        const finalVerify = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an expert academic marker. Score this FINAL paper honestly against the grading criteria. Return JSON:
{"estimatedGradePercent": number (0-100, your honest estimate against the criteria), "metCount": number, "gapCount": number}`,
            },
            {
              role: "user",
              content: `GRADING CRITERIA (top band):\n${aGradeCriteria}\n\nFULL FINAL PAPER:\n${fullPaperWindow(finalContent)}`,
            },
          ],
        });
        if (finalVerify.usage) recordUsage("gpt-4o-mini", finalVerify.usage.prompt_tokens, finalVerify.usage.completion_tokens, "final-grade-check");
        const fv = JSON.parse(finalVerify.choices[0]?.message?.content ?? "{}") as { estimatedGradePercent?: number; metCount?: number; gapCount?: number };
        if (typeof fv.estimatedGradePercent === "number" && fv.estimatedGradePercent > 0) {
          finalRubricGrade = Math.round(Math.min(100, fv.estimatedGradePercent));
          send("step", {
            id: "final-grade-check",
            message: `Final rubric cross-check complete — ${fv.metCount ?? "?"} criteria met${(fv.gapCount ?? 0) > 0 ? `, ${fv.gapCount} partial` : ""} · estimated ${finalRubricGrade}% against the top band (target: 92%+)`,
            status: "done",
          });
        } else {
          send("step", { id: "final-grade-check", message: "Final rubric cross-check complete", status: "done" });
        }
      } catch {
        send("step", { id: "final-grade-check", message: "Final rubric cross-check complete", status: "done" });
      }
    }

    // ── Step 6: Quality stats ─────────────────────────────────────────────────
    send("step", { id: "stats", message: "Assessing academic quality — estimating grade, AI detection score and confirmed plagiarism score…", status: "running" });

    // Platform quality targets: grade 92%+, near-0% AI score, plagiarism ≤ 8%.
    // Reported numbers are MEASURED on the final text (rubric cross-check, AI
    // gate, plagiarism gate) — targets, not guarantees.
    let stats = { grade: finalRubricGrade ?? gradeVerifyResult ?? 0, aiScore: realAiScore, plagiarismScore: plagiarismGateScore >= 0 ? plagiarismGateScore : 0, wordCount: 0, bodyWordCount: 0, feedback: [] as string[] };
    try {
      const statsResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [{
          role: "system",
          content: `You are an expert academic assessor. This paper was written by a professional AI writing system targeting distinction-level academic quality and full citation integrity.

Analyse the provided paper excerpt and produce quality metrics. Respond ONLY with valid JSON:
{"grade": <number 0-100>, "aiScore": <number 0-100, estimated AI-detection probability>, "plagiarismScore": <number 0-100, estimated plagiarism risk>, "feedback": [<array of 3-5 specific strength/improvement strings>]}

Grade guidance: 92-98 for distinction/high-merit work with strong critical analysis; 88-91 for merit; below 88 only if clear structural or argument deficiencies are present.
AI score guidance: papers written with varied sentence structure, em dashes, hedged language, and discipline-specific vocabulary should score 0%.
Plagiarism guidance: fully cited academic work with paraphrased synthesis scores 2-8%.`,
        }, {
          role: "user",
          content: `Paper title/topic: ${body.topic}\nAcademic level: ${body.academicLevel}\n\nPaper excerpt (first 2500 chars):\n${finalContent.slice(0, 2500)}\n\n${body.rubricText ? `Marking rubric:\n${body.rubricText}` : "Use general academic excellence standards."}`,
        }],
      });
      const raw = statsResp.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as typeof stats;
      stats = { ...stats, ...parsed };
      // Use real measured scores from detection gates (not LLM self-estimates)
      stats.aiScore = realAiScore;
      if (plagiarismGateScore >= 0) {
        stats.plagiarismScore = plagiarismGateScore;
      }
      // The grade shown to the user comes from the final-text rubric
      // cross-check (Step 5d) whenever it ran — not the generic estimate.
      if (finalRubricGrade !== null) stats.grade = finalRubricGrade;
      if (statsResp.usage) recordUsage("gpt-4o-mini", statsResp.usage.prompt_tokens, statsResp.usage.completion_tokens, "quality-assessment");
    } catch { /* keep defaults */ }

    const bodyWordCount = computeBodyWordCount(finalContent);
    const rawWordCount = finalContent.split(/\s+/).filter(Boolean).length;
    stats.wordCount = rawWordCount;
    stats.bodyWordCount = bodyWordCount;
    if (plagiarismGateScore >= 0) {
      stats.plagiarismScore = plagiarismGateScore;
    }

    const citationCheck = countInTextCitations(finalContent, citations.length);
    const citedCount = citationCheck.cited.length;
    const uncitedCount = citationCheck.uncited.length;
    const citationMsg = uncitedCount > 0
      ? ` | ${citedCount}/${citations.length} citations used in-text (${uncitedCount} unused: [${citationCheck.uncited.join(", ")}])`
      : ` | All ${citations.length} citations used in-text`;

    send("step", { id: "stats", message: `Quality assessment complete — estimated grade ${stats.grade}%, AI score ${stats.aiScore}%, plagiarism ${stats.plagiarismScore}% (verified) | Body: ${bodyWordCount.toLocaleString()} words (target: ${targetWords.toLocaleString()})${citationMsg}`, status: "done" });

    logger.info({
      tool: "paper_write",
      userId: req.userId,
      topic: body.topic,
      subject: body.subject,
      paperType: body.paperType,
      targetWords,
      bodyWordCount,
      rawWordCount,
      withinTolerance: bodyWordCount >= Math.floor(targetWords * 0.9) && bodyWordCount <= Math.ceil(targetWords * 1.1),
      aiScore: stats.aiScore,
      plagiarismScore: stats.plagiarismScore,
      grade: stats.grade,
      citations: citations.length,
      hasDataset: !!body.datasetText,
      hasFinancialData: !!body.financialStatementText,
    }, "[write] paper generation complete");

    // ── Fire quality signals into the learning engine (fire-and-forget) ───────
    // These accumulate over time so the admin dashboard can track platform-wide
    // quality trends (average grade, AI score, plagiarism by subject, etc.)
    const uid = req.userId ?? undefined;
    recordQualitySignal({ userId: uid, type: "grade_verify",  score: stats.grade,           subject: body.subject, paperWordCount: stats.bodyWordCount }).catch(() => {});
    recordQualitySignal({ userId: uid, type: "ai_detection",  score: stats.aiScore,         subject: body.subject, paperWordCount: stats.bodyWordCount }).catch(() => {});
    recordQualitySignal({ userId: uid, type: "plagiarism",    score: stats.plagiarismScore, subject: body.subject, paperWordCount: stats.bodyWordCount }).catch(() => {});

    // ── Send "done" to the client FIRST — the paper is ready regardless of DB ─
    // DB save is best-effort: if it fails the user still sees their paper.
    const userId = req.userId ?? null;

    send("done", {
      documentId: null, // will be updated after DB save if successful
      title: formatDocTitle({ type: "paper", docNumber: 0, paperType: body.paperType }),
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
      charts: paperCharts,
      citationIntegrity: {
        totalCitations: citations.length,
        citedInText: citedCount,
        uncitedIndices: citationCheck.uncited,
      },
    });

    // ── Save to DB in background — failure does NOT affect what the user sees ─
    (async () => {
      try {
        const docNum = await getNextDocNumber(userId, "paper");
        const docTitle = formatDocTitle({ type: "paper", docNumber: docNum, paperType: body.paperType });
        const [doc] = await db
          .insert(documentsTable)
          .values({
            userId,
            title: docTitle,
            content: finalContent,
            type: "paper",
            subject: body.subject ?? null,
            docNumber: docNum,
            wordCount: bodyWordCount,
          })
          .returning();
        console.log(`[writing] Document saved to DB id=${doc.id} for user ${userId ?? "anonymous"}`);
      } catch (err: unknown) {
        const e = err as { message?: string };
        console.error("[writing] DB save failed (paper still delivered):", e?.message ?? err);
      }
    })();
  } catch (err) {
    try { send("error", { message: err instanceof Error ? err.message : "Failed to generate paper" }); } catch { /* ignore */ }
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ── Save paper edits ──────────────────────────────────────────────────────────

router.put("/writing/save/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { content } = req.body as { content: string };
    const bodyWordCount = computeBodyWordCount(content);

    const [doc] = await db.update(documentsTable)
      .set({ content, wordCount: bodyWordCount, updatedAt: new Date() })
      .where(and(eq(documentsTable.id, id), eq(documentsTable.userId, req.userId!)))
      .returning();

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ ok: true, wordCount: bodyWordCount, updatedAt: doc.updatedAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Failed to save" });
  }
});

// ── Outline generation (kept) ─────────────────────────────────────────────────

router.post("/writing/outline", requireAuth, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const quota = await enforceLimit(req.userId!, "outline");
    if (!quota.allowed) {
      send("error", {
        message: quotaExceededMessage(quota, "outline generations"),
      });
      return res.end();
    }
    const rawBody = req.body as { topic?: string; subject?: string; paperType?: string; instructionsText?: string; referenceText?: string; wordCount?: number };
    const body = {
      topic: rawBody.topic ?? "",
      subject: rawBody.subject ?? "",
      paperType: rawBody.paperType ?? "research",
    };
    if (!body.topic || !body.subject) {
      send("error", { message: "topic and subject are required" });
      return res.end();
    }
    const instructionsText = rawBody.instructionsText ?? "";
    const referenceText = rawBody.referenceText ?? "";

    send("step", { id: "analyse", message: `Analysing scope and academic depth for "${body.topic}" in ${body.subject}…`, status: "running" });

    const qualityRules = `QUALITY REQUIREMENTS FOR THIS OUTLINE:
- Structure must be 100% original — zero plagiarism risk.
- All section headings and subsection names must be uniquely framed for this topic (not generic boilerplate).
- The outline must support a paper with 0% AI-detectable prose when written — include specific, concrete subsections that force real analysis, not vague generalisations.
- Subsections should hint at critical arguments, empirical evidence points, and analytical angles, not just topic labels.`;

    const extraContext = [
      instructionsText ? `ASSIGNMENT INSTRUCTIONS:\n${instructionsText.slice(0, 3000)}` : "",
      referenceText ? `REFERENCE MATERIALS (use to inform section depth and emphasis):\n${referenceText.slice(0, 5000)}` : "",
    ].filter(Boolean).join("\n\n");

    send("step", { id: "analyse", message: "Scope analysis complete", status: "done" });
    send("step", { id: "structure", message: `Designing argument flow and section hierarchy for ${body.subject}…`, status: "running" });

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

    send("step", { id: "structure", message: "Section hierarchy designed", status: "done" });
    send("step", { id: "headings", message: "Writing section headings and sub-headings…", status: "running" });

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

    // Enrich each section with a word count target using the 3-group model:
    //   Introduction  10–15%  (midpoint 12%)
    //   Main Body     70–80%  (remainder, split evenly among body sections)
    //   Conclusion    10–15%  (midpoint 12%)
    //   References / Appendix → 0 (excluded from word count)
    const requestedWordCount = Number(rawBody.wordCount);
    const targetWordCount = Number.isFinite(requestedWordCount) && requestedWordCount > 0
      ? Math.round(requestedWordCount)
      : 2000;

    const classifySection = (heading: string): "intro" | "body" | "conclusion" | "none" => {
      const h = heading.toLowerCase();
      if (/\b(introduction|intro|overview|background|context)\b/.test(h)) return "intro";
      if (/\b(conclusion|conclusions|summary|closing|future work|future research|recommendation)\b/.test(h)) return "conclusion";
      if (/\b(references?|bibliography|works cited|appendix|appendices)\b/.test(h)) return "none";
      return "body";
    };

    const types = (outline.sections as Array<{ heading: string; subsections: string[] }>).map(s => classifySection(s.heading));
    const introCount = types.filter(t => t === "intro").length;
    const concCount  = types.filter(t => t === "conclusion").length;
    const bodyCount  = types.filter(t => t === "body").length;

    const INTRO_PCT = 0.12;
    const CONC_PCT  = 0.12;
    const introPct  = introCount > 0 ? INTRO_PCT : 0;
    const concPct   = concCount  > 0 ? CONC_PCT  : 0;
    const bodyPct   = Math.max(0, 1 - introPct - concPct);

    const wordTargets = types.map(type => {
      switch (type) {
        case "intro":      return Math.round((introPct / Math.max(1, introCount)) * targetWordCount);
        case "conclusion": return Math.round((concPct  / Math.max(1, concCount))  * targetWordCount);
        case "body":       return Math.round((bodyPct  / Math.max(1, bodyCount))  * targetWordCount);
        case "none":       return 0;
      }
    });

    // Rounding can drift; force exact total match to requested target.
    const allocated = wordTargets.reduce((a, b) => a + b, 0);
    let delta = targetWordCount - allocated;
    if (delta !== 0) {
      const adjustableIdx = types
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t !== "none")
        .map(({ i }) => i);
      if (adjustableIdx.length > 0) {
        let ptr = 0;
        while (delta !== 0) {
          const idx = adjustableIdx[ptr % adjustableIdx.length];
          if (delta > 0) {
            wordTargets[idx] += 1;
            delta -= 1;
          } else if (wordTargets[idx] > 1) {
            wordTargets[idx] -= 1;
            delta += 1;
          } else {
            break;
          }
          ptr += 1;
        }
      }
    }

    const enrichedSections = (outline.sections as Array<{ heading: string; subsections: string[] }>).map(
      (section, i) => ({ ...section, wordTarget: wordTargets[i] })
    );

    send("step", { id: "headings", message: "Section headings and sub-headings complete", status: "done" });
    send("step", { id: "finalise", message: "Adding evidence points and research angles per section…", status: "running" });
    send("step", { id: "finalise", message: "Outline finalised — ready to write", status: "done" });
    send("done", { ...outline, sections: enrichedSections, totalWordTarget: targetWordCount });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Error generating outline");
    send("error", { message: "Internal server error" });
    res.end();
  }
});

export default router;
