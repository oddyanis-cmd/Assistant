import { en } from "./merged";

/** Supported UI languages. Arabic renders right-to-left. */
export type Locale = "en" | "fr" | "ar";

export const LOCALES: Locale[] = ["en", "fr", "ar"];

export const RTL_LOCALES: Locale[] = ["ar"];

/** Every translation key that exists in the (verbatim, EN-derived) dictionary. */
export type DictKey = keyof typeof en;
