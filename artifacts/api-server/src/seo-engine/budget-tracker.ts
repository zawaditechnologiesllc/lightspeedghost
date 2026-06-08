/**
 * SEO Budget Tracker — Gemini 2.5 Flash (free tier).
 * Single model, simplified cost accounting.
 */
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export type LLMModel = "gemini-2.5-flash";

interface CostEntry {
  taskType:     string;
  model:        LLMModel | string;
  inputTokens:  number;
  outputTokens: number;
  costUsd:      number;
  pageSlug?:    string;
}

// Gemini 2.5 Flash pricing (per million tokens) — free tier available
// Input: $0.15/M, Output: $0.60/M
const COST_PER_M = {
  input:  0.15,
  output: 0.60,
};

const MONTHLY_BUDGET_USD = parseFloat(process.env.SEO_BUDGET_LIMIT ?? "8.00");

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * COST_PER_M.input
       + (outputTokens / 1_000_000) * COST_PER_M.output;
}

export async function logLLMCost(entry: CostEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO seo_llm_cost_log (task_type, model_used, input_tokens, output_tokens, cost_usd, page_slug)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.taskType, entry.model, entry.inputTokens, entry.outputTokens, entry.costUsd, entry.pageSlug ?? null],
    );

    const month = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO seo_budget_status
        (month, gemini_spend_usd, claude_spend_usd, total_spend_usd, budget_limit_usd, pages_generated)
       VALUES ($1, $2, 0, $2, $3, 0)
       ON CONFLICT (month) DO UPDATE SET
         gemini_spend_usd = seo_budget_status.gemini_spend_usd + $2,
         total_spend_usd  = seo_budget_status.total_spend_usd  + $2,
         updated_at       = now()`,
      [month, entry.costUsd, MONTHLY_BUDGET_USD],
    );
  } catch (err) {
    logger.error({ err }, "[seo-budget] Failed to log LLM cost");
  }
}

export async function incrementPageCount(): Promise<void> {
  try {
    const month = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO seo_budget_status
        (month, gemini_spend_usd, claude_spend_usd, total_spend_usd, budget_limit_usd, pages_generated)
       VALUES ($1, 0, 0, 0, $2, 1)
       ON CONFLICT (month) DO UPDATE SET
         pages_generated = seo_budget_status.pages_generated + 1,
         updated_at = now()`,
      [month, MONTHLY_BUDGET_USD],
    );
  } catch (err) {
    logger.error({ err }, "[seo-budget] Failed to increment page count");
  }
}

export async function getBudgetStatus(): Promise<{
  month:             string;
  geminiSpend:       number;
  claudeSpend:       number;
  totalSpend:        number;
  budgetLimit:       number;
  pagesGenerated:    number;
  remainingBudget:   number;
  percentUsed:       number;
  upgraded:          boolean;
  claudeUnlocked:    boolean;
  pillarUsedThisMonth:      number;
  pillarRemainingThisMonth: number;
  model:             string;
}> {
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT * FROM seo_budget_status WHERE month = $1`,
    [month],
  );

  const row = rows[0] ?? {
    gemini_spend_usd: 0,
    claude_spend_usd: 0,
    total_spend_usd:  0,
    budget_limit_usd: MONTHLY_BUDGET_USD,
    pages_generated:  0,
    upgraded:         false,
  };

  const totalSpend  = parseFloat(String(row.total_spend_usd))  || 0;
  const budgetLimit = parseFloat(String(row.budget_limit_usd)) || MONTHLY_BUDGET_USD;

  return {
    month,
    geminiSpend:              parseFloat(String(row.gemini_spend_usd)) || 0,
    claudeSpend:              0,
    totalSpend,
    budgetLimit,
    pagesGenerated:           parseInt(String(row.pages_generated)) || 0,
    remainingBudget:          Math.max(0, budgetLimit - totalSpend),
    percentUsed:              budgetLimit > 0 ? Math.round((totalSpend / budgetLimit) * 100) : 0,
    upgraded:                 false,
    claudeUnlocked:           false,
    pillarUsedThisMonth:      0,
    pillarRemainingThisMonth: 0,
    model:                    "gemini-2.5-flash",
  };
}

export async function canAffordGeneration(estimatedOutputTokens = 2000): Promise<boolean> {
  const status = await getBudgetStatus();
  const estimatedCost = computeCost("gemini-2.5-flash", 2000, estimatedOutputTokens);
  return status.remainingBudget >= estimatedCost;
}

// Kept for import compatibility with orchestrator
export async function selectModel(): Promise<LLMModel> {
  return "gemini-2.5-flash";
}

export async function markBudgetUpgraded(): Promise<void> {
  // No-op — no longer needed with single model, kept for API compatibility
  logger.info("[seo-budget] markBudgetUpgraded called — no-op with Gemini-only setup");
}
