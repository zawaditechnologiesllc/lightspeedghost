/**
 * Grounding — the anti-hallucination layer for finance / markets / current-events
 * questions. When a question needs recent or real-world data, we:
 *   1. Fetch REAL live market data (Yahoo Finance) for any tickers we detect.
 *   2. Attach a shortlist of authoritative sources (from the ~1000-source
 *      registry) the model is told to cite.
 *   3. Impose strict rules: only state a figure/date/event you can ground in the
 *      live data or attribute to one of these named sources; if you can't verify
 *      it, SAY SO and point the user to the source — never invent numbers, prices,
 *      dates, or events.
 *
 * For non-finance/current-events questions this returns "" and changes nothing.
 */
import { pickAuthoritativeSources, AUTHORITATIVE_SOURCE_COUNT } from "./authoritativeSources";
import { extractTickers, fetchYahooQuotes, formatLiveQuotes } from "./financeData";

// Signals that a question depends on recent/real data (so we must ground it).
const FINANCE_TERMS = /\b(stock|shares?|equit(?:y|ies)|ticker|index|indices|market cap|valuation|p\/e|dividend|bond|yield|treasur(?:y|ies)|forex|fx|exchange rate|currenc(?:y|ies)|inflation|cpi|gdp|unemployment|interest rate|rate (?:hike|cut|decision)|central bank|earnings|ipo|merger|acquisition|hedge fund|etf|mutual fund|commodit(?:y|ies)|oil|gold|silver|crude|brent|crypto|bitcoin|ethereum|nasdaq|dow jones|s&p|ftse|nikkei|sensex|nifty|hang seng)\b/i;
const RECENCY_TERMS = /\b(today|yesterday|this (?:week|month|quarter|year)|right now|currently|latest|recent(?:ly)?|current|as of|up to date|breaking|just (?:announced|happened)|202[4-9]|203\d|trending|news)\b/i;
const WORLD_EVENTS = /\b(election|war|conflict|sanctions?|summit|crisis|recession|pandemic|policy|geopolitic|protest|disaster|treaty|ceasefire|coup)\b/i;

/** True when the question needs recent/real data — so we should ground it. */
export function needsRealtimeGrounding(question: string): boolean {
  if (!question) return false;
  if (/\$[A-Za-z]{1,6}\b/.test(question)) return true; // explicit ticker
  const finance = FINANCE_TERMS.test(question);
  const recency = RECENCY_TERMS.test(question);
  const events = WORLD_EVENTS.test(question);
  // Finance questions almost always want current data; world-events need recency.
  return finance || (events && recency) || (recency && /\b(price|worth|cost|value|market|economy|company|stock)\b/i.test(question));
}

/** Rules block appended whenever grounding is active. */
function rulesBlock(): string {
  return [
    "CRITICAL — VERIFIABILITY RULES (this question needs real/recent data, so accuracy is mandatory):",
    "• Only state a specific number, price, rate, date, or current event if it is in the LIVE MARKET DATA above OR you can attribute it to one of the AUTHORITATIVE SOURCES listed. Cite the source by name in-line, e.g. \"(Reuters)\", \"(IMF)\", \"(Yahoo Finance)\".",
    "• If you do NOT have verified current data for something asked, say so plainly — e.g. \"I don't have a verified up-to-date figure for X; check <named source> for the latest\" — and point to the most relevant source(s) below. Do NOT guess or approximate a live figure.",
    "• Never invent statistics, prices, quotes, headlines, or events. Never present your training-cutoff knowledge as current. If timing matters, note that your general knowledge may be out of date and the cited source is authoritative.",
    "• Prefer primary/official sources (central banks, statistics offices, regulators, IMF/World Bank/OECD) for economic data, and Yahoo Finance / Bloomberg / Reuters / the relevant exchange for market prices.",
    "• When you give a figure from the live data, use it exactly as provided (including the timestamp).",
  ].join("\n");
}

/**
 * Build the grounding context block for a question. Async because it fetches
 * live quotes. Returns "" when the question doesn't need real/recent data.
 */
export async function buildGroundingContext(question: string): Promise<string> {
  if (!needsRealtimeGrounding(question)) return "";

  const tickers = extractTickers(question);
  const quotes = tickers.length ? await fetchYahooQuotes(tickers).catch(() => []) : [];
  const liveBlock = formatLiveQuotes(quotes);

  const sources = pickAuthoritativeSources(question, 24);
  const sourceList = sources.map((s) => `• ${s.name} — ${s.url} [${s.region} · ${s.category}]`).join("\n");

  return [
    "",
    "──────── GROUNDING (finance / current-events) ────────",
    liveBlock,
    liveBlock ? "" : "No live quote was fetched for this question — rely on the authoritative sources below and be explicit about what you cannot verify.",
    `AUTHORITATIVE SOURCES you may cite (drawn from our vetted registry of ${AUTHORITATIVE_SOURCE_COUNT} verifiable outlets & institutions worldwide — Yahoo Finance, Bloomberg, Reuters, central banks, statistics offices, regulators, exchanges, IMF/World Bank/OECD, and regional press on every continent):`,
    sourceList,
    "",
    rulesBlock(),
    "──────────────────────────────────────────────────────",
    "",
  ].filter((l) => l !== "").join("\n");
}
