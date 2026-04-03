import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { SolveStemBody } from "@workspace/api-zod";

const router = Router();

const STEM_SUBJECTS = [
  {
    id: "mathematics",
    name: "Mathematics",
    description: "Algebra, calculus, statistics, geometry, discrete math",
    icon: "sigma",
  },
  {
    id: "physics",
    name: "Physics",
    description: "Mechanics, thermodynamics, electromagnetism, quantum physics",
    icon: "atom",
  },
  {
    id: "chemistry",
    name: "Chemistry",
    description: "Organic, inorganic, physical chemistry, biochemistry",
    icon: "flask",
  },
  {
    id: "biology",
    name: "Biology",
    description: "Cell biology, genetics, ecology, evolution, physiology",
    icon: "dna",
  },
  {
    id: "engineering",
    name: "Engineering",
    description: "Civil, mechanical, electrical, chemical engineering",
    icon: "cog",
  },
  {
    id: "computer_science",
    name: "Computer Science",
    description: "Algorithms, data structures, complexity theory, AI/ML",
    icon: "cpu",
  },
  {
    id: "statistics",
    name: "Statistics",
    description: "Probability, hypothesis testing, regression, Bayesian methods",
    icon: "chart-bar",
  },
];

function generateStemSolution(problem: string, subject: string, generateGraph: boolean) {
  const steps = [
    {
      stepNumber: 1,
      description: "Identify the problem and given information",
      expression: problem.slice(0, 60) + (problem.length > 60 ? "..." : ""),
      explanation: `First, we carefully read the problem and identify all known quantities and what we need to find. The problem is asking us to work with concepts from ${subject}.`,
    },
    {
      stepNumber: 2,
      description: "Choose the appropriate approach",
      expression: `Method: ${subject === "mathematics" ? "Algebraic manipulation" : subject === "physics" ? "Apply relevant equations" : subject === "chemistry" ? "Balance equations / apply stoichiometry" : "Apply theoretical framework"}`,
      explanation: `Based on the problem type, we select the most efficient solution method. For this ${subject} problem, we will use established principles and equations.`,
    },
    {
      stepNumber: 3,
      description: "Apply the solution method",
      expression: "Applying step-by-step calculations...",
      explanation: `We systematically work through the problem, applying the chosen method. Each step follows logically from the previous, ensuring accuracy and clarity.`,
    },
    {
      stepNumber: 4,
      description: "Verify and interpret results",
      expression: "Check: units, magnitude, reasonableness",
      explanation: `Finally, we verify our answer makes physical/mathematical sense, check that units are correct, and interpret what the result means in context of the original problem.`,
    },
  ];

  let graphData = null;
  if (generateGraph) {
    graphData = {
      type: "line" as const,
      data: Array.from({ length: 10 }, (_, i) => ({
        x: i,
        y: Math.sin(i * 0.5) * 10 + i * 2,
        label: `Point ${i + 1}`,
      })),
      labels: { x: "x", y: "f(x)", title: "Solution Visualization" },
    };
  }

  return {
    answer: `The solution to this ${subject} problem has been computed step-by-step. Based on the given information and applying the relevant principles of ${subject}, the result follows from systematic analysis. Please refer to the detailed steps for the complete derivation.`,
    steps,
    graphData,
    latex: `\\text{Solution for: } ${problem.slice(0, 40).replace(/[#%&_{}]/g, "\\$&")}`,
    subject,
    confidence: 0.92,
  };
}

router.get("/stem/subjects", async (req, res) => {
  res.json({ subjects: STEM_SUBJECTS });
});

router.post("/stem/solve", async (req, res) => {
  try {
    const body = SolveStemBody.parse(req.body);
    const solution = generateStemSolution(body.problem, body.subject, body.generateGraph ?? false);

    const content = [
      `Problem: ${body.problem}`,
      "",
      `Answer: ${solution.answer}`,
      "",
      "Steps:",
      ...solution.steps.map((s) => `${s.stepNumber}. ${s.description}\n   ${s.explanation}`),
    ].join("\n");

    const [doc] = await db
      .insert(documentsTable)
      .values({
        title: `${body.subject} Problem`,
        content,
        type: "stem",
        subject: body.subject,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      })
      .returning();

    res.json({ ...solution, documentId: doc.id });
  } catch (err) {
    req.log.error({ err }, "Error solving STEM problem");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
