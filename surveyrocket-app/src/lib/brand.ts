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
 *    chatText   bot bubbles + chips inside the chat window
 *    bubMe / bubMeText   respondent (.bub.me) fill + type
 *    muted      subtitles
 *    gray       secondary labels
 *    glow       magenta wash behind the column
 *    chip / chipHover
 *    button / buttonText / buttonHover / buttonBorder / buttonBorderHover / buttonRadius
 *    buttonDisabled / buttonDisabledText / buttonDisabledBorder
 *    button2 / button2Text / button2Hover / button2Border / button2BorderHover  (secondary — Restart, etc.)
 *    fieldRadius
 *    pageImage   optional full-bleed background photo
 *    font / serif   body + italic heading stacks (see SURVEY_FONTS)
 *    h1–h6, textLg–textXs and matching *Weight keys (300–800)
 *    steps / stepOn / stepOnText / stepPending / stepDoneText
 *    iconWelcome, iconChat, iconReview, iconPost, iconCheck
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
  chatText?: string;
  bubMe?: string;
  bubMeText?: string;
  muted?: string;
  gray?: string;
  glow?: string;
  chip?: string;
  chipHover?: string;
  button?: string;
  buttonText?: string;
  buttonHover?: string;
  buttonBorder?: string;
  buttonBorderHover?: string;
  buttonDisabled?: string;
  buttonDisabledText?: string;
  buttonDisabledBorder?: string;
  button2?: string;
  button2Text?: string;
  button2Hover?: string;
  button2Border?: string;
  button2BorderHover?: string;
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
  h1Weight?: number;
  h2Weight?: number;
  h3Weight?: number;
  h4Weight?: number;
  h5Weight?: number;
  h6Weight?: number;
  textLgWeight?: number;
  textMdWeight?: number;
  textRgWeight?: number;
  textSmWeight?: number;
  textXsWeight?: number;
  steps?: string;
  stepOn?: string;
  stepOnText?: string;
  stepPending?: string;
  stepDoneText?: string;
  iconWelcome?: string;
  iconChat?: string;
  iconReview?: string;
  iconPost?: string;
  iconCheck?: string;
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
    google: "Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400",
  },
  {
    id: "inter",
    label: "Inter",
    stack: "Inter,system-ui,-apple-system,sans-serif",
    google: "Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400",
  },
  {
    id: "poppins",
    label: "Poppins",
    stack: "Poppins,system-ui,sans-serif",
    google: "Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400",
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    stack: "'DM Sans',system-ui,sans-serif",
    google: "DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400",
  },
  {
    id: "outfit",
    label: "Outfit",
    stack: "Outfit,system-ui,sans-serif",
    google: "Outfit:wght@300;400;500;600;700;800",
  },
  {
    id: "source-serif",
    label: "Source Serif 4",
    stack: "'Source Serif 4',Georgia,serif",
    google: "Source+Serif+4:ital,wght@0,300;0,400;0,600;0,700;1,400",
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
  chatText: "#ffffff",
  bubMe: "#121212",
  bubMeText: "#ffffff",
  muted: "rgba(255,255,255,.7)",
  gray: "#949494",
  glow: "#F00090",
  chip: "rgba(255,255,255,.1)",
  chipHover: "rgba(255,255,255,.2)",
  button: "#ffffff",
  buttonText: "#000000",
  buttonHover: "#e6e6e6",
  buttonBorder: "transparent",
  buttonBorderHover: "transparent",
  buttonDisabled: "rgba(255,255,255,.03)",
  buttonDisabledText: "#949494",
  buttonDisabledBorder: "transparent",
  button2: "#121212",
  button2Text: "#ffffff",
  button2Hover: "#1b1b1b",
  button2Border: "transparent",
  button2BorderHover: "transparent",
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
  h1Weight: 400,
  h2Weight: 400,
  h3Weight: 400,
  h4Weight: 600,
  h5Weight: 600,
  h6Weight: 600,
  textLgWeight: 400,
  textMdWeight: 400,
  textRgWeight: 400,
  textSmWeight: 500,
  textXsWeight: 500,
  steps: "#ffffff",
  stepOn: "#1b365d",
  stepOnText: "#ffffff",
  stepPending: "#1b365d",
  stepDoneText: "#1b365d",
  iconWelcome: "/assets/survey-intro/icon-hand.svg",
  iconChat: "/assets/survey-intro/icon-chat.svg",
  iconReview: "/assets/survey-intro/icon-star.svg",
  iconPost: "/assets/survey-intro/icon-send.svg",
  iconCheck: "/assets/survey-intro/icon-check-mark.svg",
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
  {
    title: "Chat",
    items: [
      { key: "chatText", label: "Chat text" },
      { key: "bubMe", label: "Your reply fill" },
      { key: "bubMeText", label: "Your reply text" },
    ],
  },
] as const;

