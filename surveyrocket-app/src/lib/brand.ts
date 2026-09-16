/** Respondent-page brand. Stored on `clients.brand` and applied as CSS variables
 *  on the survey page so a client look is a JSON swap, not a restyle.
 *
 *  Known keys (all optional; missing keys fall back to the Figma defaults):
 *    color      accent (completed pill, picked chips) — already used in seed
 *    page       page background
 *    surface    chat card / input surface
 *    card       bubbles + avatar fill
 *    border
 *    text
 *    muted      subtitles
 *    gray       secondary labels
 *    glow       magenta wash behind the column
 *    chip / chipHover
 *    button / buttonText / buttonHover / buttonRadius
 *    fieldRadius
 *    pageImage   optional full-bleed background photo
 *    font / serif   body + italic heading stacks (see SURVEY_FONTS)
 *    h1–h6, textLg–textXs
 *    chatTitle, poweredBy, chatLede, chatSub
 *    markUrl    product mark in the header (defaults to Survey Rocket)
 *    botIcon    chat avatar when the client has no logo
 */
export type ClientBrand = {
  color?: string;
  page?: string;
  pageImage?: string;
  surface?: string;
  card?: string;
  border?: string;
  text?: string;
  muted?: string;
  gray?: string;
  glow?: string;
  chip?: string;
  chipHover?: string;
  button?: string;
  buttonText?: string;
  buttonHover?: string;
  buttonRadius?: number;
  fieldRadius?: number;
  font?: string;
  serif?: string;
  h1?: number;
  h2?: number;
  h3?: number;
  h4?: number;
  h5?: number;
  h6?: number;
  textLg?: number;
  textMd?: number;
  textRg?: number;
  textSm?: number;
  textXs?: number;
  chatTitle?: string;
  poweredBy?: string;
  chatLede?: string;
  chatSub?: string;
  markUrl?: string;
  botIcon?: string;
};

export const SURVEY_FONTS = [
  {
    id: "jakarta",
    label: "Plus Jakarta Sans",
    stack: "'Plus Jakarta Sans',-apple-system,'Segoe UI',system-ui,sans-serif",
    google: "Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400",
  },
  {
    id: "inter",
    label: "Inter",
    stack: "Inter,system-ui,-apple-system,sans-serif",
    google: "Inter:ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
  {
    id: "poppins",
    label: "Poppins",
    stack: "Poppins,system-ui,sans-serif",
    google: "Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    stack: "'DM Sans',system-ui,sans-serif",
    google: "DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400",
  },
  {
    id: "outfit",
    label: "Outfit",
    stack: "Outfit,system-ui,sans-serif",
    google: "Outfit:wght@400;500;600;700",
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    stack: "'Source Serif 4',Georgia,serif",
    google: "Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400",
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: "Georgia,'Times New Roman',Times,serif",
    google: null,
  },
  {
    id: "editors-note",
    label: "Editor's Note",
    stack: "\"Editor's Note\",Georgia,'Times New Roman',serif",
    google: null,
  },
  {
    id: "system",
    label: "System UI",
    stack: "system-ui,-apple-system,'Segoe UI',sans-serif",
    google: null,
  },
] as const;

export type SurveyFontId = (typeof SURVEY_FONTS)[number]["id"];

export const DEFAULT_SURVEY_BRAND = {
  color: "#25c196",
  page: "#000000",
  surface: "#0d0d0d",
  card: "#141414",
  border: "#2b2b2b",
  text: "#ffffff",
  muted: "rgba(255,255,255,.7)",
  gray: "#949494",
  glow: "#F00090",
  chip: "rgba(255,255,255,.1)",
  chipHover: "rgba(255,255,255,.2)",
  button: "#ffffff",
  buttonText: "#000000",
  buttonHover: "#e6e6e6",
  buttonRadius: 180,
  fieldRadius: 8,
  pageImage: "",
  font: "jakarta" as SurveyFontId,
  serif: "editors-note" as SurveyFontId,
  h1: 56,
  h2: 36,
  h3: 28,
  h4: 24,
  h5: 20,
  h6: 16,
  textLg: 20,
  textMd: 18,
  textRg: 16,
  textSm: 14,
  textXs: 12,
  poweredBy: "Powered by Survey Rocket",
  chatLede: "Tell us how it’s going",
  chatSub: "Just a quick, friendly conversation. Be honest. We want to celebrate wins and learn where we can improve.",
  markUrl: "/assets/landing/logo-mark.svg",
  botIcon: "/assets/survey-intro/icon-bot.svg",
} as const;

export const THEME_COLOR_GROUPS = [
  {
    title: "Neutrals",
    items: [
      { key: "text", label: "White / Text" },
      { key: "gray", label: "Text secondary" },
      { key: "muted", label: "Text muted" },
      { key: "border", label: "Border" },
      { key: "card", label: "Card background" },
      { key: "surface", label: "Surface" },
      { key: "page", label: "Page / background" },
    ],
  },
  {
    title: "System & UI",
    items: [
      { key: "color", label: "Accent" },
      { key: "glow", label: "Background glow" },
      { key: "chip", label: "Choice chips" },
      { key: "chipHover", label: "Chip hover" },
    ],
  },
] as const;

export const THEME_SIZE_FIELDS = [
  { key: "h1", label: "Heading 1", sample: "Heading 1" },
  { key: "h2", label: "Heading 2", sample: "Heading 2" },
  { key: "h3", label: "Heading 3", sample: "Heading 3" },
  { key: "h4", label: "Heading 4", sample: "Heading 4" },
  { key: "h5", label: "Heading 5", sample: "Heading 5" },
  { key: "h6", label: "Heading 6", sample: "Heading 6" },
  { key: "textLg", label: "Text large", sample: "Text large" },
  { key: "textMd", label: "Text medium", sample: "Text medium" },
  { key: "textRg", label: "Text regular", sample: "Text regular" },
  { key: "textSm", label: "Text small", sample: "Text small" },
  { key: "textXs", label: "Text tiny", sample: "Text tiny" },
] as const;

export const RADIUS_PRESETS = [0, 4, 8, 16, 24] as const;

const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\))$/i;

function asColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return COLOR.test(v) ? v : fallback;
}

function asUrl(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v || /[)"'\s]/.test(v)) return fallback;
  if (v.startsWith("/") || v.startsWith("https://") || v.startsWith("http://")) return v;
  return fallback;
}

function asText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return v || fallback;
}

export function surveyFont(id: string | null | undefined) {
  return SURVEY_FONTS.find((f) => f.id === id) || SURVEY_FONTS[0];
}

function asFontId(value: unknown, fallback: SurveyFontId): SurveyFontId {
  if (typeof value !== "string") return fallback;
  const id = value.trim();
  return SURVEY_FONTS.some((f) => f.id === id) ? (id as SurveyFontId) : fallback;
}

function asPx(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const COLOR_KEYS = [
  "color",
  "page",
  "surface",
  "card",
  "border",
  "text",
  "muted",
  "gray",
  "glow",
  "chip",
  "chipHover",
  "button",
  "buttonText",
  "buttonHover",
] as const;

const TEXT_KEYS = ["chatTitle", "poweredBy", "chatLede", "chatSub"] as const;
const URL_KEYS = ["markUrl", "botIcon", "pageImage"] as const;
const SIZE_KEYS = [
  ["buttonRadius", 0, 999],
  ["fieldRadius", 0, 48],
  ["h1", 16, 96],
  ["h2", 14, 80],
  ["h3", 12, 64],
  ["h4", 12, 48],
  ["h5", 10, 40],
  ["h6", 10, 32],
  ["textLg", 10, 32],
  ["textMd", 10, 28],
  ["textRg", 10, 24],
  ["textSm", 10, 20],
  ["textXs", 8, 16],
] as const;

/** Keep only valid brand keys so admin saves cannot inject CSS. */
export function sanitizeClientBrand(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const b = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of COLOR_KEYS) {
    const v = asColor(b[key], "");
    if (v) out[key] = v;
  }
  if (!out.color) {
    const accent = asColor(b.accent, "");
    if (accent) out.color = accent;
  }
  for (const key of TEXT_KEYS) {
    if (typeof b[key] !== "string") continue;
    const v = b[key].trim();
    if (v) out[key] = v;
  }
  for (const key of URL_KEYS) {
    const v = asUrl(b[key], "");
    if (v) out[key] = v;
  }
  for (const [key, min, max] of SIZE_KEYS) {
    if (b[key] === undefined || b[key] === null || b[key] === "") continue;
    out[key] = asPx(b[key], DEFAULT_SURVEY_BRAND[key], min, max);
  }
  const font = asFontId(b.font, "" as SurveyFontId);
  if (font) out.font = font;
  const serif = asFontId(b.serif, "" as SurveyFontId);
  if (serif) out.serif = serif;
  return out;
}

