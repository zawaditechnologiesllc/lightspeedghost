/**
 * AI Gateway — Portkey-inspired intelligent model routing with fallback chains.
 *
 * Portkey (github.com/Portkey-AI/gateway) is an open-source AI gateway that:
 *  1. Routes requests to the best model for the task
 *  2. Retries with fallback models if the primary fails or rate-limits
 *  3. Provides unified cost logging across all providers
 *  4. Caches identical requests to cut costs further
 *
 * This implementation replicates those patterns using our existing
 * Anthropic + OpenAI clients, without requiring an external service.
 *
 * Task tiers:
 *  • "fast"     — GPT-4o-mini (formatting, JSON extraction, simple summaries)
 *  • "standard" — Claude Sonnet (most academic tasks, analysis, writing)
 *  • "power"    — Claude Sonnet with extended tokens (thesis, complex STEM)
 *
 * Fallback chain:
 *  fast:     gpt-4o-mini → claude-haiku-4-5 → claude-sonnet-4-5
 *  standard: claude-sonnet-4-5 → gpt-4o → gpt-4o-mini (last resort)
 *  power:    claude-sonnet-4-5 (extended) → gpt-4o → claude-sonnet-4-5 (normal)
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getAnthropic, getOpenAI } from "./ai.js";
import { recordUsage, checkBudget } from "./apiCost.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GatewayTier = "fast" | "standard" | "power";
export type GatewayProvider = "anthropic" | "openai";

export interface GatewayMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }>;
}

export interface GatewayRequest {
  tier: GatewayTier;
  messages: GatewayMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  operation?: string;
}

export interface GatewayResponse {
  content: string;
  model: string;
  provider: GatewayProvider;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  fallbackUsed: boolean;
  attempts: number;
}

// ── Model definitions ─────────────────────────────────────────────────────────

interface ModelSpec {
  id: string;
  provider: GatewayProvider;
  maxTokensDefault: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

const MODELS: Record<string, ModelSpec> = {
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    maxTokensDefault: 4096,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
  },
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    maxTokensDefault: 4096,
    inputPricePer1M: 2.5,
    outputPricePer1M: 10.0,
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    maxTokensDefault: 4096,
    inputPricePer1M: 0.25,
    outputPricePer1M: 1.25,
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    provider: "anthropic",
    maxTokensDefault: 8192,
    inputPricePer1M: 3.0,
    outputPricePer1M: 15.0,
  },
};

const FALLBACK_CHAINS: Record<GatewayTier, string[]> = {
  fast:     ["gpt-4o-mini", "claude-haiku-4-5", "claude-sonnet-4-5"],
  standard: ["claude-sonnet-4-5", "gpt-4o", "gpt-4o-mini"],
  power:    ["claude-sonnet-4-5", "gpt-4o", "claude-sonnet-4-5"],
};

// ── Retry helpers ─────────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504, 529]);

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("rate") || msg.includes("overload") || msg.includes("timeout")) return true;
  }
  const status = (err as { status?: number })?.status;
  return status !== undefined && RETRYABLE_CODES.has(status);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Provider callers ──────────────────────────────────────────────────────────

async function callAnthropic(
  spec: ModelSpec,
  req: GatewayRequest,
): Promise<GatewayResponse> {
  const client: Anthropic = getAnthropic();
  const maxTokens = req.maxTokens ?? spec.maxTokensDefault;

  const anthropicMessages: Anthropic.MessageParam[] = req.messages.map(m => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    const blocks: Anthropic.ContentBlockParam[] = (m.content as Array<{ type: string; text?: string; image_url?: { url: string } }>).map(b => {
      if (b.type === "text") return { type: "text" as const, text: b.text ?? "" };
      const url = b.image_url?.url ?? "";
      if (url.startsWith("data:")) {
        const [header, data] = url.split(",");
        const mediaType = (header.match(/:(.*?);/)?.[1] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        return { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };
      }
      return { type: "image" as const, source: { type: "url" as const, url } };
    });
    return { role: m.role, content: blocks };
  });

  const resp = await client.messages.create({
    model: spec.id,
    max_tokens: maxTokens,
    temperature: req.temperature ?? 0.7,
    ...(req.system ? { system: req.system } : {}),
    messages: anthropicMessages,
  });

  const content = (resp.content[0] as { type: string; text?: string })?.type === "text"
    ? ((resp.content[0] as { text: string }).text ?? "")
    : "";
  const inputTokens  = resp.usage?.input_tokens  ?? 0;
  const outputTokens = resp.usage?.output_tokens ?? 0;
  const costUsd = recordUsage(spec.id, inputTokens, outputTokens, req.operation ?? "gateway");

  return {
    content,
    model: spec.id,
    provider: "anthropic",
    inputTokens,
    outputTokens,
    costUsd,
    fallbackUsed: false,
    attempts: 1,
  };
}

async function callOpenAI(
  spec: ModelSpec,
  req: GatewayRequest,
): Promise<GatewayResponse> {
  const client: OpenAI = getOpenAI();
  const maxTokens = req.maxTokens ?? spec.maxTokensDefault;

  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  if (req.system) {
    messages.push({ role: "system", content: req.system });
  }

  for (const m of req.messages) {
    if (typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content });
    } else {
      const parts: OpenAI.ChatCompletionContentPart[] = (m.content as Array<{ type: string; text?: string; image_url?: { url: string } }>).map(b => {
        if (b.type === "text") return { type: "text" as const, text: b.text ?? "" };
        return { type: "image_url" as const, image_url: { url: b.image_url?.url ?? "" } };
      });
      messages.push({ role: m.role, content: parts });
    }
  }

  const resp = await client.chat.completions.create({
    model: spec.id,
    max_tokens: maxTokens,
    temperature: req.temperature ?? 0.7,
    messages,
    ...(req.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });

  const content = resp.choices[0]?.message?.content ?? "";
  const inputTokens  = resp.usage?.prompt_tokens    ?? 0;
  const outputTokens = resp.usage?.completion_tokens ?? 0;
  const costUsd = recordUsage(spec.id, inputTokens, outputTokens, req.operation ?? "gateway");

  return {
    content,
    model: spec.id,
    provider: "openai",
    inputTokens,
    outputTokens,
    costUsd,
    fallbackUsed: false,
    attempts: 1,
  };
}

// ── Core gateway function ─────────────────────────────────────────────────────

/**
 * Route an AI request through the gateway.
 * Automatically selects the best model for the tier, retries on transient
 * failures, and falls back to the next model in the chain if needed.
 */
