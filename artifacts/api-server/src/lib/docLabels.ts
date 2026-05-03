import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { and, eq, isNull, count } from "drizzle-orm";

// ── Tool codes ─────────────────────────────────────────────────────────────

const TOOL_CODE: Record<string, string> = {
  paper:      "WP",
  outline:    "OT",
  revision:   "RV",
  humanizer:  "HN",
  plagiarism: "AP",
  stem:       "SS",
  study:      "ASA",
};

// ── Document-type label tables ─────────────────────────────────────────────

const PAPER_TYPE_LABELS: Record<string, string> = {
  "research paper":     "RESEARCH PAPER",
  "research":           "RESEARCH PAPER",
  "essay":              "ESSAY",
  "argumentative":      "ARGUMENTATIVE ESSAY",
  "expository":         "EXPOSITORY ESSAY",
  "analytical":         "ANALYTICAL ESSAY",
  "narrative":          "NARRATIVE ESSAY",
  "persuasive":         "PERSUASIVE ESSAY",
  "critical analysis":  "CRITICAL ANALYSIS",
  "literature review":  "LITERATURE REVIEW",
  "lab report":         "LAB REPORT",
  "case study":         "CASE STUDY",
  "thesis":             "THESIS",
  "dissertation":       "DISSERTATION",
  "term paper":         "TERM PAPER",
  "reflective":         "REFLECTIVE ESSAY",
  "annotated bibliography": "ANNOTATED BIBLIOGRAPHY",
};

const STEM_LABELS: Record<string, string> = {
  mathematics:    "MATH SOLUTION",
  physics:        "PHYSICS SOLUTION",
  chemistry:      "CHEMISTRY SOLUTION",
  biology:        "BIOLOGY SOLUTION",
  engineering:    "ENGINEERING SOLUTION",
  computer_science: "CS SOLUTION",
  statistics:     "STATS SOLUTION",
};

const STUDY_LABELS: Record<string, string> = {
  flashcards:  "FLASH CARDS",
  quiz:        "QUIZ",
  summary:     "SUMMARY",
  studyguide:  "STUDY GUIDE",
  slides:      "SLIDES",
  weakpoints:  "WEAKNESS ANALYSIS",
};

// ── Get next sequential number ─────────────────────────────────────────────

export async function getNextDocNumber(userId: string | null, type: string): Promise<number> {
  try {
    const condition = userId
      ? and(eq(documentsTable.userId, userId), eq(documentsTable.type, type))
      : and(isNull(documentsTable.userId), eq(documentsTable.type, type));

    const [{ value }] = await db
      .select({ value: count() })
      .from(documentsTable)
      .where(condition);

    return Number(value);
  } catch {
    return 0;
  }
}

// ── Format number with zero-padding ───────────────────────────────────────

function padNum(n: number): string {
  if (n < 10) return `0${n}`;
  return String(n);
}

// ── Generate the full LSG document title ──────────────────────────────────

export interface DocLabelOptions {
  type: "paper" | "outline" | "revision" | "humanizer" | "plagiarism" | "stem" | "study";
  docNumber: number;
  paperType?: string;        // for WP
  subject?: string;          // for SS and ASA
  studyType?: string;        // for ASA (flashcards, quiz, etc.)
  plagiarismMode?: "ai" | "plagiarism" | "both"; // for AP
}

export function formatDocTitle(opts: DocLabelOptions): string {
  const code = TOOL_CODE[opts.type] ?? opts.type.toUpperCase();
  const num  = padNum(opts.docNumber);
  const prefix = `LSG-${code}${num}`;

  switch (opts.type) {
    case "paper": {
      const raw = (opts.paperType ?? "").toLowerCase().trim();
      const label = (PAPER_TYPE_LABELS[raw] ?? raw.toUpperCase()) || "PAPER";
      return `${prefix}-${label}`;
    }
    case "outline":
      return `${prefix}-OUTLINE`;
    case "revision":
      return `${prefix}-REVISION`;
    case "humanizer":
      return `${prefix}-HUMANIZED TEXT`;
    case "plagiarism": {
      const mode = opts.plagiarismMode ?? "both";
      const label =
        mode === "ai"         ? "AI REPORT"
        : mode === "plagiarism" ? "PLAGIARISM REPORT"
        : "AI & PLAGIARISM REPORT";
      return `${prefix}-${label}`;
    }
    case "stem": {
      const raw = (opts.subject ?? "").toLowerCase().trim();
      const label = (STEM_LABELS[raw] ?? (raw.toUpperCase() + " SOLUTION")) || "STEM SOLUTION";
      return `${prefix}-${label}`;
    }
    case "study": {
      const raw = (opts.studyType ?? "").toLowerCase().trim();
      const label = (STUDY_LABELS[raw] ?? raw.toUpperCase()) || "STUDY MATERIAL";
      return `${prefix}-${label}`;
    }
    default:
      return `${prefix}-DOCUMENT`;
  }
}
