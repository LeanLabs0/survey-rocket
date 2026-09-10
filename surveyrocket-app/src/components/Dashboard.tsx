import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { formatChartAxisTick, formatChartTooltipDate, formatInteger } from "@/components/formater";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, Copy, Link2, Maximize2, Pencil } from "lucide-react";
import { AnswerList, HubSpotContactLink } from "@/components/respondent-answers";

const PERIODS = [7, 14, 30, 90] as const;
const RESPONDENT_PAGE = 10;
const chartConfig = {
  answers: { label: "Answers", color: "var(--chart-2)" },
} satisfies ChartConfig;

const REVIEW_LABEL: Record<string, string> = {
  not_asked: "Not asked",
  dismissed: "Passed",
  clicked: "Opened review page",
  declined: "Declined",
};

type Pub = {
  big: string;
  sub: string;
  sentence: string;
  surveyName?: string;
  surveyId?: string;
};

type SurveyRow = {
  id: string;
  publicId: string;
  name: string;
  status: string;
  cadence: string | null;
  questionCount: number;
  agg: {
    responses: number;
    this_week: number;
    latest_at: string | null;
    review_asked: number;
    review_clicked: number;
  };
  stats: { ready: number; total: number; pubs: Pub[] };
};

type Series = { days: number; items: { surveyId: string; name: string; count: number }[] };
type DaySeries = { days: number; total: number; items: { date: string; count: number }[] };

type DashData = {
  total: number;
  week: number;
  clicked: number;
  asked: number;
  verified: Pub[];
  surveys: SurveyRow[];
  bySurvey: Series;
  byDay: DaySeries;
};

type Respondent = {
  id: string;
  name: string | null;
  email: string | null;
  submittedAt: string;
  country: string | null;
  reviewOutcome: string;
  hubspotUrl: string | null;
  answers: Array<{
    questionKey: string;
    questionText: string | null;
    type: string;
    nps?: boolean;
    valueText: string | null;
    valueNumber: number | null;
    valueList: string[] | null;
    skipped: boolean;
  }>;
};

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

function readyPct(ready: number, total: number) {
  return total ? Math.round((ready / total) * 100) : 0;
}

