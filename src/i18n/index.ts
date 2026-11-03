import { en } from "./en";
import { bn } from "./bn";

export type Locale = "en" | "bn";
export const LANGUAGE_STORAGE_KEY = "portfolioLanguage";
export const catalogs = { en, bn } as const;

function flatten(value: unknown, result: Map<string, string>, translated: unknown): void {
  if (!value || typeof value !== "object" || !translated || typeof translated !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const translatedEntry = (translated as Record<string, unknown>)[key];
    if (typeof entry === "string" && typeof translatedEntry === "string") result.set(entry, translatedEntry);
    else flatten(entry, result, translatedEntry);
  }
}

export function getTranslations(locale: Locale): Map<string, string> {
  const result = new Map<string, string>();
  flatten(en, result, bn);
  return locale === "bn" ? result : new Map([...result].map(([english, bengali]) => [bengali, english]));
}

export function translateText(value: string, locale: Locale): string {
  return getTranslations(locale).get(value) ?? value;
}

export { en, bn };
