import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { SolveStemBody } from "@workspace/api-zod";
import { getNextDocNumber, formatDocTitle } from "../lib/docLabels";
import { reactSolve } from "../lib/reactLoop";
import { chainOfVerification } from "../lib/cove";
import { searchSemanticScholar } from "../lib/citationVerifier";
import { recordUsage } from "../lib/apiCost";
import { anthropic } from "../lib/ai";
import { ACADEMIC_SOUL } from "../lib/soul";
import { trackUsage } from "../lib/usageTracker";

const router = Router();

const STEM_SUBJECTS = [
  { id: "mathematics", name: "Mathematics", description: "Algebra, calculus, statistics, geometry, discrete math", icon: "sigma" },
  { id: "physics", name: "Physics", description: "Mechanics, thermodynamics, electromagnetism, quantum physics", icon: "atom" },
  { id: "chemistry", name: "Chemistry", description: "Organic, inorganic, physical chemistry, biochemistry", icon: "flask" },
  { id: "biology", name: "Biology", description: "Cell biology, genetics, ecology, evolution, physiology", icon: "dna" },
  { id: "engineering", name: "Engineering", description: "Civil, mechanical, electrical, chemical engineering", icon: "cog" },
  { id: "computer_science", name: "Computer Science", description: "Algorithms, data structures, complexity theory, AI/ML", icon: "cpu" },
  { id: "statistics", name: "Statistics", description: "Probability, hypothesis testing, regression, Bayesian methods", icon: "chart-bar" },
];

router.get("/stem/subjects", async (req, res) => {
  res.json({ subjects: STEM_SUBJECTS });
});

router.post("/stem/solve", async (req, res) => {
  try {
    if (req.userId) trackUsage(req.userId, "stem").catch(() => {});
    const body = SolveStemBody.parse(req.body);

    // 1. ReAct Loop — Pi Engine pattern: Think → Act → Observe → Reflect
    const reactResult = await reactSolve(body.problem, body.subject);

    // 2. Chain-of-Verification — Critic Agent checks for errors (Gauth-killer pattern)
    const coveResult = await chainOfVerification(body.problem, body.subject, reactResult);

    // 3. Map ReAct steps to the expected frontend format
    const steps = reactResult.steps.map((s, i) => ({
      stepNumber: i + 1,
      description: s.description,
      expression: s.expression || "",
      explanation: s.explanation,
    }));

    // 4. Generate graph data if requested
    let graphData = null;
    if (body.generateGraph) {
      graphData = generateGraphForSubject(body.subject, body.problem);
    }

    // 5. Build final answer — use CoVe-verified version if corrections were made
    const finalAnswer = coveResult.passedVerification
      ? reactResult.finalAnswer
      : coveResult.verified;

    const latex = coveResult.verifiedLatex || reactResult.latex;

    const content = [
      `Problem: ${body.problem}`,
      "",
      `Answer: ${finalAnswer}`,
      "",
      coveResult.corrections.length > 0
        ? `Corrections applied:\n${coveResult.corrections.map((c) => `• ${c}`).join("\n")}\n`
        : "",
      "Steps:",
      ...steps.map((s) => `${s.stepNumber}. ${s.description}\n   ${s.explanation}`),
    ]
      .filter(Boolean)
      .join("\n");

    const userId = req.userId ?? null;
    const docNum = await getNextDocNumber(userId, "stem");
    const [doc] = await db
      .insert(documentsTable)
      .values({
        userId,
        title: formatDocTitle({ type: "stem", docNumber: docNum, subject: body.subject }),
        content,
        type: "stem",
        subject: body.subject,
        docNumber: docNum,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      })
      .returning();

    res.json({
      answer: finalAnswer,
      steps,
      graphData,
      latex,
      subject: body.subject,
      confidence: reactResult.confidence,
      corrections: coveResult.corrections,
      passedVerification: coveResult.passedVerification,
      documentId: doc.id,
    });
  } catch (err) {
    req.log.error({ err }, "Error solving STEM problem");
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("API_KEY") || msg.includes("not set")) {
      res.status(503).json({ error: "AI service not configured on this server. Please contact support." });
    } else {
      res.status(500).json({ error: "Failed to solve problem. Please try again." });
    }
  }
});

