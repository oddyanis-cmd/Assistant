"use client";

/**
 * Interactive 1–5 star picker.
 * Controlled: value + onChange passed in. Keyboard accessible.
 */
interface StarPickerProps {
  value: number;
  onChange: (rating: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const SIZE_MAP = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

export function StarPicker({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarPickerProps) {
  const cls = SIZE_MAP[size];

  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && onChange(star)}
            onKeyDown={(e) => {
              if (readonly) return;
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                onChange(Math.min(5, value + 1));
                e.preventDefault();
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                onChange(Math.max(1, value - 1));
                e.preventDefault();
              }
            }}
            className={`${cls} transition-transform ${
              readonly
                ? "cursor-default"
                : "cursor-pointer hover:scale-110 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1 rounded"
            }`}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            aria-pressed={filled}
            disabled={readonly}
          >
            <span
              className={filled ? "text-rose-400" : "text-nude-200"}
              aria-hidden="true"
            >
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Display-only star row with numeric average.
 */
export function StarDisplay({
  rating,
  count,
  size = "sm",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const cls = size === "sm" ? "text-sm" : "text-xl";
  const fullStars = Math.floor(rating);

  return (
    <span className={`inline-flex items-center gap-0.5 ${cls}`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= fullStars ? "text-rose-400" : "text-nude-200"}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
      <span className="ms-1 text-charcoal-600 font-medium">
        {rating.toFixed(1)}
      </span>
      {count !== undefined && (
        <span className="text-charcoal-400 ms-0.5">({count})</span>
      )}
    </span>
  );
}
