/**
 * Programmatic SEO matrices — template × dataset page generators.
 *
 * Each builder turns a small dataset into many catalog specs that share a
 * template but target a distinct long-tail query. The specifics (source type,
 * citation style, competitor, subject) flow through `title`, `metaDescription`,
 * `keywords`, and the `*Focus` fields into the content-generator prompt, so every
 * generated page is genuinely unique — NOT a thin variable swap.
 *
 * These are appended to PAGE_CATALOG (see page-catalog.ts). They seed as drafts
 * like any other catalog entry; nothing is generated or published without an
 * operator running Catalog → Generate batch and approving in the Review queue.
 *
 * IMPORTANT (Google "scaled content abuse", March 2024): only publish cells that
 * carry real, cell-specific value (the actual citation format, real subject
 * conventions, honest comparison data). Review before publishing — the rule
 * checker's gates are the floor, not a quality guarantee.
 */
import type { PageSpec, PageType } from "./page-catalog";

// ── 1. CITATION MATRIX — "How to cite a {source} in {style}" ──────────────────
// 16 sources × 7 styles = 112 pages. The single best programmatic fit: every
// cell is genuinely different because the citation format really does differ per
// (source, style) pair. TOFU → /write citation feature.

interface CitationSource { slug: string; label: string; word: string }
interface CitationStyle { slug: string; short: string; full: string }

const CITATION_SOURCES: CitationSource[] = [
  { slug: "book", label: "a Book", word: "book" },
  { slug: "website", label: "a Website", word: "website" },
  { slug: "journal-article", label: "a Journal Article", word: "journal article" },
  { slug: "youtube-video", label: "a YouTube Video", word: "YouTube video" },
  { slug: "pdf", label: "a PDF", word: "PDF" },
  { slug: "podcast", label: "a Podcast", word: "podcast" },
  { slug: "image", label: "an Online Image", word: "online image" },
  { slug: "lecture", label: "Lecture Notes", word: "lecture notes" },
  { slug: "film", label: "a Film", word: "film" },
  { slug: "newspaper-article", label: "a Newspaper Article", word: "newspaper article" },
  { slug: "blog-post", label: "a Blog Post", word: "blog post" },
  { slug: "government-report", label: "a Government Report", word: "government report" },
  { slug: "chatgpt", label: "ChatGPT and AI Tools", word: "ChatGPT" },
  { slug: "ebook", label: "an E-book", word: "e-book" },
  { slug: "wikipedia", label: "a Wikipedia Article", word: "Wikipedia article" },
  { slug: "interview", label: "an Interview", word: "interview" },
];

const CITATION_STYLES: CitationStyle[] = [
  { slug: "apa", short: "APA", full: "APA 7th Edition" },
  { slug: "mla", short: "MLA", full: "MLA 9th Edition" },
  { slug: "chicago", short: "Chicago", full: "Chicago Style" },
  { slug: "harvard", short: "Harvard", full: "Harvard Referencing" },
  { slug: "vancouver", short: "Vancouver", full: "Vancouver Style" },
  { slug: "ieee", short: "IEEE", full: "IEEE Style" },
  { slug: "oscola", short: "OSCOLA", full: "OSCOLA" },
];

function buildCitationMatrix(): PageSpec[] {
  const pages: PageSpec[] = [];
  for (const s of CITATION_SOURCES) {
    for (const st of CITATION_STYLES) {
      pages.push({
        slug: `how-to-cite-a-${s.slug}-in-${st.slug}`,
        type: "citation-guide",
        title: `How to Cite ${s.label} in ${st.full} (Format + Example)`,
        metaDescription: `How to cite ${s.label.toLowerCase()} in ${st.full}: the exact in-text and reference-list format, a worked example, and the mistakes students make most.`,
        keywords: [
          `how to cite a ${s.word} in ${st.short}`,
          `${st.short} ${s.word} citation`,
          `cite ${s.word} ${st.short}`,
          `${st.short} citation generator`,
        ],
        toolFocus: "citation",
        paperTypeFocus: s.word,
        priority: 0.6,
      });
    }
  }
  return pages;
}

// ── 2. COMPETITOR MATRIX — alternatives & head-to-head ────────────────────────
// 14 competitors × 2 templates = 28 pages. Lowest volume, HIGHEST conversion:
// these capture buyers comparing tools right before they pay. BOFU → /pricing.

interface Competitor { slug: string; name: string }

const COMPETITORS: Competitor[] = [
  { slug: "chatgpt", name: "ChatGPT" },
  { slug: "quillbot", name: "QuillBot" },
  { slug: "grammarly", name: "Grammarly" },
  { slug: "jenni-ai", name: "Jenni AI" },
  { slug: "jasper", name: "Jasper" },
  { slug: "scribbr", name: "Scribbr" },
  { slug: "turnitin", name: "Turnitin" },
  { slug: "chegg", name: "Chegg" },
  { slug: "course-hero", name: "Course Hero" },
  { slug: "studocu", name: "Studocu" },
  { slug: "caktus-ai", name: "Caktus AI" },
  { slug: "essaypro", name: "EssayPro" },
  { slug: "smodin", name: "Smodin" },
  { slug: "hix-ai", name: "HIX.AI" },
];

