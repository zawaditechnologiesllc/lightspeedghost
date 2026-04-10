import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Link } from "wouter";
import { GraduationCap, Zap, ShieldCheck, BookOpen, ArrowRight, CheckCircle } from "lucide-react";

const PERKS = [
  { icon: Zap,           label: "AI-written papers",       sub: "Real citations, every time" },
  { icon: GraduationCap, label: "Step-by-step STEM",       sub: "LaTeX + graphs included" },
  { icon: ShieldCheck,   label: "Plagiarism & AI checker", sub: "Beat Turnitin & GPTZero" },
  { icon: BookOpen,      label: "Study Assistant",         sub: "Tutor that remembers you" },
];

export default function Invite() {
  const params = useParams<{ code?: string }>();
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(false);

  const code = params.code?.toUpperCase().trim() ?? null;

  useEffect(() => {
    if (code) {
      localStorage.setItem("lsg_ref", code);
      setSaved(true);
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <Link href="/">
          <Logo size={32} className="mb-2 w-fit cursor-pointer" />
        </Link>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
          {code ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Friend's referral</span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-1 mb-2">You've been invited</h2>
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                Your friend shared their referral link. Sign up — your referral code is automatically applied.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">Create your account</h2>
              <p className="text-white/50 text-sm mb-6">Sign up to get started with Light Speed Ghost.</p>
            </>
          )}

          <div className="space-y-3 mb-7">
            {PERKS.map((p) => (
              <div key={p.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                  <p.icon size={14} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{p.label}</div>
                  <div className="text-xs text-white/40">{p.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {saved && code && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-4">
              <CheckCircle size={13} />
              Code <span className="font-mono font-bold mx-1">{code}</span> saved — applied at sign-up automatically.
            </div>
          )}

          <button
            onClick={() => setLocation("/auth")}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Get started free
            <ArrowRight size={14} />
          </button>

          <p className="text-center text-xs text-white/30 mt-4">
            By signing up you agree to our{" "}
            <Link href="/terms"><span className="text-white/50 hover:text-white/70 cursor-pointer underline">Terms</span></Link>
            {" "}and{" "}
            <Link href="/privacy"><span className="text-white/50 hover:text-white/70 cursor-pointer underline">Privacy Policy</span></Link>.
          </p>
        </div>

        <div className="text-center text-xs text-white/25">
          Trusted by students at 200+ universities worldwide
        </div>
      </div>
    </div>
  );
}
