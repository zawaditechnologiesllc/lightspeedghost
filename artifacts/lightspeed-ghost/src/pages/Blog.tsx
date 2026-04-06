import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Clock, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";

interface Article {
  slug: string;
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  body: React.ReactNode;
}

const ARTICLES: Article[] = [
  {
    slug: "literature-review-guide",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "How to write a literature review that actually holds up",
    excerpt: "A literature review is not a summary dump. Here's how to structure one that makes reviewers take you seriously.",
    readTime: "6 min read",
    date: "March 28, 2025",
    body: null,
  },
  {
    slug: "ai-humanizer-vs-paraphrasing",
    tag: "AI Tools",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "AI humanizer vs. paraphrasing tools: what actually works against AI detection",
    excerpt: "Most paraphrasers just swap synonyms. That's not enough. Here's what the research says about what AI detectors actually look for.",
    readTime: "8 min read",
    date: "March 14, 2025",
    body: null,
  },
  {
    slug: "stem-problem-solving",
    tag: "STEM",
    tagColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    title: "The honest guide to STEM problem-solving with AI",
    excerpt: "Used right, AI can teach you how to solve problems — not just give you answers. Used wrong, it leaves you stranded in an exam.",
    readTime: "5 min read",
    date: "February 27, 2025",
    body: null,
  },
  {
    slug: "payg-vs-subscription",
    tag: "Platform",
    tagColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    title: "Pay-per-use vs. monthly plan: which is right for you?",
    excerpt: "Not every student writes papers every week. Here's an honest breakdown of when each pricing model saves you money.",
    readTime: "4 min read",
    date: "February 12, 2025",
    body: null,
  },
  {
    slug: "study-techniques-with-ai",
    tag: "Study",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "5 study techniques that actually improve with AI tutoring",
    excerpt: "Flashcards and passive re-reading are low-yield. These five evidence-backed methods get a real boost from an AI study partner.",
    readTime: "7 min read",
    date: "January 30, 2025",
    body: null,
  },
  {
    slug: "citations-that-are-real",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "Why most AI writers give you fake citations (and what we do instead)",
    excerpt: "Hallucinated references will get a paper failed instantly. We pull citations from Semantic Scholar in real time. Here's how.",
    readTime: "5 min read",
    date: "January 15, 2025",
    body: null,
  },
];

