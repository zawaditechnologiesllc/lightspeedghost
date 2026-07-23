export type PlanId = "starter_monthly" | "student_pro_monthly" | "pro_monthly" | "pro_annual" | "campus_annual" | "institution_annual" | "ebooks_monthly";
export type PaygTool = "paper" | "revision" | "humanizer" | "stem" | "study" | "plagiarism" | "outline";
export type DocumentTier = "discussion" | "essay" | "research" | "proposal" | "dissertation";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  amountCents: number;
  interval: "month" | "year";
  displayPrice: string;
  description: string;
}

// The plan lineup is Free / Pro $29.99 / Institution (+ the Ebooks add-on and
// PAYG). Free is not listed here because it has no checkout — every account
// starts on it. Retired plans (Starter $9.99, Student Pro $19.99) are gone from
// this purchase list; existing subscribers keep their entitlements server-side.
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "pro_monthly",
    name: "Pro — Monthly",
    amountCents: 2999,
    interval: "month",
    displayPrice: "$29.99/mo",
    description: "Full access to all LightSpeed Ghost tools",
  },
  {
    id: "pro_annual",
    name: "Pro — Annual",
    amountCents: 26900,
    interval: "year",
    displayPrice: "$269/yr ($22.42/mo)",
    description: "Best value — save 25% vs monthly",
  },
  {
    id: "campus_annual",
    name: "Institution",
    amountCents: 0,
    interval: "month",
    displayPrice: "Custom pricing",
    description: "Custom seats, one invoice — contact us for a quote",
  },
  {
    id: "ebooks_monthly",
    name: "Ebooks Add-On",
    amountCents: 2999,
    interval: "month",
    displayPrice: "$29.99/mo",
    description: "15 AI-written ebooks/month — KDP, Apple Books, all platforms",
  },
];

export const PAYG_PRICES: Record<PaygTool, number | Partial<Record<DocumentTier, number>>> = {
  paper: {
    discussion:    399,
    essay:         799,
    research:     1499,
    proposal:     2499,
    dissertation: 5999,
  },
  revision: {
    discussion:   199,
    essay:        399,
    research:     799,
    proposal:    1299,
    dissertation: 2499,
  },
  humanizer: {
    discussion:   199,
    essay:        399,
    research:     799,
    proposal:    1299,
    dissertation: 2499,
  },
  stem:       199,
  study:      299,
  plagiarism: 199,
  outline:    199,
};

export const DOCUMENT_TIERS: DocumentTier[] = [
  "discussion", "essay", "research", "proposal", "dissertation",
];

export const TIER_LABELS: Record<DocumentTier, string> = {
  discussion: "Discussion Post",
  essay: "Essay / Short Paper",
  research: "Research Paper",
  proposal: "Research Proposal",
  dissertation: "Thesis / Dissertation",
};

export const TIER_WORD_RANGES: Record<DocumentTier, string> = {
  discussion: "≤ 500 words",
  essay:      "500 – 1,500 words",
  research:   "1,500 – 3,500 words",
  proposal:   "3,500 – 6,000 words",
  dissertation: "6,000 – 15,000 words",
};

export function getPaygPrice(tool: PaygTool, tier?: DocumentTier): number {
  const entry = PAYG_PRICES[tool];
  if (typeof entry === "number") return entry;
  if (!tier) return 0;
  return entry[tier] ?? 0;
}

export function getPaygLabel(tool: PaygTool, tier?: DocumentTier): string {
  const toolLabels: Record<PaygTool, string> = {
    paper: "Paper Generation",
    revision: "Paper Revision",
    humanizer: "LightSpeed Humanizer",
    stem: "STEM Problem",
    study: "Study Day Pass",
    plagiarism: "Plagiarism Check",
    outline: "Outline",
  };
  const t = tier ? ` — ${TIER_LABELS[tier]}` : "";
  return `${toolLabels[tool]}${t}`;
}

export function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export const GATEWAY_LABELS: Record<string, string> = {
  stripe: "Stripe",
  paddle: "Paddle",
  lemon_squeezy: "Lemon Squeezy",
  paystack: "Paystack",
  intasend: "IntaSend (Mobile Money)",
};
