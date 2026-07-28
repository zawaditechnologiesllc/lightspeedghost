# Open-source ML models — integration & activation

We integrate reputable **open-source** models so the tools get QuillBot/Grammarly-
grade quality **without paying per-token LLM fees**. (QuillBot/Grammarly/StealthWriter
themselves are proprietary and can't be embedded — these are open models that do the
same jobs.) All of this is wired through `artifacts/api-server/src/lib/mlServices.ts`.

> **Important:** every integration is **env-gated and fallback-safe**. If the env var
> isn't set — or a call fails/times out — the function returns `null` and the caller
> falls back to the existing deterministic heuristic. So this is **live in code but
> dormant until you provision the services**, with **zero risk** to current behaviour.
> These are ML models (small transformers), i.e. **no *paid* LLM**, not "no model at all."

## What maps to which tool

| Capability | Model (default) | Wired into | Status |
|---|---|---|---|
| **AI-text detection** | `Hello-SimpleAI/chatgpt-detector-roberta` | `aiDetection.ts` (paid AI/plagiarism check) — blended 45% with the existing score | **Wired** (dormant until `HF_API_TOKEN`) |
| **Semantic similarity** (paraphrased-plagiarism) | `sentence-transformers/all-MiniLM-L6-v2` | `mlServices.semanticSimilarityML` — ready to blend into the plagiarism scan | Ready; wire next |
| **Grammar/style** | LanguageTool (self-host) | `mlServices.checkGrammarML` — ready for the free checker's Grammar tab | Ready; wire next |
| **Paraphrase / humanize** | `humarin/chatgpt_paraphraser_on_T5_base` | `mlServices.paraphraseML` — free/no-paid-LLM humanizer fallback | Ready; wire next |
| **Summaries (study)** | `facebook/bart-large-cnn` | `mlServices.summarizeML` — study summaries without a paid LLM | Ready; wire next |

## Activate

Set on the API server (Render → Environment):

```
HF_API_TOKEN         = hf_xxx          # Hugging Face Inference API token (free tier works)
LANGUAGETOOL_URL     = https://api.languagetool.org      # or your self-hosted LanguageTool
# Optional overrides:
ML_EMBED_MODEL       = sentence-transformers/all-MiniLM-L6-v2
ML_AIDETECT_MODEL    = Hello-SimpleAI/chatgpt-detector-roberta
ML_PARAPHRASE_MODEL  = humarin/chatgpt_paraphraser_on_T5_base
ML_SUMMARY_MODEL     = facebook/bart-large-cnn
```

- The **HF Inference API** free tier is rate-limited and cold-starts models (503 while
  loading → we fall back that call). For production volume, self-host the models on a
  small GPU box (or use HF Inference **Endpoints**) and point `HF_BASE`/URLs at them.
- **LanguageTool** is best self-hosted (Docker: `erikvl87/languagetool`); the public API
  is rate-limited. It replaces our regex grammar with thousands of real rules.

## Why not "replicate their code"?

LanguageTool is a large Java rule engine and the HF models are trained neural nets —
they can't be hand-reimplemented in our Node backend. The correct, standard integration
is to **call them as services** (self-hosted or API), which is exactly what `mlServices.ts`
does. That's how production systems use these models.
