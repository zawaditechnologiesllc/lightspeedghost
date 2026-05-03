import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLogoVisible(true), 150);
    const t2 = setTimeout(() => setTaglineVisible(true), 800);
    const t3 = setTimeout(() => setSubtitleVisible(true), 1400);
    const t4 = setTimeout(() => setFadingOut(true), 2200);
    const t5 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#04080f] select-none transition-opacity duration-500 ease-in-out ${fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[600px] h-[600px] rounded-full bg-blue-700/8 blur-3xl" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-2xl" />
      </div>

      <div className="relative flex flex-col items-center gap-7">
        <div
          className="transition-all duration-700 ease-out"
          style={{
            opacity: logoVisible ? 1 : 0,
            transform: logoVisible ? "scale(1) translateY(0)" : "scale(0.8) translateY(12px)",
          }}
        >
          <Logo size={64} textSize="text-2xl" />
        </div>

        <div
          className="flex items-center gap-3 transition-all duration-600 ease-out"
          style={{
            opacity: taglineVisible ? 1 : 0,
            transform: taglineVisible ? "translateY(0)" : "translateY(14px)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-violet-400 shrink-0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
          </svg>
          <p className="text-white font-semibold text-base tracking-wide">
            We are not fast,&nbsp;
            <span className="text-blue-400">We are Instant</span>
          </p>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-violet-400 shrink-0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor" />
          </svg>
        </div>

        <p
          className="text-white/40 text-xs tracking-[0.25em] uppercase transition-all duration-500 ease-out"
          style={{
            opacity: subtitleVisible ? 1 : 0,
            transform: subtitleVisible ? "translateY(0)" : "translateY(8px)",
          }}
        >
          Welcome to Light Speed AI
        </p>
      </div>
    </div>
  );
}
