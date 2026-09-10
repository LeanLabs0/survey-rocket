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
 *    chatTitle, poweredBy, chatLede, chatSub
 *    markUrl    product mark in the header (defaults to Survey Rocket)
 *    botIcon    chat avatar when the client has no logo
 */
export type ClientBrand = {
  color?: string;
  page?: string;
  surface?: string;
  card?: string;
  border?: string;
  text?: string;
  muted?: string;
  gray?: string;
  glow?: string;
  chip?: string;
  chipHover?: string;
  chatTitle?: string;
  poweredBy?: string;
  chatLede?: string;
  chatSub?: string;
  markUrl?: string;
  botIcon?: string;
};

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
  poweredBy: "Powered by Survey Rocket",
  chatLede: "Tell us how it’s going",
  chatSub: "Just a quick, friendly conversation. Be honest. We want to celebrate wins and learn where we can improve.",
  markUrl: "/assets/landing/logo-mark.svg",
  botIcon: "/assets/survey-intro/icon-bot.svg",
} as const;

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
  chatTitle: string;
  poweredBy: string;
  chatLede: string;
  chatSub: string;
  markUrl: string;
  botIcon: string;
  botAvatar: "logo" | "icon";
  cssVars: string;
};

export function resolveSurveyBrand(
  raw: Record<string, unknown> | null | undefined,
  extras: { logoUrl?: string | null; clientName: string; surveyName?: string | null },
): ResolvedSurveyBrand {
  const b = raw || {};
  const color = asColor(b.color ?? b.accent, DEFAULT_SURVEY_BRAND.color);
  const botIcon = asUrl(b.botIcon, DEFAULT_SURVEY_BRAND.botIcon);
  const surveyName = extras.surveyName?.trim() || "Survey";
  const alreadyNamed = surveyName.toLowerCase().startsWith(extras.clientName.toLowerCase());
  const resolved: Omit<ResolvedSurveyBrand, "cssVars"> = {
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
    chatTitle: asText(b.chatTitle, alreadyNamed ? surveyName : `${extras.clientName} ${surveyName}`),
    poweredBy: asText(b.poweredBy, DEFAULT_SURVEY_BRAND.poweredBy),
    chatLede: asText(b.chatLede, DEFAULT_SURVEY_BRAND.chatLede),
    chatSub: asText(b.chatSub, DEFAULT_SURVEY_BRAND.chatSub),
    markUrl: asUrl(b.markUrl, DEFAULT_SURVEY_BRAND.markUrl),
    botIcon,
    botAvatar: "icon",
  };
  const cssVars = [
    `--sr-accent:${resolved.color}`,
    `--sr-page:${resolved.page}`,
    `--sr-surface:${resolved.surface}`,
    `--sr-card:${resolved.card}`,
    `--sr-border:${resolved.border}`,
    `--sr-text:${resolved.text}`,
    `--sr-muted:${resolved.muted}`,
    `--sr-gray:${resolved.gray}`,
    `--sr-glow:${resolved.glow}`,
    `--sr-chip:${resolved.chip}`,
    `--sr-chip-hover:${resolved.chipHover}`,
    `--sr-bot-icon:url("${resolved.botIcon}")`,
  ].join(";");
  return { ...resolved, cssVars };
}
