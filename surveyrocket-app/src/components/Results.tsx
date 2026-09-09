import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatInteger } from "@/components/formater";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

type Answer = {
  questionKey: string;
  questionText: string | null;
  type: string;
  valueText: string | null;
  valueNumber: number | null;
  valueList: string[] | null;
  skipped: boolean;
};
type Row = {
  id: string;
  name: string | null;
  email: string | null;
  submittedAt: string;
  country: string | null;
  reviewOutcome: string;
  hubspotUrl: string | null;
  answers: Answer[];
};
type QDef = {
  id: string;
  q: string;
  type: string;
  nps?: boolean;
  options?: string[];
};
type QAgg = {
  question: string;
  type: string;
  nps: boolean;
  answers: number;
  average: number | null;
  choices: Record<string, number> | null;
  texts: string[];
};
type Agg = {
  responses: number;
  this_week: number;
  questions: Record<string, QAgg>;
};

type GraphResult = {
  id: string;
  title: string;
  kind: "bars" | "rating" | "number";
  kindLabel: string;
  answers: number;
  subtitle: string;
  items: { name: string; answers: number }[];
  average: number | null;
  nps: number | null;
};

const REVIEW_LABEL: Record<string, string> = {
  not_asked: "Not asked",
  dismissed: "Passed",
  clicked: "Opened review page",
  declined: "Declined",
};

const chartConfig = {
  answers: { label: "Answers", color: "var(--chart-2)" },
} satisfies ChartConfig;

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

