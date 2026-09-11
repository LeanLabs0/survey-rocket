import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConfirm } from "./ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isQuestionRequired } from "@/lib/definition";
import { cn } from "@/lib/utils";
import { Check, Eye, GripVertical, Link2, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";

declare global {
  interface Window {
    SurveyChat?: new (opts: Record<string, unknown>) => { start: () => void; stop?: () => void };
  }
}

type Question = {
  id: string;
  type: "choice" | "multi" | "number" | "text";
  q: string;
  options?: string[];
  nps?: boolean;
  min?: number;
  max?: number;
  optional?: boolean;
  required?: boolean;
};

type Definition = {
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
    source: string;
    drafted_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
  };
};

type SurveyRow = {
  id: string;
  publicId: string;
  slug: string;
  name: string;
  cadence: string | null;
  status: string;
  definition: Definition;
  settings: Definition["settings"];
  provenance: Definition["provenance"];
};

const TYPES: { value: Question["type"] | "choice+nps"; label: string }[] = [
  { value: "choice", label: "Multiple choice" },
  { value: "multi", label: "Pick several" },
  { value: "choice+nps", label: "Rating 0 to 10" },
  { value: "number", label: "Number" },
  { value: "text", label: "Open text" },
];

const fieldInputClass = "h-10";
const fieldTextareaClass = "min-h-24 py-2.5";

function qid() {
  return "q" + Math.random().toString(36).slice(2, 8);
}

function typeValue(q: Question) {
  return q.nps ? "choice+nps" : q.type;
}

function typeLabel(q: Question) {
  return TYPES.find((t) => t.value === typeValue(q))?.label ?? q.type;
}

function fieldSummary(q: Question) {
  const label = typeLabel(q);
  const need = isQuestionRequired(q) ? "Required" : "Optional";
  if (q.type === "number") return `${label} · ${q.min ?? 0} to ${q.max ?? 1000} · ${need}`;
  return `${label} · ${need}`;
}

class EditorErrorBoundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(err: Error) {
    return { err: err?.stack || String(err) };
  }
  render() {
    if (this.state.err) {
      return (
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          The editor could not load. {this.state.err}
        </p>
      );
    }
    return this.props.children;
  }
}