export type ResolvedSurveyBrand = {
  color: string;
  page: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  gray: string;
  glow: string;
  chip: string;
  chipHover: string;
  button: string;
  buttonText: string;
  buttonHover: string;
  buttonRadius: number;
  fieldRadius: number;
  pageImage: string;
  font: SurveyFontId;
  serif: SurveyFontId;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  textLg: number;
  textMd: number;
  textRg: number;
  textSm: number;
  textXs: number;
  chatTitle: string;
  poweredBy: string;
  chatLede: string;
  chatSub: string;
  markUrl: string;
  botIcon: string;
  botAvatar: "logo" | "icon";
  googleFontsHref: string | null;
  cssVarMap: Record<string, string>;
  cssVars: string;
};

function googleFontsHref(font: SurveyFontId, serif: SurveyFontId) {
  const families = new Set<string>();
  for (const id of [font, serif]) {
    const spec = surveyFont(id);
    if (spec.google && spec.id !== "jakarta") families.add(spec.google);
  }
  if (!families.size) return null;
  const q = [...families].map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

export function resolveSurveyBrand(
  raw: Record<string, unknown> | null | undefined,
  extras: { logoUrl?: string | null; clientName: string; surveyName?: string | null },
): ResolvedSurveyBrand {
  const b = raw || {};
  const color = asColor(b.color ?? b.accent, DEFAULT_SURVEY_BRAND.color);
  const botIcon = asUrl(b.botIcon, DEFAULT_SURVEY_BRAND.botIcon);
  const surveyName = extras.surveyName?.trim() || "Survey";
  const alreadyNamed = surveyName.toLowerCase().startsWith(extras.clientName.toLowerCase());
  const font = asFontId(b.font, DEFAULT_SURVEY_BRAND.font);
  const serif = asFontId(b.serif, DEFAULT_SURVEY_BRAND.serif);
  const bodyStack = surveyFont(font).stack;
  const serifStack = surveyFont(serif).stack;
  const resolved: Omit<ResolvedSurveyBrand, "cssVars" | "cssVarMap" | "googleFontsHref"> = {
    color,
    page: asColor(b.page, DEFAULT_SURVEY_BRAND.page),
    surface: asColor(b.surface, DEFAULT_SURVEY_BRAND.surface),
    card: asColor(b.card, DEFAULT_SURVEY_BRAND.card),
    border: asColor(b.border, DEFAULT_SURVEY_BRAND.border),
    text: asColor(b.text, DEFAULT_SURVEY_BRAND.text),
    muted: asColor(b.muted, DEFAULT_SURVEY_BRAND.muted),
    gray: asColor(b.gray, DEFAULT_SURVEY_BRAND.gray),
    glow: asColor(b.glow, DEFAULT_SURVEY_BRAND.glow),
    chip: asColor(b.chip, DEFAULT_SURVEY_BRAND.chip),
    chipHover: asColor(b.chipHover, DEFAULT_SURVEY_BRAND.chipHover),
    button: asColor(b.button, DEFAULT_SURVEY_BRAND.button),
    buttonText: asColor(b.buttonText, DEFAULT_SURVEY_BRAND.buttonText),
    buttonHover: asColor(b.buttonHover, DEFAULT_SURVEY_BRAND.buttonHover),
    buttonRadius: asPx(b.buttonRadius, DEFAULT_SURVEY_BRAND.buttonRadius, 0, 999),
    fieldRadius: asPx(b.fieldRadius, DEFAULT_SURVEY_BRAND.fieldRadius, 0, 48),
    pageImage: asUrl(b.pageImage, ""),
    font,
    serif,
    h1: asPx(b.h1, DEFAULT_SURVEY_BRAND.h1, 16, 96),
    h2: asPx(b.h2, DEFAULT_SURVEY_BRAND.h2, 14, 80),
    h3: asPx(b.h3, DEFAULT_SURVEY_BRAND.h3, 12, 64),
    h4: asPx(b.h4, DEFAULT_SURVEY_BRAND.h4, 12, 48),
    h5: asPx(b.h5, DEFAULT_SURVEY_BRAND.h5, 10, 40),
    h6: asPx(b.h6, DEFAULT_SURVEY_BRAND.h6, 10, 32),
    textLg: asPx(b.textLg, DEFAULT_SURVEY_BRAND.textLg, 10, 32),
    textMd: asPx(b.textMd, DEFAULT_SURVEY_BRAND.textMd, 10, 28),
    textRg: asPx(b.textRg, DEFAULT_SURVEY_BRAND.textRg, 10, 24),
    textSm: asPx(b.textSm, DEFAULT_SURVEY_BRAND.textSm, 10, 20),
    textXs: asPx(b.textXs, DEFAULT_SURVEY_BRAND.textXs, 8, 16),
    chatTitle: asText(b.chatTitle, alreadyNamed ? surveyName : `${extras.clientName} ${surveyName}`),
    poweredBy: asText(b.poweredBy, DEFAULT_SURVEY_BRAND.poweredBy),
    chatLede: asText(b.chatLede, DEFAULT_SURVEY_BRAND.chatLede),
    chatSub: asText(b.chatSub, DEFAULT_SURVEY_BRAND.chatSub),
    markUrl: asUrl(b.markUrl, DEFAULT_SURVEY_BRAND.markUrl),
    botIcon,
    botAvatar: "icon",
  };
  const cssVarMap: Record<string, string> = {
    "--sr-accent": resolved.color,
    "--sr-page": resolved.page,
    "--sr-surface": resolved.surface,
    "--sr-card": resolved.card,
    "--sr-border": resolved.border,
    "--sr-text": resolved.text,
    "--sr-muted": resolved.muted,
    "--sr-gray": resolved.gray,
    "--sr-glow": resolved.glow,
    "--sr-chip": resolved.chip,
    "--sr-chip-hover": resolved.chipHover,
    "--sr-btn": resolved.button,
    "--sr-btn-text": resolved.buttonText,
    "--sr-btn-hover": resolved.buttonHover,
    "--sr-btn-radius": `${resolved.buttonRadius}px`,
    "--sr-field-radius": `${resolved.fieldRadius}px`,
    "--sr-page-image": resolved.pageImage ? `url("${resolved.pageImage}")` : "none",
    "--sr-h1": `${resolved.h1}px`,
    "--sr-h2": `${resolved.h2}px`,
    "--sr-h3": `${resolved.h3}px`,
    "--sr-h4": `${resolved.h4}px`,
    "--sr-h5": `${resolved.h5}px`,
    "--sr-h6": `${resolved.h6}px`,
    "--sr-text-lg": `${resolved.textLg}px`,
    "--sr-text-md": `${resolved.textMd}px`,
    "--sr-text-rg": `${resolved.textRg}px`,
    "--sr-text-sm": `${resolved.textSm}px`,
    "--sr-text-xs": `${resolved.textXs}px`,
    "--sr-font": bodyStack,
    "--sr-serif": serifStack,
    "--sr-bot-icon": `url("${resolved.botIcon}")`,
  };
  const cssVars = Object.entries(cssVarMap)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return { ...resolved, cssVarMap, cssVars, googleFontsHref: googleFontsHref(font, serif) };
}
