export function detectPaperType(text: string): "research" | "essay" | "thesis" | "literature_review" | "report" {
  const t = text.toLowerCase();
  if (/\bthesis\b|\bdissertation\b/.test(t)) return "thesis";
  if (/\bliterature review\b|\blit review\b|\bsystematic review\b/.test(t)) return "literature_review";
  if (/\breport\b|\blab report\b|\btechnical report\b/.test(t)) return "report";
  if (/\bessay\b|\bargumentative\b|\bpersuasive\b/.test(t)) return "essay";
  return "research";
}

export function detectCitationStyle(text: string): "apa" | "mla" | "chicago" | "harvard" | "ieee" {
  const t = text.toLowerCase();
  if (/\bapa\b/.test(t)) return "apa";
  if (/\bmla\b/.test(t)) return "mla";
  if (/\bchicago\b/.test(t)) return "chicago";
  if (/\bharvard\b/.test(t)) return "harvard";
  if (/\bieee\b/.test(t)) return "ieee";
  return "apa";
}

export function detectLength(text: string): "short" | "medium" | "long" {
  const match = text.match(/(\d[\d,]*)\s*(?:to\s*(\d[\d,]*)\s*)?(?:[-–]\s*(\d[\d,]*)\s*)?words?\b/i);
  if (match) {
    const raw = (match[1] ?? "0").replace(/,/g, "");
    const count = parseInt(raw, 10);
    if (count <= 800) return "short";
    if (count <= 1800) return "medium";
    return "long";
  }
  return "medium";
}

export function extractTopic(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (
      line.length >= 10 &&
      line.length <= 150 &&
      !line.toLowerCase().startsWith("dear") &&
      !line.match(/^https?:/)
    ) {
      return line.replace(/[.!?]+$/, "").trim();
    }
  }

  const firstSentence = text.match(/^(.{15,120})[.!?]/);
  if (firstSentence) return firstSentence[1].trim();

  return text.slice(0, 100).trim();
}

export function extractSubject(text: string): string {
  const subjects: Record<string, string> = {
    math: "Mathematics",
    calcul: "Calculus",
    algebra: "Algebra",
    statistic: "Statistics",
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    psychology: "Psychology",
    sociology: "Sociology",
    economics: "Economics",
    history: "History",
    literature: "Literature",
    english: "English",
    philosophy: "Philosophy",
    "computer science": "Computer Science",
    programming: "Computer Science",
    engineering: "Engineering",
    business: "Business",
    marketing: "Marketing",
    nursing: "Nursing",
    medicine: "Medicine",
    law: "Law",
    political: "Political Science",
    environmental: "Environmental Science",
  };
  const t = text.toLowerCase();
  for (const [key, label] of Object.entries(subjects)) {
    if (t.includes(key)) return label;
  }
  return "";
}
