interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
}

export function Logo({ size = 32, showText = true, className = "", textSize = "text-lg" }: LogoProps) {
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
            <linearGradient id="fw" x1="18" y1="4" x2="7" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#93c5fd" />
              <stop offset="1" stopColor="#2563eb" />
            </linearGradient>
          </defs>
          <path
            d="M18.5 4C18.5 4 13 4.8 10 8.5C7.5 11.5 7.5 15 7.5 15L10 13C11.2 11.5 13.5 10 15.5 8.2C17.5 6.4 18.8 4.8 18.5 4Z"
            fill="url(#fw)"
          />
          <path
            d="M18.5 4C16.5 3.4 14 4 11.5 5.5C13.5 5.8 16 7.2 16 9.5Z"
            fill="#bfdbfe"
            opacity="0.8"
          />
          <line
            x1="15.5" y1="6.5" x2="5.5" y2="21"
            stroke="#dbeafe" strokeWidth="1" strokeLinecap="round" opacity="0.4"
          />
          <path d="M5.5 21 L3 23 L6 22 Z" fill="#60a5fa" />
        </svg>
      </div>

      {showText && (
        <span className={`font-bold text-white tracking-tight leading-none ${textSize}`}>
          Light Speed <span className="text-blue-400">Ghost</span>
        </span>
      )}
    </div>
  );
}
