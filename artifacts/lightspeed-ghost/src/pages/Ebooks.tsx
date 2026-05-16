import { useState, useRef, useEffect } from "react";
import {
  BookOpen, Sparkles, Globe, Layers, Target, Zap, CheckCircle,
  ChevronDown, ChevronUp, Download, Copy, Check, Loader2,
  BookMarked, ShoppingBag, Star, Quote, ArrowRight, Lock,
  BarChart2, Users, Lightbulb, PenLine, RefreshCw, X, Info, Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { CheckoutModal } from "@/components/checkout/CheckoutModal";
import MathRenderer from "@/components/MathRenderer";
import { ExportButtons } from "@/components/ExportButtons";
import { mdToBodyHtml, wrapDocHtml, makeLsgFilename } from "@/lib/exportUtils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EbookOutline {
  title: string;
  subtitle: string;
  tagline: string;
  chapters: { number: number; title: string; focus: string; keyTakeaway: string }[];
  targetKeywords: string[];
  amazonCategories: string[];
  backCoverBlurb: string;
}

interface PublishingGuide {
  amazonKdp: {
    title: string; subtitle: string; description: string;
    keywords: string[]; categories: string[];
    pricing: string; formats: string[];
  };
  otherPlatforms: { name: string; tip: string }[];
  wordCount: number;
}

interface Step {
  id: string;
  message: string;
  status: "pending" | "running" | "done" | "error";
}

type Phase = "config" | "generating" | "results";
type ResultTab = "content" | "outline" | "publishing";

// ── Constants ─────────────────────────────────────────────────────────────────
const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian",
  "Dutch", "Polish", "Japanese", "Chinese (Simplified)", "Arabic",
  "Hindi", "Russian", "Korean", "Turkish",
];

const INDUSTRIES = [
  "Business & Entrepreneurship", "Technology & AI", "Finance & Investing",
  "Health & Wellness", "Marketing & Sales", "Personal Development",
  "Leadership & Management", "Real Estate", "E-commerce", "Education",
  "Law & Legal", "Science & Research", "Arts & Creativity", "Sports & Fitness",
  "Food & Nutrition", "Travel & Lifestyle", "Parenting & Family",
  "Environment & Sustainability", "Politics & Society", "Media & Entertainment",
];

const SECTORS: Record<string, string[]> = {
  "Business & Entrepreneurship": ["Startups", "Small Business", "Corporate", "Franchising", "Non-profit", "Consulting"],
  "Technology & AI": ["Software", "Artificial Intelligence", "Cybersecurity", "Blockchain", "IoT", "Cloud Computing"],
  "Finance & Investing": ["Stock Market", "Cryptocurrency", "Real Estate Finance", "Personal Finance", "Banking", "Insurance"],
  "Health & Wellness": ["Mental Health", "Nutrition", "Fitness", "Alternative Medicine", "Healthcare", "Longevity"],
  "Marketing & Sales": ["Digital Marketing", "Social Media", "Content Marketing", "SEO", "Sales Strategy", "Branding"],
  "Personal Development": ["Habits & Productivity", "Mindset", "Relationships", "Career Growth", "Communication", "Creativity"],
  "Leadership & Management": ["Executive Leadership", "Team Building", "Organizational Culture", "Change Management", "Coaching"],
  "Real Estate": ["Residential", "Commercial", "Investment", "Property Management", "Development", "REITs"],
  "E-commerce": ["Amazon FBA", "Dropshipping", "DTC Brands", "Marketplace", "Logistics", "Customer Experience"],
  "Education": ["EdTech", "Higher Education", "K-12", "Vocational Training", "Online Learning", "Curriculum Design"],
  "Law & Legal": ["Corporate Law", "Criminal Law", "Family Law", "Intellectual Property", "Immigration", "Compliance"],
  "Science & Research": ["Life Sciences", "Physics", "Chemistry", "Environmental Science", "Social Sciences", "Data Science"],
  "Arts & Creativity": ["Visual Arts", "Music", "Writing & Publishing", "Film & Video", "Design", "Photography"],
  "Sports & Fitness": ["Athletic Training", "Sports Business", "Coaching", "Nutrition & Performance", "Mental Fitness", "E-sports"],
  "Food & Nutrition": ["Cooking & Recipes", "Food Business", "Dietetics", "Food Science", "Sustainable Food", "Culinary Arts"],
  "Travel & Lifestyle": ["Travel Blogging", "Digital Nomad", "Luxury Travel", "Budget Travel", "Hospitality", "Adventure"],
  "Parenting & Family": ["Early Childhood", "Teen Parenting", "Family Finance", "Education at Home", "Relationships", "Special Needs"],
  "Environment & Sustainability": ["Climate Change", "Renewable Energy", "Sustainable Business", "Conservation", "Green Tech", "Circular Economy"],
  "Politics & Society": ["Public Policy", "Social Justice", "International Relations", "Governance", "Activism", "Community Development"],
  "Media & Entertainment": ["Podcasting", "YouTube & Streaming", "Journalism", "Public Relations", "Gaming", "Influencer Marketing"],
};

