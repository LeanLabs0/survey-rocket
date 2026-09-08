import { useEffect } from "react";
import { loadOnboard, loadTour, saveOnboard, saveTour, TOUR_STEPS, tourUrl, type TourState } from "../lib/onboard";

declare global {
  interface Window {
    driver?: { js: { driver: (opts: Record<string, unknown>) => DriverHandle } };
  }
}

type DriverHandle = {
  drive: (i?: number) => void;
  destroy: () => void;
};

function viewFromPath(): "surveys" | "editor" | "results" | "other" {
  const p = window.location.pathname;
  if (/\/surveys\/[^/]+\/edit\/?$/.test(p)) return "editor";
  if (/\/surveys\/?$/.test(p)) return "surveys";
  if (/\/results(\/|$)/.test(p)) return "results";
  return "other";
}

function loadDriver(): Promise<NonNullable<Window["driver"]>> {
  return new Promise((resolve, reject) => {
    if (window.driver?.js) {
      resolve(window.driver);
      return;
    }
    if (!document.querySelector("link[data-sr-driver]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.setAttribute("data-sr-driver", "1");
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/driver.js/1.8.0/driver.min.css";
      document.head.appendChild(css);
    }
    const existing = document.querySelector("script[data-sr-driver]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (window.driver ? resolve(window.driver) : reject(new Error("driver missing"))));
      existing.addEventListener("error", () => reject(new Error("Could not load tour")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/driver.js/1.8.0/driver.js.iife.min.js";
    s.setAttribute("data-sr-driver", "1");
    s.onload = () => (window.driver ? resolve(window.driver) : reject(new Error("driver missing")));
    s.onerror = () => reject(new Error("Could not load tour"));
    document.body.appendChild(s);
  });
}

function waitFor(sel: string, tries = 40): Promise<boolean> {
  return new Promise((resolve) => {
    const tick = (left: number) => {
      if (document.querySelector(sel)) return resolve(true);
      if (left <= 0) return resolve(false);
      requestAnimationFrame(() => tick(left - 1));
    };
    tick(tries);
  });
}

async function firstSurveyId(clientSlug: string, preferred?: string | null) {
  if (preferred) return preferred;
  const res = await fetch(`/api/app/surveys?client=${encodeURIComponent(clientSlug)}`);
  const data = await res.json().catch(() => null);
  const list = (data?.surveys || []) as { id: string; slug?: string }[];
  return list.find((s) => s.slug === "client-outcomes")?.id || list[0]?.id || "";
}

export default function Tour({ clientSlug }: { clientSlug: string }) {
  useEffect(() => {
    let drv: DriverHandle | null = null;
    let navigating = false;
    let finishing = false;
    let alive = true;

    function finish() {
      if (finishing) return;
      finishing = true;
      const onb = loadOnboard();
      onb.tourDone = true;
      saveOnboard(onb);
      saveTour(null);
      window.dispatchEvent(new CustomEvent("sr-onboard-changed"));
      drv?.destroy();
      drv = null;
    }

    async function goTo(i: number, survey: string) {
      const next = TOUR_STEPS[i];
      if (!next) {
        finish();
        return;
      }
      saveTour({ clientSlug, surveyId: survey, step: i });
      if (next.view === viewFromPath()) {
        navigating = true;
        drv?.destroy();
        drv = null;
        navigating = false;
        await run(i, survey);
        return;
      }
      navigating = true;
      drv?.destroy();
      drv = null;
      window.location.href = tourUrl(clientSlug, survey, next.view);
    }

    async function run(startAt: number, survey: string) {
      if (!alive) return;
      const view = viewFromPath();
      const step = TOUR_STEPS[startAt];
      if (!step) {
        finish();
        return;
      }
      const state: TourState = { clientSlug, surveyId: survey, step: startAt };
      if (step.view !== view) {
        navigating = true;
        saveTour(state);
        window.location.href = tourUrl(clientSlug, survey, step.view);
        return;
      }
      saveTour(state);
      await loadDriver();
      const present = await waitFor(step.sel);
      if (!alive || !present || !window.driver?.js) return;
      drv?.destroy();
      drv = window.driver.js.driver({
        popoverClass: "sr-tour",
        showProgress: true,
        progressText: `${startAt + 1} of ${TOUR_STEPS.length}`,
        overlayColor: "#0D0D0D",
        overlayOpacity: 0.6,
        stageRadius: 8,
        stagePadding: 6,
        allowClose: true,
        showButtons: startAt === 0 ? ["next", "close"] : ["next", "previous", "close"],
        nextBtnText: startAt >= TOUR_STEPS.length - 1 ? "Done" : "Next",
        prevBtnText: "Back",
        doneBtnText: startAt >= TOUR_STEPS.length - 1 ? "Done" : "Next",
        steps: [{ element: step.sel, popover: { title: step.title, description: step.body, side: step.side } }],
        onPopoverRender: (popover: { nextButton?: HTMLElement }) => {
          if (popover.nextButton && startAt < TOUR_STEPS.length - 1) popover.nextButton.textContent = "Next";
        },
        onNextClick: () => {
          if (startAt >= TOUR_STEPS.length - 1) {
            finish();
            return;
          }
          void goTo(startAt + 1, survey);
        },
        onPrevClick: () => {
          if (startAt <= 0) return;
          void goTo(startAt - 1, survey);
        },
        onDestroyed: () => {
          if (navigating || finishing || !alive) return;
          finish();
        },
      });
      drv.drive(0);
    }

    async function startFromHere() {
      const survey = await firstSurveyId(clientSlug, loadTour()?.surveyId);
      saveTour({ clientSlug, surveyId: survey, step: 0 });
      await run(0, survey);
    }

    const pending = loadTour();
    if (pending && pending.clientSlug === clientSlug) {
      void run(pending.step, pending.surveyId);
    }

    const onStart = () => void startFromHere();
    window.addEventListener("sr-start-tour", onStart);
    return () => {
      alive = false;
      window.removeEventListener("sr-start-tour", onStart);
      if (!navigating) drv?.destroy();
    };
  }, [clientSlug]);

  return null;
}
