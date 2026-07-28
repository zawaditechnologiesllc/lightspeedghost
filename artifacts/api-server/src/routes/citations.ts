import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { searchAllAcademicSources } from "../lib/academicSources";
import { logger } from "../lib/logger";

// ── Citation suggestions (Jenni-style, but no LLM) ────────────────────────────
// For each claim in the peer-reviewed text that lacks a citation, return real
// academic papers that could support it — pulled straight from the live academic
// databases and ranked. No AI model is involved, so this is cheap and honest.

const router: IRouter = Router();

const SuggestBody = z.object({
  claims: z.array(z.string().min(8).max(400)).min(1).max(6),
  subject: z.string().max(80).optional(),
});

router.post("/citations/suggest", requireAuth, async (req, res) => {
  const parsed = SuggestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide 1–6 claims (8–400 characters each)." });
    return;
  }
  const { claims, subject } = parsed.data;

  try {
    const results = await Promise.all(
      claims.map(async (claim) => {
        try {
          const papers = await Promise.race([
            searchAllAcademicSources(claim, 4, subject),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
          ]);
          const sources = papers
            .filter((p) => p.title && (p.doi || p.url) && p.abstract && p.abstract.length > 40)
            .slice(0, 3)
            .map((p) => ({
              title: p.title,
              authors: p.authors,
              year: p.year,
              doi: p.doi ?? null,
              url: p.doi ? `https://doi.org/${p.doi}` : p.url,
              source: p.source,
            }));
          return { claim, sources };
        } catch {
          return { claim, sources: [] as unknown[] };
        }
      }),
    );
    res.json({ results });
  } catch (err) {
    logger.error({ err }, "[citations] suggest failed");
    res.status(500).json({ error: "Could not fetch citation suggestions — please try again." });
  }
});

export default router;
