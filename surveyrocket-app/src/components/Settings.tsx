import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { supabaseBrowser } from "../lib/supabase-browser";
import { applyTheme } from "../lib/theme";
import { useConfirm } from "./ConfirmDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Eye, EyeOff, Monitor, Moon, Sun, X } from "lucide-react";

type Member = { userId: string; email: string; fullName: string | null; inviteStatus?: "invited" | "signed_in" };
type HubSpot = {
  connected: boolean;
  status: string;
  portalId?: string | null;
  portalName?: string | null;
  signinFormId?: string | null;
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
type Tab = "general" | "security" | "notifications";
type ThemeId = "system" | "light" | "dark";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
];

const THEMES: { id: ThemeId; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

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
        className={`flex min-h-28 w-full max-w-md flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-sm transition-colors ${
          over ? "border-[var(--green)] bg-[var(--green)]/5" : "border-input text-muted-foreground hover:bg-muted/40"
        }`}
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
        {preview ? (
          <img alt="" className="max-h-16 max-w-full object-contain" src={preview} />
        ) : (
          <span>Drop an image, or click to choose</span>
        )}
      </button>
      <input
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        aria-label={label}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
        ref={input}
        type="file"
      />
    </div>
  );
}

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-[var(--green)]" : "text-muted-foreground"}`}>
      {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      {label}
    </span>
  );
}