const TONES = [
  { value: "authoritative", label: "Authoritative", desc: "Expert, confident, knowledge-driven" },
  { value: "conversational", label: "Conversational", desc: "Friendly, approachable, relatable" },
  { value: "inspirational", label: "Inspirational", desc: "Motivating, uplifting, story-driven" },
  { value: "academic", label: "Academic", desc: "Scholarly, research-backed, formal" },
  { value: "practical", label: "Practical", desc: "How-to, action-focused, step-by-step" },
  { value: "storytelling", label: "Storytelling", desc: "Narrative-led, case studies, human" },
];

const PLATFORMS = [
  "Amazon Kindle (KDP)", "Apple Books", "Google Play Books",
  "Kobo Writing Life", "Barnes & Noble Press", "Smashwords / Draft2Digital",
];

const ADDITIONAL_PLATFORMS: string[] = [
  "Draft2Digital", "IngramSpark", "PublishDrive", "StreetLib", "BookBaby",
  "Lulu", "Blurb", "Reedsy", "Leanpub", "Scribd", "Storytel", "Bookmate",
  "Overdrive (Libraries)", "Hoopla (Libraries)", "Palace Marketplace (Libraries)",
  "Odilo (Libraries)", "cloudLibrary (Libraries)", "Gumroad", "Payhip", "Podia",
  "Teachable", "Etsy (Digital Downloads)", "Patreon", "Substack",
  "Wattpad", "Royal Road", "Radish", "Tapas", "Inkitt",
  "Tolino (Europe)", "Babelcube (Translations)", "Rakuten Kobo Japan",
  "Livraria Cultura (Brazil)", "Litres (Russia)", "24symbols",
  "Findaway Voices (Audiobook)", "ACX / Audible", "Kindle Unlimited (via KDP)",
  "Amazon Japan (via KDP)", "Flipkart (India)", "Pratilipi (India)",
];

const LENGTH_OPTIONS = [
  { value: "short", label: "Short Ebook", words: "~8,000 words", chapters: "5 chapters", time: "~3 min", badge: null },
  { value: "medium", label: "Standard Ebook", words: "~15,000 words", chapters: "8 chapters", time: "~6 min", badge: "Most popular" },
  { value: "long", label: "Extended Ebook", words: "~25,000 words", chapters: "12 chapters", time: "~12 min", badge: "Best value" },
] as const;

