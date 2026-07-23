import { useId } from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
  /** "dark" renders a light wordmark (for dark backgrounds); "light" renders ink text (for light backgrounds). The bolt is the same emerald→teal gradient in both. */
  variant?: "dark" | "light";
}

// Light Speed Ghost lightning bolt, filled with the brand emerald→teal
// gradient. Backgroundless — the glyph fills the given size.
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
          <linearGradient id={`lsg-${gid}`} x1="7.88" y1="3.38" x2="16.13" y2="20.63" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#0d9488" />
          </linearGradient>
        </defs>
        {/* Lightning bolt — matches the app icon / favicon */}
        <path
          d="M13.88 3.38 L7.88 13.31 L10.88 13.31 L10.13 20.63 L16.13 10.69 L13.13 10.69 Z"
          fill={`url(#lsg-${gid})`}
        />
      </svg>

      {showText && (
        <span className={`font-bold tracking-tight leading-none ${textColor} ${textSize}`}>
          Light Speed <span className={ghostAccent}>Ghost</span>
        </span>
      )}
    </div>
  );
}
