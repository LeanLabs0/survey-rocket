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
  };
  questions: Question[];
  provenance: {
    source: "hand" | "scan" | "stat" | "template";
    drafted_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
  };
};

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
    settings: { ...defaultSettings(), ...(partial.settings || {}) },
    questions: partial.questions ?? [],
    provenance: { ...defaultProvenance(), ...(partial.provenance || {}) },
  };
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
