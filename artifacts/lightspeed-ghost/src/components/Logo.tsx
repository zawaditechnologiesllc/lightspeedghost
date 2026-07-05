interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
  /** "dark" renders white wordmark text (for dark backgrounds); "light" renders ink text (for light backgrounds). */
  variant?: "dark" | "light";
}

export function Logo({ size = 32, showText = true, className = "", textSize = "text-lg", variant = "dark" }: LogoProps) {
  const iconSize = Math.round(size * 0.56);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          background: "linear-gradient(135deg, #0d1f5c 0%, #1a3a9f 100%)",
          boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lsg-bolt" x1="12" y1="3.4" x2="12" y2="20.6" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          {/* Lightning bolt — matches the app icon / favicon */}
          <path
            d="M13.88 3.38 L7.88 13.31 L10.88 13.31 L10.13 20.63 L16.13 10.69 L13.13 10.69 Z"
            fill="url(#lsg-bolt)"
          />
        </svg>
      </div>

      {showText && (
        <span className={`font-bold tracking-tight leading-none ${variant === "light" ? "text-[#131b2e]" : "text-white"} ${textSize}`}>
          Light Speed <span className={variant === "light" ? "text-[#2563eb]" : "text-blue-400"}>Ghost</span>
        </span>
      )}
    </div>
  );
}
