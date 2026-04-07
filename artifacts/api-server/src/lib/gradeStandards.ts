/**
 * Built-in A-grade criteria by academic level.
 * Used as a fallback when no rubric is uploaded.
 * Applied in: writing, revision.
 */

export function buildGradeCriteria(academicLevel?: string): string {
  const level = (academicLevel ?? "undergraduate").toLowerCase().replace(/\s+/g, "-");

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

  const criteria = levelCriteria[level] ?? levelCriteria["undergraduate"];

  const labelMap: Record<string, string> = {
    "high-school":   "High School A-Grade",
    "undergraduate": "Undergraduate First Class / A-Grade",
    "masters":       "Master's Distinction",
    "phd":           "PhD First-Class",
  };
  const label = labelMap[level] ?? "Undergraduate First Class / A-Grade";

  return `${label} CRITERIA — the paper MUST satisfy ALL of these:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;
}