function surveyLink(publicId: string) {
  return `${window.location.origin}/s/${publicId}`;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function PeriodToggles({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (days: number) => void;
  label: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      className="shrink-0"
      onValueChange={(next) => {
        const raw = Array.isArray(next) ? next[0] : next;
        const days = Number(raw);
        if ((PERIODS as readonly number[]).includes(days)) onChange(days);
      }}
      size="sm"
      spacing={0}
      value={[String(value)]}
      variant="outline"
    >
      {PERIODS.map((days) => (
        <ToggleGroupItem key={days} value={String(days)}>
          {days}d
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function ExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="ml-auto flex size-7 shrink-0 items-center justify-center"
      onClick={onClick}
      size="icon-sm"
      title="Expand chart"
      type="button"
      variant="outline"
    >
      <Maximize2 className="size-3.5" />
      <span className="sr-only">Expand chart</span>
    </Button>
  );
}

function ProgressMeter({ ready, total }: { ready: number; total: number }) {
  const pct = readyPct(ready, total);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-chart-2" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">{total ? `${pct}%` : "—"}</span>
    </div>
  );
}

function PubCard({ pub, clientSlug }: { pub: Pub; clientSlug: string }) {
  const [copied, setCopied] = useState(false);
  const surveyId = pub.surveyId;
  const surveyName = pub.surveyName || "Survey";

  return (
    <Card className="h-full dark:bg-transparent" size="sm">
      <CardHeader className="flex-1">
        <CardTitle className="text-4xl font-semibold tracking-tight tabular-nums group-data-[size=sm]/card:text-4xl">
          {pub.big}
        </CardTitle>
        <CardDescription className="text-pretty">{pub.sub}</CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto justify-between gap-2">
        {surveyId ? (
          <Button
            className="min-w-0 px-0"
            nativeButton={false}
            render={<a href={`/app/${clientSlug}/results/${surveyId}`} />}
            size="sm"
            title="See the answers behind this number"
            variant="link"
          >
            <BarChart3 data-icon="inline-start" />
            <span className="truncate">{surveyName}</span>
          </Button>
        ) : (
          <span className="truncate text-muted-foreground text-xs">{surveyName}</span>
        )}
        <Button
          onClick={() => {
            copyText(pub.sentence).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              },
              () => window.prompt("Copy this:", pub.sentence),
            );
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Copy data-icon="inline-start" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function MetallicBar({
  fillId,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
}: {
  fillId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  if (width <= 0 || height <= 0) return null;
  return (
    <g>
      <rect fill={`url(#${fillId})`} height={height} rx={3} ry={3} width={width} x={x} y={y} />
      <rect fill="var(--color-answers)" height={2} width={width} x={x} y={y} />
    </g>
  );
}

function SurveyBars({ items, className }: { items: Series["items"]; className?: string }) {
  const gradientId = `answers-bar-${useId().replace(/:/g, "")}`;
  const data = items.map((row) => ({ name: row.name, answers: row.count }));
  return (
    <ChartContainer className={className ?? "aspect-auto h-60 w-full"} config={chartConfig}>
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="var(--color-answers)" stopOpacity={0.12} />
            <stop offset="55%" stopColor="var(--color-answers)" stopOpacity={0.38} />
            <stop offset="100%" stopColor="var(--color-answers)" stopOpacity={0.78} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="name"
          interval={0}
          tickFormatter={(value) => {
            const label = String(value);
            return label.length > 14 ? `${label.slice(0, 14)}…` : label;
          }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickFormatter={(value) => formatInteger(Number(value))}
          tickLine={false}
          width={36}
        />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dashed" />}
          cursor={{ fill: "color-mix(in oklab, var(--color-answers) 12%, transparent)" }}
          wrapperStyle={{ outline: "none" }}
        />
        <Bar
          dataKey="answers"
          maxBarSize={56}
          name="Answers"
          shape={(props) => <MetallicBar fillId={gradientId} {...props} />}
        />
      </BarChart>
    </ChartContainer>
  );
}

function DayArea({
  items,
  days,
  className,
}: {
  items: DaySeries["items"];
  days: number;
  className?: string;
}) {
  const gradientId = `answers-area-${useId().replace(/:/g, "")}`;
  const data = items.map((row) => ({ date: row.date, answers: row.count }));
  return (
    <ChartContainer className={className ?? "aspect-auto h-60 w-full"} config={chartConfig}>
      <AreaChart accessibilityLayer data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-answers)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-answers)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="date"
          tickFormatter={(value) => formatChartAxisTick(String(value), days)}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickFormatter={(value) => formatInteger(Number(value))}
          tickLine={false}
          width={36}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="dashed"
              labelFormatter={(value) => formatChartTooltipDate(String(value))}
            />
          }
          cursor={{ stroke: "var(--color-answers)", strokeDasharray: "3 3" }}
          wrapperStyle={{ outline: "none" }}
        />
        <Area
          dataKey="answers"
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
          name="Answers"
          stroke="var(--color-answers)"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export default function Dashboard({
  clientSlug,
  initialData = null,
}: {
  clientSlug: string;
  initialData?: DashData | null;
}) {
  const [data, setData] = useState<DashData | null>(initialData);
  const [surveyDays, setSurveyDays] = useState(30);
  const [seriesDays, setSeriesDays] = useState(7);
  const [open, setOpen] = useState<SurveyRow | null>(null);
  const [openIdx, setOpenIdx] = useState(0);
  const [latest, setLatest] = useState<Respondent[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(RESPONDENT_PAGE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [expandSurvey, setExpandSurvey] = useState(false);
  const [expandDays, setExpandDays] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const skipInitialFetch = useRef(Boolean(initialData));

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    const ac = new AbortController();
    fetch(
      `/api/app/aggregates?client=${encodeURIComponent(clientSlug)}&surveyDays=${surveyDays}&seriesDays=${seriesDays}`,
      { signal: ac.signal },
    )
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error || "Could not load dashboard numbers.");
        return body as DashData;
      })
      .then((next) => {
        setData((prev) => {
          if (!prev) return next;
          return { ...prev, bySurvey: next.bySurvey, byDay: next.byDay };
        });
        setLoadError(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "Could not load dashboard numbers.");
      });
    return () => ac.abort();
  }, [clientSlug, surveyDays, seriesDays]);

  useEffect(() => {
    if (!open) {
      setLatest([]);
      setLatestLoading(false);
      setVisibleCount(RESPONDENT_PAGE);
      setExpandedId(null);
      setLinkCopied(false);
      return;
    }
    const ac = new AbortController();
    setLatest([]);
    setLatestLoading(true);
    fetch(`/api/app/respondents?client=${encodeURIComponent(clientSlug)}&survey=${open.id}`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        setLatest(d.respondents || []);
        setLatestLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLatest([]);
        setLatestLoading(false);
      });
    return () => ac.abort();
  }, [open, clientSlug]);

  if (loadError) {
    return <p className="text-muted-foreground text-sm">{loadError}</p>;
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card className="dark:bg-transparent" key={i}>
            <CardHeader className="border-b">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-28" />
            </CardHeader>
          </Card>
        ))}
        <Card className="md:col-span-2 lg:col-span-3 dark:bg-transparent">
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data.surveys.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No surveys yet. Head to Surveys and create your first one.
      </p>
    );
  }

  const liveCount = data.surveys.filter((s) => statusKind(s.status, s.agg.responses) === "live").length;
  const waitingCount = data.surveys.length - liveCount;
  const openKind = open ? statusKind(open.status, open.agg.responses) : "waiting";
  const visible = latest.slice(0, visibleCount);
  const surveyChartItems = data.bySurvey?.items || [];
  const dayItems = data.byDay?.items || [];
  const dayTotal = data.byDay?.total ?? data.week;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
      <Card className="lg:col-span-6 dark:bg-transparent">
        <CardHeader className="border-b">
          <CardTitle className="text-xl text-balance">Overview</CardTitle>
          <CardDescription className="text-pretty">
            Across every survey: what came in, and what you can publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-6 sm:grid-cols-3">
            <li className="flex flex-col gap-1">
              <p className="text-pretty font-medium text-sm">Answers</p>
              <p className="text-pretty text-muted-foreground text-xs">
                Across {plural(data.surveys.length, "survey")}
              </p>
              <p className="text-balance font-semibold text-2xl tabular-nums">
                {formatInteger(data.total)}
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="text-pretty font-medium text-sm">This week</p>
              <p className="text-pretty text-muted-foreground text-xs">
                Answers in the last seven days
              </p>
              <p className="text-balance font-semibold text-2xl tabular-nums">
                {formatInteger(data.week)}
              </p>
            </li>
            <li className="flex flex-col gap-1">
              <p className="text-pretty font-medium text-sm">Review clicks</p>
              <p className="text-pretty text-muted-foreground text-xs">
                {data.asked ? `Of ${plural(data.asked, "review ask")}` : "No review asks yet"}
              </p>
              <p className="text-balance font-semibold text-2xl tabular-nums">
                {formatInteger(data.clicked)}
              </p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 dark:bg-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-lg text-balance">Answers across surveys</CardTitle>
            <CardDescription className="text-pretty">
              Count of answers by survey, last {surveyDays} days.
            </CardDescription>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <PeriodToggles label="Survey chart period" onChange={setSurveyDays} value={surveyDays} />
            <ExpandButton onClick={() => setExpandSurvey(true)} />
          </div>
        </CardHeader>
        <CardContent>
          {surveyChartItems.length ? (
            <SurveyBars items={surveyChartItems} />
          ) : (
            <p className="text-muted-foreground text-sm">No surveys to plot yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 dark:bg-transparent">
        <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle className="text-lg text-balance">Answers over time</CardTitle>
            <CardDescription className="text-pretty">
              {formatInteger(dayTotal)} in the last {seriesDays} days.
            </CardDescription>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <PeriodToggles label="Time series period" onChange={setSeriesDays} value={seriesDays} />
            <ExpandButton onClick={() => setExpandDays(true)} />
          </div>
        </CardHeader>
        <CardContent>
          <DayArea days={seriesDays} items={dayItems} />
        </CardContent>
      </Card>

      <Card className="pb-6 has-data-[slot=card-footer]:pb-6 lg:col-span-6 dark:bg-transparent">
        <CardHeader className="border-b">
          <CardTitle className="text-xl text-balance">Verified stats</CardTitle>
          <CardDescription className="text-pretty">
            Every number here comes from real answers, at least three per question. The survey under
            each one is the proof; click it to see the answers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.verified.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No verified stats yet. A question needs three answers before its number counts. Share a
              survey link to get there.
            </p>
          ) : (
            <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.verified.map((pb) => (
                <li className="h-full min-h-0" key={pb.sentence}>
                  <PubCard clientSlug={clientSlug} pub={pb} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="relative lg:col-span-6 dark:bg-transparent">
        <CardHeader>
          <CardTitle className="text-lg text-balance">Your surveys</CardTitle>
          <CardDescription className="text-pretty">
            {liveCount} live · {waitingCount} waiting or draft
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          <Table className="border-t">
            <TableCaption className="sr-only">
              Surveys with answer counts, latest response, and publish-ready progress.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">No</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead className="text-end tabular-nums">Answers</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>Publish-ready</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.surveys.map((sv, i) => {
                const kind = statusKind(sv.status, sv.agg.responses);
                return (
                  <TableRow
                    className="cursor-pointer"
                    key={sv.id}
                    onClick={() => {
                      setOpenIdx(i);
                      setOpen(sv);
                    }}
                  >
                    <TableCell className="pl-6 text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{sv.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {(sv.cadence || "No cadence") + " · " + plural(sv.questionCount, "question")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatInteger(sv.agg.responses)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sv.agg.latest_at ? sv.agg.latest_at.slice(0, 10) : "—"}
                    </TableCell>
                    <TableCell>
                      <ProgressMeter ready={sv.stats.ready} total={sv.stats.total} />
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge variant={kind === "live" ? "default" : "outline"}>
                        {statusLabel(kind)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        open={!!open}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          {open ? (
            <>
              <DialogHeader className="gap-0 border-b px-4 py-3 pr-12">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] leading-none text-muted-foreground tabular-nums">
                      {String(openIdx + 1).padStart(2, "0")}
                    </p>
                    <DialogTitle className="mt-0.5 text-lg leading-none text-balance">
                      {open.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-1.5 leading-none">
                      <Badge variant={openKind === "live" ? "default" : "outline"}>
                        {statusLabel(openKind)}
                      </Badge>
                      <span>
                        {(open.cadence || "No cadence") + " · " + plural(open.questionCount, "question")}
                      </span>
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex"
                      title={open.status === "Draft" ? "Publish the survey to copy its link" : undefined}
                    >
                      <Button
                        disabled={open.status === "Draft"}
                        onClick={() => {
                          copyText(surveyLink(open.publicId)).then(() => {
                            setLinkCopied(true);
                            window.setTimeout(() => setLinkCopied(false), 2000);
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Link2 data-icon="inline-start" />
                        {linkCopied ? "Copied" : "Copy link"}
                      </Button>
                    </span>
                    <Button
                      nativeButton={false}
                      render={<a href={`/app/${clientSlug}/surveys/${open.id}/edit`} />}
                      size="sm"
                      variant="outline"
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                    <Button
                      nativeButton={false}
                      render={<a href={`/app/${clientSlug}/results/${open.id}`} />}
                      size="sm"
                      variant="outline"
                    >
                      <BarChart3 data-icon="inline-start" />
                      Results
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex flex-col gap-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
                  <Card className="h-full dark:bg-transparent" size="sm">
                    <CardHeader className="gap-1">
                      <CardDescription>Answers</CardDescription>
                      <CardTitle className="text-xl font-semibold tabular-nums">
                        {formatInteger(open.agg.responses)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="h-full dark:bg-transparent" size="sm">
                    <CardHeader className="gap-1">
                      <CardDescription>This week</CardDescription>
                      <CardTitle className="text-xl font-semibold tabular-nums">
                        {formatInteger(open.agg.this_week)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="h-full dark:bg-transparent" size="sm">
                    <CardHeader className="gap-1">
                      <CardDescription>Review clicks</CardDescription>
                      <CardTitle className="text-xl font-semibold tabular-nums">
                        {open.agg.review_asked
                          ? `${open.agg.review_clicked} of ${open.agg.review_asked}`
                          : "—"}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="h-full dark:bg-transparent" size="sm">
                    <CardHeader className="gap-1">
                      <CardDescription>Publish-ready</CardDescription>
                      <CardTitle className="flex min-h-7 items-center">
                        <ProgressMeter ready={open.stats.ready} total={open.stats.total} />
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <div>
                  <p className="mb-2 font-medium text-base">Numbers you can publish</p>
                  {open.stats.pubs.length ? (
                    <ul className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {open.stats.pubs.map((pb) => (
                        <li className="h-full min-h-0" key={pb.sentence}>
                          <PubCard
                            clientSlug={clientSlug}
                            pub={{ ...pb, surveyId: open.id, surveyName: open.name }}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {open.agg.responses
                        ? "Three answers to a question is enough to start. Keep sharing the link."
                        : "No answers yet. Copy the link and send it to one customer."}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-2 font-medium text-base">Respondents</p>
                  {latestLoading ? (
                    <Table aria-busy="true" className="border-t">
                      <TableCaption className="sr-only">Loading respondents</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>When</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Review</TableHead>
                          <TableHead>HubSpot</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <TableRow className="hover:bg-transparent" key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-36" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-14" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : latest.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No respondents yet.</p>
                  ) : (
                    <>
                      <Table className="border-t">
                        <TableCaption className="sr-only">
                          Respondents for this survey. Click a row to see answers.
                        </TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>When</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Review</TableHead>
                            <TableHead>HubSpot</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.map((r) => (
                            <Fragment key={r.id}>
                              <TableRow
                                className="cursor-pointer"
                                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                              >
                                <TableCell>{formatWhen(r.submittedAt)}</TableCell>
                                <TableCell className="font-medium">{r.name || "Anonymous"}</TableCell>
                                <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                                <TableCell>{r.country || "—"}</TableCell>
                                <TableCell>
                                  {REVIEW_LABEL[r.reviewOutcome] || r.reviewOutcome || "Not asked"}
                                </TableCell>
                                <TableCell>
                                  <HubSpotContactLink href={r.hubspotUrl} />
                                </TableCell>
                              </TableRow>
                              {expandedId === r.id ? (
                                <TableRow>
                                  <TableCell className="bg-muted/40 whitespace-normal px-4 py-4" colSpan={6}>
                                    <AnswerList answers={r.answers} />
                                  </TableCell>
                                </TableRow>
                              ) : null}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                      {visibleCount < latest.length ? (
                        <Button
                          className="mt-2"
                          onClick={() => setVisibleCount((n) => n + RESPONDENT_PAGE)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          View more ({latest.length - visibleCount} remaining)
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setExpandSurvey} open={expandSurvey}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Answers across surveys</DialogTitle>
            <DialogDescription>
              Count of answers by survey, last {surveyDays} days.
            </DialogDescription>
          </DialogHeader>
          <PeriodToggles label="Survey chart period" onChange={setSurveyDays} value={surveyDays} />
          <SurveyBars className="aspect-auto h-[420px] w-full" items={surveyChartItems} />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setExpandDays} open={expandDays}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Answers over time</DialogTitle>
            <DialogDescription>
              {formatInteger(dayTotal)} answers in the last {seriesDays} days.
            </DialogDescription>
          </DialogHeader>
          <PeriodToggles label="Time series period" onChange={setSeriesDays} value={seriesDays} />
          <DayArea className="aspect-auto h-[420px] w-full" days={seriesDays} items={dayItems} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