// Semantic Scholar paper search (already real API — keeping and enhancing)
router.get("/stem/papers", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const subject = typeof req.query.subject === "string" ? req.query.subject : "";
    if (!q || q.length < 3) {
      return res.status(400).json({ error: "Query must be at least 3 characters" });
    }

    const params = new URLSearchParams({
      query: `${q} ${subject}`.trim(),
      limit: "8",
      fields: "title,authors,year,abstract,externalIds,openAccessPdf,url,citationCount",
    });

    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
      {
        headers: { "User-Agent": "LightSpeedGhost/1.0" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) return res.json({ papers: [] });

    const data = (await response.json()) as {
      data: Array<{
        paperId: string;
        title?: string;
        authors?: Array<{ name: string }>;
        year?: number;
        abstract?: string;
        externalIds?: { DOI?: string };
        openAccessPdf?: { url: string };
        url?: string;
        citationCount?: number;
      }>;
    };

    const papers = (data.data ?? []).map((p) => ({
      paperId: p.paperId,
      title: p.title ?? "Unknown Title",
      authors: (p.authors ?? []).map((a) => a.name).join(", "),
      year: p.year ?? null,
      abstract: p.abstract ?? null,
      url: p.openAccessPdf?.url ?? p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
      citationCount: p.citationCount ?? 0,
    }));

    res.json({ papers });
  } catch (err) {
    req.log.error({ err }, "Error searching papers");
    res.json({ papers: [] });
  }
});

// GET: used by frontend (?paperId=... or ?q=...) — returns similar/related papers
router.get("/stem/papers/recommend", async (req, res) => {
  try {
    const paperId = typeof req.query.paperId === "string" ? req.query.paperId.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!paperId && !q) return res.status(400).json({ error: "paperId or q is required" });

    // Use Semantic Scholar's recommendations API when a paper ID is provided
    if (paperId) {
      try {
        const recResp = await fetch(
          `https://api.semanticscholar.org/recommendations/v1/papers/forpaper/${encodeURIComponent(paperId)}?limit=5&fields=title,authors,year,abstract,url,openAccessPdf,citationCount`,
          { headers: { "User-Agent": "LightSpeedGhost/1.0" }, signal: AbortSignal.timeout(8000) }
        );
        if (recResp.ok) {
          const recData = (await recResp.json()) as {
            recommendedPapers?: Array<{
              paperId?: string;
              title?: string;
              authors?: Array<{ name: string }>;
              year?: number;
              abstract?: string;
              url?: string;
              openAccessPdf?: { url: string };
              citationCount?: number;
            }>;
          };
          const papers = (recData.recommendedPapers ?? []).map((p) => ({
            paperId: p.paperId ?? "",
            title: p.title ?? "Unknown",
            authors: (p.authors ?? []).map((a) => a.name).join(", "),
            year: p.year ?? null,
            abstract: p.abstract ?? null,
            url: p.openAccessPdf?.url ?? p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
            citationCount: p.citationCount ?? 0,
          }));
          if (papers.length > 0) return res.json({ papers });
        }
      } catch { /* fall through to keyword search */ }
    }

    // Fallback: keyword search
    const papers = await searchSemanticScholar(q || paperId, 5);
    res.json({ papers });
  } catch (err) {
    req.log.error({ err }, "Error recommending papers");
    res.json({ papers: [] });
  }
});

// POST: legacy / direct calls with topic in body
router.post("/stem/papers/recommend", async (req, res) => {
  try {
    const { topic, subject } = req.body as { topic?: string; subject?: string };
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const papers = await searchSemanticScholar(`${topic} ${subject ?? ""}`.trim(), 5);
    res.json({ papers });
  } catch (err) {
    req.log.error({ err }, "Error recommending papers");
    res.json({ papers: [] });
  }
});

