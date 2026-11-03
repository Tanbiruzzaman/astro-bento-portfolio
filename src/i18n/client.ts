import { getTranslations, LANGUAGE_STORAGE_KEY, type Locale } from "./index";

const readLocale = (): Locale => {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) === "bn" ? "bn" : "en";
  } catch {
    return "en";
  }
};

let activeLocale: Locale = "en";
let translating = false;

function translateDynamic(text: string, locale: Locale): string | undefined {
  const translations = getTranslations(locale);
  const direct = translations.get(text);
  if (direct) return direct;

  if (locale === "bn") {
    const messages = text.match(/^(\d+) messages?$/);
    if (messages) return `${messages[1]}টি বার্তা`;
    const replies = text.match(/^(\d+) replies?$/);
    if (replies) return `${replies[1]}টি উত্তর`;
    const offset = text.match(/^(?:(\d+)h(?:\s+(\d+)m)?\s+)?(ahead of you|behind you)$/);
    if (offset) {
      const amount = [offset[1] && `${offset[1]} ঘণ্টা`, offset[2] && `${offset[2]} মিনিট`].filter(Boolean).join(" ");
      const direction = offset[3] === "ahead of you" ? "এগিয়ে" : "পিছিয়ে";
      return `${amount ? `${amount} ` : ""}আপনার চেয়ে ${direction}`;
    }
    const ago = text.match(/^(today|yesterday|(\d+)(d|mo|y) ago)$/);
    if (ago) {
      if (ago[1] === "today") return "আজ";
      if (ago[1] === "yesterday") return "গতকাল";
      const unit = ago[3] === "d" ? "দিন আগে" : ago[3] === "mo" ? "মাস আগে" : "বছর আগে";
      return `${ago[2]} ${unit}`;
    }
  } else {
    const messages = text.match(/^(\d+)টি বার্তা$/);
    if (messages) return `${messages[1]} messages`;
    const replies = text.match(/^(\d+)টি উত্তর$/);
    if (replies) return `${replies[1]} replies`;
    const offset = text.match(/^(?:(\d+) ঘণ্টা(?:\s+(\d+) মিনিট)?\s+)?আপনার চেয়ে (এগিয়ে|পিছিয়ে)$/);
    if (offset) {
      const amount = [offset[1] && `${offset[1]}h`, offset[2] && `${offset[2]}m`].filter(Boolean).join(" ");
      const direction = offset[3] === "এগিয়ে" ? "ahead of you" : "behind you";
      return `${amount ? `${amount} ` : ""}${direction}`;
    }
    const ago = text.match(/^(আজ|গতকাল|(\d+) (দিন|মাস|বছর) আগে)$/);
    if (ago) {
      if (ago[1] === "আজ") return "today";
      if (ago[1] === "গতকাল") return "yesterday";
      const unit = ago[3] === "দিন" ? "d" : ago[3] === "মাস" ? "mo" : "y";
      return `${ago[2]}${unit} ago`;
    }
  }
  return undefined;
}

function translateComposite(value: string, locale: Locale): string {
  const direct = translateDynamic(value, locale);
  if (direct) return direct;

  // Titles and descriptions often contain a name or date alongside a translatable
  // phrase. Replace known phrases without disturbing the surrounding metadata.
  let result = value;
  const pairs = [...getTranslations(locale)].sort(([left], [right]) => right.length - left.length);
  for (const [source, translated] of pairs) {
    if (source.length < 4 || !result.includes(source)) continue;
    result = result.split(source).join(translated);
  }
  return result;
}

function updateDocument(): void {
  if (translating || !document.body) return;
  translating = true;
  activeLocale = readLocale();
  document.documentElement.lang = activeLocale;
  const translations = getTranslations(activeLocale);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,noscript,code,pre,[translate='no'],[data-no-translate]")) continue;
    const original = node.textContent ?? "";
    const value = original.trim();
    if (!value) continue;
    const leading = original.match(/^\s*/)?.[0] ?? "";
    const trailing = original.match(/\s*$/)?.[0] ?? "";
    const translated = translateDynamic(value, activeLocale) ?? translations.get(value) ?? value;
    if (translated !== value) node.textContent = `${leading}${translated}${trailing}`;
  }

  document.querySelectorAll<HTMLElement>("[title],[aria-label],[placeholder],[alt]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    for (const attribute of ["title", "aria-label", "placeholder", "alt"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateDynamic(value, activeLocale) ?? translations.get(value);
      if (translated && translated !== value) element.setAttribute(attribute, translated);
    }
  });

  for (const selector of ['title', 'meta[name="description"]', 'meta[property="og:description"]', 'meta[property="og:title"]', 'meta[name="twitter:description"]', 'meta[name="twitter:title"]']) {
    const element = document.querySelector<HTMLElement | HTMLMetaElement>(selector);
    if (!element) continue;
    const isMeta = element instanceof HTMLMetaElement;
    const value = isMeta ? element.content : element.textContent ?? "";
    const translated = translateComposite(value, activeLocale);
    if (translated !== value) {
      if (isMeta) element.content = translated;
      else element.textContent = translated;
    }
  }
  translating = false;
}

document.addEventListener("languagechange", updateDocument);
document.addEventListener("astro:page-load", updateDocument);
new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.type === "childList" || mutation.type === "characterData")) updateDocument();
}).observe(document.body, { childList: true, characterData: true, subtree: true });
