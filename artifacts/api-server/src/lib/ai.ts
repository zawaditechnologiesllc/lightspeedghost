import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required but not set.");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required but not set.");
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
