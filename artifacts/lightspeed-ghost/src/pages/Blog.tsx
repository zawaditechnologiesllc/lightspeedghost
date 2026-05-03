import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, Clock, Tag } from "lucide-react";
import { Logo } from "@/components/Logo";

interface ArticleCard {
  slug: string;
  tag: string;
  tagColor: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
}

const ARTICLES: ArticleCard[] = [
  {
    slug: "lower-ai-detection-score",
    tag: "AI Tools",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "How to lower your AI detection score below 5%",
    excerpt: "Getting flagged isn't the end. Here's exactly what drives AI detection scores up — and the systematic approach to bringing them down.",
    readTime: "9 min read",
    date: "April 7, 2025",
  },
  {
    slug: "how-to-write-a-thesis-statement",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "How to write a thesis statement that professors can't ignore",
    excerpt: "A vague thesis guarantees a mediocre grade. Here's the formula for a statement that is specific, arguable, and positions your whole paper.",
    readTime: "6 min read",
    date: "April 3, 2025",
  },
  {
    slug: "literature-review-guide",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "How to write a literature review that actually holds up",
    excerpt: "A literature review is not a summary dump. Here's how to structure one that makes reviewers take you seriously.",
    readTime: "8 min read",
    date: "March 28, 2025",
  },
  {
    slug: "ai-humanizer-vs-paraphrasing",
    tag: "AI Tools",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    title: "AI humanizer vs. paraphrasing tools: what actually works against AI detection",
    excerpt: "Most paraphrasers just swap synonyms. That's not enough. Here's what the research says about what AI detectors actually look for.",
    readTime: "9 min read",
    date: "March 14, 2025",
  },
  {
    slug: "stem-problem-solving",
    tag: "STEM",
    tagColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    title: "The honest guide to STEM problem-solving with AI",
    excerpt: "Used right, AI can teach you how to solve problems — not just give you answers. Used wrong, it leaves you stranded in an exam.",
    readTime: "7 min read",
    date: "February 27, 2025",
  },
  {
    slug: "payg-vs-subscription",
    tag: "Platform",
    tagColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    title: "Pay-per-use vs. monthly plan: which is right for you?",
    excerpt: "Not every student writes papers every week. Here's an honest breakdown of when each pricing model saves you money.",
    readTime: "5 min read",
    date: "February 12, 2025",
  },
  {
    slug: "study-techniques-with-ai",
    tag: "Study",
    tagColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    title: "5 study techniques that actually improve with AI tutoring",
    excerpt: "Flashcards and passive re-reading are low-yield. These five evidence-backed methods get a real boost from an AI study partner.",
    readTime: "8 min read",
    date: "January 30, 2025",
  },
  {
    slug: "citations-that-are-real",
    tag: "Writing",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    title: "Why most AI writers give you fake citations (and what we do instead)",
    excerpt: "Hallucinated references will get a paper failed instantly. We pull citations from Semantic Scholar in real time. Here's how.",
    readTime: "6 min read",
    date: "January 15, 2025",
  },
];

export default function Blog() {
  useEffect(() => {
    document.title = "Blog — Light Speed Ghost | Academic Writing & AI Tools for Students";

    const setMeta = (name: string, content: string, prop?: boolean) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };

    const desc = "Practical guides on academic writing, AI detection, STEM problem-solving, literature reviews, thesis statements, and making the most of AI academic tools. Written for students who want to do better work.";
    setMeta("description", desc);
    setMeta("og:title", "Blog — Light Speed Ghost", true);
    setMeta("og:description", desc, true);
    setMeta("og:type", "website", true);
    setMeta("og:url", "https://lightspeedghost.com/blog", true);
    setMeta("og:site_name", "Light Speed Ghost", true);

    let linkEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!linkEl) { linkEl = document.createElement("link"); linkEl.setAttribute("rel", "canonical"); document.head.appendChild(linkEl); }
    linkEl.setAttribute("href", "https://lightspeedghost.com/blog");

    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://lightspeedghost.com" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://lightspeedghost.com/blog" }
      ]
    };
    let scriptEl = document.getElementById("lsg-blog-jsonld") as HTMLScriptElement | null;
    if (!scriptEl) { scriptEl = document.createElement("script"); scriptEl.id = "lsg-blog-jsonld"; scriptEl.setAttribute("type", "application/ld+json"); document.head.appendChild(scriptEl); }
    scriptEl.textContent = JSON.stringify(breadcrumb);

    return () => { document.title = "Light Speed Ghost — AI Academic Writing Platform"; };
  }, []);

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
            <a key={a.slug} href={`/blog/${a.slug}`}
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
