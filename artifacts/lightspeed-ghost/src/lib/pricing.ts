export type PlanId = "pro_monthly" | "pro_annual" | "campus_annual";
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

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "pro_monthly",
    name: "Pro — Monthly",
    amountCents: 1499,
    interval: "month",
    displayPrice: "$14.99/mo",
    description: "Full access to all LightSpeed Ghost tools",
  },
  {
    id: "pro_annual",
    name: "Pro — Annual",
    amountCents: 9900,
    interval: "year",
    displayPrice: "$99/yr ($8.25/mo)",
    description: "Best value — save 45% vs monthly",
  },
  {
    id: "campus_annual",
    name: "Campus",
    amountCents: 600,
    interval: "month",
    displayPrice: "$6/seat/mo",
    description: "Annual plan, minimum 5 seats",
  },
];

export const PAYG_PRICES: Record<PaygTool, number | Partial<Record<DocumentTier, number>>> = {
  paper: {
    discussion:   199,
    essay:        399,
    research:     799,
    proposal:    1299,
    dissertation: 2499,
  },
  revision: {
    discussion:   99,
    essay:        199,
    research:     399,
    proposal:     599,
    dissertation: 999,
  },
  humanizer: {
    discussion:   99,
    essay:        199,
    research:     399,
    proposal:     599,
    dissertation: 999,
  },
  stem:       99,
  study:      199,
  plagiarism:  99,
  outline:     49,
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
    humanizer: "Ghost Writer Humanize",
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
