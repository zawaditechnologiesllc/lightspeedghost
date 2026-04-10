import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Clock, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";

interface ArticleMeta {
  slug: string;
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  dateIso: string;
  metaDescription: string;
  faqSchema?: { q: string; a: string }[];
}

const ARTICLES: ArticleMeta[] = [
  {
    slug: "literature-review-guide",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "How to write a literature review that actually holds up",
    excerpt: "A literature review is not a summary dump. Here's how to structure one that makes reviewers take you seriously.",
    readTime: "8 min read",
    date: "March 28, 2025",
    dateIso: "2025-03-28",
    metaDescription: "Learn how to write a strong academic literature review: how to scope it, organize thematically, show scholarly disagreement, and end with a gap statement that justifies your research.",
    faqSchema: [
      { q: "How long should a literature review be?", a: "For undergraduate papers, 8–15 sources covering 500–1,500 words is typical. For postgraduate theses, reviewers expect 20–50+ sources across 3,000–8,000 words depending on the discipline." },
      { q: "Should a literature review be organized chronologically?", a: "No. Chronological organization reads like a catalogue, not an argument. Organize by theme, methodology, or finding, and use transitions that show how ideas connect and diverge." },
      { q: "What is a gap statement in a literature review?", a: "A gap statement identifies what the existing research hasn't addressed — it's the sentence or paragraph that explains why your research is necessary. Every literature review should end with one." },
    ],
  },
  {
    slug: "ai-humanizer-vs-paraphrasing",
    tag: "AI Tools",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "AI humanizer vs. paraphrasing tools: what actually works against AI detection",
    excerpt: "Most paraphrasers just swap synonyms. That's not enough. Here's what the research says about what AI detectors actually look for.",
    readTime: "9 min read",
    date: "March 14, 2025",
    dateIso: "2025-03-14",
    metaDescription: "Understand why paraphrasing tools fail AI detection and how true AI humanizers work. Covers perplexity, burstiness, and what detectors like GPTZero and Turnitin actually measure.",
    faqSchema: [
      { q: "Why do AI paraphrasing tools still get flagged by AI detectors?", a: "Paraphrasers swap words and rearrange clauses but preserve the underlying statistical signature of AI text — low perplexity, low burstiness. Detectors don't look at word choice, they look at these structural patterns." },
      { q: "What is perplexity in AI detection?", a: "Perplexity measures how 'predictable' text is. AI models generate highly predictable word sequences. Human writing is messier, with more unexpected turns. Detectors flag text with consistently low perplexity." },
      { q: "What AI detection score is safe for submission?", a: "A score below 15% on GPTZero and below 20% on Turnitin's AI detector is generally considered safe. Lower is always better. Different institutions also have different policies, so check your academic integrity guidelines." },
    ],
  },
  {
    slug: "stem-problem-solving",
    tag: "STEM",
    tagColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    title: "The honest guide to STEM problem-solving with AI",
    excerpt: "Used right, AI can teach you how to solve problems — not just give you answers. Used wrong, it leaves you stranded in an exam.",
    readTime: "7 min read",
    date: "February 27, 2025",
    dateIso: "2025-02-27",
    metaDescription: "How to use AI effectively for STEM subjects: learning the method, not just the answer. Covers conceptual explanation, worked examples, step-by-step reasoning, and exam preparation.",
    faqSchema: [
      { q: "Is using AI for STEM homework cheating?", a: "Using AI to understand a concept or check your working is similar to using a textbook or tutor. Submitting AI-generated answers as your own without understanding them is academically dishonest. The distinction is whether you're using AI to learn or to avoid learning." },
      { q: "What STEM subjects work best with AI tutoring?", a: "Calculus, linear algebra, statistics, physics, chemistry, and programming all work very well. AI tutors are strong at procedural subjects where they can show step-by-step working. They're less reliable for cutting-edge research topics where training data is thin." },
    ],
  },
  {
    slug: "payg-vs-subscription",
    tag: "Platform",
    tagColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    title: "Pay-per-use vs. monthly plan: which is right for you?",
    excerpt: "Not every student writes papers every week. Here's an honest breakdown of when each pricing model saves you money.",
    readTime: "5 min read",
    date: "February 12, 2025",
    dateIso: "2025-02-12",
    metaDescription: "Compare pay-as-you-go credits vs. Light Speed Ghost's monthly Starter and Pro plans. Find out which saves more money based on your actual writing frequency.",
    faqSchema: [
      { q: "Do Light Speed Ghost credits expire?", a: "No. Credits purchased on the pay-as-you-go model never expire. They remain in your account until you use them, with no monthly reset." },
      { q: "What's included in the Starter plan?", a: "The Starter plan at $1.50/month includes 3 paper generations, 5 outlines, 5 plagiarism + AI checks, 1 revision, 10 STEM queries per day, and 10 study messages per day." },
      { q: "When does it make sense to upgrade to Pro?", a: "If you're using 3 or more paper generations per month consistently, Pro at $14.99/month saves money over pay-as-you-go. If your usage is seasonal — heavy during finals, light otherwise — credits usually cost less." },
    ],
  },
  {
    slug: "study-techniques-with-ai",
    tag: "Study",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "5 study techniques that actually improve with AI tutoring",
    excerpt: "Flashcards and passive re-reading are low-yield. These five evidence-backed methods get a real boost from an AI study partner.",
    readTime: "8 min read",
    date: "January 30, 2025",
    dateIso: "2025-01-30",
    metaDescription: "Five evidence-based study techniques — retrieval practice, spaced repetition, elaborative interrogation, interleaving, and the Feynman technique — and how AI tutoring makes each one more effective.",
    faqSchema: [
      { q: "What is the most effective study technique according to research?", a: "Retrieval practice (active recall) consistently ranks highest in learning science research. Testing yourself is significantly more effective than re-reading, highlighting, or summarizing." },
      { q: "How can AI help with spaced repetition?", a: "An AI tutor can track which concepts you answered incorrectly and schedule them for review at increasing intervals — next day, then 3 days, then a week. Ask your AI explicitly to keep a 'struggle list' and quiz you on it." },
      { q: "What is the Feynman technique?", a: "Explaining a concept in simple language as if teaching it to a beginner. Every time you can't explain something clearly, you've identified a gap. AI tutors make this easier by role-playing as a curious student and asking follow-up questions." },
    ],
  },
  {
    slug: "citations-that-are-real",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "Why most AI writers give you fake citations (and what we do instead)",
    excerpt: "Hallucinated references will get a paper failed instantly. We pull citations from Semantic Scholar in real time. Here's how.",
    readTime: "6 min read",
    date: "January 15, 2025",
    dateIso: "2025-01-15",
    metaDescription: "Why AI language models hallucinate academic citations and how Light Speed Ghost queries Semantic Scholar in real time to produce only verified, existing references for your papers.",
    faqSchema: [
      { q: "Why do AI writing tools make up fake citations?", a: "Language models generate text statistically, learning patterns from training data including citation formats. When producing a reference list, they generate strings that look like citations — but they have no way to verify whether the paper actually exists." },
      { q: "What is Semantic Scholar?", a: "Semantic Scholar is a free AI-powered academic search engine from the Allen Institute for AI, indexing over 220 million academic papers across all major disciplines. It provides a public API for real-time citation lookup." },
      { q: "How do I check if an AI-generated citation is real?", a: "Copy the paper title or DOI into Google Scholar, Semantic Scholar, or the publisher's journal search. If the paper appears and the details match, it's real. If no results appear, or the details differ, the citation is likely hallucinated." },
    ],
  },
  {
    slug: "how-to-write-a-thesis-statement",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "How to write a thesis statement that professors can't ignore",
    excerpt: "A vague thesis is the fastest way to guarantee a mediocre grade. Here's the formula for a statement that is specific, arguable, and positions your whole paper.",
    readTime: "6 min read",
    date: "April 3, 2025",
    dateIso: "2025-04-03",
    metaDescription: "Step-by-step guide to writing a strong academic thesis statement: what it must do, how to make it arguable, the specific + so what formula, and common mistakes that kill papers before they start.",
    faqSchema: [
      { q: "What makes a thesis statement strong?", a: "A strong thesis is specific (not vague), arguable (someone could disagree with it), and scoped to what your paper can actually prove in its page limit. It also signals to the reader what the paper's structure will be." },
      { q: "Where does the thesis statement go in a paper?", a: "Typically at the end of the introduction — usually the last one or two sentences. This position lets you set up context first, then deliver the central claim the paper will defend." },
      { q: "How long should a thesis statement be?", a: "One to two sentences for most undergraduate and Master's papers. A PhD dissertation may have a slightly longer thesis paragraph, but even then clarity and specificity matter more than length." },
    ],
  },
  {
    slug: "lower-ai-detection-score",
    tag: "AI Tools",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "How to lower your AI detection score below 5%",
    excerpt: "Getting flagged isn't the end. Here's exactly what drives AI detection scores up — and the systematic approach to bringing them down.",
    readTime: "9 min read",
    date: "April 7, 2025",
    dateIso: "2025-04-07",
    metaDescription: "Practical steps to reduce AI detection scores on GPTZero, Turnitin, and Originality.ai below 5%. Covers perplexity engineering, sentence variety, structural rewriting, and human voice injection.",
    faqSchema: [
      { q: "What is a safe AI detection score for academic submission?", a: "Below 15% on GPTZero and below 20% on Turnitin's AI detector is generally considered low-risk. Below 5% gives you meaningful margin. Institutions vary in their thresholds, so check your school's academic integrity policy." },
      { q: "Does rewriting AI text in your own words reduce detection?", a: "Yes, but only if the rewrite is structural — changing sentence length, rhythm, and flow, not just word substitution. Surface-level paraphrasing preserves the statistical patterns detectors flag." },
      { q: "Can Turnitin detect all AI-written text?", a: "No. Turnitin's AI detection is probabilistic, not definitive. It looks for patterns associated with LLM-generated text. Heavily restructured text, especially with varied sentence length and personal voice, often scores below detection thresholds." },
    ],
  },
];