export const THEME_PROGRESS_COLORS = [
  { key: "steps", label: "Progress card" },
  { key: "stepOn", label: "In-progress fill" },
  { key: "stepOnText", label: "In-progress icon & label" },
  { key: "stepPending", label: "Pending icon" },
  { key: "stepDoneText", label: "Completed check & label" },
  { key: "color", label: "Completed fill (accent)" },
] as const;

export const THEME_STEP_ICONS = [
  { key: "iconWelcome", label: "Welcome" },
  { key: "iconChat", label: "Quick chat" },
  { key: "iconReview", label: "Your review" },
  { key: "iconPost", label: "Post it" },
  { key: "iconCheck", label: "Completed check" },
] as const;

export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800] as const;

export const THEME_SIZE_FIELDS = [
  { key: "h1", weightKey: "h1Weight", label: "Heading 1", sample: "Heading 1" },
  { key: "h2", weightKey: "h2Weight", label: "Heading 2", sample: "Heading 2" },
  { key: "h3", weightKey: "h3Weight", label: "Heading 3", sample: "Heading 3" },
  { key: "h4", weightKey: "h4Weight", label: "Heading 4", sample: "Heading 4" },
  { key: "h5", weightKey: "h5Weight", label: "Heading 5", sample: "Heading 5" },
  { key: "h6", weightKey: "h6Weight", label: "Heading 6", sample: "Heading 6" },
  { key: "textLg", weightKey: "textLgWeight", label: "Text large", sample: "Text large" },
  { key: "textMd", weightKey: "textMdWeight", label: "Text medium", sample: "Text medium" },
  { key: "textRg", weightKey: "textRgWeight", label: "Text regular", sample: "Text regular" },
  { key: "textSm", weightKey: "textSmWeight", label: "Text small", sample: "Text small" },
  { key: "textXs", weightKey: "textXsWeight", label: "Text tiny", sample: "Text tiny" },
] as const;

export const RADIUS_PRESETS = [0, 4, 8, 16, 24] as const;

const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)|transparent)$/i;

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
  "chatText",
  "bubMe",
  "bubMeText",
  "muted",
  "gray",
  "glow",
  "chip",
  "chipHover",
  "button",
  "buttonText",
  "buttonHover",
  "buttonBorder",
  "buttonBorderHover",
  "buttonDisabled",
  "buttonDisabledText",
  "buttonDisabledBorder",
  "button2",
  "button2Text",
  "button2Hover",
  "button2Border",
  "button2BorderHover",
  "steps",
  "stepOn",
  "stepOnText",
  "stepPending",
  "stepDoneText",
] as const;

const TEXT_KEYS = ["chatTitle", "poweredBy", "chatLede", "chatSub"] as const;
const URL_KEYS = [
  "markUrl",
  "botIcon",
  "pageImage",
  "iconWelcome",
  "iconChat",
  "iconReview",
  "iconPost",
  "iconCheck",
] as const;
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
const WEIGHT_KEYS = [
  "h1Weight",
  "h2Weight",
  "h3Weight",
  "h4Weight",
  "h5Weight",
  "h6Weight",
  "textLgWeight",
  "textMdWeight",
  "textRgWeight",
  "textSmWeight",
  "textXsWeight",
] as const;

