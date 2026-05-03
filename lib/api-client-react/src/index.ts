export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

import { customFetch } from "./custom-fetch";

export interface CodeCompareResult {
  similarity1: number;
  similarity2: number;
  overallSimilarity: number;
  tokenOverlap: number;
  slices1: Array<{ start: number; end: number }>;
  slices2: Array<{ start: number; end: number }>;
  highlightedDoc1: string;
  highlightedDoc2: string;
  riskLevel: "low" | "medium" | "high";
  algorithm: string;
  kgramSize: number;
  windowSize: number;
}

export interface CompareCodeBody {
  doc1: string;
  doc2: string;
  language?: string;
}

export function compareCode(body: CompareCodeBody): Promise<CodeCompareResult> {
  return customFetch<CodeCompareResult>("/plagiarism/code", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
