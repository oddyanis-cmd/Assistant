import { Link } from "@/i18n/navigation";

interface LogoProps {
  size?: "sm" | "md" | "lg";
}

export function Logo({ size = "md" }: LogoProps) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <Link href="/" className="flex items-center gap-2 group">
      {/* Placeholder SVG logo mark */}
      <svg
        width={size === "sm" ? 28 : size === "lg" ? 48 : 36}
        height={size === "sm" ? 28 : size === "lg" ? 48 : 36}
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="18" cy="18" r="17" stroke="#fda4af" strokeWidth="1.5" />
        <path
          d="M18 8 C13 8, 9 12, 9 18 C9 24, 13 28, 18 28"
          stroke="#f43f5e"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M18 8 C23 8, 27 12, 27 18 C27 24, 23 28, 18 28"
          stroke="#fda4af"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="18" cy="18" r="3" fill="#f43f5e" opacity="0.7" />
      </svg>
      <span className={`font-light tracking-wide text-charcoal-900 group-hover:text-rose-600 transition-colors ${sizes[size]}`}>
        Shiny <span className="text-rose-500 italic">Beauty</span>
      </span>
    </Link>
  );
}
