interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
  /** "dark" renders a light wordmark + bolt (for dark backgrounds); "light" renders ink text + purple bolt (for light backgrounds). */
  variant?: "dark" | "light";
}

export function Logo({ size = 32, showText = true, className = "", textSize = "text-lg", variant = "dark" }: LogoProps) {
  // Backgroundless lightning bolt. The glyph fills the given size; the bolt path
  // occupies ~72% of the viewBox height, so a size of 30 reads ~22px tall next
  // to the wordmark — balanced without a heavy tile behind it.
  const boltFill = variant === "light" ? "#6b38d4" : "#a78bfa";
  const ghostColor = variant === "light" ? "text-[#6b38d4]" : "text-[#a78bfa]";
  const textColor = variant === "light" ? "text-[#131b2e]" : "text-white";

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
        {/* Lightning bolt — matches the app icon / favicon */}
        <path
          d="M13.88 3.38 L7.88 13.31 L10.88 13.31 L10.13 20.63 L16.13 10.69 L13.13 10.69 Z"
          fill={boltFill}
        />
      </svg>

      {showText && (
        <span className={`font-bold tracking-tight leading-none ${textColor} ${textSize}`}>
          Light Speed <span className={ghostColor}>Ghost</span>
        </span>
      )}
    </div>
  );
}