const PLATFORM_ICONS: Record<string, string> = {
  "Amazon Kindle (KDP)": "📦",
  "Apple Books": "🍎",
  "Google Play Books": "📱",
  "Kobo Writing Life": "📖",
  "Barnes & Noble Press": "🏪",
  "Smashwords / Draft2Digital": "🌐",
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function StepRow({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="shrink-0">
        {step.status === "done" && <CheckCircle size={15} className="text-emerald-400" />}
        {step.status === "running" && <Loader2 size={15} className="animate-spin text-purple-400" />}
        {step.status === "pending" && <div className="w-3.5 h-3.5 rounded-full border border-white/20" />}
        {step.status === "error" && <X size={15} className="text-red-400" />}
      </div>
      <span className={cn(
        "text-sm",
        step.status === "done" ? "text-white/70" : step.status === "running" ? "text-white" : "text-white/30"
      )}>
        {step.message}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function UpgradeGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
        <BookOpen size={36} className="text-purple-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Ebooks — Business Add-On</h2>
      <p className="text-white/55 max-w-md leading-relaxed mb-2">
        Write and publish professional ebooks to Amazon, Apple Books, and 40+ platforms.
        Powered by verified academic sources and expert quotes from industry leaders.
      </p>
      <div className="flex flex-wrap justify-center gap-2 mb-8 mt-4">
        {["15 ebooks / month", "Amazon KDP ready", "10+ languages", "Expert quotes", "Publishing guide", "Academic sources"].map(f => (
          <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
            <CheckCircle size={11} />
            {f}
          </span>
        ))}
      </div>
      <button
        onClick={onUpgrade}
        className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-xl shadow-purple-600/25 hover:scale-[1.02] active:scale-100"
      >
        <Zap size={16} />
        Subscribe — $29.99 / month
        <ArrowRight size={16} />
      </button>
      <p className="text-white/30 text-xs mt-3">15 ebooks per month · Cancel anytime · Separate from other plans</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Ebooks() {
  const [phase, setPhase] = useState<Phase>("config");
  const [resultTab, setResultTab] = useState<ResultTab>("content");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [outline, setOutline] = useState<EbookOutline | null>(null);
  const [content, setContent] = useState("");
  const [publishingGuide, setPublishingGuide] = useState<PublishingGuide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([1]));
  const esRef = useRef<EventSource | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [language, setLanguage] = useState("English");
  const [industry, setIndustry] = useState("");
  const [sector, setSector] = useState("");
  const [inspiration, setInspiration] = useState("");
  const [tone, setTone] = useState("authoritative");
  const [ebookLength, setEbookLength] = useState<"short" | "medium" | "long">("medium");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Amazon Kindle (KDP)", "Apple Books"]);
  const [includeExpertQuotes, setIncludeExpertQuotes] = useState(true);
  const [keywords, setKeywords] = useState("");
  const [showMorePlatforms, setShowMorePlatforms] = useState(false);
  const [customPlatform, setCustomPlatform] = useState("");

  useEffect(() => {
    checkStatus();
    return () => { esRef.current?.close(); };
  }, []);

  async function checkStatus() {
    try {
      const res = await apiFetch("/ebooks/status");
      if (res.ok) {
        const data = await res.json() as { hasAccess: boolean; used: number; remaining: number };
        setHasAccess(data.hasAccess);
        setUsedThisMonth(data.used);
      } else {
        setHasAccess(false);
      }
    } catch {
      setHasAccess(false);
    }
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function addCustomPlatform() {
    const trimmed = customPlatform.trim();
    if (!trimmed || selectedPlatforms.includes(trimmed)) return;
    setSelectedPlatforms(prev => [...prev, trimmed]);
    setCustomPlatform("");
  }

  function toggleChapter(n: number) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  async function handleGenerate() {
    if (!topic.trim() || !industry || !targetAudience.trim()) return;

    setPhase("generating");
    setError(null);
    setSteps([]);
    setOutline(null);
    setContent("");
    setPublishingGuide(null);

    const body = {
      topic: topic.trim(),
      targetAudience: targetAudience.trim(),
      language,
      industry,
      sector,
      inspiration: inspiration.trim(),
      tone,
      ebookLength,
      platforms: selectedPlatforms,
      includeExpertQuotes,
      keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
    };

    const res = await apiFetch("/ebooks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({})) as { error?: string; requiresUpgrade?: boolean; limitReached?: boolean };
      if (data.requiresUpgrade) { setHasAccess(false); setPhase("config"); return; }
      setError(data.error ?? "Generation failed. Please try again.");
      setPhase("config");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        const eventLine = lines.find(l => l.startsWith("event:"));
        const dataLine = lines.find(l => l.startsWith("data:"));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.replace("event:", "").trim();
        let data: unknown;
        try { data = JSON.parse(dataLine.replace("data:", "").trim()); } catch { continue; }

        if (event === "step") {
          const s = data as Step;
          setSteps(prev => {
            const idx = prev.findIndex(x => x.id === s.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = s; return n; }
            return [...prev, s];
          });
        } else if (event === "outline") {
          setOutline(data as EbookOutline);
        } else if (event === "complete") {
          const d = data as { content: string; outline: EbookOutline; publishingGuide: PublishingGuide; usedThisMonth: number };
          setContent(d.content);
          setOutline(d.outline);
          setPublishingGuide(d.publishingGuide);
          setUsedThisMonth(d.usedThisMonth);
          setPhase("results");
          setResultTab("content");
        } else if (event === "error") {
          setError((data as { message: string }).message);
          setPhase("config");
        }
      }
    }
  }

  function handleReset() {
    esRef.current?.close();
    setPhase("config");
    setSteps([]);
    setOutline(null);
    setContent("");
    setPublishingGuide(null);
    setError(null);
  }

  const sectorOptions = SECTORS[industry] ?? [];
  const canGenerate = topic.trim().length > 3 && targetAudience.trim().length > 3;
  const remaining = Math.max(0, 15 - usedThisMonth);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  // ── Upgrade wall ───────────────────────────────────────────────────────────
  if (hasAccess === false) {
    return (
      <>
        <UpgradeGate onUpgrade={() => setShowCheckout(true)} />
        <CheckoutModal
          open={showCheckout}
          onClose={() => setShowCheckout(false)}
          mode="subscription"
          plan="ebooks_monthly"
          onSuccess={() => { setShowCheckout(false); checkStatus(); }}
        />
      </>
    );
  }

  // ── Results Phase ──────────────────────────────────────────────────────────
  if (phase === "results" && outline && content) {
    const filename = makeLsgFilename("ebook", outline.title);
    const bodyHtml = mdToBodyHtml(content);
    const fullHtml = wrapDocHtml(outline.title, bodyHtml);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <BookOpen size={15} className="text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{outline.title}</p>
              <p className="text-muted-foreground text-xs truncate">{outline.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExportButtons getHtml={() => fullHtml} getText={() => content} filename={filename} formats={["pdf", "docx", "copy"]} />
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium transition-colors"
            >
              <RefreshCw size={12} />
              New Ebook
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 sm:px-6 pt-3 pb-0 shrink-0 border-b border-border">
          {([
            { id: "content", label: "Ebook Content", icon: PenLine },
            { id: "outline", label: "Structure & Outline", icon: Layers },
            { id: "publishing", label: "Publishing Guide", icon: ShoppingBag },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setResultTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors",
                resultTab === tab.id
                  ? "border-purple-500 text-purple-400 bg-purple-500/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Content tab */}
          {resultTab === "content" && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">
                    ~{publishingGuide?.wordCount?.toLocaleString() ?? "—"} words
                    &nbsp;·&nbsp; {outline.chapters.length} chapters
                    &nbsp;·&nbsp; {language}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-purple-400 font-medium">{remaining} ebooks remaining this month</span>
                  <CopyButton text={content} />
                </div>
              </div>
              <div className="prose prose-sm prose-invert max-w-none bg-card border border-border rounded-xl p-6 sm:p-8">
                <MathRenderer text={content} />
              </div>
            </div>
          )}

          {/* Outline tab */}
          {resultTab === "outline" && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5">
                <h2 className="text-xl font-bold text-white mb-1">{outline.title}</h2>
                <p className="text-purple-300 text-sm mb-3">{outline.subtitle}</p>
                <div className="bg-black/20 rounded-lg px-4 py-2.5 border border-white/5">
                  <p className="text-white/70 text-sm italic">"{outline.tagline}"</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Quote size={14} className="text-purple-400" />
                  Back Cover Blurb
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{outline.backCoverBlurb}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white/70 px-1">Chapter Structure</h3>
                {outline.chapters.map(ch => (
                  <div key={ch.number} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleChapter(ch.number)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0">
                          {ch.number}
                        </span>
                        <span className="font-medium text-sm text-foreground truncate">{ch.title}</span>
                      </div>
                      {expandedChapters.has(ch.number)
                        ? <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                        : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                    </button>
                    {expandedChapters.has(ch.number) && (
                      <div className="px-4 pb-4 border-t border-border space-y-2 pt-3">
                        <p className="text-xs text-muted-foreground">{ch.focus}</p>
                        <div className="flex items-start gap-2">
                          <Star size={11} className="text-yellow-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-yellow-300/80"><span className="font-medium">Key takeaway:</span> {ch.keyTakeaway}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Publishing guide tab */}
          {resultTab === "publishing" && publishingGuide && (
            <div className="max-w-3xl mx-auto space-y-5">
              {/* Amazon KDP */}
              <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📦</span>
                  <div>
                    <h3 className="font-bold text-white text-sm">Amazon KDP Listing</h3>
                    <p className="text-xs text-orange-300">Ready to paste into your KDP dashboard</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Title", value: publishingGuide.amazonKdp.title },
                    { label: "Subtitle", value: publishingGuide.amazonKdp.subtitle },
                    { label: "Recommended Pricing", value: publishingGuide.amazonKdp.pricing },
                  ].map(row => (
                    <div key={row.label} className="bg-black/20 rounded-lg p-3 border border-white/5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-semibold text-orange-300/70 uppercase tracking-wider">{row.label}</span>
                          <p className="text-sm text-white/80 mt-0.5">{row.value}</p>
                        </div>
                        <CopyButton text={row.value} />
                      </div>
                    </div>
                  ))}
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-semibold text-orange-300/70 uppercase tracking-wider">Description</span>
                        <p className="text-sm text-white/80 mt-0.5 leading-relaxed">{publishingGuide.amazonKdp.description}</p>
                      </div>
                      <CopyButton text={publishingGuide.amazonKdp.description} />
                    </div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <span className="text-[10px] font-semibold text-orange-300/70 uppercase tracking-wider block mb-2">Keywords (paste each one)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {publishingGuide.amazonKdp.keywords.map(kw => (
                        <span key={kw} className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs rounded-lg">{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <span className="text-[10px] font-semibold text-orange-300/70 uppercase tracking-wider block mb-2">Category Paths</span>
                    {publishingGuide.amazonKdp.categories.map(cat => (
                      <p key={cat} className="text-xs text-white/70 mb-1">→ {cat}</p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Other platforms */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-white/80 text-sm mb-4 flex items-center gap-2">
                  <Globe size={14} className="text-purple-400" />
                  Other Publishing Platforms
                </h3>
                <div className="space-y-3">
                  {publishingGuide.otherPlatforms.map(p => (
                    <div key={p.name} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                      <span className="text-lg shrink-0">{PLATFORM_ICONS[p.name] ?? "📚"}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format note */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-300">Format your ebook</p>
                  <p className="text-xs text-blue-300/70 mt-1 leading-relaxed">
                    Download the ebook as a Word (.docx) file and convert it to EPUB using <strong>Calibre</strong> (free) or <strong>Vellum</strong> (Mac). KDP also accepts .docx directly. Add a cover image (1,600 × 2,560px) before uploading.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Generating Phase ───────────────────────────────────────────────────────
  if (phase === "generating") {
    const doneCount = steps.filter(s => s.status === "done").length;
    const totalExpected = steps.length || 3;
    const pct = Math.round((doneCount / totalExpected) * 100);
    const currentStep = steps.find(s => s.status === "running");

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 py-10">
        <div className="w-full max-w-lg">
          {/* LightSpeed AI brand header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center relative">
                <Zap size={22} className="text-primary" />
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping opacity-20" />
              </div>
            </div>
            <p className="text-[11px] font-bold text-primary uppercase tracking-[0.18em] mb-1">LightSpeed AI</p>
            <h2 className="text-xl font-bold text-foreground">Writing Your Ebook</h2>
            {currentStep && (
              <p className="text-sm text-muted-foreground mt-1 animate-pulse">{currentStep.message}</p>
            )}
            {outline && !currentStep && (
              <p className="text-sm text-muted-foreground mt-1 truncate max-w-xs mx-auto">"{outline.title}"</p>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</span>
              <span className="text-xs font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Step list */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-1">
            {steps.map((step, i) => (
              <div key={step.id} className={cn(
                "flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors",
                step.status === "running" ? "bg-primary/5 border border-primary/20" : ""
              )}>
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {step.status === "done"    && <CheckCircle size={15} className="text-emerald-400" />}
                  {step.status === "running" && <Loader2 size={15} className="animate-spin text-primary" />}
                  {step.status === "pending" && (
                    <span className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                  )}
                  {step.status === "error"   && <X size={15} className="text-red-400" />}
                </div>
                <span className={cn(
                  "text-sm leading-snug",
                  step.status === "done"    ? "text-muted-foreground line-through decoration-muted-foreground/30" :
                  step.status === "running" ? "text-foreground font-medium" :
                  step.status === "error"   ? "text-red-400" :
                  "text-muted-foreground/40"
                )}>
                  {step.message}
                </span>
                {step.status === "running" && (
                  <span className="ml-auto text-[10px] font-semibold text-primary shrink-0 uppercase tracking-wider">Active</span>
                )}
                {step.status === "done" && (
                  <span className="ml-auto text-[10px] text-emerald-400/70 shrink-0">Done</span>
                )}
              </div>
            ))}
          </div>

          {outline && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} className="text-primary" />
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Outline Ready</p>
              </div>
              <p className="text-sm font-semibold text-foreground">{outline.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{outline.subtitle}</p>
            </div>
          )}

          <p className="text-center text-muted-foreground/40 text-xs">
            Keep this window open — LightSpeed AI is writing chapter by chapter using verified sources.
          </p>
        </div>
      </div>
    );
  }

  // ── Config Phase ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 shrink-0">
        {/* Centered LightSpeed AI brand header */}
        <div className="text-center space-y-1.5 mb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Zap size={20} className="text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold text-primary uppercase tracking-[0.18em]">LightSpeed AI</p>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Ebook Writer</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Write &amp; publish professional ebooks to Amazon, Apple Books &amp; 40+ platforms — powered by verified sources and expert quotes.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            {["15 ebooks / month", "Amazon KDP ready", "15 languages", "Expert quotes", "Publishing guide"].map(f => (
              <span key={f} className="text-[10px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">{f}</span>
            ))}
          </div>
        </div>

        {/* Usage badge row */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <BarChart2 size={13} className="text-purple-400" />
            <p className="text-purple-300 text-xs font-bold">{usedThisMonth} / 15 this month</p>
          </div>
          <span className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold uppercase tracking-wider">Business</span>
        </div>

        {remaining === 0 && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <Lock size={13} className="text-red-400 shrink-0" />
            <p className="text-red-300 text-xs">Monthly limit reached (15/15). Resets at the start of next month.</p>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <X size={13} className="text-red-400 shrink-0" />
            <p className="text-red-300 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 sm:px-6 py-5 space-y-6 max-w-3xl w-full mx-auto">

        {/* ── Topic & Audience ───────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ebook Topic <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. How to Scale a Dropshipping Business from $0 to $1M"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Target Audience <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={e => setTargetAudience(e.target.value)}
              placeholder="e.g. First-time entrepreneurs aged 25-40 looking to generate passive income"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Inspiration / Unique Angle <span className="text-muted-foreground text-xs font-normal">(optional)</span>
            </label>
            <textarea
              value={inspiration}
              onChange={e => setInspiration(e.target.value)}
              rows={2}
              placeholder="What makes this ebook different? e.g. 'Focus on the emotional side of entrepreneurship, not just tactics'"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors resize-none"
            />
          </div>
        </section>

        {/* ── Industry & Sector ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Layers size={13} className="text-purple-400" /> Industry & Sector
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Industry <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </label>
              <select
                value={industry}
                onChange={e => { setIndustry(e.target.value); setSector(""); }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
              >
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sector</label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                disabled={!sectorOptions.length}
                style={{ colorScheme: "dark" }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors disabled:opacity-40"
              >
                <option value="">Select sector…</option>
                {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Target Keywords <span className="text-muted-foreground text-xs font-normal">(comma-separated, for Amazon SEO)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="e.g. dropshipping, passive income, ecommerce, amazon fba, side hustle"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            />
          </div>
        </section>

        {/* ── Language & Tone ────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Globe size={13} className="text-purple-400" /> Language & Style
          </h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Writing Tone</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={cn(
                    "flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                    tone === t.value
                      ? "border-purple-500/60 bg-purple-500/10 text-purple-300"
                      : "border-border bg-background text-muted-foreground hover:border-purple-500/30 hover:text-foreground"
                  )}
                >
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-[10px] opacity-70">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ebook Length ───────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <BookMarked size={13} className="text-purple-400" /> Ebook Length
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LENGTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setEbookLength(opt.value)}
                className={cn(
                  "relative flex flex-col gap-1 p-4 rounded-xl border text-left transition-all",
                  ebookLength === opt.value
                    ? "border-purple-500/60 bg-purple-500/10"
                    : "border-border bg-card hover:border-purple-500/30"
                )}
              >
                {opt.badge && (
                  <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[9px] font-bold">
                    {opt.badge}
                  </span>
                )}
                <span className={cn("font-semibold text-sm", ebookLength === opt.value ? "text-purple-300" : "text-foreground")}>
                  {opt.label}
                </span>
                <span className="text-xs text-muted-foreground">{opt.words}</span>
                <span className="text-xs text-muted-foreground">{opt.chapters}</span>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">{opt.time} to generate</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Publishing Platforms ───────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag size={13} className="text-purple-400" /> Publishing Platforms
          </h2>

          {/* Main 6 platforms — quick select */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-xs transition-all",
                  selectedPlatforms.includes(p)
                    ? "border-purple-500/60 bg-purple-500/10 text-purple-300"
                    : "border-border bg-card text-muted-foreground hover:border-purple-500/30 hover:text-foreground"
                )}
              >
                <span className="text-base leading-none">{PLATFORM_ICONS[p] ?? "📚"}</span>
                <span className="font-medium leading-tight">{p}</span>
              </button>
            ))}
          </div>

          {/* More platforms — expandable */}
          <button
            onClick={() => setShowMorePlatforms(v => !v)}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <ChevronDown size={13} className={cn("transition-transform duration-200", showMorePlatforms && "rotate-180")} />
            {showMorePlatforms ? "Hide additional platforms" : "More platforms (40+ supported)"}
            {ADDITIONAL_PLATFORMS.filter(p => selectedPlatforms.includes(p)).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                {ADDITIONAL_PLATFORMS.filter(p => selectedPlatforms.includes(p)).length} selected
              </span>
            )}
          </button>

          {showMorePlatforms && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ADDITIONAL_PLATFORMS.map(p => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-left text-xs transition-all",
                    selectedPlatforms.includes(p)
                      ? "border-purple-500/60 bg-purple-500/10 text-purple-300"
                      : "border-border bg-card text-muted-foreground hover:border-purple-500/30 hover:text-foreground"
                  )}
                >
                  <span className="text-sm leading-none">📚</span>
                  <span className="font-medium leading-tight">{p}</span>
                </button>
              ))}
            </div>
          )}

          {/* Custom platform input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customPlatform}
              onChange={e => setCustomPlatform(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustomPlatform()}
              placeholder="Add a custom platform…"
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-colors"
            />
            <button
              onClick={addCustomPlatform}
              disabled={!customPlatform.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-300 text-xs font-medium hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={12} />
              Add
            </button>
          </div>

          {/* Selected platforms as removable chips */}
          {selectedPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              <span className="text-[10px] text-muted-foreground/50 self-center">Selected:</span>
              {selectedPlatforms.map(p => (
                <span key={p} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-medium">
                  {p}
                  <button onClick={() => togglePlatform(p)} className="ml-0.5 hover:text-white transition-colors">
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Options ────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Lightbulb size={13} className="text-purple-400" /> Content Options
          </h2>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeExpertQuotes}
                onChange={e => setIncludeExpertQuotes(e.target.checked)}
                className="mt-0.5 accent-purple-500"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Include expert quotes &amp; inspiration</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Opens each chapter with a quote from a recognized industry leader (Peter Drucker, Warren Buffett, Simon Sinek, etc.) matched to your topic.
                </p>
              </div>
            </label>

            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 mb-1">
                <BookMarked size={12} className="text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-400">Verified Academic Sources</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every ebook is grounded in real research from Harvard Business Review, MIT Sloan, McKinsey, and 10+ verified academic databases. All sources are cited in the appendix.
              </p>
            </div>
          </div>
        </section>

        {/* ── Generate Button ─────────────────────────────────────────────── */}
        <div className="pb-8">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || remaining === 0}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-semibold text-sm transition-all",
              canGenerate && remaining > 0
                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-600/25 hover:scale-[1.01] active:scale-100"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Zap size={16} />
            Generate with LightSpeed AI
            <span className={cn("font-normal text-xs", canGenerate && remaining > 0 ? "text-white/60" : "")}>({remaining} remaining)</span>
          </button>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
            {[
              { icon: Users, text: "Verified expert sources" },
              { icon: Globe, text: `${LANGUAGES.length} languages` },
              { icon: ShoppingBag, text: "Amazon KDP ready" },
              { icon: Star, text: "Expert quotes included" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Icon size={10} className="text-purple-400" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
