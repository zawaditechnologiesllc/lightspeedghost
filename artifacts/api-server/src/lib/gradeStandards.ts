/**
 * Built-in A-grade rubric criteria modelled on Harvard, Stanford, and Oxford
 * grading standards. Used as the default when no student rubric is uploaded.
 *
 * Each level blends criteria from all three institutions into a single
 * comprehensive rubric that targets the highest grade band.
 *
 * Sources:
 *  - Harvard College Writing Program — grading guidelines
 *  - Stanford Undergrad / Graduate grading descriptors
 *  - Oxford Examination Standards — First Class / Distinction descriptors
 */

export interface InstitutionRubric {
  institution: string;
  label: string;
  criteria: string[];
}

const HARVARD_CRITERIA: Record<string, string[]> = {
  "high-school": [
    "Clear thesis statement that presents an arguable claim, not a statement of fact",
    "Each body paragraph opens with a topic sentence and provides specific evidence (quotes, data, examples)",
    "Sources are integrated into the argument — analysed and contextualised, not just quoted",
    "Logical organisation with effective transitions that connect ideas across paragraphs",
    "Conclusion synthesises the argument and offers a broader implication — not a summary restatement",
    "Consistent, error-free citation style (MLA/APA/Chicago as assigned)",
    "Polished prose: varied sentence structure, precise word choice, no grammatical errors",
  ],
  "undergraduate": [
    "Original, arguable thesis that presents a clear analytical framework for the entire paper",
    "Sustained critical engagement with primary and secondary sources — not descriptive summary",
    "Evidence selected and deployed to build a cumulative argument, not just illustrate points",
    "Counter-arguments acknowledged and substantively addressed, strengthening the central claim",
    "Paragraph structure follows claim → evidence → analysis → significance pattern consistently",
    "Scholarly register maintained throughout; discipline-appropriate terminology used precisely",
    "Conclusion extends the argument by identifying implications, tensions, or avenues for further inquiry",
    "Impeccable citation practice with a complete, correctly formatted bibliography",
  ],
  "masters": [
    "Sophisticated thesis articulating an original scholarly contribution to existing discourse",
    "Comprehensive, critically evaluated literature review that identifies and addresses a gap",
    "Methodological choices explicitly justified and limitations honestly acknowledged",
    "Analysis integrates theory and evidence at postgraduate level with nuanced interpretation",
    "Engagement with competing scholarly positions — demonstrates command of the debate landscape",
    "Writing exhibits intellectual maturity: precise hedging, confident claims where warranted",
    "Conclusion articulates the paper's contribution, its boundaries, and a concrete future research agenda",
    "Reference list is extensive, current, and formatted flawlessly in the required citation style",
  ],
  "phd": [
    "Original scholarly contribution clearly articulated and positioned relative to the state of the field",
    "Theoretical framework explicitly constructed, defended, and applied with doctoral-level command",
    "Methodology demonstrates mastery of the field's research traditions and epistemological commitments",
    "Sustained critical synthesis — sources positioned in dialogue with each other and the argument",
    "Limitations acknowledged with intellectual honesty; scope and generalisability precisely defined",
    "Conclusion situates the contribution within the broader discipline and proposes specific future work",
    "Every claim grounded in evidence or explicitly flagged as the author's analytical position",
    "Citation practice is impeccable throughout; reference list comprehensive and authoritative",
  ],
};

const STANFORD_CRITERIA: Record<string, string[]> = {
  "high-school": [
    "Thesis is specific, debatable, and addresses the prompt directly — not a vague topic announcement",
    "Body paragraphs are organised around discrete analytical points, each with supporting evidence",
    "Analysis drives the paper — summary is minimal and always in service of the argument",
    "Transitions create logical flow between ideas; the reader never has to guess the connection",
    "Conclusion demonstrates intellectual growth — shows how the analysis changed or deepened understanding",
    "Writing is clear, concise, and free of filler; every sentence advances the argument",
    "Proper citation of all sources with a correctly formatted works cited page",
  ],
  "undergraduate": [
    "Thesis presents a genuinely original insight or interpretation, not a restatement of existing scholarship",
    "Argument is structurally coherent — each section builds on the previous to create a progressive case",
    "Primary sources are analysed in depth; secondary sources contextualise and complicate the argument",
    "Paper demonstrates independent thinking — goes beyond course materials to develop a unique perspective",
    "Methodology or analytical approach is named, justified, and consistently applied",
    "Prose is clear, efficient, and intellectually precise — no unnecessary hedging or padding",
    "Counter-evidence and alternative interpretations are addressed rather than ignored",
    "All citation conventions followed precisely; bibliography is complete and correctly formatted",
  ],
  "masters": [
    "Thesis makes a significant, defensible claim that advances understanding in the field",
    "Literature review demonstrates command of the scholarly conversation and identifies a meaningful gap",
    "Research design is rigorous, replicable, and appropriate for the research question",
    "Findings are interpreted with sophistication — connected to theory and prior empirical work",
    "Paper demonstrates the ability to work independently at a level approaching professional scholarship",
    "Writing is clear, authoritative, and free of unnecessary jargon — accessible to an educated reader",
    "Limitations discussed honestly; implications for practice and future research clearly articulated",
    "Documentation is thorough, consistent, and meets the field's professional standards",
  ],
  "phd": [
    "Research makes a demonstrable, original contribution to knowledge in the discipline",
    "Theoretical positioning is sophisticated, drawing on and extending established frameworks",
    "Methodology is innovative or rigorously justified; data collection and analysis are transparent",
    "Argument demonstrates the capacity for independent, professional-level scholarly work",
    "Critical engagement with the field is comprehensive — the author's voice is authoritative and distinct",
    "Ethical considerations and positionality addressed where relevant",
    "Conclusion defines the contribution's scope, identifies limitations, and charts productive future directions",
    "Publication-ready quality in writing, formatting, and citation practice",
  ],
};

