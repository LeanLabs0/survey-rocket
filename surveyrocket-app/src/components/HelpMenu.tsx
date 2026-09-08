import { useEffect, useState } from "react";
import { loadOnboard } from "../lib/onboard";

export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [tourDone, setTourDone] = useState(false);

  useEffect(() => {
    function sync() {
      setTourDone(loadOnboard().tourDone);
    }
    sync();
    window.addEventListener("sr-onboard-changed", sync);
    return () => window.removeEventListener("sr-onboard-changed", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".helpwrap")) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="helpwrap">
      <button
        className="navitem"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg className="ic" aria-hidden="true"><use href="#i-help" /></svg>
        Help
      </button>
      <div className={"helpmenu" + (open ? " open" : "")} role="menu">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("sr-start-tour"));
          }}
        >
          {tourDone ? "Replay the tour" : "Take the tour"}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new CustomEvent("sr-show-tip"));
          }}
        >
          Show the tip for this view
        </button>
        <div className="foot">Questions? Ask your Lean Labs team.</div>
      </div>
    </div>
  );
}
