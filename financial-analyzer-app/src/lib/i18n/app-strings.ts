/**
 * Hand-authored supplemental UI strings.
 *
 * keel-landing/index.html is a single marketing page with no functional
 * sub-pages, so its FR/AR dictionaries don't cover a couple of extra nav
 * labels this app needs (linking to /training). Kept intentionally tiny,
 * literal and unambiguous — unlike the verbatim dictionaries.ts, these are
 * NOT copied from the design source, so scope is deliberately limited to
 * simple, low-risk words rather than specialized financial terminology.
 */
export const en = {
  nav_training: "Training",
} as const;

export const fr = {
  nav_training: "Formation",
} as const;

export const ar = {
  nav_training: "التدريب",
} as const;
