import { useEffect, useState } from "react";
import { loadOnboard, saveOnboard } from "../lib/onboard";

const TIPS: Record<string, string> = {
  surveys: "Sample surveys are marked in their cards. Your real ones sit beside them.",
  editor: "Publish puts the newest version on your link. Save draft keeps edits without changing what respondents see.",
  dashboard: "Numbers you can publish appear here once a question has three answers.",
  results: "Answers arrive here the moment someone finishes, from any device.",
  scan: "The scan reads the page live, so a run takes under a minute.",
};

function viewFromPath() {
  const p = window.location.pathname;
  if (/\/surveys\/[^/]+\/edit\/?$/.test(p)) return "editor";
  if (/\/surveys\/?$/.test(p)) return "surveys";
  if (/\/scan\/?$/.test(p)) return "scan";
  if (/\/results(\/|$)/.test(p)) return "results";
  if (/\/dashboard\/?$/.test(p)) return "dashboard";
  return "";
}

export default function ViewTip() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    function refresh(force = false) {
      const view = viewFromPath();
      const tip = TIPS[view];
      if (!tip) {
        setText(null);
        return;
      }
      const onb = loadOnboard();
      if (view === "surveys" && !onb.dismissedAt && !force) {
        setText(null);
        return;
      }
      const dismissed = onb.views[view]?.tipDismissed;
      setText(!dismissed || force ? tip : null);
    }
    refresh();
    const onShow = () => refresh(true);
    const onChange = () => refresh();
    window.addEventListener("sr-show-tip", onShow);
    window.addEventListener("sr-onboard-changed", onChange);
    return () => {
      window.removeEventListener("sr-show-tip", onShow);
      window.removeEventListener("sr-onboard-changed", onChange);
    };
  }, []);

  if (!text) return null;

  return (
    <div className="viewtip" role="status">
      <span>{text}</span>
      <button
        className="viewtip-x"
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          const view = viewFromPath();
          const onb = loadOnboard();
          onb.views = { ...onb.views, [view]: { tipDismissed: true } };
          saveOnboard(onb);
          setText(null);
        }}
      >
        <svg className="ic" aria-hidden="true"><use href="#i-x" /></svg>
      </button>
    </div>
  );
}
