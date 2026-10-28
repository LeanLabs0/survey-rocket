export type Question = {
  id: string;
  type: "choice" | "multi" | "number" | "text";
  q: string;
  options?: string[];
  nps?: boolean;
  min?: number;
  max?: number;
  unit?: string | null;
  optional?: boolean;
  required?: boolean;
};

export type SurveyDefinition = {
  schema_version: 1;
  id: string;
  name: string;
  cadence: string | null;
  status: "Draft" | "Active" | "Paused";
  intro: string | null;
  outro: string | null;
  settings: {
    require_contact: boolean;
    show_results: boolean;
    review_ask: boolean;
    review_links: Record<string, string>;
    chat_lede?: string;
    chat_sub?: string;
    welcome_title?: string;
    welcome_note?: string;
    hubspot_lists?: boolean;
  };
  questions: Question[];
  provenance: {
    source: "hand" | "scan" | "stat" | "template";
    drafted_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
  };
};

/**
 * HubSpot lists are made only when the client approved them for this survey.
 * Off unless `settings.hubspot_lists` is exactly true (Kevin 10/28).
 * A copied `hubspot_answer_lists` flag does not count.
 */
export function hubspotListsApproved(definition: unknown) {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return false;
  const settings = (definition as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return (settings as { hubspot_lists?: unknown }).hubspot_lists === true;
}

/**
 * Approval lives on the published survey only. A missing publication, a draft,
 * or a duplicated survey is not approval, even when its saved definition has the switch on.
 */
export function publishedHubspotListsApproved(publication: unknown) {
  if (!publication || typeof publication !== "object" || Array.isArray(publication)) return false;
  return hubspotListsApproved((publication as { definition?: unknown }).definition);
}

const HUBSPOT_LIST_SETTING_KEYS = ["hubspot_lists", "hubspot_answer_lists"] as const;

/** Drop list approval so a new survey, scan, or copy cannot inherit it. */
export function stripHubspotListSettings<T>(settings: T): T {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return settings;
  const next = { ...(settings as Record<string, unknown>) };
  let changed = false;
  for (const key of HUBSPOT_LIST_SETTING_KEYS) {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? (next as T) : settings;
}

export function stripHubspotListApproval<T>(definition: T): T {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) return definition;
  const settings = (definition as { settings?: unknown }).settings;
  if (!settings) return definition;
  return { ...(definition as object), settings: stripHubspotListSettings(settings) } as T;
}

/** Completed responses join the completed list. A sign-in retry must not. */
export function hubspotEnrollmentStage(completedAt: Date | null | undefined): "signedIn" | "completed" {
  if (completedAt instanceof Date && !Number.isNaN(completedAt.getTime())) return "completed";
  return "signedIn";
}

/** Welcome subtitle when `intro` is null or blank. Straight apostrophe, matches the live page. */
export const DEFAULT_WELCOME_INTRO =
  "We'd love to capture what actually changed, so you and future clients can get a better experience with us.";
/** Note under the welcome intro when `settings.welcome_note` is omitted or blank. */
export const DEFAULT_WELCOME_NOTE =
  "We'd love to hear your feedback so we can keep improving your experience with us.";

export const WELCOME_TITLE_MAX = 180;
export const WELCOME_NOTE_MAX = 400;
/** High enough that an existing welcome subtitle still saves. This only stops an abusive payload. */
export const WELCOME_INTRO_MAX = 4000;

const INVISIBLE = /[\u200B\u200C\u200D\uFEFF\u2060\u180E]/g;

export function cleanWelcomeLine(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

export function cleanWelcomeBlock(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim();
}

function clip(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

/** Respondent welcome copy. An empty `title` means the styled default headline. */
export function resolveWelcomeCopy(definition: unknown) {
  const record =
    definition && typeof definition === "object"
      ? (definition as { intro?: unknown; settings?: unknown })
      : {};
  const settings =
    record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
      ? (record.settings as { welcome_title?: unknown; welcome_note?: unknown })
      : {};
  const intro = clip(cleanWelcomeLine(record.intro), WELCOME_INTRO_MAX);
  const note = clip(cleanWelcomeBlock(settings.welcome_note), WELCOME_NOTE_MAX);
  return {
    title: clip(cleanWelcomeLine(settings.welcome_title), WELCOME_TITLE_MAX),
    intro: intro || DEFAULT_WELCOME_INTRO,
    note: note || DEFAULT_WELCOME_NOTE,
  };
}

function readOptionalSetting(
  settings: Record<string, unknown>,
  key: "welcome_title" | "welcome_note",
  max: number,
  label: string,
  block: boolean,
): { error: string | null; patch: Record<string, string> } {
  if (!Object.prototype.hasOwnProperty.call(settings, key)) return { error: null, patch: {} };
  const raw = settings[key];
  if (typeof raw !== "string") return { error: `${label} must be text.`, patch: {} };
  const value = block ? cleanWelcomeBlock(raw) : cleanWelcomeLine(raw);
  if (value.length > max) return { error: `${label} must be ${max} characters or fewer.`, patch: {} };
  return { error: null, patch: { [key]: value } };
}

/**
 * Trim welcome fields before they are stored.
 * Absent keys stay absent, so a survey that never set them keeps today's copy.
 * Whitespace-only values become blank, which the page renders as the default.
 */
export function applyWelcomeCopy(definition: SurveyDefinition | null | undefined): {
  definition: SurveyDefinition | null;
  error: string | null;
} {
  if (!definition || typeof definition !== "object") return { definition: null, error: null };
  let intro: string | null;
  if (definition.intro == null) intro = null;
  else if (typeof definition.intro !== "string") return { definition, error: "Intro must be text." };
  else {
    const value = cleanWelcomeLine(definition.intro);
    if (value.length > WELCOME_INTRO_MAX) {
      return { definition, error: `Intro must be ${WELCOME_INTRO_MAX} characters or fewer.` };
    }
    intro = value || null;
  }

  const settings = definition.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { definition: { ...definition, intro }, error: null };
  }
  const rawSettings = settings as SurveyDefinition["settings"] & Record<string, unknown>;
  const title = readOptionalSetting(rawSettings, "welcome_title", WELCOME_TITLE_MAX, "Headline", false);
  if (title.error) return { definition, error: title.error };
  const note = readOptionalSetting(rawSettings, "welcome_note", WELCOME_NOTE_MAX, "Note", true);
  if (note.error) return { definition, error: note.error };
  return {
    error: null,
    definition: {
      ...definition,
      intro,
      settings: { ...settings, ...title.patch, ...note.patch },
    },
  };
}

export function defaultSettings() {
  return {
    require_contact: false,
    show_results: false,
    review_ask: false,
    review_links: {} as Record<string, string>,
  };
}

export function defaultProvenance(source: SurveyDefinition["provenance"]["source"] = "hand") {
  return { source, drafted_by: null as string | null, approved_by: null as string | null, approved_at: null as string | null };
}

export function blankDefinition(partial: Partial<SurveyDefinition> & { id: string; name: string }): SurveyDefinition {
  return {
    schema_version: 1,
    id: partial.id,
    name: partial.name,
    cadence: partial.cadence ?? null,
    status: partial.status ?? "Draft",
    intro: partial.intro ?? null,
    outro: partial.outro ?? null,
    settings: stripHubspotListSettings({ ...defaultSettings(), ...(partial.settings || {}) }),
    questions: partial.questions ?? [],
    provenance: { ...defaultProvenance(), ...(partial.provenance || {}) },
  };
}

export function isQuestionRequired(q: { type?: string; optional?: boolean; required?: boolean }) {
  if (q.required === true) return true;
  if (q.required === false) return false;
  if (q.optional === true) return false;
  if (q.optional === false) return true;
  return q.type !== "text";
}

export function validateDefinition(s: SurveyDefinition) {
  if (!s.questions.length) return "Add at least one question first.";
  for (let i = 0; i < s.questions.length; i++) {
    const q = s.questions[i];
    if (!q.q?.trim()) return `Q${i + 1} has no question text.`;
    if ((q.type === "choice" || q.type === "multi") && !(q.options && q.options.length)) {
      return `Q${i + 1} needs at least one option.`;
    }
  }
  if (s.status === "Active" && !s.provenance?.approved_by) {
    return "An Active survey needs an approver.";
  }
  return null;
}

export function respondentDefinition(def: Record<string, unknown>, extras: { publicId: string; clientName: string; logoUrl: string | null; brand?: Record<string, unknown> }) {
  return {
    ...def,
    public_id: extras.publicId,
    client_name: extras.clientName,
    logo_url: extras.logoUrl,
    brand: extras.brand || {},
  };
}
