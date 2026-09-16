import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  RADIUS_PRESETS,
  SURVEY_FONTS,
  THEME_COLOR_GROUPS,
  THEME_SIZE_FIELDS,
  resolveSurveyBrand,
  type SurveyFontId,
} from "../lib/brand";

type ColorKey =
  | "color"
  | "page"
  | "surface"
  | "card"
  | "border"
  | "text"
  | "muted"
  | "gray"
  | "glow"
  | "chip"
  | "chipHover"
  | "button"
  | "buttonText"
  | "buttonHover";

type SizeKey = (typeof THEME_SIZE_FIELDS)[number]["key"];

type Draft = Record<ColorKey, string> &
  Record<SizeKey, number> & {
    pageImage: string;
    buttonRadius: number;
    fieldRadius: number;
    font: SurveyFontId;
    serif: SurveyFontId;
    chatTitle: string;
    poweredBy: string;
    chatLede: string;
    chatSub: string;
    markUrl: string;
    botIcon: string;
  };

function toDraft(brand: Record<string, unknown> | null | undefined, clientName: string): Draft {
  const r = resolveSurveyBrand(brand, { clientName, surveyName: "Sample survey" });
  return {
    color: r.color,
    page: r.page,
    surface: r.surface,
    card: r.card,
    border: r.border,
    text: r.text,
    muted: r.muted,
    gray: r.gray,
    glow: r.glow,
    chip: r.chip,
    chipHover: r.chipHover,
    button: r.button,
    buttonText: r.buttonText,
    buttonHover: r.buttonHover,
    pageImage: typeof brand?.pageImage === "string" ? brand.pageImage : r.pageImage,
    buttonRadius: r.buttonRadius,
    fieldRadius: r.fieldRadius,
    font: r.font,
    serif: r.serif,
    h1: r.h1,
    h2: r.h2,
    h3: r.h3,
    h4: r.h4,
    h5: r.h5,
    h6: r.h6,
    textLg: r.textLg,
    textMd: r.textMd,
    textRg: r.textRg,
    textSm: r.textSm,
    textXs: r.textXs,
    chatTitle: typeof brand?.chatTitle === "string" ? brand.chatTitle : "",
    poweredBy: r.poweredBy,
    chatLede: r.chatLede,
    chatSub: r.chatSub,
    markUrl: r.markUrl,
    botIcon: r.botIcon,
  };
}

function pickerValue(css: string) {
  const hex6 = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex6) return `#${hex6[1]}`;
  const hex3 = css.trim().match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [a, b, c] = hex3[1].split("");
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  const rgb = css.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return "#000000";
  const to = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`;
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `sg-c-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="sg-row">
      <label htmlFor={id}>{label}</label>
      <div className="sg-swatch">
        <input type="color" aria-label={`${label} swatch`} value={pickerValue(value)} onChange={(e) => onChange(e.target.value)} />
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </div>
    </div>
  );
}

