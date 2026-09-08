import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "../lib/supabase-browser";
import { applyTheme } from "../lib/theme";
import { useConfirm } from "./ConfirmDialog";

type Member = { userId: string; email: string; fullName: string | null; role: string };
type HubSpot = {
  connected: boolean;
  status: string;
  portalId?: string | null;
  portalName?: string | null;
};
type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  theme: string;
  locale: string;
  notifyReviews: boolean;
};
type Passkey = { id: string; label: string; createdAt: string };
type SessionRow = { id: string; current: boolean; userAgent: string | null; lastSeenAt: string; createdAt: string };

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter((p) => /^[a-z]/i.test(p));
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function shortUA(ua: string | null) {
  if (!ua) return "Unknown browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "this device";
  if (/Edg\//.test(ua)) return `Edge on ${os}`;
  if (/Chrome\//.test(ua)) return `Chrome on ${os}`;
  if (/Firefox\//.test(ua)) return `Firefox on ${os}`;
  if (/Safari\//.test(ua)) return `Safari on ${os}`;
  return ua.slice(0, 72);
}

function FileDrop({
  preview,
  onFile,
  label,
}: {
  preview: string | null;
  onFile: (file: File) => void;
  label: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button
        type="button"
        className={"dropzone" + (over ? " over" : "")}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        {preview ? <img src={preview} alt="" /> : <span>Drop an image, or click to choose</span>}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        hidden
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return <span className={"pw-rule" + (ok ? " ok" : "")}>{ok ? "✓" : "×"} {label}</span>;
}

export default function Settings(props: {
  clientSlug: string;
  clientName: string;
  logoUrl: string | null;
  hubspot: HubSpot;
  hsConfigured: boolean;
  hsFlash: string | null;
  members: Member[];
  canInvite: boolean;
  isSuperadmin: boolean;
  profile: Profile;
  supabaseUrl: string;
  supabaseKey: string;
}) {
  const [tab, setTab] = useState<"general" | "security" | "notifications">("general");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState(props.profile.fullName || "");
  const [email, setEmail] = useState(props.profile.email || "");
  const [avatar, setAvatar] = useState(props.profile.avatarUrl);
  const [theme, setTheme] = useState(props.profile.theme || "dark");
  const [locale, setLocale] = useState(props.profile.locale || "en");
  const [notifyReviews, setNotifyReviews] = useState(props.profile.notifyReviews !== false);
  const [logo, setLogo] = useState(props.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [members, setMembers] = useState(props.members);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [pkStatus, setPkStatus] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [deletePw, setDeletePw] = useState("");
  const { confirm, dialog } = useConfirm();

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : logo), [logoFile, logo]);

  function flash(ok: string | null, error?: string | null) {
    setMsg(ok);
    setErr(error || null);
  }

  function go(next: typeof tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "general") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  }

  async function saveProfile(extra: Record<string, unknown> = {}) {
    const r = await fetch("/api/app/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, theme, locale, notifyReviews, ...extra }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error || "Could not save.");
    if (d.emailPending) flash("Check your inbox to confirm the new email.");
    else flash("Saved.");
  }

  async function upload(kind: "avatar" | "logo", file: File) {
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    fd.set("client", props.clientSlug);
    const r = await fetch("/api/app/upload", { method: "POST", body: fd });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error || "Upload failed.");
    return d.url as string;
  }

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "security" || q === "notifications") setTab(q);
  }, []);

  useEffect(() => {
    if (tab !== "security") return;
    fetch("/api/app/passkeys").then((r) => r.json()).then((d) => setPasskeys(d.passkeys || [])).catch(() => setPasskeys([]));
    fetch("/api/app/sessions").then((r) => r.json()).then((d) => setSessions(d.sessions || [])).catch(() => setSessions([]));
  }, [tab]);

  const pw = {
    len: newPw.length >= 8,
    case: /[a-z]/.test(newPw) && /[A-Z]/.test(newPw),
    num: /\d/.test(newPw),
    spec: /[^A-Za-z0-9]/.test(newPw),
  };

  return (
    <div className="acct">
      <div className="pagehead">
        <h1>Account settings</h1>
        <p>Manage your personal account, this workspace, and HubSpot.</p>
      </div>
      <div className="acct-tabs" role="tablist">
        {(["general", "security", "notifications"] as const).map((id) => (
          <button key={id} type="button" role="tab" className="acct-tab" aria-selected={tab === id} onClick={() => go(id)}>
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      {msg && <p className="acct-flash ok">{msg}</p>}
      {err && <p className="acct-flash err">{err}</p>}
      {props.hsFlash === "connected" && tab === "general" && <p className="acct-flash ok">HubSpot connected.</p>}
      {props.hsFlash === "error" && tab === "general" && <p className="acct-flash err">Could not connect HubSpot. Try again.</p>}

      {tab === "general" && (
        <div className="acct-stack">
          <section className="acct-card">
            <div className="acct-copy">
              <h3>Your avatar</h3>
              <p>To change your avatar, click the picture and select a file from your computer.</p>
            </div>
            <button
              type="button"
              className="avatar-btn"
              aria-label="Upload avatar"
              onClick={() => document.getElementById("avatar-file")?.click()}
            >
              {avatar ? <img src={avatar} alt="" /> : <span>{initials(fullName, email)}</span>}
            </button>
            <input
              id="avatar-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setAvatar(await upload("avatar", file));
                  flash("Avatar updated.");
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not upload.");
                }
              }}
            />
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Your name</h3>
              <p>This is how your name appears to teammates in this workspace.</p>
            </div>
            <form
              className="acct-row acct-save"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await saveProfile({ fullName });
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not save.");
                }
              }}
            >
              <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <button className="btn primary" type="submit">Save</button>
            </form>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Your email</h3>
              <p>Enter the new email and hit save. You will have to confirm it before it becomes active.</p>
            </div>
            <form
              className="acct-row acct-save"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await saveProfile({ email });
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not save.");
                }
              }}
            >
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn primary" type="submit">Save</button>
            </form>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Color mode</h3>
              <p>Choose how the app looks for you. System follows your device setting.</p>
            </div>
            <div className="acct-row acct-save">
              <div className="theme-seg" role="radiogroup" aria-label="Color mode">
                {(
                  [
                    ["system", "System"],
                    ["light", "Light"],
                    ["dark", "Dark"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={theme === id ? "on" : undefined}
                    aria-pressed={theme === id}
                    onClick={async () => {
                      setTheme(id);
                      applyTheme(id);
                      try {
                        await saveProfile({ theme: id });
                      } catch (ex) {
                        flash(null, ex instanceof Error ? ex.message : "Could not save.");
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Your language</h3>
              <p>This is stored on your account. The product UI is English for now.</p>
            </div>
            <form
              className="acct-row acct-save"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await saveProfile({ locale });
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not save.");
                }
              }}
            >
              <select className="field" value={locale} onChange={(e) => setLocale(e.target.value)}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
              <button className="btn primary" type="submit">Save</button>
            </form>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>HubSpot</h3>
              <p>Answers stay in Survey Rocket. HubSpot holds the contact identity for this workspace.</p>
            </div>
            <div className="hs-panel">
              <div className={"hs-status" + (props.hubspot.connected ? " on" : "")}>
                <i />
                {props.hubspot.connected
                  ? `Connected${props.hubspot.portalName || props.hubspot.portalId ? ` · ${props.hubspot.portalName || "portal " + props.hubspot.portalId}` : ""}`
                  : "Not connected"}
              </div>
              {props.isSuperadmin && (
                <p className="acct-note">You are viewing this as a superadmin. Connecting here attaches HubSpot to {props.clientName}.</p>
              )}
              <div className="acct-actions">
                <a className="btn primary" href={`/api/hubspot/oauth/start?client=${encodeURIComponent(props.clientSlug)}`}>
                  {props.hubspot.connected ? "Reconnect HubSpot" : "Connect HubSpot"}
                </a>
                {props.hubspot.connected && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Disconnect HubSpot",
                        message: "New answers will no longer sync contacts to HubSpot. Existing HubSpot records are not deleted.",
                        confirmLabel: "Disconnect",
                      });
                      if (!ok) return;
                      await fetch("/api/hubspot/disconnect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ client: props.clientSlug }),
                      });
                      location.reload();
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
              {!props.hsConfigured && (
                <p className="acct-note">OAuth env vars are missing on this environment, so the connect flow will fail until they are set.</p>
              )}
            </div>
          </section>

          <section className="acct-card col">
            <div className="acct-copy">
              <h3>Workspace logo</h3>
              <p>Shown to respondents on the survey. Drop a file, then save.</p>
            </div>
            <FileDrop preview={logoPreview} label="Workspace logo" onFile={setLogoFile} />
            <button
              className="btn primary"
              type="button"
              disabled={!logoFile}
              onClick={async () => {
                if (!logoFile) return;
                try {
                  const url = await upload("logo", logoFile);
                  setLogo(url);
                  setLogoFile(null);
                  flash("Logo saved.");
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not save logo.");
                }
              }}
            >
              Save
            </button>
          </section>

          <section className="acct-card col">
            <div className="acct-copy">
              <h3>Members</h3>
              <p>People who can open this workspace. Owners can invite new members.</p>
            </div>
            <ul className="member-list">
              {members.map((m) => (
                <li key={m.userId}>
                  <span>
                    <b>{m.fullName || m.email}</b>
                    {m.fullName && <em>{m.email}</em>}
                  </span>
                  <span className="member-role">{m.role}</span>
                  {props.canInvite && m.userId !== props.profile.id && (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Remove member",
                          message: `Remove ${m.fullName || m.email} from this workspace? They will lose access immediately.`,
                          confirmLabel: "Remove",
                        });
                        if (!ok) return;
                        const r = await fetch("/api/app/members", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ client: props.clientSlug, userId: m.userId }),
                        });
                        const d = await r.json().catch(() => null);
                        if (!r.ok) return flash(null, d?.error || "Could not remove.");
                        setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
                        flash("Member removed.");
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {props.canInvite ? (
              <form
                className="acct-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await fetch("/api/app/members", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ client: props.clientSlug, email: inviteEmail, role: inviteRole }),
                  });
                  const d = await r.json().catch(() => null);
                  if (!r.ok) return flash(null, d?.error || "Could not invite.");
                  setInviteEmail("");
                  flash("Invite sent. They will get an email to set a password.");
                  const list = await fetch(`/api/app/members?client=${encodeURIComponent(props.clientSlug)}`).then((x) => x.json());
                  setMembers(list.members || members);
                }}
              >
                <input className="field" type="email" required placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <select className="field" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={{ maxWidth: 140 }}>
                  <option value="member">Member</option>
                  <option value="owner">Owner</option>
                </select>
                <button className="btn primary" type="submit">Add member</button>
              </form>
            ) : (
              <p className="acct-note">Ask a workspace owner to invite someone.</p>
            )}
          </section>

          <section className="acct-card danger">
            <div className="acct-copy">
              <h3>Delete account</h3>
              <p>Permanently delete your account. Once you delete your account, there is no going back. Enter your password to confirm.</p>
            </div>
            {props.isSuperadmin ? (
              <p className="acct-note">A superadmin account cannot be deleted from a client portal.</p>
            ) : (
              <form
                className="acct-row"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await confirm({
                    title: "Delete account",
                    message: "This permanently deletes your account. There is no going back.",
                    confirmLabel: "Delete account",
                  });
                  if (!ok) return;
                  const r = await fetch("/api/app/profile", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: deletePw }),
                  });
                  const d = await r.json().catch(() => null);
                  if (!r.ok) return flash(null, d?.error || "Could not delete account.");
                  window.location.assign("/logout");
                }}
              >
                <input className="field" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} placeholder="Password" />
                <button className="btn danger" type="submit">Delete account</button>
              </form>
            )}
          </section>
        </div>
      )}

      {tab === "security" && (
        <div className="acct-stack">
          <section className="acct-card col">
            <div className="acct-copy">
              <h3>Your password</h3>
            </div>
            <form
              className="pw-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await fetch("/api/app/password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ current: currentPw, next: newPw }),
                });
                const d = await r.json().catch(() => null);
                if (!r.ok) return flash(null, d?.error || "Could not update password.");
                setCurrentPw("");
                setNewPw("");
                flash("Password updated.");
              }}
            >
              <label className="flabel">Current password</label>
              <div className="pw-field">
                <input className="field" type={showCur ? "text" : "password"} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="pw-toggle" onClick={() => setShowCur((v) => !v)}>{showCur ? "Hide" : "Show"}</button>
              </div>
              <label className="flabel">New password</label>
              <div className="pw-field">
                <input className="field" type={showNew ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" required />
                <button type="button" className="pw-toggle" onClick={() => setShowNew((v) => !v)}>{showNew ? "Hide" : "Show"}</button>
              </div>
              <div className="pw-rules">
                <Rule ok={pw.len} label="Min. 8 characters" />
                <Rule ok={pw.case} label="Upper & lowercase" />
                <Rule ok={pw.num} label="Number" />
                <Rule ok={pw.spec} label="Special character" />
              </div>
              <button className="btn primary" type="submit" disabled={!pw.len || !pw.case || !pw.num || !pw.spec}>Save</button>
            </form>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Passkeys</h3>
              <p>Use a passkey as a secure alternative to passwords. After you add one, it works on the sign-in page.</p>
            </div>
            <div>
              <ul className="member-list">
                {passkeys.length === 0 && <li className="acct-note">No passkeys yet.</li>}
                {passkeys.map((p) => (
                  <li key={p.id}>
                    <span>{p.label}</span>
                    <button
                      type="button"
                      className="text-btn"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Remove passkey",
                          message: `Remove “${p.label}”? You will not be able to sign in with it anymore.`,
                          confirmLabel: "Remove",
                        });
                        if (!ok) return;
                        await fetch("/api/app/passkeys", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: p.id }),
                        });
                        setPasskeys((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {pkStatus && <p className="acct-note">{pkStatus}</p>}
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  if (!props.supabaseUrl || !props.supabaseKey) {
                    setPkStatus("Passkeys are not configured on this environment.");
                    return;
                  }
                  setPkStatus("Follow the browser prompt…");
                  try {
                    const supabase = supabaseBrowser(props.supabaseUrl, props.supabaseKey);
                    const auth = supabase.auth as typeof supabase.auth & {
                      registerPasskey: () => Promise<{ error: { message: string } | null }>;
                    };
                    const { error } = await auth.registerPasskey();
                    if (error) throw error;
                    await fetch("/api/app/passkeys", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ label: "Passkey" }),
                    });
                    const d = await fetch("/api/app/passkeys").then((r) => r.json());
                    setPasskeys(d.passkeys || []);
                    setPkStatus("Passkey saved. You can use it on the sign-in page next time.");
                  } catch (ex) {
                    setPkStatus(ex instanceof Error ? ex.message : "Could not add a passkey.");
                  }
                }}
              >
                + Add passkey
              </button>
            </div>
          </section>

          <section className="acct-card">
            <div className="acct-copy">
              <h3>Active sessions</h3>
              <p>These are the browsers signed in to your account. Click the X to end a session.</p>
            </div>
            <ul className="session-list">
              {sessions.length === 0 && <li className="acct-note">No other sessions recorded yet. This browser is signed in.</li>}
              {sessions.map((s) => (
                <li key={s.id}>
                  <div>
                    <b>{s.current ? "Current session" : "Session"}</b>
                    <span>{shortUA(s.userAgent)}</span>
                    <small>Last seen {new Date(s.lastSeenAt).toLocaleString()}</small>
                  </div>
                  <button
                    type="button"
                    className="iconx"
                    aria-label="End session"
                    onClick={async () => {
                      const ok = await confirm({
                        title: s.current ? "Sign out this browser?" : "End session",
                        message: s.current
                          ? "This will sign you out of the current browser."
                          : "That browser will be signed out immediately.",
                        confirmLabel: s.current ? "Sign out" : "End session",
                      });
                      if (!ok) return;
                      const r = await fetch("/api/app/sessions", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: s.id }),
                      });
                      const d = await r.json().catch(() => null);
                      if (d?.current) {
                        window.location.assign("/logout");
                        return;
                      }
                      setSessions((prev) => prev.filter((x) => x.id !== s.id));
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "notifications" && (
        <div className="acct-stack">
          <div className="pagehead" style={{ padding: 0, margin: 0 }}>
            <h3>Notifications</h3>
            <p>Choose how you receive notifications. In-app is available now; email will come later.</p>
          </div>
          <section className="acct-card col">
            <h4>General</h4>
            <div className="note-table">
              <div className="note-head"><span>Notification</span><span>In-app</span></div>
              <div className="note-row">
                <span>Survey reviews</span>
                <button
                  type="button"
                  className={"switch" + (notifyReviews ? " on" : "")}
                  aria-pressed={notifyReviews}
                  aria-label="Survey reviews in-app"
                  onClick={async () => {
                    const next = !notifyReviews;
                    setNotifyReviews(next);
                    try {
                      await saveProfile({ notifyReviews: next });
                    } catch (ex) {
                      setNotifyReviews(!next);
                      flash(null, ex instanceof Error ? ex.message : "Could not save.");
                    }
                  }}
                >
                  <i />
                </button>
              </div>
            </div>
            <p className="acct-note">When someone leaves a review or opens the review page, it shows in the Notifications list in the sidebar.</p>
          </section>
        </div>
      )}
      {dialog}
    </div>
  );
}
