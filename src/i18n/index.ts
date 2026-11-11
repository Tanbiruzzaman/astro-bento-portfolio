import { createSignal, onCleanup, onMount } from "solid-js";
import { readable } from "svelte/store";
import { en } from "./en";
import { bn } from "./bn";

export type Lang = "en" | "bn";
const dictionaries = { en, bn } as const;
export type TranslationKey<T = typeof en> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${TranslationKey<T[K]>}`
      : never;
}[keyof T & string];
type Listener = (lang: Lang) => void;
const listeners = new Set<Listener>();

function translateValue(key: TranslationKey, element: HTMLElement, lang: Lang): string {
  let value = t(key, lang);
  element.dataset.i18nArgs?.split(",").forEach((arg) => {
    const [name, source] = arg.split(":");
    if (!name || !source) return;
    const raw = element.dataset[source] ?? "";
    const replacement = lang === "bn" && /^\d+$/.test(raw)
      ? new Intl.NumberFormat("bn-BD").format(Number(raw))
      : raw;
    value = value.replaceAll(`{${name}}`, replacement);
  });
  return value;
}

export function getLang(): Lang {
  return typeof document !== "undefined" && document.documentElement.dataset.lang === "bn" ? "bn" : "en";
}

export function t(key: TranslationKey, lang: Lang = getLang()): string {
  const value = key.split(".").reduce<unknown>((node, part) => node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined, dictionaries[lang]);
  return typeof value === "string" ? value : key;
}

export function setLang(lang: Lang): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem("lang", lang); } catch { /* Storage can be disabled. */ }
  applyTranslations();
  listeners.forEach((listener) => listener(lang));
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function createLangSignal() {
  const [lang, set] = createSignal<Lang>("en");
  let unsubscribe: (() => void) | undefined;
  onMount(() => { set(getLang()); unsubscribe = subscribe(set); });
  onCleanup(() => unsubscribe?.());
  return lang;
}

export const langStore = readable<Lang>("en", (set) => {
  if (typeof document !== "undefined") set(getLang());
  return subscribe(set);
});

export function applyTranslations(root: ParentNode = document): void {
  const lang = getLang();
  const html = document.documentElement;
  if (html.dataset.titleEn) document.title = lang === "bn" ? (html.dataset.titleBn || html.dataset.titleEn) : html.dataset.titleEn;
  const description = lang === "bn" ? (html.dataset.descriptionBn || html.dataset.descriptionEn) : html.dataset.descriptionEn;
  if (description) {
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:image:alt"]')?.setAttribute("content", description);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:locale"]')?.setAttribute("content", lang === "bn" ? "bn_BD" : "en_US");
  }
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = translateValue(key as TranslationKey, element, lang);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((element) => {
    element.dataset.i18nAttr?.split(",").forEach((entry) => {
      const [attribute, key] = entry.split(":");
      if (attribute && key) element.setAttribute(attribute, translateValue(key as TranslationKey, element, lang));
    });
  });
  root.querySelectorAll<HTMLElement>("[data-set-lang]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.setLang === lang));
  });
  root.querySelectorAll<HTMLElement>("[data-date]").forEach((element) => {
    const date = new Date(element.dataset.date ?? "");
    if (!Number.isNaN(date.getTime())) element.textContent = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
  });
  root.querySelectorAll<HTMLElement>("[data-reading-time]").forEach((element) => {
    const minutes = element.dataset.readingTime?.match(/\d+/)?.[0];
    if (minutes) {
      const count = lang === "bn" ? new Intl.NumberFormat("bn-BD").format(Number(minutes)) : minutes;
      element.textContent = t("blog.minutesRead", lang).replace("{count}", count);
    }
  });
  root.querySelectorAll<HTMLElement>("[data-created-at]").forEach((element) => {
    const date = new Date(element.dataset.createdAt ?? "");
    if (Number.isNaN(date.getTime())) return;
    const elapsed = (date.getTime() - Date.now()) / 1000;
    const abs = Math.abs(elapsed);
    const [unit, seconds] = abs < 60
      ? ["second", 1]
      : abs < 3600
        ? ["minute", 60]
        : abs < 86400
          ? ["hour", 3600]
          : abs < 2_592_000
            ? ["day", 86400]
            : abs < 31_536_000
              ? ["month", 2_592_000]
              : ["year", 31_536_000];
    const formatter = new Intl.RelativeTimeFormat(lang === "bn" ? "bn-BD" : "en-US", { numeric: "auto" });
    element.textContent = formatter.format(Math.round(elapsed / seconds), unit as Intl.RelativeTimeFormatUnit);
  });
  root.querySelectorAll<HTMLElement>("[data-entry-title-en]").forEach((element) => {
    element.textContent = lang === "bn" ? (element.dataset.entryTitleBn || element.dataset.entryTitleEn || "") : (element.dataset.entryTitleEn || "");
  });
}

if (typeof document !== "undefined") {
  const start = () => { applyTranslations(); };
  document.addEventListener("astro:page-load", start);
  document.addEventListener("astro:after-swap", start);
  document.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>("[data-set-lang]");
    if (button?.dataset.setLang === "en" || button?.dataset.setLang === "bn") setLang(button.dataset.setLang);
  });
  start();
}