const OXFORD_CRITERIA: Record<string, string[]> = {
  "high-school": [
    "Answer directly addresses the question — no irrelevant material or tangential discussion",
    "Argument is well-structured with a clear introduction, development, and conclusion",
    "Demonstrates genuine understanding of the subject matter, not just memorised content",
    "Evidence is relevant, accurately presented, and effectively integrated into the argument",
    "Shows the ability to evaluate different viewpoints rather than presenting only one side",
    "Expression is fluent, accurate, and appropriately formal for academic writing",
    "References all sources correctly and consistently throughout",
  ],
  "undergraduate": [
    "Demonstrates First Class understanding: depth, breadth, and originality of analysis",
    "Argument is logically rigorous — conclusions follow from premises with no unsupported leaps",
    "Critical engagement with scholarship — sources challenged, contextualised, and placed in conversation",
    "Independent analytical voice evident throughout — not merely competent reproduction of lecture content",
    "Awareness of methodological issues and their implications for the argument",
    "Exceptional clarity and precision of expression; prose is elegant and economical",
    "Evidence of wide and discriminating reading beyond the core reading list",
    "Faultless referencing in the appropriate citation style",
  ],
  "masters": [
    "Distinction-level work: demonstrates potential for doctoral-level research",
    "Critical mastery of the relevant literature — comprehensive, evaluative, and current",
    "Research question is sharply defined and its significance clearly articulated",
    "Methodology is appropriate, rigorously applied, and its limitations honestly assessed",
    "Analysis shows intellectual sophistication — moves beyond description to genuine interpretation",
    "Argument is sustained, coherent, and internally consistent across all sections",
    "Writing is polished, authoritative, and demonstrates full command of academic conventions",
    "Contribution to the field is identifiable, even if modest in scope",
  ],
  "phd": [
    "Work is of publishable quality and makes a distinct, original contribution to the field",
    "Demonstrates comprehensive knowledge of the discipline and adjacent fields",
    "Theoretical framework is robustly constructed and applied with rigour and consistency",
    "Critical analysis is penetrating — reveals connections, tensions, and implications others have missed",
    "Methodology is exemplary: transparent, justified, and appropriate to the research questions",
    "Argument sustains a compelling, authoritative scholarly voice throughout",
    "Limitations and scope are defined with intellectual honesty and scholarly precision",
    "Work stands as an independent, professional contribution ready for peer review",
  ],
};

function mergeAndDedup(arrays: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const arr of arrays) {
    for (const item of arr) {
      const key = item.toLowerCase().slice(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }
  return result;
}

export function buildGradeCriteria(academicLevel?: string): string {
  const level = (academicLevel ?? "undergraduate").toLowerCase().replace(/\s+/g, "-");

  const key = Object.keys(HARVARD_CRITERIA).includes(level) ? level : "undergraduate";

  const merged = mergeAndDedup([
    HARVARD_CRITERIA[key],
    STANFORD_CRITERIA[key],
    OXFORD_CRITERIA[key],
  ]);

  const labelMap: Record<string, string> = {
    "high-school":   "High School A-Grade",
    "undergraduate": "Undergraduate First Class / A-Grade",
    "masters":       "Master's Distinction",
    "phd":           "PhD First-Class / Summa Cum Laude",
  };
  const label = labelMap[key] ?? "Undergraduate First Class / A-Grade";

  return `${label} CRITERIA (Harvard · Stanford · Oxford composite rubric) — the paper MUST satisfy ALL of these:\n${merged.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
}

export function getInstitutionRubrics(academicLevel?: string): InstitutionRubric[] {
  const level = (academicLevel ?? "undergraduate").toLowerCase().replace(/\s+/g, "-");
  const key = Object.keys(HARVARD_CRITERIA).includes(level) ? level : "undergraduate";

  return [
    { institution: "Harvard", label: "Harvard College Writing Program", criteria: HARVARD_CRITERIA[key] },
    { institution: "Stanford", label: "Stanford University Grading Standards", criteria: STANFORD_CRITERIA[key] },
    { institution: "Oxford", label: "University of Oxford Examination Standards", criteria: OXFORD_CRITERIA[key] },
  ];
}
