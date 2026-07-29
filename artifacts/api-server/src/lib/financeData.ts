/**
 * Live finance data — fetches REAL, current market data from Yahoo Finance's
 * public endpoints (no API key) so answers about prices/markets are grounded in
 * actual numbers instead of the model's memory. This is the anti-hallucination
 * backbone for finance questions: if we have a live quote, we hand the model the
 * real figure; if we can't fetch, we tell the model to say so rather than guess.
 *
 * Fault-tolerant: any network/parse failure returns null/empty and the caller
 * falls back to the authoritative-source allowlist + "don't fabricate" rules.
 */
import { logger } from "./logger";

const YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";
const UA = "Mozilla/5.0 (compatible; LightSpeedGhost/1.0; +https://lightspeedghost.com)";

export interface LiveQuote {
  symbol: string;
  name?: string;
  price: number;
  previousClose?: number;
  changePct?: number;
  currency?: string;
  exchange?: string;
  asOf: string; // ISO timestamp of the quote
}

// Common company / asset names → ticker, so "what's Apple trading at" resolves
// without a lookup round-trip. Not exhaustive — the search endpoint handles the rest.
const NAME_TO_SYMBOL: Record<string, string> = {
  apple: "AAPL", microsoft: "MSFT", amazon: "AMZN", tesla: "TSLA", nvidia: "NVDA",
  google: "GOOGL", alphabet: "GOOGL", meta: "META", facebook: "META", netflix: "NFLX",
  "berkshire hathaway": "BRK-B", jpmorgan: "JPM", visa: "V", mastercard: "MA",
  walmart: "WMT", disney: "DIS", boeing: "BA", intel: "INTC", amd: "AMD",
  coca: "KO", "coca-cola": "KO", pepsi: "PEP", mcdonald: "MCD", nike: "NKE",
  exxon: "XOM", chevron: "CVX", pfizer: "PFE", moderna: "MRNA", "goldman sachs": "GS",
   "s&p 500": "^GSPC", "s&p500": "^GSPC", "sp500": "^GSPC", "dow jones": "^DJI", dow: "^DJI",
  nasdaq: "^IXIC", "ftse 100": "^FTSE", ftse: "^FTSE", nikkei: "^N225", "hang seng": "^HSI",
  dax: "^GDAXI", "cac 40": "^FCHI", sensex: "^BSESN", nifty: "^NSEI",
  bitcoin: "BTC-USD", btc: "BTC-USD", ethereum: "ETH-USD", eth: "ETH-USD",
  gold: "GC=F", silver: "SI=F", oil: "CL=F", crude: "CL=F", "brent": "BZ=F",
  "us dollar": "DX-Y.NYB", eurusd: "EURUSD=X", gbpusd: "GBPUSD=X", usdjpy: "JPY=X",
};

/**
 * Extract candidate tickers from a question: explicit $TICKER, and known company
 * / index / asset names. Bounded to a handful so we don't fan out excessively.
 */
export function extractTickers(text: string, max = 6): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\$([A-Za-z][A-Za-z.\-]{0,6})\b/g)) found.add(m[1].toUpperCase());
  const low = text.toLowerCase();
  for (const [name, sym] of Object.entries(NAME_TO_SYMBOL)) {
    if (low.includes(name)) found.add(sym);
    if (found.size >= max) break;
  }
  return [...found].slice(0, max);
}

/** Fetch one live quote via the chart endpoint (no auth needed). */
export async function fetchYahooQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const res = await fetch(`${YF_CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: {
        symbol?: string; regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number;
        currency?: string; exchangeName?: string; regularMarketTime?: number; longName?: string; shortName?: string;
      } }> };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    return {
      symbol: meta.symbol ?? symbol.toUpperCase(),
      name: meta.longName ?? meta.shortName,
      price: meta.regularMarketPrice,
      previousClose: prev,
      changePct: prev ? Math.round(((meta.regularMarketPrice - prev) / prev) * 10000) / 100 : undefined,
      currency: meta.currency,
      exchange: meta.exchangeName,
      asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err, symbol }, "[finance] Yahoo quote fetch failed — non-fatal");
    return null;
  }
}

/** Fetch several quotes in parallel; drops the ones that fail. */
export async function fetchYahooQuotes(symbols: string[]): Promise<LiveQuote[]> {
  if (!symbols.length) return [];
  const results = await Promise.all(symbols.slice(0, 6).map(fetchYahooQuote));
  return results.filter((q): q is LiveQuote => q !== null);
}

/** Resolve a company/asset name to its most likely ticker via Yahoo search. */
export async function searchYahooSymbol(name: string): Promise<string | null> {
  try {
    const res = await fetch(`${YF_SEARCH}?q=${encodeURIComponent(name)}&quotesCount=1&newsCount=0`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { quotes?: Array<{ symbol?: string }> };
    return data.quotes?.[0]?.symbol ?? null;
  } catch {
    return null;
  }
}

/** Format live quotes into a prompt-ready block the model must ground figures in. */
export function formatLiveQuotes(quotes: LiveQuote[]): string {
  if (!quotes.length) return "";
  const lines = quotes.map((q) => {
    const chg = q.changePct !== undefined ? ` (${q.changePct >= 0 ? "+" : ""}${q.changePct}% vs prev close)` : "";
    const cur = q.currency ? ` ${q.currency}` : "";
    return `• ${q.name ? `${q.name} ` : ""}${q.symbol}: ${q.price}${cur}${chg} — ${q.exchange ?? "market"}, as of ${q.asOf} [source: Yahoo Finance]`;
  });
  return `LIVE MARKET DATA (real, fetched just now from Yahoo Finance — use these exact figures; do not alter them):\n${lines.join("\n")}`;
}
