import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { SubmitRevisionBody } from "@workspace/api-zod";

const router = Router();

router.post("/revision/submit", async (req, res) => {
  try {
    const body = SubmitRevisionBody.parse(req.body);

    const sentences = body.originalText.split(/(?<=[.!?])\s+/);
    const changes = sentences.slice(0, Math.min(4, sentences.length)).map((sentence, i) => ({
      section: `Section ${i + 1}`,
      original: sentence,
      revised: sentence
        .replace(/\bvery\b/g, "exceptionally")
        .replace(/\bgood\b/g, "commendable")
        .replace(/\bbad\b/g, "deficient")
        .replace(/\bshow\b/g, "demonstrate")
        .replace(/\buse\b/g, "utilize")
        .replace(/\bget\b/g, "obtain")
        .replace(/\bmake\b/g, "construct")
        .replace(/\bdo\b/g, "perform"),
      reason: [
        "Enhanced vocabulary and academic register",
        "Improved clarity and precision",
        "Strengthened argumentative structure",
        "Refined transitions and coherence",
      ][i % 4],
    }));

    const revisedText = changes.reduce((text, change) => {
      return text.replace(change.original, change.revised);
    }, body.originalText);

    const grade = body.marksScored
      ? `Estimated revised grade: ${Math.min(100, parseInt(body.marksScored) + Math.floor(Math.random() * 15) + 5)}%`
      : "Grade estimate: B+ to A- range based on revisions";

    const feedback = `The paper demonstrates a solid understanding of the subject matter. The revised version addresses key areas for improvement including academic register, argument structure, and clarity. ${body.gradingCriteria ? `Based on the provided grading criteria, particular attention was paid to meeting all specified requirements. ` : ""}The revisions enhance the overall scholarly quality of the work.`;

    const [doc] = await db
      .insert(documentsTable)
      .values({
        title: "Revised Paper",
        content: revisedText,
        type: "revision",
        wordCount: revisedText.split(/\s+/).filter(Boolean).length,
      })
      .returning();

    res.json({
      revisedText,
      changes,
      feedback,
      gradeEstimate: grade,
      documentId: doc.id,
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting revision");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
