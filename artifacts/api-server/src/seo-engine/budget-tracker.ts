import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export type LLMModel = "gemini-2.5-flash" | "claude-haiku-4-5";

interface CostEntry {
  taskType: string;
  model: LLMModel;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  pageSlug?: string;
}

// Gemini 2.5 Flash: $0.075/M input, $0.30/M output
// Claude Haiku 4.5: $0.25/M input, $1.25/M output
const COST_PER_M = {
  "gemini-2.5-flash": { input: 0.075, output: 0.30 },
  "claude-haiku-4-5": { input: 0.25, output: 1.25 },
};

const MONTHLY_BUDGET_USD = parseFloat(process.env.SEO_BUDGET_LIMIT ?? "8.00");
const SELF_HEAL_THRESHOLD = parseFloat(process.env.SEO_SELF_HEAL_REVENUE_THRESHOLD ?? "500");
const PILLAR_MONTHLY_LIMIT = 15;

export function computeCost(model: LLMModel, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_M[model];
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export async function logLLMCost(entry: CostEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO seo_llm_cost_log (task_type, model_used, input_tokens, output_tokens, cost_usd, page_slug)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.taskType, entry.model, entry.inputTokens, entry.outputTokens, entry.costUsd, entry.pageSlug ?? null]
    );

    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    await pool.query(
      `INSERT INTO seo_budget_status (month, gemini_spend_usd, claude_spend_usd, total_spend_usd, budget_limit_usd, pages_generated)
       VALUES ($1, $2, $3, $4, $5, 0)
       ON CONFLICT (month) DO UPDATE SET
         gemini_spend_usd = seo_budget_status.gemini_spend_usd + CASE WHEN $6 = 'gemini-2.5-flash' THEN $7 ELSE 0 END,
         claude_spend_usd = seo_budget_status.claude_spend_usd + CASE WHEN $6 = 'claude-haiku-4-5' THEN $7 ELSE 0 END,
         total_spend_usd = seo_budget_status.total_spend_usd + $7,
         updated_at = now()`,
      [
        month,
        entry.model === "gemini-2.5-flash" ? entry.costUsd : 0,
        entry.model === "claude-haiku-4-5" ? entry.costUsd : 0,
        entry.costUsd,
        MONTHLY_BUDGET_USD,
        entry.model,
        entry.costUsd,
      ]
    );
  } catch (err) {
    logger.error({ err }, "[seo-budget] Failed to log LLM cost");
  }
}

export async function incrementPageCount(): Promise<void> {
  try {
    const month = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO seo_budget_status (month, gemini_spend_usd, claude_spend_usd, total_spend_usd, budget_limit_usd, pages_generated)
       VALUES ($1, 0, 0, 0, $2, 1)
       ON CONFLICT (month) DO UPDATE SET
         pages_generated = seo_budget_status.pages_generated + 1,
         updated_at = now()`,
      [month, MONTHLY_BUDGET_USD]
    );
  } catch (err) {
    logger.error({ err }, "[seo-budget] Failed to increment page count");
  }
}

export async function getBudgetStatus(): Promise<{
  month: string;
  geminiSpend: number;
  claudeSpend: number;
  totalSpend: number;
  budgetLimit: number;
  pagesGenerated: number;
  remainingBudget: number;
  percentUsed: number;
  upgraded: boolean;
  claudeUnlocked: boolean;
  pillarUsedThisMonth: number;
  pillarRemainingThisMonth: number;
}> {
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT * FROM seo_budget_status WHERE month = $1`,
    [month]
  );

  const pillarRow = await pool.query(
    `SELECT COUNT(*) as cnt FROM seo_llm_cost_log
     WHERE model_used = 'claude-haiku-4-5' AND date_trunc('month', logged_at) = date_trunc('month', now())`,
    []
  );

  const row = rows[0] ?? {
    gemini_spend_usd: 0,
    claude_spend_usd: 0,
    total_spend_usd: 0,
    budget_limit_usd: MONTHLY_BUDGET_USD,
    pages_generated: 0,
    upgraded: false,
  };

  const totalSpend = parseFloat(row.total_spend_usd) || 0;
  const budgetLimit = parseFloat(row.budget_limit_usd) || MONTHLY_BUDGET_USD;
  const pillarUsed = parseInt(pillarRow.rows[0]?.cnt ?? "0");

  // Check if organic revenue threshold reached to unlock Claude for all content
  const upgraded = row.upgraded ?? false;

  return {
    month,
    geminiSpend: parseFloat(row.gemini_spend_usd) || 0,
    claudeSpend: parseFloat(row.claude_spend_usd) || 0,
    totalSpend,
    budgetLimit,
    pagesGenerated: parseInt(row.pages_generated) || 0,
    remainingBudget: Math.max(0, budgetLimit - totalSpend),
    percentUsed: budgetLimit > 0 ? Math.round((totalSpend / budgetLimit) * 100) : 0,
    upgraded,
    claudeUnlocked: upgraded,
    pillarUsedThisMonth: pillarUsed,
    pillarRemainingThisMonth: Math.max(0, PILLAR_MONTHLY_LIMIT - pillarUsed),
  };
}

export async function canAffordGeneration(model: LLMModel, estimatedOutputTokens = 1500): Promise<boolean> {
  const status = await getBudgetStatus();
  const estimatedCost = computeCost(model, 2000, estimatedOutputTokens);
  return status.remainingBudget >= estimatedCost;
}

export async function selectModel(pageType: string, isPillar: boolean): Promise<LLMModel> {
  const status = await getBudgetStatus();

  if (status.upgraded) return "claude-haiku-4-5"; // budget upgraded — unlock all

  if (isPillar && status.pillarRemainingThisMonth > 0) {
    const canAfford = await canAffordGeneration("claude-haiku-4-5", 2000);
    if (canAfford) return "claude-haiku-4-5";
  }

  return "gemini-2.5-flash";
}

export async function markBudgetUpgraded(): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await pool.query(
    `INSERT INTO seo_budget_status (month, gemini_spend_usd, claude_spend_usd, total_spend_usd, budget_limit_usd, pages_generated, upgraded)
     VALUES ($1, 0, 0, 0, $2, 0, true)
     ON CONFLICT (month) DO UPDATE SET upgraded = true, updated_at = now()`,
    [month, MONTHLY_BUDGET_USD]
  );
}