function buildCompetitorMatrix(): PageSpec[] {
  const pages: PageSpec[] = [];
  for (const c of COMPETITORS) {
    // "alternative" template
    pages.push({
      slug: `${c.slug}-alternative-for-students`,
      type: "comparison",
      title: `The Best ${c.name} Alternative for Students (2026)`,
      metaDescription: `Looking for a ${c.name} alternative? Compare features, pricing, and academic accuracy, and see why students pick LightspeedGhost for essays, citations, and STEM.`,
      keywords: [
        `${c.name.toLowerCase()} alternative`,
        `${c.name.toLowerCase()} alternative for students`,
        `best ${c.name.toLowerCase()} alternative`,
        `free ${c.name.toLowerCase()} alternative`,
      ],
      toolFocus: "paper-writer",
      audienceSegment: "student",
      priority: 0.7,
    });
    // "vs" template
    pages.push({
      slug: `lightspeedghost-vs-${c.slug}`,
      type: "comparison",
      title: `LightspeedGhost vs ${c.name}: Which Is Better for Students? (2026)`,
      metaDescription: `LightspeedGhost vs ${c.name} compared on real citations, originality checks, STEM support, and price — an honest breakdown to help students choose.`,
      keywords: [
        `lightspeedghost vs ${c.name.toLowerCase()}`,
        `${c.name.toLowerCase()} vs lightspeedghost`,
        `is lightspeedghost better than ${c.name.toLowerCase()}`,
        `${c.name.toLowerCase()} comparison`,
      ],
      toolFocus: "paper-writer",
      audienceSegment: "student",
      priority: 0.7,
    });
  }
  return pages;
}

// ── 3. SUBJECT MATRIX — "{subject} {assignment} help" ─────────────────────────
// 14 subjects × 2 intents = 28 pages. MOFU buyer intent → /write or /stem.
// Subjects here are deliberately NEW (not in the core catalog) to avoid slug
// collisions; STEM subjects route to the STEM solver CTA.

interface SubjectSpec { slug: string; name: string; stem: boolean }
interface SubjectIntent { slug: string; label: string; assignment: string }

const SUBJECTS: SubjectSpec[] = [
  { slug: "biology", name: "Biology", stem: true },
  { slug: "chemistry", name: "Chemistry", stem: true },
  { slug: "computer-science", name: "Computer Science", stem: true },
  { slug: "marketing", name: "Marketing", stem: false },
  { slug: "finance", name: "Finance", stem: false },
  { slug: "engineering", name: "Engineering", stem: true },
  { slug: "accounting", name: "Accounting", stem: false },
  { slug: "education", name: "Education", stem: false },
  { slug: "political-science", name: "Political Science", stem: false },
  { slug: "philosophy", name: "Philosophy", stem: false },
  { slug: "mathematics", name: "Mathematics", stem: true },
  { slug: "environmental-science", name: "Environmental Science", stem: true },
  { slug: "anthropology", name: "Anthropology", stem: false },
  { slug: "communications", name: "Communications", stem: false },
];

const SUBJECT_INTENTS: SubjectIntent[] = [
  { slug: "essay-help", label: "Essay Help", assignment: "essay" },
  { slug: "assignment-help", label: "Assignment Help", assignment: "assignment" },
];

function buildSubjectMatrix(): PageSpec[] {
  const pages: PageSpec[] = [];
  for (const subj of SUBJECTS) {
    for (const intent of SUBJECT_INTENTS) {
      pages.push({
        slug: `ai-${subj.slug}-${intent.slug}`,
        type: "subject",
        title: `AI ${subj.name} ${intent.label}: Writing Support & Examples (2026)`,
        metaDescription: `${subj.name} ${intent.assignment} help with AI: structure, real citations, and worked examples for ${subj.name.toLowerCase()} students — review, edit, and submit with confidence.`,
        keywords: [
          `${subj.name.toLowerCase()} ${intent.assignment} help`,
          `ai ${subj.name.toLowerCase()} ${intent.assignment} writer`,
          `${subj.name.toLowerCase()} ${intent.assignment} examples`,
          `help with ${subj.name.toLowerCase()} ${intent.assignment}`,
        ],
        toolFocus: subj.stem ? "stem" : "paper-writer",
        paperTypeFocus: intent.assignment,
        audienceSegment: `${subj.name.toLowerCase()} students`,
        priority: 0.65,
      });
    }
  }
  return pages;
}

// ── Combined export ───────────────────────────────────────────────────────────
export const PROGRAMMATIC_PAGES: PageSpec[] = [
  ...buildCitationMatrix(),   // 112
  ...buildCompetitorMatrix(), // 28
  ...buildSubjectMatrix(),    // 28
];

// Re-export the builders for testing / selective seeding.
export { buildCitationMatrix, buildCompetitorMatrix, buildSubjectMatrix };

// Keep PageType referenced so the import is not flagged as unused by linters
// that don't track type-only positions (the builders annotate via PageSpec).
export type ProgrammaticPageType = PageType;