function RadiusRow({
  label,
  value,
  allowPill,
  onChange,
}: {
  label: string;
  value: number;
  allowPill?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <div className="sg-radius">
      <span>{label}</span>
      <div className="sg-radius-picks">
        {RADIUS_PRESETS.map((n) => (
          <button key={n} type="button" className={value === n ? "on" : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
        {allowPill ? (
          <button type="button" className={value >= 180 ? "on" : undefined} onClick={() => onChange(180)}>
            Pill
          </button>
        ) : null}
        <label className="sg-px">
          <input
            type="number"
            min={0}
            max={allowPill ? 999 : 48}
            value={value}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          px
        </label>
      </div>
    </div>
  );
}

type Props = {
  slug: string;
  clientName: string;
  brand: Record<string, unknown> | null;
};

export default function ThemeSettings({ slug, clientName, brand }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(brand, clientName));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const pageFile = useRef<HTMLInputElement>(null);

  const resolved = useMemo(
    () => resolveSurveyBrand(draft, { clientName, surveyName: "Sample survey" }),
    [draft, clientName],
  );
  const vars = resolved.cssVarMap as CSSProperties;
  const headingStack = SURVEY_FONTS.find((f) => f.id === draft.serif)?.stack;
  const bodyStack = SURVEY_FONTS.find((f) => f.id === draft.font)?.stack;

  useEffect(() => {
    if (!resolved.googleFontsHref) return;
    const id = "sr-theme-google-font";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = resolved.googleFontsHref;
  }, [resolved.googleFontsHref]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus(null);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, brand: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ ok: false, text: data.error || "Could not save theme." });
        return;
      }
      setStatus({ ok: true, text: "Saved. Live questionnaires pick this up on the next load." });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Could not save theme." });
    } finally {
      setBusy(false);
    }
  }

  async function uploadSlot(slot: string, file: File) {
    const fd = new FormData();
    fd.set("kind", "brand");
    fd.set("slot", slot);
    fd.set("file", file);
    fd.set("client", slug);
    const res = await fetch("/api/app/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Upload failed.");
    return data.url as string;
  }

  async function onPageFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      set("pageImage", await uploadSlot("page", file));
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="theme-edit" onSubmit={save}>
      <nav className="sg-nav" aria-label="Theme sections">
        <a href="#sg-color">Color</a>
        <a href="#sg-buttons">Buttons</a>
        <a href="#sg-forms">Forms</a>
        <a href="#sg-type">Typography</a>
      </nav>

      <section id="sg-color" className="sg-section">
        <h2>Color</h2>
        <p className="lede">Primitive colors for this client’s questionnaires. Upload a photo to sit behind the page color, or leave it as a flat fill.</p>

        <div className="sg-bg" style={vars}>
          <div className="sg-bg-preview" aria-hidden="true" />
          <div className="sg-bg-tools">
            <ColorRow label="Background color" value={draft.page} onChange={(v) => set("page", v)} />
            <div className="sg-bg-upload">
              <input ref={pageFile} type="file" accept="image/*" hidden onChange={(e) => onPageFile(e.target.files?.[0])} />
              <button className="btn ghost small" type="button" disabled={busy} onClick={() => pageFile.current?.click()}>
                Upload background
              </button>
              {draft.pageImage ? (
                <button className="btn ghost small" type="button" onClick={() => set("pageImage", "")}>
                  Remove image
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {THEME_COLOR_GROUPS.map((group) => (
          <div className="sg-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <ColorRow key={item.key} label={item.label} value={draft[item.key]} onChange={(v) => set(item.key, v)} />
            ))}
          </div>
        ))}
      </section>

      <section id="sg-buttons" className="sg-section">
        <h2>Buttons</h2>
        <p className="lede">Fill, type, hover, and corner radius. The specimen uses this client’s questionnaire tokens.</p>
        <div className="sg-controls">
          <ColorRow label="Button fill" value={draft.button} onChange={(v) => set("button", v)} />
          <ColorRow label="Button text" value={draft.buttonText} onChange={(v) => set("buttonText", v)} />
          <ColorRow label="Button hover" value={draft.buttonHover} onChange={(v) => set("buttonHover", v)} />
          <RadiusRow label="Radius" value={draft.buttonRadius} allowPill onChange={(n) => set("buttonRadius", n)} />
        </div>
        <div className="sg-specimen" style={vars}>
          <div className="sg-spec-col">
            <span>Default</span>
            <button className="sg-btn" type="button" tabIndex={-1}>
              Get started
            </button>
            <button className="sg-btn ghost" type="button" tabIndex={-1}>
              Get started
            </button>
          </div>
          <div className="sg-spec-col">
            <span>Hover</span>
            <button className="sg-btn hover" type="button" tabIndex={-1}>
              Get started
            </button>
            <button className="sg-btn ghost hover" type="button" tabIndex={-1}>
              Get started
            </button>
          </div>
          <div className="sg-spec-col">
            <span>Disabled</span>
            <button className="sg-btn" type="button" disabled tabIndex={-1}>
              Get started
            </button>
            <button className="sg-btn ghost" type="button" disabled tabIndex={-1}>
              Get started
            </button>
          </div>
        </div>
      </section>

      <section id="sg-forms" className="sg-section">
        <h2>Forms</h2>
        <p className="lede">Field fill, border, and radius for questionnaire inputs — text, textarea, and select.</p>
        <div className="sg-controls">
          <ColorRow label="Field fill" value={draft.card} onChange={(v) => set("card", v)} />
          <ColorRow label="Field border" value={draft.border} onChange={(v) => set("border", v)} />
          <ColorRow label="Placeholder" value={draft.gray} onChange={(v) => set("gray", v)} />
          <RadiusRow label="Radius" value={draft.fieldRadius} onChange={(n) => set("fieldRadius", n)} />
        </div>
        <div className="sg-specimen sg-forms" style={vars}>
          <label className="sg-field-label">Text input</label>
          <input className="sg-field" type="text" placeholder="Placeholder" readOnly tabIndex={-1} />
          <label className="sg-field-label">Text area</label>
          <textarea className="sg-field sg-area" placeholder="Type your message…" readOnly tabIndex={-1} />
          <label className="sg-field-label">Select</label>
          <select className="sg-field" tabIndex={-1} defaultValue="">
            <option value="" disabled>
              Select one…
            </option>
            <option>Yes, it helped</option>
            <option>Not really</option>
          </select>
        </div>
      </section>

      <section id="sg-type" className="sg-section">
        <h2>Typography</h2>
        <p className="lede">Heading and body families, then the size scale used on the questionnaire.</p>
        <div className="sg-typefaces">
          <div>
            <span className="sg-kicker">Heading typeface</span>
            <select value={draft.serif} onChange={(e) => set("serif", e.target.value as SurveyFontId)}>
              {SURVEY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="sg-alpha" style={{ fontFamily: headingStack }}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz
              <br />
              1234567890!@#$%^&amp;*()
            </p>
          </div>
          <div>
            <span className="sg-kicker">Body typeface</span>
            <select value={draft.font} onChange={(e) => set("font", e.target.value as SurveyFontId)}>
              {SURVEY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <p className="sg-alpha" style={{ fontFamily: bodyStack }}>
              ABCDEFGHIJKLMNOPQRSTUVWXYZ
              <br />
              abcdefghijklmnopqrstuvwxyz
              <br />
              1234567890!@#$%^&amp;*()
            </p>
          </div>
        </div>

        <h3>Sizes</h3>
        <div className="sg-sizes" style={{ fontFamily: bodyStack }}>
          {THEME_SIZE_FIELDS.map((field) => {
            const px = draft[field.key];
            const isHeading = field.key.startsWith("h");
            return (
              <div className="sg-size-row" key={field.key}>
                <div className="sg-size-meta">
                  <label htmlFor={`sg-size-${field.key}`}>{field.label}</label>
                  <span>
                    Font size: {px}px / {(px / 16).toFixed(2).replace(/\.00$/, "")}rem
                  </span>
                </div>
                <div className="sg-size-sample" style={{ fontSize: px, fontFamily: isHeading ? headingStack : bodyStack, fontWeight: isHeading ? 600 : 400 }}>
                  {field.sample}
                </div>
                <label className="sg-px">
                  <input
                    id={`sg-size-${field.key}`}
                    type="number"
                    min={8}
                    max={96}
                    value={px}
                    onChange={(e) => set(field.key, Number(e.target.value) || px)}
                  />
                  px
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <div className="theme-savebar">
        <button className="btn primary" type="submit" disabled={busy} aria-busy={busy || undefined}>
          Save theme
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => {
            setDraft(toDraft({}, clientName));
            setStatus({ ok: true, text: "Reset to Survey Rocket defaults — save to apply." });
          }}
        >
          Reset defaults
        </button>
        {status ? <p className={`theme-status ${status.ok ? "ok" : "err"}`}>{status.text}</p> : null}
      </div>
    </form>
  );
}