const ARTICLE_BODIES: Record<string, React.ReactNode> = {
  "literature-review-guide": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>A literature review is the part of your paper that tells reviewers you actually understand the field. Done well, it positions your argument inside a larger scholarly conversation. Done badly, it's an annotated bibliography with better sentence variety.</p>
      <p>The difference between the two isn't the number of sources — it's whether they add up to an argument. Here's how to build one that holds up under scrutiny.</p>

      <h3 className="text-white font-semibold text-base mt-7">Define your scope before you read anything</h3>
      <p>The most common mistake is starting with sources instead of a question. Define your research question first, in one sentence. Every source in your review should connect to that question clearly enough that you can explain why it's included in one sentence. If you can't, cut it.</p>
      <p>Scope also determines depth. An undergraduate review covering 8–15 sources should focus narrowly on your topic. A postgraduate review of 20–40 sources can afford to cover more ground, but thematic control still matters more than coverage.</p>

      <h3 className="text-white font-semibold text-base mt-7">Organize thematically, never chronologically</h3>
      <p>Organizing by year — "Smith (2015) found X. Jones (2018) found Y. Chen (2022) found Z." — is the most common structure mistake in undergraduate reviews. Reviewers read a catalogue, not an argument. The dates don't help them understand how the field has developed.</p>
      <p>Instead, group sources by theme, methodology, or finding. Ask yourself: what are the two or three main debates in this literature? Organize around those debates. Transitions should explain how ideas connect: "While Zhang (2021) demonstrates X under controlled conditions, field studies by Okafor and Lee (2023) suggest the relationship reverses in real-world contexts."</p>
      <p>That sentence does more intellectual work than three pages of chronological summaries.</p>

      <h3 className="text-white font-semibold text-base mt-7">Show disagreement — it's your strongest asset</h3>
      <p>If every source in your review agrees, the reader wonders why you're doing research at all. Real literature reviews map where scholars diverge — and that divergence is what makes your research necessary.</p>
      <p>Point out contradictions explicitly. Don't soften them with "however, some scholars suggest..." — name the disagreement and the stakes: "These findings directly contradict Ibarra's (2020) model, which predicts the opposite relationship under conditions of low institutional trust."</p>
      <p>Showing that you understand why smart people disagree demonstrates mastery of the field. It's one of the clearest signals of graduate-level thinking.</p>

      <h3 className="text-white font-semibold text-base mt-7">Use primary sources, not secondary summaries</h3>
      <p>Citing what someone else said about a paper — without reading the original — is a serious academic risk. The secondary source may have misread, oversimplified, or selectively quoted the original. If you cite it, you inherit those errors.</p>
      <p>Track down primary sources for any claim that matters to your argument. If a paper is behind a paywall, use your institution's library access, interlibrary loan, Unpaywall, or the author's institutional page. Reviewers who know the field well will catch lazy secondary citation.</p>

      <h3 className="text-white font-semibold text-base mt-7">End with a gap statement that makes your study inevitable</h3>
      <p>Every literature review should end by identifying what's missing. Not "no one has studied this exact thing" — that's rarely true and reviewers are suspicious of it — but rather what specific aspect remains underexplored, what conditions haven't been tested, what methodological limitations exist in prior work.</p>
      <p>Your gap statement should make your research question feel like the only logical next step: "Existing studies have demonstrated X across population Y, but none have examined whether the relationship holds for Z. This study addresses that gap by..." Your study then isn't just another paper — it's necessary.</p>

      <h3 className="text-white font-semibold text-base mt-7">Common mistakes that cost marks</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>Including sources that don't connect to your research question (padding)</li>
        <li>Summarizing each paper independently rather than connecting them to each other</li>
        <li>Missing major papers in the field that reviewers will expect to see</li>
        <li>Describing what studies found without evaluating how reliable the methodology was</li>
        <li>Failing to distinguish between strong and weak evidence</li>
      </ul>
      <p className="pt-2 text-white/40 text-xs">Light Speed Ghost's Write Paper tool generates literature-grounded papers using sources verified through Semantic Scholar in real time. The AI queries an actual academic database before writing the literature section — sources are confirmed to exist before they appear in your paper.</p>
    </div>
  ),

  "ai-humanizer-vs-paraphrasing": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>AI detectors don't flag text because of specific words or phrases. They flag statistical patterns — measurable properties of text that differ predictably between language models and humans. Understanding what those properties are explains exactly why most "AI paraphrasers" fail to help, and what actually works instead.</p>

      <h3 className="text-white font-semibold text-base mt-7">What AI detectors actually measure</h3>
      <p>The two most important signals are <strong className="text-white/80">perplexity</strong> and <strong className="text-white/80">burstiness</strong>.</p>
      <p><strong className="text-white/80">Perplexity</strong> measures how predictable a sequence of words is. Language models are trained to generate the most probable next word — which means AI text tends to be statistically "safe" and low-surprise. Human writing is messier, with more unexpected turns, deliberate variations, and stylistic idiosyncrasies. Low perplexity = AI-like. High perplexity = more human-like.</p>
      <p><strong className="text-white/80">Burstiness</strong> measures variation in sentence length. Humans naturally alternate between short sentences and long ones. AI models tend to produce sentences of consistent, medium length — grammatically perfect, structurally predictable. Low burstiness is a strong AI signal.</p>
      <p>Tools like GPTZero, Turnitin's AI detector, and Originality.ai all use variants of these metrics. When you understand this, the limitations of paraphrasers become obvious.</p>

      <h3 className="text-white font-semibold text-base mt-7">Why paraphrasers fail</h3>
      <p>Standard paraphrasing tools — including most that market themselves as "AI paraphrasers" — operate by substituting synonyms and rearranging clause order. A sentence like "The study examined the relationship between sleep duration and cognitive performance" becomes "The research investigated how sleeping hours correlate with mental capacity."</p>
      <p>The wording is different. The statistical structure — sentence length, word predictability distribution, burstiness profile — is almost identical. The detector doesn't care about the words. It cares about the shape of the text. Paraphrasers don't change the shape.</p>

      <h3 className="text-white font-semibold text-base mt-7">What a real humanizer does differently</h3>
      <p>Effective AI humanization requires structural rewriting, not word substitution. Specifically:</p>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li><strong className="text-white/70">Vary sentence length deliberately.</strong> Follow a complex sentence with a short one. Break a long sentence into two. Merge two short ones. Create rhythm that mirrors human writing patterns.</li>
        <li><strong className="text-white/70">Introduce controlled imperfection.</strong> Humans write with minor stylistic inconsistencies — word choice that's slightly unusual, a slightly informal turn of phrase in an otherwise formal paragraph. This increases perplexity.</li>
        <li><strong className="text-white/70">Restructure at the paragraph level.</strong> Move points around. Start paragraphs differently. Vary the position of the topic sentence.</li>
        <li><strong className="text-white/70">Add personal or contextual voice.</strong> First-person framing, hedged statements, and opinion markers all increase burstiness and perplexity in the right ways.</li>
      </ul>

      <h3 className="text-white font-semibold text-base mt-7">How Light Speed Ghost's humanizer works</h3>
      <p>Our humanizer runs a multi-pass structural rewrite designed to move AI-probability scores below 15% on major detection platforms. The first pass targets sentence-length distribution. The second adjusts predictability patterns at the phrase level. The third refines paragraph flow to match human writing cadence.</p>
      <p>This is slower than synonym-swapping. The quality difference is significant. You can test it on your own text — paste in AI-written content, run it through, and check the output against GPTZero or Copyleaks before submitting.</p>

      <h3 className="text-white font-semibold text-base mt-7">When to use a humanizer and when not to</h3>
      <p>Humanization is most valuable for AI-assisted drafts where you want to ensure the final text reads naturally and passes institutional review. It's not a substitute for understanding your material. If you're submitting work in a subject where you'll be asked to explain or extend it — presentations, vivas, class discussions — make sure the content reflects knowledge you actually have.</p>
      <p className="pt-2 text-white/40 text-xs">Academic use note: always review humanized output for accuracy before submitting. The goal is to help you express ideas in your own voice — not to submit work that isn't yours. Check your institution's AI use policy before using any AI tool for academic work.</p>
    </div>
  ),

  "stem-problem-solving": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>There are two ways students use AI for STEM problems. The first produces short-term grade improvements and long-term disaster. The second builds genuine competency that holds up in exams, vivas, and careers. The difference is entirely in how you ask.</p>

      <h3 className="text-white font-semibold text-base mt-7">The dangerous pattern: copy-paste answers</h3>
      <p>Copying an AI's answer to a problem set is academically risky and practically useless. The risk is obvious. The practical uselessness is worth explaining: when a similar problem appears on your exam, you'll have no method to apply. You memorized an output, not a process.</p>
      <p>The students who use AI well don't ask it to solve their problems. They ask it to teach them how to solve that class of problem.</p>

      <h3 className="text-white font-semibold text-base mt-7">Start with concepts, not calculations</h3>
      <p>Before asking for any solution, ask the AI to explain the underlying concept. "What is the relationship between net force and acceleration in a non-inertial reference frame?" before "Solve this rotational dynamics problem." That ordering changes what you get from the interaction.</p>
      <p>Once you understand the concept, the solution becomes derivable rather than memorizable. You can reconstruct it under exam conditions even if you haven't seen that specific problem before. Concept-first is the only approach that scales to exams.</p>

      <h3 className="text-white font-semibold text-base mt-7">Ask for parallel problems, not just solutions</h3>
      <p>One of the most valuable things an AI tutor can do for STEM is generate similar problems — same difficulty, different numbers or context — for practice. "Give me three problems using the same technique as this one, with full step-by-step working shown, then give me one unsolved problem to try myself."</p>
      <p>This mimics deliberate practice, the most effective form of skill-building. You're not checking an answer — you're building fluency with a method by applying it repeatedly in slightly different contexts.</p>

      <h3 className="text-white font-semibold text-base mt-7">Require step-by-step reasoning — every step</h3>
      <p>In STEM, examiners often award more marks for the working than the final answer. A correct answer with no working gets partial credit at best. An incorrect answer with correct method often gets most of the marks.</p>
      <p>When using an AI tutor, require explicit justification for each step. Not just "apply the chain rule here" — ask why the chain rule applies in this case, and what would happen if you applied the product rule instead. Understanding why a step is valid is what lets you adapt when the problem is slightly different.</p>
      <p>Light Speed Ghost's STEM Solver tool shows full reasoning at every step, with graph support for problems where visualization clarifies the method. This is deliberate — we know examiners check the working.</p>

      <h3 className="text-white font-semibold text-base mt-7">Identify your weak problem types and track them</h3>
      <p>Keep a running list of the problem types you consistently need help with. Review it before each study session. As you improve, the list should shrink. The goal is to reach exam day with nothing left on that list.</p>
      <p>Ask your AI tutor to quiz you on specific problem types. If you get three consecutive problems right without hints, move on. If you get stuck, go back to concept-level explanation and try again. This systematic approach is more efficient than working through a textbook chapter sequentially.</p>

      <h3 className="text-white font-semibold text-base mt-7">Know when to close the AI and work alone</h3>
      <p>Exam conditions don't include an AI assistant. Any method you're not comfortable applying independently by exam time is a liability. Build checkpoints into your study: once a week, attempt a problem set without any assistance. Grade yourself honestly. What you can't do solo is what needs more practice.</p>
      <p>The AI is a study accelerator, not a substitute for competence. Used correctly, it dramatically shortens the path to genuine mastery.</p>
    </div>
  ),

  "payg-vs-subscription": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>Most platforms push you toward a subscription because subscriptions are better for their revenue. The honest answer is that the right model depends on your actual usage pattern. Here's how to figure that out without guessing.</p>

      <h3 className="text-white font-semibold text-base mt-7">How pay-as-you-go credits work</h3>
      <p>Credits are purchased in amounts — $5, $10, $20, or $50 — and deducted per use based on the tool and length of output. A standard paper generation costs more than an outline; a full revision costs more than a plagiarism check. Credits never expire. If you top up $20 and use $7 this month, the remaining $13 is there whenever you need it, even if that's three months later during finals.</p>
      <p>PAYG is pay for what you use, when you use it. No monthly commitment, no pressure to generate content to "get your money's worth."</p>

      <h3 className="text-white font-semibold text-base mt-7">When PAYG makes more sense</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>You write 1–2 papers per month, not more</li>
        <li>Your usage is seasonal — heavy in finals and assignment periods, minimal otherwise</li>
        <li>You only need specific tools, not the full platform on a regular basis</li>
        <li>You want to test the platform before committing to a subscription</li>
        <li>You're mid-semester and need help with one or two difficult assignments</li>
      </ul>
      <p>The math: a standard essay-length paper (500–1,500 words) costs $7.99 PAYG. A research paper (1,500–3,500 words) is $14.99. If you write one essay a month, PAYG costs roughly $96/year. Starter at $1.50/month is $18/year for 3 papers per month — Starter almost always wins on cost, but PAYG wins on flexibility if your usage is truly unpredictable.</p>

      <h3 className="text-white font-semibold text-base mt-7">When the Starter plan makes more sense</h3>
      <p>The Starter plan at $1.50/month gives you 3 papers, 5 outlines, 5 plagiarism + AI checks, 10 STEM queries per day, 10 study messages per day, and 1 revision per month. At less than the cost of a coffee, it's the cheapest structured academic writing plan available. If you're regularly using those tools, Starter is almost always cheaper than PAYG for the same volume.</p>

      <h3 className="text-white font-semibold text-base mt-7">When Pro is worth it</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>You write 3 or more papers per month</li>
        <li>You regularly use the humanizer, revision tool, or study assistant</li>
        <li>You want predictable billing without tracking per-use costs</li>
        <li>You're in a heavy course-load semester</li>
      </ul>
      <p>At $14.99/month, Pro provides 50 of every tool per month plus unlimited study and plagiarism checks. If you write three papers a month, that's less than $5 per paper — significantly below PAYG rates for equivalent output length. The math strongly favors Pro once you're consistently at or above that volume.</p>

      <h3 className="text-white font-semibold text-base mt-7">The honest recommendation</h3>
      <p>Start on PAYG if you're testing the platform or if your usage is genuinely unpredictable. Move to Starter once you're using it regularly — even one paper per month makes Starter cheaper annually than PAYG. Upgrade to Pro when you're using 3+ papers per month consistently or when you need the higher limits on revisions and humanizations.</p>
      <p>PAYG credits from any prior purchases carry over regardless of plan status, so you never lose what you've already paid for. There's no penalty for switching between models.</p>
    </div>
  ),

  "study-techniques-with-ai": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>Learning science has a reasonably clear answer to which study methods produce lasting retention and which produce the illusion of learning. The gap between them is large. AI tutors don't change what works — but they significantly amplify the methods that do.</p>

      <h3 className="text-white font-semibold text-base mt-7">1. Retrieval practice (active recall)</h3>
      <p>Testing yourself on material is consistently shown to be more effective for long-term retention than any form of re-reading or reviewing. The effort of retrieval — pulling information from memory without looking — is what creates and strengthens memory traces.</p>
      <p>With an AI tutor: ask to be quizzed on a topic before seeing explanations. Set a rule with yourself: no looking at the answer until you've made a genuine attempt. After you answer, the AI can correct and explain. The discomfort of not knowing is the mechanism — don't short-circuit it.</p>

      <h3 className="text-white font-semibold text-base mt-7">2. Spaced repetition</h3>
      <p>Reviewing material at increasing intervals — rather than massed practice (cramming) — produces dramatically better long-term retention. The optimal spacing is roughly: review the next day, then three days later, then a week, then two weeks. Each successful recall extends the interval.</p>
      <p>With an AI tutor: ask it to maintain a running list of concepts you got wrong or were uncertain about. At the start of each study session, ask it to quiz you on yesterday's weak points before introducing new material. This requires telling the AI explicitly — it won't do it automatically unless you build the system.</p>

      <h3 className="text-white font-semibold text-base mt-7">3. Elaborative interrogation</h3>
      <p>Instead of asking "what happened?" ask "why did this happen?" and "how does this connect to what I already know?" This forces you to integrate new information with existing understanding, rather than storing it in isolation. Isolated facts are easily forgotten. Connected facts are far more durable.</p>
      <p>With an AI tutor: for any concept, ask "why is this true?" and "what would happen if this weren't the case?" These questions force the AI to generate explanatory connections. Your job is to understand the explanations, not just receive them — ask for clarification until the connection is obvious to you.</p>

      <h3 className="text-white font-semibold text-base mt-7">4. Interleaving</h3>
      <p>Studying multiple related topics in one session — rather than completing one topic before starting another — produces better long-term results, even though it feels less efficient in the moment. The struggle of switching between methods is the mechanism.</p>
      <p>With an AI tutor: explicitly ask for mixed problem sets rather than batches of the same type. "Give me a set of 10 problems across calculus, linear algebra, and probability, mixed randomly." The disorientation of switching is exactly what you need — it forces you to identify which method applies, which is what exams actually test.</p>

      <h3 className="text-white font-semibold text-base mt-7">5. The Feynman technique</h3>
      <p>Richard Feynman's approach: explain a concept in the simplest possible language, as if teaching it to someone with no background. Every failure to explain clearly reveals a gap in understanding. Fill the gap, then try again.</p>
      <p>With an AI tutor: ask it to role-play as a curious 12-year-old. Explain your concept. The AI will ask follow-up questions a genuine 12-year-old would ask — "but why?", "what does that word mean?", "how does that work?" — and every question you can't answer identifies a real gap. This exercise is uncomfortable and extremely effective.</p>

      <h3 className="text-white font-semibold text-base mt-7">What doesn't work (but feels like it does)</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li><strong className="text-white/70">Re-reading:</strong> Creates familiarity, not retention. You recognize material without being able to recall it under test conditions.</li>
        <li><strong className="text-white/70">Highlighting:</strong> Feels active, is mostly passive. Doesn't produce retrieval practice or elaborative processing.</li>
        <li><strong className="text-white/70">Summarizing:</strong> Useful as a warmup. Not effective as a primary study strategy compared to retrieval practice.</li>
        <li><strong className="text-white/70">Massed practice (cramming):</strong> Works for the exam, fails within days. Material isn't consolidated into long-term memory.</li>
      </ul>
    </div>
  ),

  "citations-that-are-real": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>Hallucinated citations are one of the most consequential failures in AI-assisted academic writing. A marker who tries to verify a source and finds it doesn't exist will fail the paper — regardless of the quality of the argument. This isn't a minor glitch. It's a structural problem with how language models work, and understanding it explains why most AI writers can't solve it.</p>

      <h3 className="text-white font-semibold text-base mt-7">Why hallucination happens</h3>
      <p>Language models don't retrieve information from a database. They generate text statistically based on patterns learned during training. During training, they saw vast amounts of academic writing — including papers, reviews, and reference lists. They learned what citations look like.</p>
      <p>When asked to produce a reference list, a language model generates strings that match the pattern of real citations: author name, year, title, journal, volume, issue, page numbers. Every element looks right. But the model has no way to verify whether that specific combination corresponds to a paper that actually exists. It's generating the form without the substance.</p>
      <p>This isn't a bug that can be patched with a better model. It's a fundamental consequence of how generative models work. The only fix is connecting the model to an actual database lookup.</p>

      <h3 className="text-white font-semibold text-base mt-7">What we do differently</h3>
      <p>Light Speed Ghost's paper writer queries the Semantic Scholar API in real time before writing any literature-dependent section. Here's the sequence: the AI receives your topic and requirements, identifies the key claims that need academic support, queries Semantic Scholar for papers that support those claims, retrieves and verifies the actual paper metadata (title, authors, year, journal, DOI), and only then incorporates those sources into the writing.</p>
      <p>If a source can't be retrieved and confirmed, it doesn't appear in the paper. This means the output is sometimes more conservative than an AI that invents freely — but it's academically defensible, which is the only thing that matters when marks are at stake.</p>
      <p>Semantic Scholar indexes over 220 million academic papers across all major disciplines and provides a public API for real-time lookup. It's the same database used by researchers at major institutions. When a paper exists, we find it. When we can't find it, we say so.</p>

      <h3 className="text-white font-semibold text-base mt-7">How to verify citations yourself — always</h3>
      <p>Regardless of which tool you use, verify every citation before submitting:</p>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>Copy the paper title into Google Scholar and confirm a matching result appears</li>
        <li>If a DOI is provided, paste it into <code className="text-blue-400">doi.org</code> and confirm it resolves to the correct paper</li>
        <li>Check that the authors, year, and journal match exactly — hallucinations often get the title approximately right but corrupt authors or dates</li>
        <li>For key claims, read at least the abstract to confirm the paper says what the citation implies it says</li>
      </ul>
      <p>This takes five to ten minutes for a typical reference list. It's the minimum due diligence for any academic work. Our tool makes this unnecessary for the citations it generates — but verification is still good practice.</p>

      <h3 className="text-white font-semibold text-base mt-7">Warning signs that a citation may be hallucinated</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>No DOI provided, or the DOI doesn't resolve</li>
        <li>Paper title returns no results in Google Scholar</li>
        <li>Journal name is vaguely plausible but not recognized in your field</li>
        <li>The authors exist but have no record of publishing on this topic</li>
        <li>The paper is cited as being from a year when the research area didn't yet exist</li>
      </ul>
      <p className="pt-2 text-white/40 text-xs">Real citations only: our paper writer queries Semantic Scholar before writing. When a verified source isn't available for your specific topic, we'll tell you — rather than invent one.</p>
    </div>
  ),

  "how-to-write-a-thesis-statement": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>A thesis statement does one job: it tells the reader what position your paper takes and why that position is defensible. Everything else in the paper — every paragraph, every piece of evidence — exists to support it. A weak thesis produces a weak paper, regardless of how good the body content is. A strong thesis makes a mediocre paper significantly better.</p>

      <h3 className="text-white font-semibold text-base mt-7">What a thesis statement must do</h3>
      <p>A functional thesis statement has three properties:</p>
      <ul className="list-disc list-inside space-y-1.5 text-white/55 mb-3">
        <li><strong className="text-white/70">It's specific.</strong> "The French Revolution had many causes" is not a thesis — it's a fact that no one would dispute. "The financial collapse of the French state between 1786 and 1789, not ideological opposition to monarchy, was the primary catalyst of revolutionary action" is a thesis.</li>
        <li><strong className="text-white/70">It's arguable.</strong> Someone should be able to disagree with it, with evidence, and the debate should be interesting. If no reasonable person could disagree, it's a statement of fact, not a thesis.</li>
        <li><strong className="text-white/70">It's scoped to your paper.</strong> A thesis you can't fully defend in your page limit is a thesis you shouldn't be writing. Narrow it until the paper can actually prove it.</li>
      </ul>

      <h3 className="text-white font-semibold text-base mt-7">The specific + "so what" formula</h3>
      <p>Most weak theses fail at specificity. The fix is to ask "so what?" after every draft thesis until you reach a claim that actually matters. "Social media affects mental health" → so what? → "Social media use is correlated with depression in adolescents" → so what? → "Instagram's algorithmic promotion of aspirational content is causally linked to increased rates of clinical depression in girls aged 13–17, according to internal Facebook research" → that's a thesis.</p>
      <p>The "so what" chain forces you to move from topic to claim. Most students stop too early.</p>

      <h3 className="text-white font-semibold text-base mt-7">Where the thesis goes and how long it should be</h3>
      <p>For most academic papers, the thesis belongs at the end of the introduction — typically the last one or two sentences. This position lets you set up context, establish why the topic matters, and then deliver the claim the paper will defend. The reader knows what to expect and can evaluate your evidence accordingly.</p>
      <p>Length: one to two sentences. Long theses are usually a sign that the argument hasn't been sufficiently clarified. If you need three sentences to state your position, you probably have two arguments, not one.</p>

      <h3 className="text-white font-semibold text-base mt-7">Thesis statements for different paper types</h3>
      <p><strong className="text-white/80">Argumentative paper:</strong> Your thesis takes a position: "X is true because of Y and Z, despite the objection that W." It signals both the claim and the strongest counterargument you'll address.</p>
      <p><strong className="text-white/80">Analytical paper:</strong> Your thesis explains what your analysis reveals: "Through an examination of X and Y, this paper argues that Z, challenging the conventional view that W."</p>
      <p><strong className="text-white/80">Expository paper:</strong> Your thesis states what the paper explains and why it matters: "This paper examines three mechanisms by which X produces Y, with implications for our understanding of Z."</p>
      <p><strong className="text-white/80">Research paper:</strong> Your thesis states your findings: "This study finds that X is significantly associated with Y in population Z, suggesting that the conventional model of W requires revision."</p>

      <h3 className="text-white font-semibold text-base mt-7">Common mistakes that professors spot immediately</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li><strong className="text-white/70">Announcing instead of arguing:</strong> "This paper will discuss the causes of World War I" is an agenda, not a thesis. State your argument, not your plan.</li>
        <li><strong className="text-white/70">Asking a question:</strong> "Was the New Deal effective?" A thesis answers the question, it doesn't ask it.</li>
        <li><strong className="text-white/70">Being too broad:</strong> "Climate change is a serious issue" cannot be defended or disputed. It's trivially true.</li>
        <li><strong className="text-white/70">The two-headed thesis:</strong> Two disconnected arguments that the paper can't fully develop: "Income inequality harms economic growth and also reduces social mobility." Pick one, or explain the connection.</li>
        <li><strong className="text-white/70">Forgetting to revise it:</strong> A thesis written before the paper often doesn't match what the paper actually argues. Revise the thesis last, after the body is written.</li>
      </ul>

      <h3 className="text-white font-semibold text-base mt-7">Writing the thesis after the paper</h3>
      <p>Professional academic writers often draft a working thesis at the start, write the paper, and then rewrite the thesis at the end to match what they actually argued. This is not cheating — it's good practice. Arguments develop as you write and research. A thesis written before you know your conclusion often misrepresents what the paper does.</p>
      <p>Revise your thesis last, not first. Make sure the final thesis is an accurate one-sentence summary of the position the paper actually defends.</p>
      <p className="pt-2 text-white/40 text-xs">Light Speed Ghost's Write Paper tool generates papers from your topic, requirements, and academic level. The output includes a developed thesis that aligns with the paper's argument — and all citations are verified against Semantic Scholar in real time.</p>
    </div>
  ),

  "lower-ai-detection-score": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>AI detection isn't binary. It's a probability score — and probability scores can be moved. If your text is scoring high on GPTZero, Turnitin, or Originality.ai, there are systematic reasons for it, and systematic ways to address them. Here's what's actually driving the score and how to bring it down reliably.</p>

      <h3 className="text-white font-semibold text-base mt-7">Understand what detectors are actually measuring</h3>
      <p>AI detectors don't analyze meaning or logic — they analyze statistical properties of text. The two primary signals are perplexity (how predictable the word choices are, relative to what a language model would produce) and burstiness (variation in sentence length).</p>
      <p>AI-generated text typically has low perplexity — it's statistically "safe," using the most probable words in the most expected sequences. It also has low burstiness — sentence lengths are consistent, medium-range, grammatically complete. These two signals together are strong predictors of AI origin.</p>
      <p>Human writing is messier. Shorter sentences interrupt longer ones. Word choice is sometimes surprising. Phrasing occasionally breaks from the "optimal" structure. These imperfections are your target.</p>

      <h3 className="text-white font-semibold text-base mt-7">Step 1 — Diagnose before fixing</h3>
      <p>Before making changes, run your text through multiple detectors: GPTZero, Originality.ai, and if available, Turnitin. Note not just the overall score but which sections score highest. Most detectors highlight the specific paragraphs they flag as AI-likely. Those are your priority sections.</p>
      <p>Don't edit randomly — edit surgically, starting with the highest-flagged sections.</p>

      <h3 className="text-white font-semibold text-base mt-7">Step 2 — Fix sentence length variation first</h3>
      <p>This is the highest-leverage single change. Look at your flagged paragraphs. Count the average sentence length. If most sentences are between 18–26 words, that's a burstiness red flag. Human writers rarely sustain that range for an entire paragraph.</p>
      <p>Break long sentences into two. Or three. Merge very short ones where it makes sense. Add a deliberately short sentence after a complex one — "This matters." or "The evidence is clear." — to create the rhythm variation that human writing naturally produces.</p>
      <p>Target: no two adjacent sentences should be the same length. Mix 8-word sentences with 30-word ones deliberately.</p>

      <h3 className="text-white font-semibold text-base mt-7">Step 3 — Increase perplexity through word choice</h3>
      <p>High perplexity means "unpredictable word choices given the context." This doesn't mean using obscure words — it means occasionally choosing the less obvious but still correct word, or structuring a phrase in a less formulaic way.</p>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>Replace stock academic phrases. "It is important to note that" → "Crucially," or "Worth emphasizing:" or restructure the sentence entirely.</li>
        <li>Vary how paragraphs start. If three consecutive paragraphs start with "This suggests," change two of them.</li>
        <li>Add hedging language where appropriate: "arguably," "tends to," "in most cases." AI text often overclaims with certainty.</li>
        <li>Add a specific concrete example or detail — AI tends to stay abstract. A real, specific example raises perplexity significantly.</li>
      </ul>

      <h3 className="text-white font-semibold text-base mt-7">Step 4 — Inject personal or contextual voice</h3>
      <p>First-person statements (where appropriate for your discipline), opinion markers, and field-specific jargon that's used naturally rather than formally all increase the human signal. "I argue that" is more human-like than "This paper argues that" — if your discipline allows first person.</p>
      <p>Even in third-person academic writing, inserting a short reflective or evaluative sentence raises the human probability: "This distinction is often overlooked in the literature, which is surprising given its implications for X." That kind of editorial aside is rare in AI-generated text.</p>

      <h3 className="text-white font-semibold text-base mt-7">Step 5 — Run through a humanizer, then verify</h3>
      <p>After manual editing, run the text through a structural AI humanizer (not a synonym-swapper) for a final pass. Then test again across multiple detectors. You're aiming for below 15% on GPTZero and below 20% on Turnitin. Below 5% across both gives you a strong margin.</p>
      <p>Light Speed Ghost's humanizer handles the structural pass — sentence-length redistribution and perplexity adjustment — after your manual edits have addressed the highest-flagged sections. The combination of targeted manual editing and a structural automated pass is more effective than either alone.</p>

      <h3 className="text-white font-semibold text-base mt-7">What doesn't work</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li><strong className="text-white/70">Synonym replacement tools:</strong> Change wording, preserve structure. Detectors don't care about wording.</li>
        <li><strong className="text-white/70">Adding filler sentences:</strong> Padding doesn't change the statistical properties of the existing text.</li>
        <li><strong className="text-white/70">Changing fonts or inserting invisible characters:</strong> Modern detectors are robust to these tricks, and institutions may flag them as separate integrity violations.</li>
        <li><strong className="text-white/70">Rerunning the same AI model:</strong> Regenerating from the same model produces statistically similar text. The structural problem doesn't change.</li>
      </ul>
      <p className="pt-2 text-white/40 text-xs">Academic integrity note: AI tools are assistants, not replacements for your own thinking. Use them to draft, refine, and support — but the argument, judgment, and understanding need to be yours. Check your institution's AI policy before submitting any AI-assisted work.</p>
    </div>
  ),
};