function SettingCard({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Card className={danger ? "border-destructive/40 dark:bg-transparent" : "dark:bg-transparent"}>
      <CardHeader className="border-b">
        <CardTitle className="text-lg text-balance">{title}</CardTitle>
        {description ? <CardDescription className="text-pretty">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  revealed,
  onToggle,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  revealed: boolean;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <Field>
      <FieldTitle>
        <label htmlFor={id}>{label}</label>
      </FieldTitle>
      <div className="relative">
        <Input
          autoComplete={autoComplete}
          className="pr-9"
          id={id}
          onChange={(e) => onChange(e.target.value)}
          required
          type={revealed ? "text" : "password"}
          value={value}
        />
        <Button
          aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute top-1/2 right-1 size-6 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onToggle}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          {revealed ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </Field>
  );
}

function SaveRow({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex max-w-lg items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          await onSubmit();
        } finally {
          setSaving(false);
        }
      }}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const el = child as ReactElement<{ type?: string; loading?: boolean; disabled?: boolean }>;
        if (el.props.type === "submit") {
          return cloneElement(el, { loading: saving, disabled: saving || el.props.disabled });
        }
        return child;
      })}
    </form>
  );
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
  const [tab, setTab] = useState<Tab>("general");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState(props.profile.fullName || "");
  const [email, setEmail] = useState(props.profile.email || "");
  const [avatar, setAvatar] = useState(props.profile.avatarUrl);
  const [theme, setTheme] = useState(props.profile.theme || "dark");
  const [notifyReviews, setNotifyReviews] = useState(props.profile.notifyReviews !== false);
  const [logo, setLogo] = useState(props.logoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [members, setMembers] = useState(props.members);
  const [inviteEmail, setInviteEmail] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [pkStatus, setPkStatus] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [deletePw, setDeletePw] = useState("");
  const [logoSaving, setLogoSaving] = useState(false);
  const [hsBusy, setHsBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : logo), [logoFile, logo]);

  function flash(ok: string | null, error?: string | null) {
    setMsg(ok);
    setErr(error || null);
  }

  function go(next: Tab) {
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
      body: JSON.stringify({ fullName, email, theme, locale: props.profile.locale, notifyReviews, ...extra }),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error || "Could not save.");
    if (d.emailPending) flash("Check your inbox to confirm the new email.");
    else flash("Saved.");
  }

  async function trySave(extra: Record<string, unknown> = {}) {
    try {
      await saveProfile(extra);
    } catch (ex) {
      flash(null, ex instanceof Error ? ex.message : "Could not save.");
    }
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
    <div className="flex flex-col gap-4">
      <ToggleGroup
        aria-label="Settings sections"
        onValueChange={(next) => {
          const raw = Array.isArray(next) ? next[0] : next;
          if (raw === "general" || raw === "security" || raw === "notifications") go(raw);
        }}
        size="sm"
        spacing={0}
        value={[tab]}
        variant="outline"
      >
        {TABS.map((item) => (
          <ToggleGroupItem key={item.id} value={item.id}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {msg ? <p className="text-sm text-[var(--green)]">{msg}</p> : null}
      {err ? <p className="text-destructive text-sm">{err}</p> : null}
      {props.hsFlash === "connected" && tab === "general" ? (
        <p className="text-sm text-[var(--green)]">HubSpot connected.</p>
      ) : null}
      {props.hsFlash === "error" && tab === "general" ? (
        <p className="text-destructive text-sm">Could not connect HubSpot. Try again.</p>
      ) : null}

      {tab === "general" ? (
        <div className="flex flex-col gap-4">
          <SettingCard
            description="To change your avatar, click the picture and select a file from your computer."
            title="Your avatar"
          >
            <button
              aria-label="Upload avatar"
              className="rounded-full outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              onClick={() => document.getElementById("avatar-file")?.click()}
              type="button"
            >
              <Avatar className="size-16" size="lg">
                {avatar ? <AvatarImage alt="" src={avatar} /> : null}
                <AvatarFallback className="text-base">{initials(fullName, email)}</AvatarFallback>
              </Avatar>
            </button>
            <input
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              hidden
              id="avatar-file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const url = await upload("avatar", file);
                  setAvatar(url);
                  window.dispatchEvent(new CustomEvent("sr-avatar-changed", { detail: url }));
                  flash("Avatar updated.");
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not upload.");
                }
              }}
              type="file"
            />
          </SettingCard>

          <SettingCard
            description="This is how your name appears to teammates in this workspace."
            title="Your name"
          >
            <SaveRow onSubmit={() => trySave({ fullName })}>
              <Input className="min-w-0 flex-1" onChange={(e) => setFullName(e.target.value)} value={fullName} />
              <Button type="submit">Save</Button>
            </SaveRow>
          </SettingCard>

          <SettingCard
            description="Enter the new email and hit save. You will have to confirm it before it becomes active."
            title="Your email"
          >
            <SaveRow onSubmit={() => trySave({ email })}>
              <Input
                className="min-w-0 flex-1"
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
              <Button type="submit">Save</Button>
            </SaveRow>
          </SettingCard>

          <SettingCard
            description="Choose how the app looks for you. System follows your device setting."
            title="Color mode"
          >
            <ToggleGroup
              aria-label="Color mode"
              onValueChange={async (next) => {
                const raw = Array.isArray(next) ? next[0] : next;
                if (raw !== "system" && raw !== "light" && raw !== "dark") return;
                setTheme(raw);
                applyTheme(raw);
                try {
                  await saveProfile({ theme: raw });
                } catch (ex) {
                  flash(null, ex instanceof Error ? ex.message : "Could not save.");
                }
              }}
              spacing={0}
              value={[theme]}
              variant="outline"
            >
              {THEMES.map(({ id, label, icon: Icon }) => (
                <ToggleGroupItem aria-label={label} key={id} title={label} value={id}>
                  <Icon />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingCard>

          <SettingCard
            description="Answers stay in Survey Rocket. Connecting HubSpot auto-creates [LL] SurveyRocket Sign in. Each survey gets two static lists: signed in and completed."
            title="HubSpot"
          >
            <div className="flex flex-col gap-3">
              <Badge variant={props.hubspot.connected ? "default" : "outline"}>
                {props.hubspot.connected
                  ? `Connected${props.hubspot.portalName || props.hubspot.portalId ? ` · ${props.hubspot.portalName || `portal ${props.hubspot.portalId}`}` : ""}`
                  : "Not connected"}
              </Badge>
              {props.isSuperadmin ? (
                <p className="text-muted-foreground text-sm">
                  You are viewing this as a superadmin. Connecting here attaches HubSpot to {props.clientName}.
                </p>
              ) : null}
              {props.hubspot.connected && props.hubspot.signinFormId ? (
                <p className="text-muted-foreground text-sm">
                  Sign-in form <span className="text-foreground">[LL] SurveyRocket Sign in</span> is ready. It opens when a respondent clicks Begin.
                </p>
              ) : props.hubspot.connected ? (
                <p className="text-muted-foreground text-sm">
                  Reconnect HubSpot so we can create the [LL] SurveyRocket Sign in form in this portal. The HubSpot app needs the forms scope.
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {props.hsConfigured ? (
                  <Button nativeButton={false} render={<a href={`/api/hubspot/oauth/start?client=${encodeURIComponent(props.clientSlug)}`} />}>
                    {props.hubspot.connected ? "Reconnect HubSpot" : "Connect HubSpot"}
                  </Button>
                ) : (
                  <Button disabled type="button">
                    Connect HubSpot
                  </Button>
                )}
                {props.hubspot.connected ? (
                  <Button
                    loading={hsBusy}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Disconnect HubSpot",
                        message: "New answers will no longer sync contacts to HubSpot. Existing HubSpot records are not deleted.",
                        confirmLabel: "Disconnect",
                      });
                      if (!ok) return;
                      setHsBusy(true);
                      try {
                        await fetch("/api/hubspot/disconnect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ client: props.clientSlug }),
                        });
                        location.reload();
                      } finally {
                        setHsBusy(false);
                      }
                    }}
                    type="button"
                    variant="outline"
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
              {!props.hsConfigured ? (
                <p className="text-muted-foreground text-sm">
                  Add HUBSPOT_APP_CLIENT_ID and HUBSPOT_APP_CLIENT_SECRET from HubSpot → Development → Projects → Survey Rocket → Auth, then restart the app.
                </p>
              ) : null}
            </div>
          </SettingCard>

          <SettingCard description="Shown to respondents on the survey. Drop a file, then save." title="Workspace logo">
            <div className="flex flex-col items-start gap-3">
              <FileDrop label="Workspace logo" onFile={setLogoFile} preview={logoPreview} />
              <Button
                disabled={!logoFile || logoSaving}
                loading={logoSaving}
                onClick={async () => {
                  if (!logoFile) return;
                  setLogoSaving(true);
                  try {
                    const url = await upload("logo", logoFile);
                    setLogo(url);
                    setLogoFile(null);
                    flash("Logo saved.");
                  } catch (ex) {
                    flash(null, ex instanceof Error ? ex.message : "Could not save logo.");
                  } finally {
                    setLogoSaving(false);
                  }
                }}
                type="button"
              >
                Save
              </Button>
            </div>
          </SettingCard>

          <SettingCard description="Anyone on this workspace can sign in and invite colleagues." title="Members">
            <div className="flex flex-col gap-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{m.fullName || m.email}</span>
                          {m.fullName ? <span className="text-muted-foreground text-xs">{m.email}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {m.inviteStatus === "signed_in" ? (
                          <Badge variant="secondary">Accepted</Badge>
                        ) : (
                          <Badge variant="outline">Invite sent</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {props.canInvite && m.inviteStatus !== "signed_in" ? (
                            <Button
                              loading={resendBusy === m.userId}
                              onClick={async () => {
                                if (resendBusy) return;
                                setResendBusy(m.userId);
                                try {
                                  const r = await fetch("/api/app/members", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ client: props.clientSlug, email: m.email, resend: true }),
                                  });
                                  const d = await r.json().catch(() => null);
                                  if (!r.ok) return flash(null, d?.error || "Could not resend invite.");
                                  flash("Invite resent. They will get a fresh email to set a password.");
                                } finally {
                                  setResendBusy(null);
                                }
                              }}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Resend invite
                            </Button>
                          ) : null}
                          {props.canInvite && m.userId !== props.profile.id ? (
                            <Button
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
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {props.canInvite ? (
                <form
                  className="flex max-w-xl flex-wrap items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (inviteBusy) return;
                    setInviteBusy(true);
                    try {
                      const r = await fetch("/api/app/members", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ client: props.clientSlug, email: inviteEmail }),
                      });
                      const d = await r.json().catch(() => null);
                      if (!r.ok) return flash(null, d?.error || "Could not invite.");
                      setInviteEmail("");
                      flash("Invite sent. They will get an email to set a password.");
                      const list = await fetch(`/api/app/members?client=${encodeURIComponent(props.clientSlug)}`).then((x) => x.json());
                      setMembers(list.members || members);
                    } finally {
                      setInviteBusy(false);
                    }
                  }}
                >
                  <Input
                    className="min-w-0 flex-1"
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    required
                    type="email"
                    value={inviteEmail}
                  />
                  <Button loading={inviteBusy} type="submit">Send invite</Button>
                </form>
              ) : null}
            </div>
          </SettingCard>

          <SettingCard
            danger
            description="Permanently delete your account. Once you delete your account, there is no going back. Enter your password to confirm."
            title="Delete account"
          >
            {props.isSuperadmin ? (
              <p className="text-muted-foreground text-sm">A superadmin account cannot be deleted from a client portal.</p>
            ) : (
              <form
                className="flex max-w-lg items-center gap-2"
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
                <Input
                  autoComplete="current-password"
                  className="min-w-0 flex-1"
                  onChange={(e) => setDeletePw(e.target.value)}
                  placeholder="Password"
                  type="password"
                  value={deletePw}
                />
                <Button type="submit" variant="destructive">
                  Delete account
                </Button>
              </form>
            )}
          </SettingCard>
        </div>
      ) : null}

      {tab === "security" ? (
        <div className="flex flex-col gap-4">
          <SettingCard title="Your password">
            <form
              className="flex max-w-lg flex-col gap-3"
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
              <PasswordField
                autoComplete="current-password"
                id="current-password"
                label="Current password"
                onChange={setCurrentPw}
                onToggle={() => setShowCur((v) => !v)}
                revealed={showCur}
                value={currentPw}
              />
              <PasswordField
                autoComplete="new-password"
                id="new-password"
                label="New password"
                onChange={setNewPw}
                onToggle={() => setShowNew((v) => !v)}
                revealed={showNew}
                value={newPw}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Rule label="Min. 8 characters" ok={pw.len} />
                <Rule label="Upper & lowercase" ok={pw.case} />
                <Rule label="Number" ok={pw.num} />
                <Rule label="Special character" ok={pw.spec} />
              </div>
              <Button className="self-start" disabled={!pw.len || !pw.case || !pw.num || !pw.spec} type="submit">
                Save
              </Button>
            </form>
          </SettingCard>

          <SettingCard
            description="Use a passkey as a secure alternative to passwords. After you add one, it works on the sign-in page."
            title="Passkeys"
          >
            <div className="flex flex-col gap-3">
              {passkeys.length === 0 ? (
                <p className="text-muted-foreground text-sm">No passkeys yet.</p>
              ) : (
                <Table>
                  <TableBody>
                    {passkeys.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.label}</TableCell>
                        <TableCell className="text-end">
                          <Button
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
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {pkStatus ? <p className="text-muted-foreground text-sm">{pkStatus}</p> : null}
              <Button
                className="self-start"
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
                type="button"
                variant="outline"
              >
                Add passkey
              </Button>
            </div>
          </SettingCard>

          <SettingCard
            description="These are the browsers signed in to your account. End a session to sign that browser out."
            title="Active sessions"
          >
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No other sessions recorded yet. This browser is signed in.</p>
            ) : (
              <Table>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">{s.current ? "Current session" : "Session"}</span>
                          <span className="text-muted-foreground text-sm">{shortUA(s.userAgent)}</span>
                          <span className="text-muted-foreground text-xs">
                            Last seen {new Date(s.lastSeenAt).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
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
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <X />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SettingCard>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <SettingCard
          description="Choose how you receive notifications. In-app is available now; email will come later."
          title="Notifications"
        >
          <div className="flex flex-col gap-3">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Survey reviews</FieldTitle>
                <FieldDescription>
                  When someone leaves a review or opens the review page, it shows in the Notifications list.
                </FieldDescription>
              </FieldContent>
              <Switch
                aria-label="Survey reviews in-app"
                checked={notifyReviews}
                onCheckedChange={async (checked) => {
                  setNotifyReviews(checked);
                  try {
                    await saveProfile({ notifyReviews: checked });
                  } catch (ex) {
                    setNotifyReviews(!checked);
                    flash(null, ex instanceof Error ? ex.message : "Could not save.");
                  }
                }}
              />
            </Field>
          </div>
        </SettingCard>
      ) : null}
      {dialog}
    </div>
  );
}