const FULL_ARTICLES: Record<string, React.ReactNode> = {
  "literature-review-guide": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>A literature review is the part of your paper that shows reviewers you actually understand the field. Done well, it positions your argument in a larger conversation. Done badly, it's a list of things you read.</p>
      <h3 className="text-white font-semibold text-base mt-6">Start with a clear scope</h3>
      <p>Define your research question first. Every source you include should connect to that question. If you can't explain why a paper is in your review in one sentence, cut it. Most undergraduate lit reviews should be 8–15 sources. Most postgraduate reviews: 20–40, depending on the field.</p>
      <h3 className="text-white font-semibold text-base mt-6">Organize thematically, not chronologically</h3>
      <p>Organizing by year ("Smith (2015) said X. Jones (2018) said Y.") is the most common mistake. Reviewers read a catalogue, not an argument. Instead, group sources by theme, methodology, or finding — and use transitions that show how ideas relate to each other.</p>
      <h3 className="text-white font-semibold text-base mt-6">Show disagreement</h3>
      <p>If the literature agrees on everything, you don't need a review — you need a summary. Real lit reviews map where scholars diverge. Point out contradictions explicitly: "While Zhang (2021) argues that X, several studies suggest the opposite under conditions Y."</p>
      <h3 className="text-white font-semibold text-base mt-6">End with a gap statement</h3>
      <p>Your review should lead naturally to your research question by identifying what's missing. The last paragraph should effectively say: "These gaps are why this study is necessary."</p>
      <p className="pt-2 text-white/40 text-xs">Light Speed Ghost's Write Paper tool generates literature-grounded papers using real citations verified through Semantic Scholar. The AI pulls and verifies sources before writing — it doesn't invent them.</p>
    </div>
  ),
  "ai-humanizer-vs-paraphrasing": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>AI detectors like GPTZero and Turnitin's AI tool don't flag text because it contains specific words. They look for statistical patterns — sentence-length entropy, perplexity, burstiness — that differ between humans and large language models.</p>
      <h3 className="text-white font-semibold text-base mt-6">Why paraphrasers fail</h3>
      <p>Standard paraphrasing tools — even "AI paraphrasers" — typically swap synonyms and rearrange clauses. This changes surface-level wording but preserves the same low-perplexity, low-burstiness structure that detectors flag. The result: text that reads awkwardly to humans and still scores high on AI probability.</p>
      <h3 className="text-white font-semibold text-base mt-6">What a humanizer actually needs to do</h3>
      <p>Effective humanization requires structural rewriting, not word substitution. That means varying sentence length deliberately, introducing the kind of minor imperfections and stylistic choices that characterize human writing, and ensuring the semantic flow matches what a person would naturally produce. It's a fundamentally different task than paraphrasing.</p>
      <h3 className="text-white font-semibold text-base mt-6">LightSpeed Humanizer's approach</h3>
      <p>Our humanizer runs a multi-pass rewrite process designed specifically to move AI-probability scores below 15% on major detection platforms. It doesn't just change words — it restructures the text at the sentence and paragraph level. You can test it on your own text before committing.</p>
      <p className="pt-2 text-white/40 text-xs">Academic use note: always review humanized output for accuracy before submitting. The goal is to help you write in your own voice — not to submit work that isn't yours.</p>
    </div>
  ),
  "stem-problem-solving": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>The most dangerous thing you can do with AI and STEM problems is copy-paste the solution. You learn nothing, and you'll fail the exam. The most useful thing you can do is use AI to teach you the method, step by step, so you can reproduce it yourself.</p>
      <h3 className="text-white font-semibold text-base mt-6">Use AI for conceptual explanation, not just answers</h3>
      <p>Before asking an AI to solve a problem, ask it to explain the concept behind it. "What is the relationship between torque and angular momentum?" before "Solve this rotational dynamics problem." That order matters. Once you understand the concept, the solution becomes derivable rather than memorizable.</p>
      <h3 className="text-white font-semibold text-base mt-6">Ask for worked examples on similar problems</h3>
      <p>Good AI tutors can generate parallel problems — same difficulty, different numbers — so you can practice the method rather than just checking an answer. Ask for this explicitly: "Give me three similar problems with full working, then give me one unsolved for me to try."</p>
      <h3 className="text-white font-semibold text-base mt-6">Step-by-step is not optional</h3>
      <p>In STEM, showing the method is usually worth more marks than the final answer. Understand each step well enough to explain why it's valid. Our STEM Solver tool shows full reasoning at every step, with graph support for problems where visualization matters — specifically because we know examiners check the working.</p>
      <h3 className="text-white font-semibold text-base mt-6">Know when to close the AI</h3>
      <p>Once you can solve a class of problems correctly three times in a row without help, you don't need the AI anymore for that problem type. Track which types you need help with. The goal is to have nothing left to check by the time the exam comes.</p>
    </div>
  ),
  "payg-vs-subscription": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>Both pricing models work well for specific students. The wrong one wastes money. Here's a simple framework for choosing.</p>
      <h3 className="text-white font-semibold text-base mt-6">Pay-per-use is better if:</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>You write 1–2 papers per month, not more</li>
        <li>Your usage is seasonal — heavy in finals period, light otherwise</li>
        <li>You only need specific tools, not the full platform</li>
        <li>You want to try the platform before committing</li>
      </ul>
      <p>PAYG charges never expire. If you top up $20 and only use $12 this month, the remaining $8 sits in your account for whenever you need it. There's no pressure to "use it before it expires."</p>
      <h3 className="text-white font-semibold text-base mt-6">Pro subscription is better if:</h3>
      <ul className="list-disc list-inside space-y-1.5 text-white/55">
        <li>You write more than 2–3 papers per month</li>
        <li>You regularly use the humanizer, plagiarism check, or study assistant</li>
        <li>You want predictable billing without thinking about per-use costs</li>
        <li>You're in a course-heavy semester</li>
      </ul>
      <p>At $14.99/month, Pro costs less than two standard essay purchases under PAYG. If you write three or more papers a month, the math favors Pro by a significant margin.</p>
      <h3 className="text-white font-semibold text-base mt-6">The honest comparison</h3>
      <p>Most students start on PAYG to test the platform, then upgrade to Pro mid-semester once they realize they're using it regularly. That's the intended path. Credits from PAYG purchases carry over regardless, so you never lose what you've paid for.</p>
    </div>
  ),
  "study-techniques-with-ai": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>Not all study methods are equal. The research on learning science is fairly clear about what works and what doesn't. Here's how to pair evidence-backed techniques with an AI study assistant.</p>
      <h3 className="text-white font-semibold text-base mt-6">1. Retrieval practice (active recall)</h3>
      <p>Testing yourself on material is significantly more effective than re-reading it. Ask your AI tutor to quiz you on a topic — and insist on answering before seeing the correct answer. The effort of retrieval is what cements the memory.</p>
      <h3 className="text-white font-semibold text-base mt-6">2. Spaced repetition</h3>
      <p>Return to material at increasing intervals rather than cramming. Use your AI session to identify which concepts you got wrong, then schedule them for review the next day, then in three days, then a week. You can ask the tutor to keep a running list.</p>
      <h3 className="text-white font-semibold text-base mt-6">3. Elaborative interrogation</h3>
      <p>Instead of "what happened?", ask "why did this happen?" and "how does this connect to X?" AI tutors are particularly good here — they can generate connected explanations on demand. This builds conceptual understanding rather than surface-level recall.</p>
      <h3 className="text-white font-semibold text-base mt-6">4. Interleaving</h3>
      <p>Study multiple related topics in one session, rather than blocking them. If you're revising calculus, mix derivatives, integrals, and limits in the same session. Ask your AI tutor to mix problem types so you practice switching between methods — which is what exams actually require.</p>
      <h3 className="text-white font-semibold text-base mt-6">5. The Feynman technique</h3>
      <p>Explain a concept as if you're teaching it to someone with no background. Ask your AI tutor to role-play as a curious 12-year-old asking follow-up questions. Every time you can't answer a follow-up, you've found a gap in your understanding. Fill it, then try again.</p>
    </div>
  ),
  "citations-that-are-real": (
    <div className="space-y-5 text-white/65 text-sm leading-relaxed">
      <p>If you've used more than one AI writing tool, you've probably seen this: a reference list that looks authoritative, with real-sounding authors and journal names, for papers that don't exist. This is hallucination — and it will get your paper failed the moment a marker tries to verify a source.</p>
      <h3 className="text-white font-semibold text-base mt-6">Why AI models hallucinate citations</h3>
      <p>Large language models generate text statistically. They learn patterns from training data — including the patterns of academic citations. When asked to produce a reference list, they generate strings that look like citations, not strings verified against a database. The model has no way to confirm a paper exists.</p>
      <h3 className="text-white font-semibold text-base mt-6">What we do differently</h3>
      <p>Light Speed Ghost's paper writer queries the Semantic Scholar API in real time before writing the literature section. Sources are verified against an actual database of academic papers before they appear in your document. If a source can't be retrieved and confirmed, it doesn't go in.</p>
      <p>This is slower than generating fake citations instantly, but it's the only version that's academically defensible.</p>
      <h3 className="text-white font-semibold text-base mt-6">How to verify your citations regardless</h3>
      <p>For any AI-generated paper: copy every DOI into Google Scholar or the journal's own site before submitting. This takes five minutes and is the minimum due diligence for academic work. Our tool makes this unnecessary for the citations it generates — but it's good practice for any academic writing.</p>
      <p className="pt-2 text-white/40 text-xs">Semantic Scholar indexes over 220 million academic papers across all major fields. When a verified source isn't available for your specific topic, our tool will say so rather than invent one.</p>
    </div>
  ),
};

