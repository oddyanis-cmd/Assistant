"use client";

/**
 * Scroll-triggered entrance animation — ports keel-landing's IntersectionObserver
 * `.reveal` / `.reveal.io` pattern. `.reveal` alone is always fully visible
 * (opacity:1), so this is a pure enhancement: if JS hasn't run yet, or
 * `prefers-reduced-motion` is set, content still renders normally.
 */
import { useEffect, useRef, useState, type ElementType, type ReactNode, type Ref } from "react";

export function Reveal({
  as: As = "div",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <As
      ref={ref as Ref<never>}
      className={`reveal${inView ? " io" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </As>
  );
}
