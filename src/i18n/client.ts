import { getTranslations, LANGUAGE_STORAGE_KEY, type Locale } from "./index";

const validLocale = (value: string | null): Locale => value === "bn" ? "bn" : "en";
let activeLocale: Locale = "en";
let translating = false;

function translateDynamic(text: string, locale: Locale): string {
  if (locale === "en") return text;
  const translations = getTranslations("bn");
  const direct = translations.get(text);
  if (direct) return direct;

  const messages = text.match(/^(\d+) messages?$/);
  if (messages) return `${new Intl.NumberFormat("bn").format(Number(messages[1]))}টি বার্তা`;
  const replies = text.match(/^(\d+) replies?$/);
  if (replies) return `${new Intl.NumberFormat("bn").format(Number(replies[1]))}টি উত্তর`;
  const offset = text.match(/^(?:(\d+)h(?:\s+(\d+)m)?\s+)?(ahead of you|behind you)$/);
  if (offset) {
    const amount = [offset[1] && `${offset[1]} ঘণ্টা`, offset[2] && `${offset[2]} মিনিট`].filter(Boolean).join(" ");
    const direction = offset[3] === "ahead of you" ? "আপনার চেয়ে এগিয়ে" : "আপনার চেয়ে পিছিয়ে";
    return `${amount ? `${amount} ` : ""}${direction}`;
  }
  return text;
}

function updateDocument(): void {
  if (translating) return;
  translating = true;
  activeLocale = validLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  document.documentElement.lang = activeLocale;
  const translations = getTranslations(activeLocale);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,noscript,code,pre,[translate='no'],[data-no-translate]")) continue;
    const original = node.textContent ?? "";
    const trimmed = original.trim();
    if (!trimmed) continue;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    const translated = translateDynamic(trimmed, activeLocale) || translations.get(trimmed) || trimmed;
    if (translated !== trimmed) node.textContent = `${leading}${translated}${trailing}`;
  }

  document.querySelectorAll<HTMLElement>("[title],[aria-label],[placeholder],[alt]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    for (const attribute of ["title", "aria-label", "placeholder", "alt"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateDynamic(value, activeLocale) || translations.get(value);
      if (translated && translated !== value) element.setAttribute(attribute, translated);
    }
  });

  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:title"]', 'meta[name="twitter:description"]', 'meta[name="twitter:title"]']) {
    const meta = document.querySelector<HTMLMetaElement>(selector);
    if (!meta) continue;
    const value = meta.content;
    const translated = translations.get(value);
    if (translated) meta.content = translated;
    else {
      for (const [english, bengali] of getTranslations("bn")) {
        if (!english || !value.includes(english)) continue;
        meta.content = activeLocale === "bn" ? value.replace(english, bengali) : value.replace(bengali, english);
      }
    }
  }
  translating = false;
}

document.addEventListener("languagechange", updateDocument);
document.addEventListener("astro:page-load", updateDocument);
new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === "childList" || mutation.type === "characterData")) updateDocument();
}).observe(document.body, { childList: true, characterData: true, subtree: true });