export default function Blog() {
  const hash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
  const openArticle = hash && ARTICLES.find((a) => a.slug === hash) ? hash : null;
  const article = openArticle ? ARTICLES.find((a) => a.slug === openArticle) : null;

  if (article) {
    return (
      <div className="min-h-screen bg-[#04080f] text-white antialiased">
        <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
          <a href="/blog" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={14} /> All articles
          </a>
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
            {FULL_ARTICLES[article.slug]}
          </div>

          <div className="mt-14 p-6 rounded-2xl bg-blue-600/8 border border-blue-500/20 text-center">
            <p className="text-white font-semibold mb-2">Try it for yourself</p>
            <p className="text-white/50 text-sm mb-5">Light Speed Ghost has seven AI tools built specifically for students. Free to start, no credit card required.</p>
            <Link href="/auth">
              <span className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all cursor-pointer text-sm">
                Get started <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </main>

        <footer className="border-t border-white/5 py-8 px-6 text-center">
          <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#04080f] text-white antialiased">
      <header className="border-b border-white/5 px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/"><Logo size={28} textSize="text-base" className="cursor-pointer" /></Link>
        <div className="flex items-center gap-4">
          <Link href="/auth"><span className="text-sm text-white/50 hover:text-white transition-colors cursor-pointer">Sign In</span></Link>
          <Link href="/auth"><span className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors cursor-pointer">Get Started</span></Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-14 sm:py-20">
        <div className="mb-12">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">Blog</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">Guides for students who want to do better work.</h1>
          <p className="text-white/50 text-lg max-w-xl">
            Practical articles on academic writing, AI tools, study techniques, and making the most of the platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {ARTICLES.map((a) => (
            <a key={a.slug} href={`/blog#${a.slug}`}
              className="group flex flex-col p-6 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-white/16 hover:bg-white/[0.05] transition-all cursor-pointer">
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${a.tagColor}`}>
                  <Tag size={9} /> {a.tag}
                </span>
              </div>
              <h2 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors mb-2 leading-snug">{a.title}</h2>
              <p className="text-white/45 text-sm leading-relaxed flex-1">{a.excerpt}</p>
              <div className="flex items-center gap-3 mt-5 text-white/25 text-xs">
                <span>{a.date}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {a.readTime}</span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-14 py-12 border-t border-white/5 text-center">
          <p className="text-white/40 text-sm mb-6">More guides on the way — covering citation management, revision techniques, STEM problem-setting, and more.</p>
          <Link href="/auth">
            <span className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all cursor-pointer text-sm">
              Try the platform <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-white/25 text-xs">© {new Date().getFullYear()} Light Speed Ghost. All rights reserved.</p>
      </footer>
    </div>
  );
}
