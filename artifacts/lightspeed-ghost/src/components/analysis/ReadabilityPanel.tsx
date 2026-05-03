import { useMemo } from "react";
import { analyzeReadability, type ReadabilityResult } from "@/lib/textAnalysis";
import { BookOpen, Clock, GraduationCap, BarChart3 } from "lucide-react";

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: any }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-blue-400" />
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

function easeColor(score: number): string {
  if (score >= 60) return "bg-green-500";
  if (score >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

function easeLabel(score: number): string {
  if (score >= 90) return "Very Easy";
  if (score >= 80) return "Easy";
  if (score >= 70) return "Fairly Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly Difficult";
  if (score >= 30) return "Difficult";
  return "Very Difficult";
}

export function ReadabilityPanel({ text }: { text: string }) {
  const result = useMemo(() => analyzeReadability(text), [text]);

  if (result.wordCount < 20) {
    return (
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-center text-white/40 text-sm">
        Need at least 20 words for readability analysis
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <BookOpen size={16} className="text-blue-400" />
          Readability Analysis
        </h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {result.levelLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={BarChart3}
          label="Reading Ease"
          value={String(result.fleschReadingEase)}
          sub={easeLabel(result.fleschReadingEase)}
        />
        <MetricCard
          icon={GraduationCap}
          label="Grade Level"
          value={String(result.fleschKincaidGrade)}
          sub={result.levelLabel}
        />
        <MetricCard
          icon={BookOpen}
          label="Word Count"
          value={result.wordCount.toLocaleString()}
          sub={`${result.sentenceCount} sentences`}
        />
        <MetricCard
          icon={Clock}
          label="Reading Time"
          value={`${result.readingTime} min`}
          sub={`~${result.avgSentenceLength} words/sentence`}
        />
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/50">Flesch Reading Ease</span>
            <span className="text-white/70">{result.fleschReadingEase}/100</span>
          </div>
          <ScoreBar value={result.fleschReadingEase} max={100} color={easeColor(result.fleschReadingEase)} />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/50">Coleman-Liau Index</span>
            <span className="text-white/70">Grade {result.colemanLiauIndex}</span>
          </div>
          <ScoreBar value={result.colemanLiauIndex} max={20} color="bg-blue-500" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/50">Automated Readability Index</span>
            <span className="text-white/70">Grade {result.automatedReadabilityIndex}</span>
          </div>
          <ScoreBar value={result.automatedReadabilityIndex} max={20} color="bg-purple-500" />
        </div>
      </div>

      <div className="text-xs text-white/30 border-t border-white/5 pt-3">
        Avg syllables/word: {result.avgSyllablesPerWord} · Avg sentence length: {result.avgSentenceLength} words · {result.charCount.toLocaleString()} characters
      </div>
    </div>
  );
}
