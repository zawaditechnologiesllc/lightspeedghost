/**
 * Shared Semantic Scholar rate limiter.
 * API key tier: 1 request per second, cumulative across all endpoints.
 * Both academicSources.ts and citationVerifier.ts import this to share the slot.
 */

let _lastSSCall = 0;

export async function ssRateLimit(): Promise<void> {
  const gap = Date.now() - _lastSSCall;
  if (gap < 1100) await new Promise<void>((r) => setTimeout(r, 1100 - gap));
  _lastSSCall = Date.now();
}
