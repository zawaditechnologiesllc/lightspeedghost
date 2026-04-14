export type PlanId = "starter_monthly" | "pro_monthly" | "pro_annual" | "campus_annual";
export type PaygTool = "paper" | "revision" | "humanizer" | "stem" | "study" | "plagiarism" | "outline";
export type DocumentTier = "discussion" | "essay" | "research" | "proposal" | "dissertation";

export interface PlanPrice {
  amountCents: number;
  currency: string;
  interval: "month" | "year";
  label: string;
  description: string;
}

export const SUBSCRIPTION_PLANS: Record<PlanId, PlanPrice> = {
  starter_monthly: {
    amountCents: 150,
    currency: "USD",
    interval: "month",
    label: "Starter — Monthly",
    description: "Essential access to LightSpeed Ghost tools",
  },
  pro_monthly: {
    amountCents: 1499,
    currency: "USD",
    interval: "month",
    label: "Pro — Monthly",
    description: "Full access to all LightSpeed Ghost tools",
  },
  pro_annual: {
    amountCents: 12900,
    currency: "USD",
    interval: "year",
    label: "Pro — Annual",
    description: "Full access to all LightSpeed Ghost tools (billed annually)",
  },
  campus_annual: {
    amountCents: 900,
    currency: "USD",
    interval: "month",
    label: "Campus — Per Seat",
    description: "Campus plan billed annually (minimum 5 seats)",
  },
};

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

export function getPaygPrice(tool: PaygTool, tier?: DocumentTier): number {
  const entry = PAYG_PRICES[tool];
  if (typeof entry === "number") return entry;
  if (!tier) throw new Error(`Document tier required for tool: ${tool}`);
  const price = entry[tier];
  if (price === undefined) throw new Error(`Unknown tier "${tier}" for tool "${tool}"`);
  return price;
}

export function getPaygLabel(tool: PaygTool, tier?: DocumentTier): string {
  const labels: Record<PaygTool, string> = {
    paper:      "Paper Generation",
    revision:   "Paper Revision",
    humanizer:  "Ghost Writer Humanize",
    stem:       "STEM Problem",
    study:      "Study Day Pass",
    plagiarism: "Plagiarism Check",
    outline:    "Outline Generation",
  };
  const tierLabel = tier ? ` — ${tier.charAt(0).toUpperCase() + tier.slice(1)}` : "";
  return `${labels[tool]}${tierLabel}`;
}

export function formatAmount(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