function EditorInner({
  clientSlug,
  surveyJson,
  siteUrl,
}: {
  clientSlug: string;
  surveyJson: string;
  siteUrl: string;
}) {
  const survey = JSON.parse(surveyJson) as SurveyRow;
  const [def, setDef] = useState<Definition>(() => ({
    schema_version: 1,
    id: survey.slug,
    name: survey.name,
    cadence: survey.cadence,
    status: (survey.status as Definition["status"]) || "Draft",
    intro: (survey.definition as Definition)?.intro ?? null,
    outro: (survey.definition as Definition)?.outro ?? null,
    settings: (() => {
      const incoming = ((survey.definition as Definition)?.settings || survey.settings || {}) as Definition["settings"];
      return {
        require_contact: incoming.require_contact ?? false,
        show_results: incoming.show_results ?? false,
        review_ask: incoming.review_ask ?? false,
        review_links: incoming.review_links ?? {},
      };
    })(),
    questions: ((survey.definition as Definition)?.questions || []).map((q) => ({ ...q })),
    provenance: survey.provenance || (survey.definition as Definition)?.provenance || {
      source: "hand",
      drafted_by: null,
      approved_by: null,
      approved_at: null,
    },
  }));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<"draft" | "publish" | "delete" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [optDraft, setOptDraft] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const { confirm, dialog } = useConfirm();
  const dragIndexRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const progRef = useRef<HTMLSpanElement>(null);
  const chatRef = useRef<{ start: () => void; stop?: () => void; o?: Record<string, unknown> } | null>(null);
  const committedQuestionsRef = useRef(def.questions);
  const shareUrl = `${siteUrl}/s/${survey.publicId}`;
  const statusLabel = def.status === "Active" ? "Published" : def.status || "Draft";
  const statusLive = def.status === "Active";

  function updateQ(i: number, patch: Partial<Question>) {
    setDef((d) => {
      const questions = d.questions.slice();
      questions[i] = { ...questions[i], ...patch };
      return { ...d, questions };
    });
  }

  function setType(i: number, value: string) {
    if (value === "choice+nps") {
      updateQ(i, { type: "choice", nps: true, options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] });
    } else if (value === "number") {
      updateQ(i, { type: "number", nps: false, min: 0, max: 1000, options: undefined });
    } else if (value === "text") {
      updateQ(i, { type: "text", nps: false, options: undefined });
    } else {
      updateQ(i, { type: value as Question["type"], nps: false });
    }
  }

  if (!editingId) committedQuestionsRef.current = def.questions;
  const previewQuestions = editingId ? committedQuestionsRef.current : def.questions;
  const previewKey = useMemo(
    () => JSON.stringify({ questions: previewQuestions, intro: def.intro, outro: def.outro }),
    [previewQuestions, def.intro, def.outro],
  );

  useEffect(() => {
    const log = logRef.current;
    if (!log || !window.SurveyChat) return;
    const script = JSON.parse(previewKey).questions as Question[];
    const intro = def.intro || undefined;
    const outro = def.outro || "That is everything. Thank you.";
    try {
      if (!chatRef.current) {
        chatRef.current = new window.SurveyChat({
          log,
          input: inputRef.current || undefined,
          sendBtn: sendRef.current || undefined,
          progEl: progRef.current || undefined,
          script,
          intro,
          outro,
        });
      } else if (chatRef.current.o) {
        chatRef.current.o.script = script;
        chatRef.current.o.intro = intro;
        chatRef.current.o.outro = outro;
      }
      chatRef.current.start();
    } catch {
      log.innerHTML =
        "<div class='chat-row bot'><span class='chat-av' aria-hidden='true'></span><div class='bub bot'>Preview will show here after the questions are set.</div></div>";
    }
    return () => {
      chatRef.current?.stop?.();
    };
  }, [previewKey, def.intro, def.outro]);

  async function save(publish: boolean) {
    if (busy) return;
    setMsg("");
    setBusy(publish ? "publish" : "draft");
    const next: Definition = {
      ...def,
      status: publish ? "Active" : def.status,
    };
    try {
      const res = await fetch(publish ? `/api/app/surveys/${survey.id}/publish` : `/api/app/surveys/${survey.id}`, {
        method: publish ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientSlug, definition: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Could not save");
        return;
      }
      setDef({
        ...data.survey.definition,
        status: data.survey.status || data.survey.definition.status,
      });
      setMsg(publish ? "Published" : "Draft saved");
      if (publish) setShareOpen(true);
    } finally {
      setBusy(null);
    }
  }

  async function deleteDraft() {
    if (busy) return;
    const ok = await confirm({
      title: def.status === "Draft" ? "Delete draft" : "Delete survey",
      message:
        def.status === "Draft"
          ? `Delete “${def.name}”? This cannot be undone.`
          : `Delete “${def.name}”? The live link will stop working.`,
      confirmLabel: def.status === "Draft" ? "Delete draft" : "Delete survey",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/app/surveys/${survey.id}?client=${encodeURIComponent(clientSlug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setMsg(data?.error || "Could not delete");
        return;
      }
      window.location.href = `/app/${clientSlug}/surveys`;
    } finally {
      setBusy(null);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(
      () => setMsg("Link copied"),
      () => setShareOpen(true),
    );
  }

  function moveQuestion(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setDef((d) => {
      const questions = d.questions.slice();
      if (from >= questions.length) return d;
      const [item] = questions.splice(from, 1);
      const dest = from < to ? to - 1 : to;
      questions.splice(Math.max(0, Math.min(dest, questions.length)), 0, item);
      return { ...d, questions };
    });
  }

  function setDrag(i: number | null) {
    dragIndexRef.current = i;
    setDragIndex(i);
  }
  function setDrop(i: number | null) {
    dropIndexRef.current = i;
    setDropIndex(i);
  }
  function finishDrag() {
    const from = dragIndexRef.current;
    const to = dropIndexRef.current;
    if (from !== null && to !== null) moveQuestion(from, to);
    setDrag(null);
    setDrop(null);
  }
  function showDropSlot(at: number) {
    return dragIndex !== null && dropIndex === at && at !== dragIndex && at !== dragIndex + 1;
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="dark:bg-transparent">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="text-xl text-balance">Questions</CardTitle>
              <CardDescription className="text-pretty">
                The chat asks exactly what you type here. The preview updates when you finish a question.
              </CardDescription>
            </div>
            <Badge
              className={
                statusLive
                  ? "border-transparent bg-[var(--green)] text-black"
                  : undefined
              }
              variant={statusLive ? "default" : "outline"}
            >
              {statusLabel}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <Field>
              <FieldLabel htmlFor="ed-name">Survey name</FieldLabel>
              <Input
                className={fieldInputClass}
                id="ed-name"
                onChange={(e) => setDef({ ...def, name: e.target.value })}
                value={def.name}
              />
            </Field>

            <div
              className="flex flex-col gap-3"
              id="qwrap"
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                finishDrag();
              }}
            >
              {def.questions.map((q, i) => {
                const editing = editingId === q.id;
                const options = (q.type === "choice" || q.type === "multi") && !q.nps ? q.options || [] : [];
                return (
                <div key={q.id}>
                  {showDropSlot(i) ? (
                    <div
                      aria-hidden="true"
                      className="mb-3 h-24 rounded-xl border border-dashed border-border bg-muted/30"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDrop(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        finishDrag();
                      }}
                    />
                  ) : null}
                  <Card
                    className={cn("dark:bg-transparent", dragIndex === i && "opacity-40")}
                    onDragOver={(e) => {
                      if (dragIndex === null) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDrop(e.clientY < rect.top + rect.height / 2 ? i : i + 1);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      finishDrag();
                    }}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <button
                          aria-label="Drag to reorder"
                          className="mt-0.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                          draggable
                          onDragEnd={() => {
                            setDrag(null);
                            setDrop(null);
                          }}
                          onDragStart={(e) => {
                            setDrag(i);
                            setDrop(i);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", String(i));
                          }}
                          type="button"
                        >
                          <GripVertical />
                        </button>
                        <div className="min-w-0">
                          <CardDescription className="text-[11px] uppercase tracking-wide">
                            Question {i + 1}
                          </CardDescription>
                          {!editing ? (
                            <CardTitle className="mt-1 text-base text-pretty">
                              {q.q.trim() || "Untitled question"}
                            </CardTitle>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          onClick={() => setEditingId(editing ? null : q.id)}
                          size="sm"
                          type="button"
                          variant={editing ? "outline" : "ghost"}
                        >
                          {editing ? (
                            <>
                              <Check data-icon="inline-start" />
                              Done
                            </>
                          ) : (
                            <>
                              <Pencil data-icon="inline-start" />
                              Edit
                            </>
                          )}
                        </Button>
                        <Button
                          aria-label="Delete question"
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Delete question",
                              message: "Remove this question from the survey? Save to keep the change.",
                              confirmLabel: "Delete question",
                            });
                            if (!ok) return;
                            if (editingId === q.id) setEditingId(null);
                            setDef((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }));
                          }}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <X />
                        </Button>
                      </div>
                    </CardHeader>
                    {editing ? (
                    <CardContent className="flex flex-col gap-3 pt-3">
                      <Field>
                        <FieldLabel htmlFor={"q-type-" + q.id}>Type</FieldLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value) setType(i, String(value));
                          }}
                          value={typeValue(q)}
                        >
                          <SelectTrigger
                            className="h-10 w-full min-w-0 data-[size=default]:h-10"
                            id={"q-type-" + q.id}
                          >
                            <SelectValue>
                              {TYPES.find((t) => t.value === typeValue(q))?.label}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            align="start"
                            alignItemWithTrigger={false}
                            className="p-1"
                            side="bottom"
                          >
                            {TYPES.map((t) => (
                              <SelectItem className="py-2" key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`q-text-${q.id}`}>Question</FieldLabel>
                        <Textarea
                          className={fieldTextareaClass}
                          id={`q-text-${q.id}`}
                          onChange={(e) => updateQ(i, { q: e.target.value })}
                          placeholder="Question"
                          value={q.q}
                        />
                      </Field>
                      {(q.type === "choice" || q.type === "multi") && !q.nps ? (
                        <Field>
                          <FieldLabel htmlFor={"q-opt-" + q.id}>Options</FieldLabel>
                          <Input
                            className={fieldInputClass}
                            id={"q-opt-" + q.id}
                            onChange={(e) => setOptDraft({ ...optDraft, [q.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const v = (optDraft[q.id] || "").trim();
                                if (!v) return;
                                updateQ(i, { options: [...(q.options || []), v] });
                                setOptDraft({ ...optDraft, [q.id]: "" });
                              }
                            }}
                            placeholder="Add option, press Enter"
                            value={optDraft[q.id] || ""}
                          />
                        </Field>
                      ) : null}
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          checked={isQuestionRequired(q)}
                          className="size-4 accent-primary"
                          id={"q-req-" + q.id}
                          onChange={(e) =>
                            updateQ(i, { required: e.target.checked, optional: !e.target.checked })
                          }
                          type="checkbox"
                        />
                        Required
                      </label>
                      {q.type === "number" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Field>
                            <FieldLabel htmlFor={"q-min-" + q.id}>From</FieldLabel>
                            <Input
                              className={fieldInputClass}
                              id={"q-min-" + q.id}
                              onChange={(e) => updateQ(i, { min: Number(e.target.value) })}
                              type="number"
                              value={q.min ?? 0}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor={"q-max-" + q.id}>To</FieldLabel>
                            <Input
                              className={fieldInputClass}
                              id={"q-max-" + q.id}
                              onChange={(e) => updateQ(i, { max: Number(e.target.value) })}
                              type="number"
                              value={q.max ?? 1000}
                            />
                          </Field>
                        </div>
                      ) : null}
                      {(q.type === "choice" || q.type === "multi") && !q.nps ? (
                        <div className="flex flex-wrap gap-2">
                          {(q.options || []).map((o) => (
                            <Button
                              key={o}
                              onClick={() => updateQ(i, { options: (q.options || []).filter((x) => x !== o) })}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {o}
                              <X data-icon="inline-end" />
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                    ) : (
                    <CardContent className="pt-2 pb-4">
                      <p className="text-muted-foreground text-sm">{fieldSummary(q)}</p>
                      {options.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {options.map((o) => (
                            <span
                              className="rounded-md border border-border px-2 py-0.5 text-muted-foreground text-xs"
                              key={o}
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </CardContent>
                    )}
                  </Card>
                </div>
                );
              })}
              {showDropSlot(def.questions.length) ? (
                <div
                  aria-hidden="true"
                  className="h-24 rounded-xl border border-dashed border-border bg-muted/30"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrop(def.questions.length);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    finishDrag();
                  }}
                />
              ) : null}
            </div>

            <Button
              onClick={() => {
                const id = qid();
                setDef((d) => ({
                  ...d,
                  questions: [...d.questions, { id, type: "choice", q: "", options: [], required: true }],
                }));
                setEditingId(id);
              }}
              type="button"
              variant="outline"
            >
              <Plus data-icon="inline-start" />
              Add question
            </Button>
          </CardContent>
        </Card>

        <Card className="dark:bg-transparent">
          <CardHeader className="border-b">
            <CardTitle className="text-lg text-balance">Before and after the questions</CardTitle>
            <CardDescription className="text-pretty">
              Results and the optional review ask. Name and email come from the HubSpot sign-in form.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Show results on completion</FieldTitle>
                  <FieldDescription>Respondents see the running averages when they finish.</FieldDescription>
                </FieldContent>
                <Switch
                  aria-label="Show results on completion"
                  checked={def.settings.show_results}
                  onCheckedChange={(checked) =>
                    setDef({ ...def, settings: { ...def.settings, show_results: checked } })
                  }
                />
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle>Ask for a review</FieldTitle>
                  <FieldDescription>
                    Shows your review link after the last question, with a maybe later option.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  aria-label="Ask for a review"
                  checked={def.settings.review_ask}
                  onCheckedChange={(checked) =>
                    setDef({ ...def, settings: { ...def.settings, review_ask: checked } })
                  }
                />
              </Field>
              {def.settings.review_ask ? (
                <Field>
                  <FieldLabel htmlFor="ed-review">Review link</FieldLabel>
                  <Input
                    className={fieldInputClass}
                    id="ed-review"
                    onChange={(e) =>
                      setDef({
                        ...def,
                        settings: { ...def.settings, review_links: { google: e.target.value } },
                      })
                    }
                    placeholder="https://g.page/r/…"
                    value={def.settings.review_links.google || Object.values(def.settings.review_links)[0] || ""}
                  />
                </Field>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2" id="ed-foot">
          <Button disabled={!!busy} loading={busy === "publish"} onClick={() => save(true)} type="button">
            {busy === "publish" ? null : <Upload data-icon="inline-start" />}
            Publish
          </Button>
          <Button disabled={!!busy} loading={busy === "draft"} onClick={() => save(false)} type="button" variant="outline">
            {busy === "draft" ? null : <Save data-icon="inline-start" />}
            Save draft
          </Button>
          <span
            className="inline-flex"
            title={def.status === "Draft" ? "Publish the survey to copy its link" : undefined}
          >
            <Button
              disabled={def.status === "Draft"}
              onClick={copyLink}
              type="button"
              variant="ghost"
            >
              <Link2 data-icon="inline-start" />
              Copy link
            </Button>
          </span>
          <span
            className="inline-flex"
            title={def.status === "Draft" ? "Publish the survey to preview it" : undefined}
          >
            <Button
              disabled={def.status === "Draft"}
              nativeButton={def.status !== "Draft" ? false : undefined}
              render={def.status === "Draft" ? undefined : <a href={shareUrl} rel="noopener" target="_blank" />}
              type="button"
              variant="ghost"
            >
              <Eye data-icon="inline-start" />
              Preview
            </Button>
          </span>
          <Button
            disabled={!!busy}
            loading={busy === "delete"}
            onClick={deleteDraft}
            type="button"
            variant="destructive"
          >
            {busy === "delete" ? null : <Trash2 data-icon="inline-start" />}
            {def.status === "Draft" ? "Delete draft" : "Delete survey"}
          </Button>
          {msg ? <span className="text-muted-foreground text-sm">{msg}</span> : null}
        </div>
      </div>

      <Card className="overflow-hidden dark:bg-transparent lg:sticky lg:top-16">
        <CardHeader className="border-b">
          <CardTitle className="text-lg text-balance">Preview</CardTitle>
          <CardDescription className="text-pretty">What a respondent sees as they answer.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="chat-frame border-0 shadow-none">
            <div className="chat-head">
              <div>
                <b>{def.name || "Preview"}</b>
                <img
                  alt="Survey Rocket"
                  className="powered"
                  height="35"
                  src="/assets/landing/survey-rocket.svg"
                  width="140"
                />
              </div>
              <span className="chat-prog" ref={progRef} />
            </div>
            <div className="chat-log min-h-80" id="pv-log" ref={logRef} />
            <div className="chat-input">
              <input
                aria-label="Preview answer"
                autoComplete="off"
                placeholder="Tap an option above"
                ref={inputRef}
                type="text"
              />
              <button className="send" ref={sendRef} type="button">
                Send
              </button>
              <button className="chat-restart" onClick={() => chatRef.current?.start()} type="button">
                Restart
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setShareOpen} open={shareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saved and live</DialogTitle>
            <DialogDescription>
              Send this link to your customers. It always serves the newest version you save.
            </DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupInput readOnly value={shareUrl} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <DialogFooter>
            <Button nativeButton={false} render={<a href={shareUrl} rel="noopener" target="_blank" />} variant="outline">
              Preview
            </Button>
            <Button onClick={() => setShareOpen(false)} type="button" variant="ghost">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </div>
  );
}

export default function Editor(props: {
  clientSlug: string;
  surveyJson: string;
  siteUrl: string;
}) {
  return (
    <EditorErrorBoundary>
      <EditorInner {...props} />
    </EditorErrorBoundary>
  );
}
