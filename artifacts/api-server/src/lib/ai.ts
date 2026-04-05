import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please add it as a secret.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