export async function gatewayCall(req: GatewayRequest): Promise<GatewayResponse> {
  // Budget guard — refuse if over hard limit
  const budget = checkBudget();
  if (!budget.ok) {
    throw new Error(`[AI Gateway] Daily budget limit reached ($${budget.sessionCost.toFixed(4)}/${budget.dailyBudget}). No further AI calls will be made.`);
  }

  const chain = FALLBACK_CHAINS[req.tier];
  let lastError: unknown;
  let totalAttempts = 0;

  for (let i = 0; i < chain.length; i++) {
    const modelId = chain[i];
    const spec = MODELS[modelId];
    if (!spec) continue;

    const isFallback = i > 0;
    const maxRetries = isFallback ? 1 : 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      try {
        const resp = spec.provider === "anthropic"
          ? await callAnthropic(spec, req)
          : await callOpenAI(spec, req);

        if (isFallback || attempt > 0) {
          resp.fallbackUsed = isFallback;
          resp.attempts = totalAttempts;
          console.log(
            `[AI Gateway] ${req.tier} → ${modelId}` +
            (isFallback ? ` (fallback from ${chain[0]})` : "") +
            (attempt > 0 ? ` (retry ${attempt})` : "") +
            ` — ${resp.inputTokens + resp.outputTokens} tokens, $${resp.costUsd.toFixed(6)}`
          );
        }

        return { ...resp, attempts: totalAttempts };
      } catch (err) {
        lastError = err;
        totalAttempts++;
        if (isRetryable(err) && attempt < maxRetries) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(`[AI Gateway] ${modelId} attempt ${attempt + 1} failed (retryable), backing off ${backoffMs}ms:`, (err as Error).message);
          await sleep(backoffMs);
        } else {
          console.warn(`[AI Gateway] ${modelId} failed (non-retryable or exhausted), trying next in chain:`, (err as Error).message);
          break;
        }
      }
    }
  }

  throw new Error(`[AI Gateway] All models exhausted for tier "${req.tier}". Last error: ${(lastError as Error)?.message ?? String(lastError)}`);
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

/**
 * Fast-tier call — GPT-4o-mini with fallback.
 * Best for: JSON extraction, formatting, simple classification, rubric parsing.
 */
export async function fastCall(
  system: string,
  userMessage: string,
  options: { maxTokens?: number; jsonMode?: boolean; operation?: string; temperature?: number } = {}
): Promise<string> {
  const resp = await gatewayCall({
    tier: "fast",
    system,
    messages: [{ role: "user", content: userMessage }],
    ...options,
  });
  return resp.content;
}

/**
 * Standard-tier call — Claude Sonnet with fallback.
 * Best for: academic writing, analysis, explanations, study assistance.
 */
export async function standardCall(
  system: string,
  userMessage: string,
  options: { maxTokens?: number; operation?: string; temperature?: number } = {}
): Promise<string> {
  const resp = await gatewayCall({
    tier: "standard",
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: options.maxTokens ?? 8192,
    ...options,
  });
  return resp.content;
}

/**
 * Power-tier call — Claude Sonnet extended tokens with fallback.
 * Best for: full papers, thesis chapters, complex STEM with multi-step reasoning.
 */
export async function powerCall(
  system: string,
  userMessage: string,
  options: { maxTokens?: number; operation?: string; temperature?: number } = {}
): Promise<string> {
  const resp = await gatewayCall({
    tier: "power",
    system,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: options.maxTokens ?? 16000,
    ...options,
  });
  return resp.content;
}
