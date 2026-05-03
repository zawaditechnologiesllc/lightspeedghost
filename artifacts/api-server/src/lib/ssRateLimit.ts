import Bottleneck from "bottleneck";

const limiters: Record<string, Bottleneck> = {
  semanticScholar: new Bottleneck({ minTime: 1100, maxConcurrent: 1 }),
  openAlex: new Bottleneck({ minTime: 200, maxConcurrent: 3 }),
  crossref: new Bottleneck({ minTime: 300, maxConcurrent: 2 }),
  europePMC: new Bottleneck({ minTime: 250, maxConcurrent: 2 }),
  pubmed: new Bottleneck({ minTime: 350, maxConcurrent: 1 }),
  arxiv: new Bottleneck({ minTime: 3100, maxConcurrent: 1 }),
  core: new Bottleneck({ minTime: 500, maxConcurrent: 2 }),
  doaj: new Bottleneck({ minTime: 300, maxConcurrent: 2 }),
  eric: new Bottleneck({ minTime: 500, maxConcurrent: 1 }),
  zenodo: new Bottleneck({ minTime: 300, maxConcurrent: 2 }),
  base: new Bottleneck({ minTime: 500, maxConcurrent: 1 }),
  dataCite: new Bottleneck({ minTime: 300, maxConcurrent: 2 }),
  openAire: new Bottleneck({ minTime: 400, maxConcurrent: 2 }),
  openLibrary: new Bottleneck({ minTime: 200, maxConcurrent: 2 }),
  wikipedia: new Bottleneck({ minTime: 100, maxConcurrent: 3 }),
  googleBooks: new Bottleneck({ minTime: 200, maxConcurrent: 2 }),
  internetArchive: new Bottleneck({ minTime: 300, maxConcurrent: 2 }),
};

export async function ssRateLimit(): Promise<void> {
  await limiters.semanticScholar.schedule(() => Promise.resolve());
}

export function getRateLimiter(api: string): Bottleneck {
  return limiters[api] ?? limiters.crossref;
}

export async function rateLimitedFetch(
  api: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const limiter = getRateLimiter(api);
  return limiter.schedule(() => fetch(url, init));
}
