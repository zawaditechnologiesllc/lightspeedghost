/**
 * ML services — LOCAL-FIRST.
 *
 * The platform's paraphrase, summarise and semantic-similarity capabilities run
 * on our own in-process engines (localSemantic / localSummarize / localHumanize)
 * — no Hugging Face API, no LanguageTool server, no per-token fees, no external
 * dependency. Those local engines are the DEFAULT and the shipped behaviour.
 *
 * The Hugging Face / LanguageTool hooks below are OPTIONAL accelerators that are
 * OFF unless you explicitly set HF_API_TOKEN / LANGUAGETOOL_URL. We keep them as
 * a drop-in upgrade path (e.g. if you later self-host a model on a GPU box), but
 * nothing here depends on them and the product is fully functional without them.
 *
 * Optional env (all unset by default → everything uses the local engines):
 *   HF_API_TOKEN            — Hugging Face Inference token (optional accelerator)
 *   LANGUAGETOOL_URL        — self-hosted LanguageTool (optional grammar upgrade)
 *   ML_AIDETECT_MODEL       — default Hello-SimpleAI/chatgpt-detector-roberta
 *   ML_EMBED_MODEL          — default sentence-transformers/all-MiniLM-L6-v2
 */
import { logger } from "./logger";
import { semanticSimilarity as localSemanticSimilarity } from "./localSemantic";
import { summarizeExtractive } from "./localSummarize";
import { humanizeLocal } from "./localHumanize";

const HF_TOKEN = process.env.HF_API_TOKEN;
const HF_BASE = "https://api-inference.huggingface.co/models";
const LT_URL = process.env.LANGUAGETOOL_URL;

const EMBED_MODEL    = process.env.ML_EMBED_MODEL    ?? "sentence-transformers/all-MiniLM-L6-v2";
const AIDETECT_MODEL = process.env.ML_AIDETECT_MODEL ?? "Hello-SimpleAI/chatgpt-detector-roberta";

export const mlEnabled = {
  /** External grammar service configured? (optional — local regex grammar is default) */
  get languageTool() { return Boolean(LT_URL); },
  /** External HF accelerator configured? (optional — local engines are default) */
  get huggingface() { return Boolean(HF_TOKEN); },
};

async function hf<T>(model: string, payload: unknown, timeoutMs = 12_000): Promise<T | null> {
  if (!HF_TOKEN) return null;
  try {
    const res = await fetch(`${HF_BASE}/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null; // 503 = model loading; caller falls back this time
    return (await res.json()) as T;
  } catch (err) {
    logger.warn({ err, model }, "[ml] optional HF accelerator failed — using local engine");
    return null;
  }
}

// ── Semantic similarity — LOCAL by default ────────────────────────────────────
/** 0–100 semantic similarity. Uses the local engine; no external call needed. */
export async function semanticSimilarityML(a: string, b: string): Promise<number> {
  if (HF_TOKEN) {
    const [va, vb] = await Promise.all([embedText(a), embedText(b)]);
    if (va && vb) return Math.round(cosine(va, vb) * 1000) / 10;
  }
  return localSemanticSimilarity(a, b);
}

// ── Paraphrase / humanize — LOCAL by default ──────────────────────────────────
/** Rule-based local humanize by default; optional HF T5 if configured. */
export async function paraphraseML(text: string, tone: "academic" | "conversational" | "professional" = "academic"): Promise<string> {
  if (HF_TOKEN) {
    const out = await hf<Array<{ generated_text: string }>>(
      process.env.ML_PARAPHRASE_MODEL ?? "humarin/chatgpt_paraphraser_on_T5_base",
      { inputs: text.slice(0, 2000), parameters: { max_new_tokens: 256 }, options: { wait_for_model: true } },
    );
    if (out?.[0]?.generated_text) return out[0].generated_text;
  }
  return humanizeLocal(text, { tone }).text;
}

// ── Summarize — LOCAL by default ──────────────────────────────────────────────
/** Extractive local summary by default; optional HF BART if configured. */
export async function summarizeML(text: string, maxSentences = 5): Promise<string> {
  if (HF_TOKEN) {
    const out = await hf<Array<{ summary_text: string }>>(
      process.env.ML_SUMMARY_MODEL ?? "facebook/bart-large-cnn",
      { inputs: text.slice(0, 6000), options: { wait_for_model: true } },
    );
    if (out?.[0]?.summary_text) return out[0].summary_text;
  }
  return summarizeExtractive(text, maxSentences).keySentences.join(" ");
}

// ── AI-text detection (optional HF RoBERTa) ───────────────────────────────────
// OFF by default. When unset, aiDetection.ts uses its local burstiness+perplexity
// detector (and the paid LLM path). Returns null unless HF_API_TOKEN is set.
export async function detectAIML(text: string): Promise<number | null> {
  if (!HF_TOKEN) return null;
  const out = await hf<Array<Array<{ label: string; score: number }>> | Array<{ label: string; score: number }>>(
    AIDETECT_MODEL, { inputs: text.slice(0, 4000), options: { wait_for_model: true } });
  if (!out) return null;
  const arr = (Array.isArray(out[0]) ? out[0] : out) as Array<{ label: string; score: number }>;
  const ai = arr.find((x) => /fake|ai|chatgpt|machine|generated|label_1/i.test(x.label));
  return ai ? Math.round(ai.score * 100) : null;
}

// ── Grammar (optional LanguageTool) ───────────────────────────────────────────
// OFF by default. The free checker uses the local regex grammar engine unless a
// self-hosted LanguageTool URL is provided here as an upgrade.
export interface LTMatch { message: string; offset: number; length: number; replacement?: string; rule: string; category: string; }
export async function checkGrammarML(text: string, language = "en-US"): Promise<LTMatch[] | null> {
  if (!LT_URL) return null;
  try {
    const body = new URLSearchParams({ text: text.slice(0, 20000), language, level: "picky" });
    const res = await fetch(`${LT_URL.replace(/\/$/, "")}/v2/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { matches?: Array<{ message: string; offset: number; length: number; replacements?: Array<{ value: string }>; rule?: { id?: string; category?: { id?: string } } }> };
    return (data.matches ?? []).map((m) => ({
      message: m.message,
      offset: m.offset,
      length: m.length,
      replacement: m.replacements?.[0]?.value,
      rule: m.rule?.id ?? "",
      category: m.rule?.category?.id ?? "",
    }));
  } catch (err) {
    logger.warn({ err }, "[ml] optional LanguageTool failed — using local grammar");
    return null;
  }
}

// ── Optional HF embeddings (only used when HF_API_TOKEN is set) ────────────────
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
async function embedText(text: string): Promise<number[] | null> {
  const out = await hf<number[] | number[][]>(EMBED_MODEL, { inputs: text.slice(0, 4000), options: { wait_for_model: true } });
  if (!out) return null;
  const vec = Array.isArray(out[0]) ? (out as number[][])[0] : (out as number[]);
  return Array.isArray(vec) ? vec : null;
}