function asWeight(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return fallback;
  const snapped = Math.round(n / 100) * 100;
  return Math.min(800, Math.max(300, snapped));
}

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
  for (const key of WEIGHT_KEYS) {
    if (b[key] === undefined || b[key] === null || b[key] === "") continue;
    out[key] = asWeight(b[key], DEFAULT_SURVEY_BRAND[key]);
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
  chatText: string;
  bubMe: string;
  bubMeText: string;
  muted: string;
  gray: string;
  glow: string;
  chip: string;
  chipHover: string;
  button: string;
  buttonText: string;
  buttonHover: string;
  buttonBorder: string;
  buttonBorderHover: string;
  buttonDisabled: string;
  buttonDisabledText: string;
  buttonDisabledBorder: string;
  button2: string;
  button2Text: string;
  button2Hover: string;
  button2Border: string;
  button2BorderHover: string;
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
  h1Weight: number;
  h2Weight: number;
  h3Weight: number;
  h4Weight: number;
  h5Weight: number;
  h6Weight: number;
  textLgWeight: number;
  textMdWeight: number;
  textRgWeight: number;
  textSmWeight: number;
  textXsWeight: number;
  steps: string;
  stepOn: string;
  stepOnText: string;
  stepPending: string;
  stepDoneText: string;
  iconWelcome: string;
  iconChat: string;
  iconReview: string;
  iconPost: string;
  iconCheck: string;
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
    if (spec.google) families.add(spec.google);
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
    chatText: asColor(b.chatText, asColor(b.text, DEFAULT_SURVEY_BRAND.chatText)),
    bubMe: asColor(b.bubMe, DEFAULT_SURVEY_BRAND.bubMe),
    bubMeText: asColor(b.bubMeText, DEFAULT_SURVEY_BRAND.bubMeText),
    muted: asColor(b.muted, DEFAULT_SURVEY_BRAND.muted),
    gray: asColor(b.gray, DEFAULT_SURVEY_BRAND.gray),
    glow: asColor(b.glow, DEFAULT_SURVEY_BRAND.glow),
    chip: asColor(b.chip, DEFAULT_SURVEY_BRAND.chip),
    chipHover: asColor(b.chipHover, DEFAULT_SURVEY_BRAND.chipHover),
    button: asColor(b.button, DEFAULT_SURVEY_BRAND.button),
    buttonText: asColor(b.buttonText, DEFAULT_SURVEY_BRAND.buttonText),
    buttonHover: asColor(b.buttonHover, DEFAULT_SURVEY_BRAND.buttonHover),
    buttonBorder: asColor(b.buttonBorder, DEFAULT_SURVEY_BRAND.buttonBorder),
    buttonBorderHover: asColor(
      b.buttonBorderHover,
      asColor(b.buttonBorder, DEFAULT_SURVEY_BRAND.buttonBorderHover),
    ),
    buttonDisabled: asColor(b.buttonDisabled, DEFAULT_SURVEY_BRAND.buttonDisabled),
    buttonDisabledText: asColor(
      b.buttonDisabledText,
      asColor(b.gray, DEFAULT_SURVEY_BRAND.buttonDisabledText),
    ),
    buttonDisabledBorder: asColor(
      b.buttonDisabledBorder,
      asColor(b.buttonBorder, DEFAULT_SURVEY_BRAND.buttonDisabledBorder),
    ),
    button2: asColor(b.button2, DEFAULT_SURVEY_BRAND.button2),
    button2Text: asColor(b.button2Text, DEFAULT_SURVEY_BRAND.button2Text),
    button2Hover: asColor(b.button2Hover, DEFAULT_SURVEY_BRAND.button2Hover),
    button2Border: asColor(b.button2Border, DEFAULT_SURVEY_BRAND.button2Border),
    button2BorderHover: asColor(
      b.button2BorderHover,
      asColor(b.button2Border, DEFAULT_SURVEY_BRAND.button2BorderHover),
    ),
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
    h1Weight: asWeight(b.h1Weight, DEFAULT_SURVEY_BRAND.h1Weight),
    h2Weight: asWeight(b.h2Weight, DEFAULT_SURVEY_BRAND.h2Weight),
    h3Weight: asWeight(b.h3Weight, DEFAULT_SURVEY_BRAND.h3Weight),
    h4Weight: asWeight(b.h4Weight, DEFAULT_SURVEY_BRAND.h4Weight),
    h5Weight: asWeight(b.h5Weight, DEFAULT_SURVEY_BRAND.h5Weight),
    h6Weight: asWeight(b.h6Weight, DEFAULT_SURVEY_BRAND.h6Weight),
    textLgWeight: asWeight(b.textLgWeight, DEFAULT_SURVEY_BRAND.textLgWeight),
    textMdWeight: asWeight(b.textMdWeight, DEFAULT_SURVEY_BRAND.textMdWeight),
    textRgWeight: asWeight(b.textRgWeight, DEFAULT_SURVEY_BRAND.textRgWeight),
    textSmWeight: asWeight(b.textSmWeight, DEFAULT_SURVEY_BRAND.textSmWeight),
    textXsWeight: asWeight(b.textXsWeight, DEFAULT_SURVEY_BRAND.textXsWeight),
    steps: asColor(b.steps, DEFAULT_SURVEY_BRAND.steps),
    stepOn: asColor(b.stepOn, DEFAULT_SURVEY_BRAND.stepOn),
    stepOnText: asColor(b.stepOnText, DEFAULT_SURVEY_BRAND.stepOnText),
    stepPending: asColor(b.stepPending, DEFAULT_SURVEY_BRAND.stepPending),
    stepDoneText: asColor(b.stepDoneText, DEFAULT_SURVEY_BRAND.stepDoneText),
    iconWelcome: asUrl(b.iconWelcome, DEFAULT_SURVEY_BRAND.iconWelcome),
    iconChat: asUrl(b.iconChat, DEFAULT_SURVEY_BRAND.iconChat),
    iconReview: asUrl(b.iconReview, DEFAULT_SURVEY_BRAND.iconReview),
    iconPost: asUrl(b.iconPost, DEFAULT_SURVEY_BRAND.iconPost),
    iconCheck: asUrl(b.iconCheck, DEFAULT_SURVEY_BRAND.iconCheck),
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
    "--sr-chat-text": resolved.chatText,
    "--sr-bub-me": resolved.bubMe,
    "--sr-bub-me-text": resolved.bubMeText,
    "--sr-muted": resolved.muted,
    "--sr-gray": resolved.gray,
    "--sr-glow": resolved.glow,
    "--sr-chip": resolved.chip,
    "--sr-chip-hover": resolved.chipHover,
    "--sr-btn": resolved.button,
    "--sr-btn-text": resolved.buttonText,
    "--sr-btn-hover": resolved.buttonHover,
    "--sr-btn-border": resolved.buttonBorder,
    "--sr-btn-border-hover": resolved.buttonBorderHover,
    "--sr-btn-disabled": resolved.buttonDisabled,
    "--sr-btn-disabled-text": resolved.buttonDisabledText,
    "--sr-btn-disabled-border": resolved.buttonDisabledBorder,
    "--sr-btn-2": resolved.button2,
    "--sr-btn-2-text": resolved.button2Text,
    "--sr-btn-2-hover": resolved.button2Hover,
    "--sr-btn-2-border": resolved.button2Border,
    "--sr-btn-2-border-hover": resolved.button2BorderHover,
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
    "--sr-h1-w": String(resolved.h1Weight),
    "--sr-h2-w": String(resolved.h2Weight),
    "--sr-h3-w": String(resolved.h3Weight),
    "--sr-h4-w": String(resolved.h4Weight),
    "--sr-h5-w": String(resolved.h5Weight),
    "--sr-h6-w": String(resolved.h6Weight),
    "--sr-text-lg-w": String(resolved.textLgWeight),
    "--sr-text-md-w": String(resolved.textMdWeight),
    "--sr-text-rg-w": String(resolved.textRgWeight),
    "--sr-text-sm-w": String(resolved.textSmWeight),
    "--sr-text-xs-w": String(resolved.textXsWeight),
    "--sr-steps": resolved.steps,
    "--sr-step-on": resolved.stepOn,
    "--sr-step-on-text": resolved.stepOnText,
    "--sr-step-pending": resolved.stepPending,
    "--sr-step-done-text": resolved.stepDoneText,
    "--sr-icon-welcome": `url("${resolved.iconWelcome}")`,
    "--sr-icon-chat": `url("${resolved.iconChat}")`,
    "--sr-icon-review": `url("${resolved.iconReview}")`,
    "--sr-icon-post": `url("${resolved.iconPost}")`,
    "--sr-icon-check": `url("${resolved.iconCheck}")`,
    "--sr-font": bodyStack,
    "--sr-serif": serifStack,
    "--sr-bot-icon": `url("${resolved.botIcon}")`,
  };
  const cssVars = Object.entries(cssVarMap)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return { ...resolved, cssVarMap, cssVars, googleFontsHref: googleFontsHref(font, serif) };
}