function useSeoMeta(article: ArticleMeta | undefined, slug: string) {
  useEffect(() => {
    if (!article) {
      document.title = "Article not found — Light Speed Ghost Blog";
      return;
    }

    document.title = `${article.title} — Light Speed Ghost`;

    const setMeta = (name: string, content: string, prop?: boolean) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const canonical = `https://lightspeedghost.com/blog/${slug}`;

    setMeta("description", article.metaDescription);
    setMeta("og:title", article.title, true);
    setMeta("og:description", article.metaDescription, true);
    setMeta("og:type", "article", true);
    setMeta("og:url", canonical, true);
    setMeta("og:site_name", "Light Speed Ghost", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", article.title);
    setMeta("twitter:description", article.metaDescription);
    setMeta("article:published_time", article.dateIso, true);

    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkEl) { linkEl = document.createElement("link"); linkEl.setAttribute("rel", "canonical"); document.head.appendChild(linkEl); }
    linkEl.setAttribute("href", canonical);

    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": article.title,
      "description": article.metaDescription,
      "datePublished": article.dateIso,
      "dateModified": article.dateIso,
      "author": { "@type": "Organization", "name": "Light Speed Ghost", "url": "https://lightspeedghost.com" },
      "publisher": {
        "@type": "Organization",
        "name": "Light Speed Ghost",
        "url": "https://lightspeedghost.com",
        "logo": { "@type": "ImageObject", "url": "https://lightspeedghost.com/og-image.png" }
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonical },
    };

    const schemas: object[] = [articleSchema];

    if (article.faqSchema && article.faqSchema.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": article.faqSchema.map(({ q, a }) => ({
          "@type": "Question",
          "name": q,
          "acceptedAnswer": { "@type": "Answer", "text": a }
        }))
      });
    }

    let scriptEl = document.getElementById("lsg-article-jsonld") as HTMLScriptElement | null;
    if (!scriptEl) { scriptEl = document.createElement("script"); scriptEl.id = "lsg-article-jsonld"; scriptEl.setAttribute("type", "application/ld+json"); document.head.appendChild(scriptEl); }
    scriptEl.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);

    return () => {
      document.title = "Light Speed Ghost — AI Academic Writing Platform";
    };
  }, [article, slug]);
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const article = ARTICLES.find((a) => a.slug === slug);
  const body = ARTICLE_BODIES[slug];

  useSeoMeta(article, slug);

  if (!article || !body) {
    return (
      <div className="min-h-screen bg-[#04080f] text-white antialiased flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-sm">Article not found.</p>
        <Link href="/blog"><span className="text-blue-400 text-sm hover:text-blue-300 cursor-pointer">← All articles</span></Link>
      </div>
    );
  }

  const otherArticles = ARTICLES.filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <Link href="/blog">
          <span className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={14} /> All articles
          </span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-14 sm:py-20">
        <div className="mb-8">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border mb-4 ${article.tagColor}`}>
            <Tag size={10} /> {article.tag}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-snug">{article.title}</h1>
          <div className="flex items-center gap-3 text-white/35 text-xs">
            <span>{article.date}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {article.readTime}</span>
          </div>
        </div>

        <div className="prose prose-sm prose-invert max-w-none">
          {body}
        </div>

        {article.faqSchema && article.faqSchema.length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-white font-semibold text-lg">Frequently asked questions</h2>
            {article.faqSchema.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
                <p className="text-white/90 text-sm font-semibold mb-2">{q}</p>
                <p className="text-white/55 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-14 p-6 rounded-2xl bg-blue-600/8 border border-blue-500/20 text-center">
          <p className="text-white font-semibold mb-2">Try it yourself</p>
          <p className="text-white/50 text-sm mb-5">Seven AI academic tools built specifically for students. Starter plan from $1.50/month — cancel any time.</p>
          <Link href="/auth">
            <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer text-sm">
              Get started <ArrowRight size={14} />
            </span>
          </Link>
        </div>

        {otherArticles.length > 0 && (
          <div className="mt-14">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-5">More articles</p>
            <div className="space-y-3">
              {otherArticles.map((a) => (
                <a key={a.slug} href={`/blog/${a.slug}`} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/12 hover:bg-white/[0.04] transition-all group cursor-pointer">
                  <div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border mb-1 ${a.tagColor}`}>
                      {a.tag}
                    </span>
                    <p className="text-sm text-white/75 group-hover:text-white transition-colors leading-snug">{a.title}</p>
                  </div>
                  <ArrowRight size={14} className="text-white/20 group-hover:text-white/50 shrink-0 ml-4 transition-colors" />
                </a>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center mt-10">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
