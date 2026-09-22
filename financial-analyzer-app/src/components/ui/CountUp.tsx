"use client";

/** Animated number — ports keel-landing's `.cu` / `runCount()` counter. */
import { useEffect, useRef, useState } from "react";

export function CountUp({
  target,
  decimals = 0,
  className,
}: {
  target: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // Start at the resting (target) value, exactly like the static markup in
  // keel-landing — the count-from-zero animation only kicks in once the
  // element scrolls into view (see `run()` below), so anyone who never
  // scrolls to it (or has JS disabled) still sees the real number.
  const [value, setValue] = useState<number>(target);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    function run() {
      if (reduce) {
        setValue(target);
        return;
      }
      const start = performance.now();
      const duration = 1300;
      function step(now: number) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(target * eased);
        if (progress < 1) requestAnimationFrame(step);
        else setValue(target);
      }
      requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      run();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            run();
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, decimals]);

  return (
    <span ref={ref} className={`num${className ? ` ${className}` : ""}`}>
      {value.toFixed(decimals)}
    </span>
  );
}
