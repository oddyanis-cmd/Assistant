/** The Keel "sail" mark — verbatim from keel-landing/index.html. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="mark"
      style={{ width: size, height: size }}
      viewBox="0 0 44 44"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="41" height="41" rx="12" fill="var(--panel)" stroke="var(--line)" />
      <path d="M13 31 C14 21 19 14 30 11 C27.5 18 24.5 25 22 31 Z" fill="var(--accent)" />
      <path
        d="M11 31.5 q11 3 22 0"
        stroke="var(--line)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="30" cy="11" r="1.9" fill="var(--accent-hi)" />
    </svg>
  );
}
