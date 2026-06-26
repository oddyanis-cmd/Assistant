import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* Phase 1 — later phases add image domains, redirects, etc. */
};

export default withNextIntl(nextConfig);
