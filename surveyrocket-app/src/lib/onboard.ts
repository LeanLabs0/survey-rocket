const KEY = "sr:onboard:v1";

export type OnboardState = {
  v: 1;
  tourDone: boolean;
  dismissedAt: string | null;
  views: Record<string, { tipDismissed?: boolean }>;
};

export function loadOnboard(): OnboardState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, tourDone: false, dismissedAt: null, views: {} };
    const o = JSON.parse(raw) as OnboardState;
    if (o && o.v === 1) return o;
  } catch {
    /* ignore */
  }
  return { v: 1, tourDone: false, dismissedAt: null, views: {} };
}

export function saveOnboard(state: OnboardState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const TOUR_KEY = "sr:tour:v1";

export type TourState = {
  clientSlug: string;
  surveyId: string;
  step: number;
};

export function loadTour(): TourState | null {
  try {
    const raw = sessionStorage.getItem(TOUR_KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

export function saveTour(state: TourState | null) {
  try {
    if (!state) sessionStorage.removeItem(TOUR_KEY);
    else sessionStorage.setItem(TOUR_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const TOUR_STEPS = [
  {
    view: "surveys" as const,
    sel: "#newSurveyBtn",
    title: "Start a survey",
    body: "Write your own from scratch, or let a site scan draft one for you.",
    side: "bottom" as const,
  },
  {
    view: "editor" as const,
    sel: "#qwrap",
    title: "Write the questions",
    body: "The chat asks exactly what you type here. The preview updates as you type.",
    side: "right" as const,
  },
  {
    view: "editor" as const,
    sel: "#ed-foot",
    title: "Share it",
    body: "Publish puts the newest version on your link. Save draft keeps edits without changing what respondents see.",
    side: "top" as const,
  },
  {
    view: "results" as const,
    sel: "#resultsHead",
    title: "Watch the results",
    body: "Every answer lands here as it arrives, from any device.",
    side: "bottom" as const,
  },
];

export function tourUrl(clientSlug: string, surveyId: string, view: "surveys" | "editor" | "results") {
  if (view === "surveys") return `/app/${clientSlug}/surveys`;
  if (view === "editor") return `/app/${clientSlug}/surveys/${surveyId}/edit`;
  return `/app/${clientSlug}/results/${surveyId}`;
}
