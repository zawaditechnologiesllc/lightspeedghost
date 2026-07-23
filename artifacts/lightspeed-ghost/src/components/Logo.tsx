import { useId } from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
  /** "dark" renders a light wordmark (for dark backgrounds); "light" renders ink text (for light backgrounds). The mark is the same emerald→teal gradient in both. */
  variant?: "dark" | "light";
}

// Original Light Speed Ghost mark: a rounded emerald→teal tile holding a white
// ghost glyph, with two motion streaks trailing it to suggest "light speed."
// Original artwork — no third-party logo is referenced.
export function Logo({ size = 32, showText = true, className = "", textSize = "text-lg", variant = "light" }: LogoProps) {
  const gid = useId().replace(/:/g, "");
  const textColor = variant === "light" ? "text-[#131b2e]" : "text-white";
  const ghostAccent = variant === "light" ? "text-[#10b981]" : "text-[#6ee7b7]";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`lsg-${gid}`} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {/* Motion streaks */}
        <rect x="0.4" y="8.2" width="3.6" height="1.7" rx="0.85" fill={`url(#lsg-${gid})`} opacity="0.55" />
        <rect x="0.9" y="12.1" width="2.7" height="1.7" rx="0.85" fill={`url(#lsg-${gid})`} opacity="0.35" />
        {/* Gradient tile */}
        <rect x="5" y="2.5" width="17" height="19" rx="5.4" fill={`url(#lsg-${gid})`} />
        {/* White ghost glyph */}
        <path
          d="M8.4 12.1a5.1 5.1 0 0 1 10.2 0V17.6c0 .74-.86 1.12-1.36.55l-.5-.57c-.28-.32-.78-.3-1.03.05l-.43.6c-.27.38-.83.37-1.09-.02l-.38-.57c-.26-.4-.85-.4-1.11 0l-.38.57c-.26.39-.82.4-1.09.02l-.43-.6c-.25-.35-.75-.37-1.03-.05l-.5.57c-.5.57-1.36.19-1.36-.55Z"
          fill="#ffffff"
        />
        {/* Eyes */}
        <circle cx="11.7" cy="11.9" r="1.02" fill="#0d9488" />
        <circle cx="15.3" cy="11.9" r="1.02" fill="#0d9488" />
      </svg>

      {showText && (
        <span className={`font-bold tracking-tight leading-none ${textColor} ${textSize}`}>
          Light Speed <span className={ghostAccent}>Ghost</span>
        </span>
      )}
    </div>
  );
}
