import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { GeneratePaperBody, GenerateOutlineBody } from "@workspace/api-zod";
import { anthropic, openai } from "../lib/ai";
import { WRITER_SOUL } from "../lib/soul";
import { getVerifiedCitations } from "../lib/citationVerifier";
import { recordUsage } from "../lib/apiCost";

const router = Router();

router.post("/writing/generate", async (req, res) => {
  try {
    const body = GeneratePaperBody.parse(req.body);

    // 1. Fetch REAL citations — VerifiedRegistry prevents hallucinated references
    const citationCount = body.length === "long" ? 8 : body.length === "medium" ? 5 : 3;
    const citations = await getVerifiedCitations(
      body.topic,
      body.subject,
      citationCount,
      body.citationStyle
    );

    const citationContext =
      citations.length > 0
        ? `VERIFIED CITATIONS (use ONLY these — never invent additional sources):\n` +
          citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n")
        : "No verified citations retrieved — do not fabricate sources. Mark any citation needed as [citation needed].";

    const wordTargets: Record<string, number> = { short: 800, medium: 1500, long: 3000 };
    const targetWords = wordTargets[body.length ?? "medium"] ?? 1500;

    const systemPrompt = `${WRITER_SOUL}

${citationContext}

PAPER REQUIREMENTS:
- Type: ${body.paperType}
- Subject: ${body.subject}
- Citation style: ${body.citationStyle.toUpperCase()}
- Target length: approximately ${targetWords} words
- Use ONLY the verified citations listed above (reference by number)
- Write in full markdown with headings (## for sections, ### for subsections)
- All mathematical expressions in LaTeX: inline $...$ and block $$...$$
${body.additionalInstructions ? `- Additional instructions: ${body.additionalInstructions}` : ""}`;

    // 2. Generate paper with Claude 3.5 Sonnet — Reasoning model (ClawRouter)
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write a complete, high-quality academic ${body.paperType} on: "${body.topic}"\n\nStructure: Abstract → Introduction → Literature Review → Methodology → Results/Discussion → Conclusion → References\n\nUse the verified citations provided and format References in ${body.citationStyle.toUpperCase()} style.`,
        },
      ],
    });

    const usage = response.usage;
    recordUsage("claude-3-5-sonnet-20241022", usage.input_tokens, usage.output_tokens, "paper-generation");

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // 3. Format bibliography with GPT-4o-mini — cheap formatting task (ClawRouter)
    let bibliography = citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n");
    try {
      const bibResp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `Format these citations as a clean ${body.citationStyle.toUpperCase()} bibliography. Return ONLY the bibliography list, numbered.`,
          },
          {
            role: "user",
            content: citations.map((c, i) => `[${i + 1}] ${c.formatted}`).join("\n"),
          },
        ],
      });
      const bibText = bibResp.choices[0]?.message?.content;
      if (bibText) bibliography = bibText;
      if (bibResp.usage) {
        recordUsage("gpt-4o-mini", bibResp.usage.prompt_tokens, bibResp.usage.completion_tokens, "bibliography-format");
      }
    } catch {
      // Keep default bibliography on GPT-4o-mini failure
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const [doc] = await db
      .insert(documentsTable)
      .values({
        title: `${body.topic}: A ${body.paperType} in ${body.subject}`,
        content,
        type: "paper",
        subject: body.subject,
        wordCount,
      })
      .returning();

    res.json({
      title: `${body.topic}: A ${body.paperType} in ${body.subject}`,
      content,
      citations: citations.map((c, i) => ({
        id: c.id,
        authors: c.authors,
        title: c.title,
        year: c.year,
        source: c.source,
        url: c.url,
        formatted: c.formatted,
      })),
      bibliography,
      wordCount,
      documentId: doc.id,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating paper");
    res.status(500).json({ error: "Failed to generate paper. Please try again." });
  }
});

router.post("/writing/outline", async (req, res) => {
  try {
    const body = GenerateOutlineBody.parse(req.body);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      system: `${WRITER_SOUL}\n\nGenerate a detailed academic paper outline. Return ONLY valid JSON: {"title": string, "sections": [{"heading": string, "subsections": string[]}]}`,
      messages: [
        {
          role: "user",
          content: `Create a detailed outline for a ${body.paperType} on "${body.topic}" in ${body.subject}. Include 6-8 sections with 3-5 subsections each.`,
        },
      ],
    });

    recordUsage("claude-3-5-sonnet-20241022", response.usage.input_tokens, response.usage.output_tokens, "outline-generation");

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    let outline: { title: string; sections: Array<{ heading: string; subsections: string[] }> };

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      outline = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      outline = {
        title: `${body.topic}: A ${body.paperType} in ${body.subject}`,
        sections: [
          { heading: "Abstract", subsections: ["Research summary", "Key contributions"] },
          { heading: "Introduction", subsections: ["Background", "Problem statement", "Objectives", "Paper structure"] },
          { heading: "Literature Review", subsections: ["Theoretical framework", "Prior work", "Research gap"] },
          { heading: "Methodology", subsections: ["Research design", "Data collection", "Analytical approach"] },
          { heading: "Results", subsections: ["Primary findings", "Statistical outcomes"] },
          { heading: "Discussion", subsections: ["Interpretation", "Implications", "Limitations"] },
          { heading: "Conclusion", subsections: ["Summary", "Future directions"] },
          { heading: "References", subsections: [] },
        ],
      };
    }

    res.json(outline);
  } catch (err) {
    req.log.error({ err }, "Error generating outline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