router.get("/stem/biomodels", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "cancer";
    const response = await fetch(
      `https://www.ebi.ac.uk/biomodels/search?query=${encodeURIComponent(q)}&numResults=5&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!response.ok) return res.json({ models: [] });
    const data = (await response.json()) as { models?: Array<{ id: string; name: string; description?: string; lastModified?: string; publicationCount?: number; format?: string }> };
    const models = (data.models ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? null,
      lastModified: m.lastModified ?? null,
      publicationCount: m.publicationCount ?? 0,
      format: m.format ?? "SBML",
      url: `https://www.ebi.ac.uk/biomodels/${m.id}`,
    }));
    res.json({ models });
  } catch (err) {
    req.log.error({ err }, "Error searching BioModels");
    res.json({ models: [] });
  }
});

// Accept both POST (body.name) and GET (?q=...) so the frontend helper works either way
router.get("/stem/molecule", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ error: "q query param is required" });
  req.body = { name: q };
  // fall through to the shared handler below by calling the POST handler inline
  return handleMoleculeLookup(req, res);
});

router.post("/stem/molecule", async (req, res) => {
  return handleMoleculeLookup(req, res);
});

async function handleMoleculeLookup(req: import("express").Request, res: import("express").Response) {
  try {
    const { name } = req.body as { name?: string };
    if (!name) return res.status(400).json({ error: "name is required" });

    const searchResp = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/JSON`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!searchResp.ok) return res.status(404).json({ error: "Molecule not found" });

    const data = (await searchResp.json()) as {
      PC_Compounds?: Array<{
        id?: { id?: { cid?: number } };
        props?: Array<{ urn?: { label?: string; name?: string }; value?: { sval?: string; fval?: number; ival?: number } }>;
      }>;
    };

    const compound = data.PC_Compounds?.[0];
    if (!compound) return res.status(404).json({ error: "Molecule not found" });

    const cid = compound.id?.id?.cid ?? 0;
    const props = compound.props ?? [];
    const getProp = (label: string, name?: string) =>
      props.find((p) => p.urn?.label === label && (!name || p.urn?.name === name))?.value;

    res.json({
      cid,
      iupacName: getProp("IUPAC Name", "Preferred")?.sval ?? null,
      commonName: name,
      casNumber: getProp("CAS-like style SMILES")?.sval ?? null,
      smiles: getProp("SMILES", "Canonical")?.sval ?? null,
      formula: getProp("Molecular Formula")?.sval ?? null,
      molecularWeight: getProp("Molecular Weight")?.fval ?? (getProp("Molecular Weight")?.sval ? parseFloat(getProp("Molecular Weight")!.sval!) : null),
      xLogP: getProp("Log P")?.fval ?? null,
      hBondDonors: getProp("Count", "Hydrogen Bond Donor")?.ival ?? null,
      hBondAcceptors: getProp("Count", "Hydrogen Bond Acceptor")?.ival ?? null,
      rotatableBonds: getProp("Count", "Rotatable Bond")?.ival ?? null,
      tpsa: getProp("Topological Polar Surface Area")?.fval ?? null,
      ghsHazards: [],
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      synonyms: [],
    });
  } catch (err) {
    req.log.error({ err }, "Error looking up molecule");
    res.status(500).json({ error: "Internal server error" });
  }
}

function generateGraphForSubject(
  subject: string,
  problem: string
): {
  type: "line";
  data: Array<{ x: number; y: number; label: string }>;
  labels: { x: string; y: string; title: string };
} {
  const points = Array.from({ length: 12 }, (_, i) => {
    const x = i - 2;
    let y: number;
    if (subject === "mathematics" || subject === "physics") {
      y = Math.pow(x, 2) - 2 * x + 1;
    } else if (subject === "statistics") {
      y = Math.exp(-Math.pow(x, 2) / 2) / Math.sqrt(2 * Math.PI);
    } else {
      y = Math.sin(x * 0.8) * 5 + x * 0.5;
    }
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(4)), label: `x=${x}` };
  });

  return {
    type: "line",
    data: points,
    labels: {
      x: "x",
      y: subject === "statistics" ? "P(x)" : "f(x)",
      title: `Solution Visualization — ${subject}`,
    },
  };
}

export default router;
