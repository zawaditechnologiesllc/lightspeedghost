export function detectPaperType(text: string): string {
  const t = text.toLowerCase();
  if (/\bgrant\s*proposal\b/.test(t)) return "grant proposal";
  if (/\bresearch\s*proposal\b/.test(t)) return "research proposal";
  if (/\bproposal\b/.test(t)) return "proposal";
  if (/\bbusiness\s*plan\b/.test(t)) return "business plan";
  if (/\bfinancial\s*(statement\s*)?analysis\b/.test(t)) return "financial analysis";
  if (/\bwhite\s*paper\b/.test(t)) return "white paper";
  if (/\bposition\s*paper\b/.test(t)) return "position paper";
  if (/\bpolicy\s*brief\b/.test(t)) return "policy brief";
  if (/\bdissertation\b/.test(t)) return "dissertation";
  if (/\bthesis\b/.test(t)) return "thesis";
  if (/\bannotated\s*bibliograph/i.test(t)) return "annotated bibliography";
  if (/\bliterature\s*review\b|\blit\s*review\b|\bsystematic\s*review\b/.test(t)) return "literature_review";
  if (/\blab\s*report\b/.test(t)) return "lab report";
  if (/\breport\b|\btechnical\s*report\b/.test(t)) return "report";
  if (/\bcase\s*stud/i.test(t)) return "case study";
  if (/\bterm\s*paper\b/.test(t)) return "term paper";
  if (/\bcritical\s*analysis\b/.test(t)) return "critical analysis";
  if (/\breflect/i.test(t)) return "reflective";
  if (/\bargumentative\b/.test(t)) return "argumentative";
  if (/\bessay\b|\bpersuasive\b/.test(t)) return "essay";
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
    finance: "Finance",
    accounting: "Accounting",
    "financial statement": "Accounting",
    actuarial: "Actuarial Science",
    insurance: "Insurance",
    "credit analysis": "Credit Analysis",
    "credit risk": "Credit Analysis",
    banking: "Banking",
    investment: "Investment",
    portfolio: "Finance",
    "corporate finance": "Finance",
    "financial management": "Finance",
    "cost accounting": "Accounting",
    audit: "Accounting",
    tax: "Accounting",
    theology: "Theology",
    religious: "Theology",
    communicat: "Communications",
    criminolog: "Criminology",
    "social work": "Social Work",
    "public health": "Public Health",
    epidemiol: "Public Health",
    architectur: "Architecture",
    anthropolog: "Anthropology",
    linguist: "Linguistics",
    "data science": "Data Science",
    "machine learning": "Data Science",
    "information technology": "Information Technology",
    "supply chain": "Supply Chain Management",
    logistics: "Supply Chain Management",
    "human resource": "Human Resource Management",
    "international relation": "International Relations",
    "foreign policy": "International Relations",
    geograph: "Geography",
    education: "Education",
    pedagog: "Education",
    "english lit": "English Literature",
    "art and design": "Art & Design",
    "art & design": "Art & Design",
    "fine art": "Art & Design",
    "graphic design": "Art & Design",
    music: "Music",
    language: "Languages",
    spanish: "Languages",
    french: "Languages",
    german: "Languages",
    mandarin: "Languages",
    "business stud": "Business Studies",
    "business admin": "Business Studies",
    management: "Business Studies",
  };
  const t = text.toLowerCase();
  for (const [key, label] of Object.entries(subjects)) {
    if (t.includes(key)) return label;
  }
  return "";
}