function npsMeta(choices: Record<string, number> | null) {
  if (!choices) return null;
  let prom = 0,
    det = 0,
    tot = 0;
  for (const [k, c] of Object.entries(choices)) {
    const v = parseInt(k, 10);
    if (Number.isNaN(v)) continue;
    tot += c;
    if (v >= 9) prom += c;
    else if (v < 7) det += c;
  }
  if (!tot) return null;
  return { score: Math.round(((prom - det) / tot) * 100), tot };
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

function answerDisplay(a: Answer) {
  if (a.skipped) return "skipped";
  if (a.valueList?.length) return a.valueList.join(", ");
  if (a.valueText) return a.valueText;
  if (a.valueNumber !== null && a.valueNumber !== undefined) return String(a.valueNumber);
  return "—";
}

function orderedQuestions(def: QDef[], agg: Agg): QDef[] {
  const seen = new Set(def.map((q) => q.id));
  const extra = Object.entries(agg.questions)
    .filter(([id]) => !seen.has(id))
    .map(([id, q]) => ({
      id,
      q: q.question,
      type: q.type,
      nps: q.nps,
      options: q.choices ? Object.keys(q.choices) : [],
    }));
  return [...def, ...extra];
}

function SurveyPicker({
  surveys,
  surveyId,
  clientSlug,
}: {
  surveys: { id: string; name: string }[];
  surveyId: string;
  clientSlug: string;
}) {
  const selected = surveys.find((s) => s.id === surveyId);

  return (
    <Field className="max-w-xl">
      <FieldLabel htmlFor="surveyPick">Survey</FieldLabel>
      <Select
        onValueChange={(value) => {
          if (!value || value === surveyId) return;
          window.location.assign(`/app/${clientSlug}/results/${value}`);
        }}
        value={surveyId}
      >
        <SelectTrigger
          className="h-10 w-full min-w-0 data-[size=default]:h-10"
          id="surveyPick"
        >
          <SelectValue>{selected?.name || "Select a survey"}</SelectValue>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} className="p-1" side="bottom">
          {surveys.map((s) => (
            <SelectItem className="py-2" key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function MetallicBar({
  fillId,
  scale = false,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
}: {
  fillId: string;
  scale?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  if (width <= 0 || height <= 0) return null;
  return (
    <g>
      <rect fill={`url(#${fillId})`} height={height} rx={3} ry={3} width={width} x={x} y={y} />
      {scale ? (
        <rect fill="var(--color-answers)" height={2} width={width} x={x} y={y} />
      ) : (
        <rect fill="var(--color-answers)" height={height} width={2} x={x + width - 2} y={y} />
      )}
    </g>
  );
}

function ChoiceBars({
  items,
  variant = "options",
}: {
  items: { name: string; answers: number }[];
  variant?: "options" | "scale";
}) {
  const gradientId = `choice-bar-${useId().replace(/:/g, "")}`;
  const scale = variant === "scale";
  return (
    <ChartContainer className="aspect-auto h-60 w-full" config={chartConfig}>
      <BarChart
        accessibilityLayer
        data={items}
        layout={scale ? "horizontal" : "vertical"}
        margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1={scale ? "0" : "0"}
            x2={scale ? "0" : "1"}
            y1={scale ? "1" : "0"}
            y2={scale ? "0" : "0"}
          >
            <stop offset="0%" stopColor="var(--color-answers)" stopOpacity={0.12} />
            <stop offset="55%" stopColor="var(--color-answers)" stopOpacity={0.38} />
            <stop offset="100%" stopColor="var(--color-answers)" stopOpacity={0.78} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={!scale} horizontal={scale} />
        {scale ? (
          <>
            <XAxis axisLine={false} dataKey="name" tickLine={false} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value) => formatInteger(Number(value))}
              tickLine={false}
              width={28}
            />
          </>
        ) : (
          <>
            <XAxis
              allowDecimals={false}
              axisLine={false}
              tickFormatter={(value) => formatInteger(Number(value))}
              tickLine={false}
              type="number"
            />
            <YAxis
              axisLine={false}
              dataKey="name"
              tickFormatter={(value) => {
                const label = String(value);
                return label.length > 22 ? `${label.slice(0, 22)}…` : label;
              }}
              tickLine={false}
              tickMargin={8}
              type="category"
              width={128}
            />
          </>
        )}
        <ChartTooltip
          content={<ChartTooltipContent indicator="dashed" />}
          cursor={{ fill: "color-mix(in oklab, var(--color-answers) 12%, transparent)" }}
          wrapperStyle={{ outline: "none" }}
        />
        <Bar
          dataKey="answers"
          maxBarSize={scale ? 28 : 22}
          name="Answers"
          radius={scale ? [4, 4, 0, 0] : [0, 4, 4, 0]}
          shape={(props) => <MetallicBar fillId={gradientId} scale={scale} {...props} />}
        />
      </BarChart>
    </ChartContainer>
  );
}

function GraphCard({ result }: { result: GraphResult }) {
  return (
    <Card className="flex h-[26rem] w-[min(100%,28rem)] shrink-0 flex-col border border-foreground/10 ring-0 dark:bg-transparent">
      <CardHeader className="border-b">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{result.kindLabel}</p>
        <CardTitle className="line-clamp-2 min-h-12 text-lg text-balance">{result.title}</CardTitle>
        <CardDescription className="line-clamp-2 min-h-10 text-pretty">{result.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end overflow-hidden pt-4">
        {result.kind === "number" && result.average !== null && result.items.length === 0 ? (
          <div className="flex h-60 flex-col justify-center gap-1">
            <p className="font-semibold text-4xl tabular-nums tracking-tight">
              {formatInteger(Math.round(result.average))}
            </p>
            <p className="text-muted-foreground text-sm">Average · {plural(result.answers, "answer")}</p>
          </div>
        ) : (
          <ChoiceBars items={result.items} variant={result.kind === "rating" ? "scale" : "options"} />
        )}
      </CardContent>
    </Card>
  );
}

function ChartArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Button
      aria-label={dir === "prev" ? "Previous charts" : "Next charts"}
      className="size-8 border-[var(--ll-border)] text-foreground hover:border-[var(--green)] hover:text-[var(--green)] disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
      size="icon"
      type="button"
      variant="outline"
    >
      <Icon className="size-4" />
    </Button>
  );
}

function ChartRow({ results }: { results: GraphResult[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function update() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    const drag = { pointerId: -1, startX: 0, startScroll: 0, moved: false };

    function setDragging(on: boolean) {
      el.dataset.dragging = on ? "true" : "false";
    }

    function onScroll() {
      update();
    }

    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    function onPointerDown(e: globalThis.PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag.pointerId = e.pointerId;
      drag.startX = e.clientX;
      drag.startScroll = el.scrollLeft;
      drag.moved = false;
      el.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: globalThis.PointerEvent) {
      if (drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(dx) < 4) return;
      drag.moved = true;
      setDragging(true);
      el.scrollLeft = drag.startScroll - dx;
    }

    function onPointerUp(e: globalThis.PointerEvent) {
      if (drag.pointerId !== e.pointerId) return;
      drag.pointerId = -1;
      setDragging(false);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }

    function onDragStart(e: DragEvent) {
      e.preventDefault();
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("dragstart", onDragStart);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("dragstart", onDragStart);
      ro.disconnect();
    };
  }, [results]);

  function scroll(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector("[data-slot=card]");
    const gap = 16;
    const step = card ? card.getBoundingClientRect().width + gap : Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <ChartArrow dir="prev" disabled={!canLeft} onClick={() => scroll(-1)} />
        <ChartArrow dir="next" disabled={!canRight} onClick={() => scroll(1)} />
      </div>
      <div
        className="cursor-grab overflow-x-auto overflow-y-hidden p-px select-none overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden data-[dragging=true]:cursor-grabbing"
        ref={scrollerRef}
      >
        <div className="flex items-stretch gap-4">
          {results.map((result) => (
            <GraphCard key={result.id} result={result} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="dark:bg-transparent">
        <CardHeader className="border-b">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <ul className="grid gap-6 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <li className="flex flex-col gap-2" key={i}>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-16" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card className="dark:bg-transparent">
        <CardHeader className="border-b">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function Results({
  clientSlug,
  surveyId,
  surveys,
}: {
  clientSlug: string;
  surveyId: string;
  surveys: { id: string; name: string }[];
}) {
  const [agg, setAgg] = useState<Agg | null>(null);
  const [questions, setQuestions] = useState<QDef[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setAgg(null);
    setRows([]);
    setRowsLoading(true);
    setError(null);
    fetch(`/api/app/aggregates?client=${encodeURIComponent(clientSlug)}&survey=${surveyId}`, {
      signal: ac.signal,
    })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error || "Could not load results.");
        return body;
      })
      .then((d) => {
        setAgg(d.agg);
        const qs = (d.survey?.definition as { questions?: QDef[] } | undefined)?.questions || [];
        setQuestions(qs);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load results.");
      });
    fetch(`/api/app/respondents?client=${encodeURIComponent(clientSlug)}&survey=${surveyId}`, {
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => setRows(d.respondents || []))
      .catch(() => {
        if (!ac.signal.aborted) setRows([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setRowsLoading(false);
      });
    return () => ac.abort();
  }, [clientSlug, surveyId]);

  const ordered = agg ? orderedQuestions(questions, agg) : [];

  const tiles = useMemo(() => {
    if (!agg) return [];
    return [
      {
        key: "answers",
        label: "Answers",
        value: formatInteger(agg.responses),
        src: "Everyone who finished the survey",
      },
      {
        key: "week",
        label: "This week",
        value: formatInteger(agg.this_week),
        src: "Answers in the last seven days",
      },
    ];
  }, [agg]);

  const graphResults = useMemo(() => {
    if (!agg) return [] as GraphResult[];
    return ordered.flatMap((q) => {
      const a = agg.questions[q.id];
      if (!a) return [];
      if (q.type === "text" || a.type === "text") return [];

      const title = q.q || a.question;
      if (q.nps || a.nps) {
        const n = npsMeta(a.choices);
        const options = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
        for (const k of Object.keys(a.choices || {})) {
          if (!options.includes(k)) options.push(k);
        }
        const items = options.map((name) => ({ name, answers: a.choices?.[name] || 0 }));
        if (!items.some((it) => it.answers > 0)) return [];
        return [
          {
            id: q.id,
            title,
            kind: "rating" as const,
            kindLabel: "Rating 0 to 10",
            answers: a.answers,
            subtitle: n
              ? `NPS ${n.score} · ${plural(a.answers, "answer")}`
              : plural(a.answers, "answer"),
            items,
            average: a.average,
            nps: n?.score ?? null,
          },
        ];
      }

      if (q.type === "number" || a.type === "number") {
        const values = rows.flatMap((r) => {
          const ans = r.answers.find((x) => x.questionKey === q.id);
          if (!ans || ans.skipped || ans.valueNumber === null || ans.valueNumber === undefined) return [];
          return [ans.valueNumber];
        });
        let items: { name: string; answers: number }[] = [];
        if (values.length) {
          const min = Math.min(...values);
          const max = Math.max(...values);
          if (min === max) {
            items = [{ name: formatInteger(min), answers: values.length }];
          } else {
            const buckets = 5;
            const size = (max - min) / buckets;
            const counts = Array.from({ length: buckets }, () => 0);
            for (const v of values) {
              counts[Math.min(buckets - 1, Math.floor((v - min) / size))] += 1;
            }
            items = counts.map((count, i) => {
              const from = Math.round(min + i * size);
              const to = Math.round(min + (i + 1) * size);
              return { name: `${formatInteger(from)}–${formatInteger(to)}`, answers: count };
            });
          }
        }
        if (a.average === null && !items.length) return [];
        return [
          {
            id: q.id,
            title,
            kind: "number" as const,
            kindLabel: "Number",
            answers: a.answers,
            subtitle:
              a.average !== null
                ? `Average ${formatInteger(Math.round(a.average))} · ${plural(a.answers, "answer")}`
                : plural(a.answers, "answer"),
            items,
            average: a.average,
            nps: null,
          },
        ];
      }

      const isBars = q.type === "choice" || q.type === "multi" || a.type === "choice" || a.type === "multi";
      if (!isBars || !a.choices) return [];
      const options = [...(q.options || [])];
      for (const k of Object.keys(a.choices)) {
        if (!options.includes(k)) options.push(k);
      }
      const answered = options.reduce((n, o) => n + (a.choices![o] || 0), 0);
      if (!answered) return [];
      return [
        {
          id: q.id,
          title,
          kind: "bars" as const,
          kindLabel: q.type === "multi" || a.type === "multi" ? "Pick several" : "Multiple choice",
          answers: a.answers || answered,
          subtitle: plural(a.answers || answered, "answer"),
          items: options.map((name) => ({ name, answers: a.choices![name] || 0 })),
          average: null,
          nps: null,
        },
      ];
    });
  }, [agg, ordered, rows]);

  const openTextCounts = useMemo(() => {
    if (!agg) return [];
    return ordered.flatMap((q) => {
      const a = agg.questions[q.id];
      if (q.type !== "text" && a?.type !== "text") return [];
      if (q.nps || a?.nps) return [];
      const count = rows.reduce((n, r) => {
        const ans = r.answers.find((x) => x.questionKey === q.id);
        if (!ans || ans.skipped) return n;
        const v = (ans.valueText || "").trim();
        return v ? n + 1 : n;
      }, 0);
      const fallback = a?.answers || 0;
      return [
        {
          id: q.id,
          question: q.q || a?.question || q.id,
          count: rows.length ? count : fallback,
        },
      ];
    });
  }, [agg, ordered, rows]);

  return (
    <div className="flex flex-col gap-4">
      <SurveyPicker clientSlug={clientSlug} surveyId={surveyId} surveys={surveys} />
      {error ? <p className="text-muted-foreground text-sm">{error}</p> : null}
      {!error && !agg ? <ResultsSkeleton /> : null}
      {agg && agg.responses === 0 ? (
        <Card className="dark:bg-transparent">
          <CardHeader>
            <CardTitle className="text-lg">No answers yet</CardTitle>
            <CardDescription className="text-pretty">
              Copy this survey’s share link in the editor and send it to one customer.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      {agg && agg.responses > 0 ? (
        <>
          <Card className="dark:bg-transparent">
            <CardHeader className="border-b">
              <CardTitle className="text-xl text-balance">Overview</CardTitle>
              <CardDescription className="text-pretty">
                Totals for this survey. Choice, number, and rating breakdowns sit in the row below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map((t) => (
                  <li className="flex min-w-0 flex-col gap-1" key={t.key} title={t.label}>
                    <p className="text-pretty font-medium text-sm">{t.label}</p>
                    <p className="text-pretty text-muted-foreground text-xs">{t.src}</p>
                    <p className="text-balance font-semibold text-3xl tabular-nums tracking-tight">{t.value}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {graphResults.length ? <ChartRow results={graphResults} /> : null}

          {openTextCounts.length ? (
            <Card className="dark:bg-transparent">
              <CardHeader className="border-b">
                <CardTitle className="text-lg text-balance">Open text response counts</CardTitle>
                <CardDescription className="text-pretty">
                  How many people wrote an answer for each open-text question on this survey. Read
                  the wording in every answer below.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <Table>
                  <TableCaption className="sr-only">
                    Count of written answers for each open-text question.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Question</TableHead>
                      <TableHead className="pr-6 text-end">Responses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openTextCounts.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="pl-6 text-pretty">{row.question}</TableCell>
                        <TableCell className="pr-6 text-end font-medium tabular-nums">
                          {formatInteger(row.count)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          <Card className="dark:bg-transparent">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b">
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle className="text-lg text-balance">Every answer</CardTitle>
                <CardDescription className="text-pretty">
                  Newest first. Click a row for the full response.
                </CardDescription>
              </div>
              <Button
                nativeButton={false}
                render={
                  <a href={`/api/app/csv?client=${encodeURIComponent(clientSlug)}&survey=${surveyId}`} />
                }
                size="sm"
                variant="outline"
              >
                <Download data-icon="inline-start" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              {rowsLoading ? (
                <Table className="border-t">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">When</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead className="pr-6">HubSpot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody aria-busy="true">
                    {Array.from({ length: 5 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6">
                          <Skeleton className="h-4 w-36" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="pr-6">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : rows.length === 0 ? (
                <p className="px-(--card-spacing) py-6 text-muted-foreground text-sm">No respondents yet.</p>
              ) : (
                <Table className="border-t">
                  <TableCaption className="sr-only">
                    Respondents for this survey. Click a row to see answers.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">When</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Review</TableHead>
                      <TableHead className="pr-6">HubSpot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <Fragment key={r.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setOpen(open === r.id ? null : r.id)}
                        >
                          <TableCell className="pl-6">{formatWhen(r.submittedAt)}</TableCell>
                          <TableCell className="font-medium">{r.name || "Anonymous"}</TableCell>
                          <TableCell className="text-muted-foreground">{r.email || "—"}</TableCell>
                          <TableCell>{r.country || "—"}</TableCell>
                          <TableCell>
                            {REVIEW_LABEL[r.reviewOutcome] || r.reviewOutcome || "Not asked"}
                          </TableCell>
                          <TableCell className="pr-6">
                            {r.hubspotUrl ? (
                              <a
                                className="underline-offset-4 hover:underline"
                                href={r.hubspotUrl}
                                onClick={(e) => e.stopPropagation()}
                                rel="noopener"
                                target="_blank"
                              >
                                Contact
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        {open === r.id ? (
                          <TableRow>
                            <TableCell className="bg-muted/40 whitespace-normal" colSpan={6}>
                              {r.answers.length ? (
                                <div className="grid gap-3 p-2 sm:grid-cols-2">
                                  {r.answers.map((a) => (
                                    <div
                                      className="rounded-lg border border-border bg-background/40 p-3"
                                      key={a.questionKey}
                                    >
                                      <p className="text-muted-foreground text-xs text-pretty">
                                        {a.questionText || a.questionKey}
                                      </p>
                                      <p className="mt-1 font-medium text-pretty">{answerDisplay(a)}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-2 text-muted-foreground">None recorded</p>
                              )}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
