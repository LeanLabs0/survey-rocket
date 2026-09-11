import { useEffect, useState } from "react";
import { loadOnboard, saveOnboard } from "../lib/onboard";
import type { ShelfSurvey } from "../lib/access";
import { useConfirm } from "./ConfirmDialog";
import { FeatureCard } from "@/components/feature-section";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Copy,
  Link2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

function statusKind(status: string, responses: number) {
  if (status === "Draft") return "draft";
  if (responses === 0) return "waiting";
  return "live";
}

function statusLabel(kind: string) {
  if (kind === "live") return "Live";
  if (kind === "draft") return "Draft";
  return "Waiting";
}

const taskCardClass = "flex h-full flex-1 cursor-pointer flex-col text-left";

export default function SurveysList({
  clientSlug,
  clientName,
  clientNote,
  siteUrl,
  surveys,
}: {
  clientSlug: string;
  clientName: string;
  clientNote: string;
  siteUrl: string;
  surveys: ShelfSurvey[];
}) {
  const [chooser, setChooser] = useState(false);
  const [list, setList] = useState(surveys);
  const [onb, setOnb] = useState(() => ({
    v: 1 as const,
    tourDone: false,
    dismissedAt: null as string | null,
    views: {} as Record<string, { tipDismissed?: boolean }>,
  }));
  const [copied, setCopied] = useState<string | null>(null);
  const [copyModal, setCopyModal] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const sample = list.find((s) => s.slug === "client-outcomes") || list[0] || null;

  useEffect(() => {
    setOnb(loadOnboard());
  }, []);

  function persist(next: typeof onb) {
    setOnb(next);
    saveOnboard(next);
    window.dispatchEvent(new CustomEvent("sr-onboard-changed"));
  }

  async function createBlank() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/app/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientSlug, name: "Untitled survey" }),
      });
      const data = await res.json();
      if (data.survey?.id) window.location.href = `/app/${clientSlug}/surveys/${data.survey.id}/edit`;
    } finally {
      setCreating(false);
    }
  }

  async function duplicate(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/app/surveys/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientSlug }),
      });
      const data = await res.json();
      const row = data.survey;
      if (!row) return;
      setList((cur) => [
        {
          id: row.id,
          publicId: row.publicId,
          slug: row.slug,
          name: row.name,
          cadence: row.cadence,
          status: row.status,
          questionCount: Array.isArray(row.definition?.questions) ? row.definition.questions.length : 0,
          answers: 0,
        },
        ...cur,
      ]);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: "Delete survey",
      message: `Delete “${name}”? The live link will stop working.`,
      confirmLabel: "Delete survey",
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await fetch(`/api/app/surveys/${id}?client=${encodeURIComponent(clientSlug)}`, { method: "DELETE" });
      setList((cur) => cur.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  function copyLink(publicId: string) {
    const url = `${siteUrl}/s/${publicId}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(publicId);
        setTimeout(() => setCopied((cur) => (cur === publicId ? null : cur)), 2000);
      },
      () => setCopyModal(url),
    );
  }

  function hideFirstRun() {
    persist({ ...onb, dismissedAt: new Date().toISOString() });
  }

  function startTour() {
    window.dispatchEvent(new CustomEvent("sr-start-tour"));
  }

  const showFirstRun = !onb.dismissedAt;
  const liveCount = list.filter((s) => statusKind(s.status, s.answers) === "live").length;
  const waitingCount = list.length - liveCount;

  return (
    <div className="flex flex-col gap-4">
      {showFirstRun ? (
        <Card className="gap-0 pb-0 dark:bg-transparent">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-xl text-balance">Start here</CardTitle>
              <CardDescription className="text-pretty">
                Pick one. Each takes a few minutes.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button onClick={startTour} size="sm" type="button" variant="ghost">
                <Play data-icon="inline-start" />
                Take the tour
              </Button>
              <Button onClick={hideFirstRun} size="sm" type="button" variant="ghost">
                Hide this
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 items-stretch gap-px bg-border sm:grid-cols-3 sm:auto-rows-fr">
              <button
                className="flex h-full min-h-0 flex-col text-left"
                onClick={() => setChooser(true)}
                type="button"
              >
                <FeatureCard
                  className={taskCardClass}
                  feature={{
                    title: "Write a survey",
                    icon: <Pencil />,
                    description: "Type your questions and share a link.",
                  }}
                />
              </button>
              <a className="flex h-full min-h-0 flex-col" href={`/app/${clientSlug}/scan`}>
                <FeatureCard
                  className={taskCardClass}
                  feature={{
                    title: "Scan a page for proof gaps",
                    icon: <Search />,
                    description: "Point it at a page that makes claims. The scan drafts a survey from them.",
                  }}
                />
              </a>
              {sample ? (
                <a className="flex h-full min-h-0 flex-col" href={`/s/${sample.publicId}`} rel="noopener" target="_blank">
                  <FeatureCard
                    className={taskCardClass}
                    feature={{
                      title: "Try the sample survey",
                      icon: <Play />,
                      description: "Answer it yourself and watch Results move.",
                    }}
                  />
                </a>
              ) : (
                <FeatureCard
                  className="h-full opacity-60"
                  feature={{
                    title: "Try the sample survey",
                    icon: <Play />,
                    description: "No sample survey in this portal yet.",
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="dark:bg-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-lg text-balance">Your surveys</CardTitle>
            <CardDescription className="text-pretty">
              {list.length
                ? `${liveCount} live · ${waitingCount} waiting or draft · ${clientName}`
                : `${clientName} · ${clientNote}`}
            </CardDescription>
          </div>
          <Button id="newSurveyBtn" onClick={() => setChooser(true)} type="button">
            <Plus data-icon="inline-start" />
            New survey
          </Button>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {list.length === 0 ? (
            <p className="px-6 pb-4 text-muted-foreground text-sm">
              No surveys yet. Hit New survey to write your first one.
            </p>
          ) : (
            <Table className="border-t">
              <TableCaption className="sr-only">
                Surveys with question counts, answers, and status.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">No</TableHead>
                  <TableHead>Survey</TableHead>
                  <TableHead className="text-end tabular-nums">Answers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s, i) => {
                  const kind = statusKind(s.status, s.answers);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="pl-6 text-muted-foreground tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">{s.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {(s.cadence || "No cadence") + " · " + plural(s.questionCount, "question")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{s.answers}</TableCell>
                      <TableCell>
                        <Badge variant={kind === "live" ? "default" : "outline"}>
                          {statusLabel(kind)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            nativeButton={false}
                            render={<a href={`/app/${clientSlug}/surveys/${s.id}/edit`} />}
                            size="sm"
                            variant="ghost"
                          >
                            <Pencil data-icon="inline-start" />
                            Edit
                          </Button>
                          <Button
                            nativeButton={false}
                            render={<a href={`/app/${clientSlug}/results/${s.id}`} />}
                            size="sm"
                            variant="ghost"
                          >
                            <BarChart3 data-icon="inline-start" />
                            Results
                          </Button>
                          <span
                            className="inline-flex"
                            title={s.status === "Draft" ? "Publish the survey to copy its link" : undefined}
                          >
                            <Button
                              disabled={s.status === "Draft"}
                              onClick={() => copyLink(s.publicId)}
                              size="sm"
                              type="button"
                              variant="ghost"
                            >
                              <Link2 data-icon="inline-start" />
                              {copied === s.publicId ? "Copied" : "Copy link"}
                            </Button>
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  aria-label={`More actions for ${s.name}`}
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-40">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => duplicate(s.id)}>
                                  <Copy />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => remove(s.id, s.name)}
                                  variant="destructive"
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setChooser} open={chooser}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New survey</DialogTitle>
            <DialogDescription>Two ways to start. Both end in the editor.</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              <button className="text-left" disabled={creating} onClick={createBlank} type="button">
                <FeatureCard
                  className={taskCardClass}
                  feature={{
                    title: creating ? "Creating…" : "Write it myself",
                    icon: <Pencil />,
                    description: "Start from a blank survey and type your exact questions.",
                  }}
                />
              </button>
              <button
                className="text-left"
                onClick={() => {
                  window.location.href = `/app/${clientSlug}/scan`;
                }}
                type="button"
              >
                <FeatureCard
                  className={taskCardClass}
                  feature={{
                    title: "Scan a page",
                    icon: <Search />,
                    description:
                      "We read one page of your site and draft a survey for each claim with no proof behind it.",
                  }}
                />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(next) => {
          if (!next) setCopyModal(null);
        }}
        open={!!copyModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy survey link</DialogTitle>
            <DialogDescription>Select the link and copy it.</DialogDescription>
          </DialogHeader>
          {copyModal ? (
            <InputGroup>
              <InputGroupInput
                onFocus={(e) => e.currentTarget.select()}
                readOnly
                value={copyModal}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={() =>
                    navigator.clipboard.writeText(copyModal).then(() => setCopyModal(null))
                  }
                >
                  Copy
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          ) : null}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}
