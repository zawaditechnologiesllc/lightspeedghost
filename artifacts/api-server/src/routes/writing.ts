import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { GeneratePaperBody, GenerateOutlineBody } from "@workspace/api-zod";

const router = Router();

function generateMockCitations(topic: string, count = 5) {
  const authors = [
    "Smith, J., & Jones, M.",
    "Johnson, A., Brown, K., & Davis, L.",
    "Williams, R.",
    "Taylor, C., & Anderson, P.",
    "Martinez, E., et al.",
    "Thompson, N., & White, S.",
    "Garcia, F.",
  ];
  const journals = [
    "Journal of Academic Research",
    "International Review of Science",
    "Proceedings of the National Academy",
    "Nature Reviews",
    "Science Advances",
    "PLOS ONE",
    "Frontiers in Research",
  ];

  return Array.from({ length: count }, (_, i) => {
    const year = 2018 + Math.floor(Math.random() * 6);
    const author = authors[i % authors.length];
    const journal = journals[i % journals.length];
    const id = `cite-${i + 1}`;
    return {
      id,
      authors: author,
      title: `Research on ${topic}: A Comprehensive Study ${i + 1}`,
      year,
      source: journal,
      url: `https://doi.org/10.1000/xyz${i + 1}`,
      formatted: `${author} (${year}). Research on ${topic}: A Comprehensive Study ${i + 1}. ${journal}, ${10 + i}(${i + 1}), ${100 + i * 10}-${120 + i * 10}.`,
    };
  });
}

function generatePaperContent(topic: string, subject: string, paperType: string, citations: ReturnType<typeof generateMockCitations>): string {
  const citeRef = (idx: number) => `(${citations[idx]?.authors?.split(",")[0] ?? "Author"}, ${citations[idx]?.year ?? 2023})`;

  return `# ${topic}

## Abstract

This ${paperType} examines the fundamental aspects of ${topic} within the field of ${subject}. Through a systematic analysis of current literature and empirical evidence, this paper provides a comprehensive overview of key concepts, methodologies, and implications for future research. Our findings suggest that ${topic} represents a significant area of inquiry with far-reaching consequences for both theory and practice ${citeRef(0)}.

## Introduction

The study of ${topic} has garnered increasing attention in recent years, driven by its relevance to contemporary challenges in ${subject} ${citeRef(1)}. Understanding the mechanisms and implications of ${topic} is essential for advancing knowledge in this field. This paper aims to synthesize existing research while identifying gaps that warrant further investigation.

Previous research has established foundational frameworks for understanding ${topic}, yet significant questions remain unanswered ${citeRef(2)}. By examining recent developments and applying rigorous analytical methods, this paper contributes to the growing body of knowledge surrounding this important area of study.

## Literature Review

Scholars have approached ${topic} from multiple theoretical perspectives. Early work by ${citations[0]?.authors?.split(",")[0]} established the groundwork for understanding the basic principles involved ${citeRef(0)}. Subsequent research expanded upon these foundations, incorporating new methodologies and datasets to refine our understanding ${citeRef(1)}.

Recent meta-analyses have confirmed the significance of ${topic} across diverse contexts ${citeRef(3)}. These studies collectively demonstrate that the phenomenon is both robust and generalizable, lending credibility to theoretical predictions. Furthermore, longitudinal research has revealed important temporal dynamics that shorter-term studies may have missed ${citeRef(2)}.

## Methodology

This study employs a mixed-methods approach, combining quantitative analysis with qualitative insights to provide a comprehensive examination of ${topic}. Data were collected through systematic literature review and synthesized using established protocols for evidence-based research in ${subject}.

The analytical framework draws upon validated models from the literature ${citeRef(4)}, adapted to address the specific parameters of the current investigation. Statistical analyses were conducted using appropriate software, with significance thresholds set at p < .05 for all inferential tests.

## Results and Discussion

The analysis reveals several key findings pertaining to ${topic}. First, there is strong evidence supporting the primary theoretical framework, consistent with predictions derived from prior research ${citeRef(1)}. Second, moderating variables play a significant role in shaping observed outcomes, suggesting that context-specific factors must be considered in any comprehensive account of the phenomenon.

These findings align with those reported by ${citations[2]?.authors?.split(",")[0]} ${citeRef(2)}, while extending the evidence base to new populations and settings. Importantly, the results also point to previously unidentified mechanisms that may account for inconsistencies in earlier research ${citeRef(3)}.

The implications of these findings for both theory and practice are substantial. From a theoretical standpoint, the results necessitate refinements to existing models and frameworks. From a practical perspective, the findings suggest new avenues for intervention and application ${citeRef(4)}.

## Conclusion

This paper has examined ${topic} from multiple angles, synthesizing evidence from the existing literature with new analytical insights. The findings confirm the importance of this area while highlighting opportunities for future research. In particular, longitudinal and cross-cultural studies would be valuable for further elucidating the mechanisms and boundary conditions of the phenomena described here.

Researchers and practitioners in ${subject} should take note of these findings and consider their implications for ongoing work in the field. By building on the foundation established here, future scholarship can continue to advance our understanding of ${topic} and its significance for human knowledge and welfare.

## References

${citations.map((c) => c.formatted).join("\n\n")}`;
}

router.post("/writing/generate", async (req, res) => {
  try {
    const body = GeneratePaperBody.parse(req.body);
    const citations = generateMockCitations(body.topic, 5);
    const content = generatePaperContent(body.topic, body.subject, body.paperType, citations);
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    const bibliography = citations.map((c) => c.formatted).join("\n\n");

    const [doc] = await db
      .insert(documentsTable)
      .values({
        title: `${body.topic} - ${body.paperType}`,
        content,
        type: "paper",
        subject: body.subject,
        wordCount,
      })
      .returning();

    res.json({
      title: `${body.topic} - ${body.paperType}`,
      content,
      citations,
      bibliography,
      wordCount,
      documentId: doc.id,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating paper");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/writing/outline", async (req, res) => {
  try {
    const body = GenerateOutlineBody.parse(req.body);

    const sections = [
      {
        heading: "Abstract",
        subsections: ["Research overview", "Key findings", "Implications"],
      },
      {
        heading: "Introduction",
        subsections: [
          `Background on ${body.topic}`,
          "Research problem statement",
          "Objectives and scope",
          "Paper organization",
        ],
      },
      {
        heading: "Literature Review",
        subsections: [
          "Theoretical frameworks",
          "Prior empirical research",
          "Research gaps and contributions",
        ],
      },
      {
        heading: "Methodology",
        subsections: [
          "Research design",
          "Data collection",
          "Analytical approach",
          "Validity and reliability",
        ],
      },
      {
        heading: "Results",
        subsections: [
          "Primary findings",
          "Secondary analyses",
          "Statistical outcomes",
        ],
      },
      {
        heading: "Discussion",
        subsections: [
          "Interpretation of results",
          "Comparison with prior work",
          "Theoretical implications",
          "Practical implications",
        ],
      },
      {
        heading: "Conclusion",
        subsections: [
          "Summary of findings",
          "Limitations",
          "Future research directions",
        ],
      },
      {
        heading: "References",
        subsections: [],
      },
    ];

    res.json({
      title: `${body.topic}: A ${body.paperType} in ${body.subject}`,
      sections,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating outline");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
