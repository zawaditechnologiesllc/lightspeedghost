import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * Returns an Anthropic client configured for the current environment:
 *
 *  • Replit dev  — uses AI_INTEGRATIONS_ANTHROPIC_BASE_URL + AI_INTEGRATIONS_ANTHROPIC_API_KEY
 *                  (Replit-managed proxy; supports claude-sonnet-4-5, claude-haiku-4-5, etc.)
 *  • Production  — uses ANTHROPIC_API_KEY directly against api.anthropic.com
 */
export function getAnthropic(): Anthropic {
  const proxyBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const proxyApiKey  = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (proxyBaseUrl && proxyApiKey) {
    return new Anthropic({ baseURL: proxyBaseUrl, apiKey: proxyApiKey });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please add it as a secret.");
  }
  return new Anthropic({ apiKey });
}

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Please add it as a secret.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return getAnthropic()[prop as keyof Anthropic];
  },
});

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return getOpenAI()[prop as keyof OpenAI];
  },
});
