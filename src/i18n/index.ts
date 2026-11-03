import { en } from "./en";
import { bn } from "./bn";

export type Locale = "en" | "bn";
export const LANGUAGE_STORAGE_KEY = "portfolioLanguage";
export const catalogs = { en, bn } as const;

/** Resolve a translation by its English source string; unknown text is untouched. */
export function translateText(value: string, locale: Locale): string {
  if (locale === "en") return value;
  const english = Object.values(en.home).find((text) => text === value);
  if (english) {
    const key = Object.keys(en.home).find((name) => en.home[name as keyof typeof en.home] === english);
    if (key) return bn.home[key as keyof typeof bn.home] as string;
  }
  const language = Object.values(en.language).find((text) => text === value);
  if (language) {
    const key = Object.keys(en.language).find((name) => en.language[name as keyof typeof en.language] === language);
    if (key) return bn.language[key as keyof typeof bn.language];
  }
  return value;
}

export { en, bn };
