/**
 * Open-source ML services — integration layer for the free/open models we can
 * self-host or call cheaply, so we get QuillBot/Grammarly-grade quality WITHOUT
 * paying per-token LLM fees.
 *
 *   • Grammar/style     → LanguageTool   (self-hosted or public API)
 *   • Semantic similarity → sentence-transformers embeddings (HF Inference API)
 *   • AI-text detection → RoBERTa detector (HF Inference API)
 *   • Paraphrase        → T5 paraphraser  (HF Inference API)
 *   • Summarize         → BART/Pegasus    (HF Inference API)
 *
 * EVERYTHING here is OPTIONAL and env-gated. If the relevant env var is not set
 * (or a call fails/times out), each function returns null and the caller falls
 * back to the existing deterministic heuristic — so production behaviour is
 * unchanged until these are configured. That means shipping this is zero-risk.
 *
 * Activate by setting (see ML_MODELS.md):
 *   HF_API_TOKEN            — Hugging Face Inference API token (free tier works)
 *   LANGUAGETOOL_URL        — e.g. https://api.languagetool.org  or your self-host
 *   ML_EMBED_MODEL          — default sentence-transformers/all-MiniLM-L6-v2
 *   ML_AIDETECT_MODEL       — default Hello-SimpleAI/chatgpt-detector-roberta
 *   ML_PARAPHRASE_MODEL     — default humarin/chatgpt_paraphraser_on_T5_base
 *   ML_SUMMARY_MODEL        — default facebook/bart-large-cnn
 */
import { logger } from "./logger";

const HF_TOKEN = process.env.HF_API_TOKEN;
const HF_BASE = "https://api-inference.huggingface.co/models";
const LT_URL = process.env.LANGUAGETOOL_URL;

const EMBED_MODEL     = process.env.ML_EMBED_MODEL     ?? "sentence-transformers/all-MiniLM-L6-v2";
const AIDETECT_MODEL  = process.env.ML_AIDETECT_MODEL  ?? "Hello-SimpleAI/chatgpt-detector-roberta";
const PARAPHRASE_MODEL = process.env.ML_PARAPHRASE_MODEL ?? "humarin/chatgpt_paraphraser_on_T5_base";
const SUMMARY_MODEL   = process.env.ML_SUMMARY_MODEL   ?? "facebook/bart-large-cnn";

export const mlEnabled = {
  get languageTool() { return Boolean(LT_URL); },
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
    logger.warn({ err, model }, "[ml] HF inference failed — falling back");
    return null;
  }
}

// ── Grammar (LanguageTool) ────────────────────────────────────────────────────
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
    logger.warn({ err }, "[ml] LanguageTool failed — falling back");
    return null;
  }
}

// ── Semantic similarity (sentence-transformers embeddings) ────────────────────
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
export async function embedText(text: string): Promise<number[] | null> {
  const out = await hf<number[] | number[][]>(EMBED_MODEL, { inputs: text.slice(0, 4000), options: { wait_for_model: true } });
  if (!out) return null;
  const vec = Array.isArray(out[0]) ? (out as number[][])[0] : (out as number[]);
  return Array.isArray(vec) ? vec : null;
}
/** 0–100 semantic similarity — catches paraphrased plagiarism that TF-cosine misses. */
export async function semanticSimilarityML(a: string, b: string): Promise<number | null> {
  const [va, vb] = await Promise.all([embedText(a), embedText(b)]);
  if (!va || !vb) return null;
  return Math.round(cosine(va, vb) * 1000) / 10;
}

// ── AI-text detection (RoBERTa) ───────────────────────────────────────────────
/** 0–100 probability the text is AI-generated, or null if unavailable. */
export async function detectAIML(text: string): Promise<number | null> {
  const out = await hf<Array<Array<{ label: string; score: number }>> | Array<{ label: string; score: number }>>(
    AIDETECT_MODEL, { inputs: text.slice(0, 4000), options: { wait_for_model: true } });
  if (!out) return null;
  const arr = (Array.isArray(out[0]) ? out[0] : out) as Array<{ label: string; score: number }>;
  const ai = arr.find((x) => /fake|ai|chatgpt|machine|generated|label_1/i.test(x.label));
  return ai ? Math.round(ai.score * 100) : null;
}

// ── Paraphrase (T5) — a no-paid-LLM humanizer fallback ────────────────────────
export async function paraphraseML(text: string): Promise<string | null> {
  const out = await hf<Array<{ generated_text: string }>>(
    PARAPHRASE_MODEL, { inputs: text.slice(0, 2000), parameters: { max_new_tokens: 256 }, options: { wait_for_model: true } });
  return out?.[0]?.generated_text ?? null;
}

// ── Summarize (BART) — study summaries without a paid LLM ─────────────────────
export async function summarizeML(text: string): Promise<string | null> {
  const out = await hf<Array<{ summary_text: string }>>(
    SUMMARY_MODEL, { inputs: text.slice(0, 6000), options: { wait_for_model: true } });
  return out?.[0]?.summary_text ?? null;
}
