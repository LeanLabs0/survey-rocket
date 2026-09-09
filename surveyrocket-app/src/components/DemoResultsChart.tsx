import { useEffect, useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const LABELS = [
  "Up more than 50%",
  "Up 20 to 50%",
  "Up less than 20%",
  "About the same",
  "Down",
];
const DEFAULT_COUNTS = [39, 55, 13, 16, 5];

const chartConfig = {
  answers: { label: "Answers", color: "var(--chart-2)" },
} satisfies ChartConfig;

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
      <rect fill="var(--color-answers)" height={height} width={2} x={x + width - 2} y={y} />
    </g>
  );
}

export default function DemoResultsChart() {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);
  const gradientId = `demo-bar-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    function onUpdate(event: Event) {
      const next = (event as CustomEvent<{ counts?: number[] }>).detail?.counts;
      if (Array.isArray(next) && next.length === LABELS.length) setCounts(next);
    }
    window.addEventListener("sr-demo-chart", onUpdate);
    return () => window.removeEventListener("sr-demo-chart", onUpdate);
  }, []);

  const items = LABELS.map((name, i) => ({ name, answers: counts[i] }));

  return (
    <ChartContainer className="aspect-auto h-60 w-full" config={chartConfig}>
      <BarChart accessibilityLayer data={items} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--color-answers)" stopOpacity={0.12} />
            <stop offset="55%" stopColor="var(--color-answers)" stopOpacity={0.38} />
            <stop offset="100%" stopColor="var(--color-answers)" stopOpacity={0.78} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} />
        <XAxis
          allowDecimals={false}
          axisLine={false}
          tickFormatter={(value) => String(value)}
          tickLine={false}
          type="number"
        />
        <YAxis
          axisLine={false}
          dataKey="name"
          tickLine={false}
          tickMargin={8}
          type="category"
          width={128}
        />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dashed" />}
          cursor={{ fill: "color-mix(in oklab, var(--color-answers) 12%, transparent)" }}
          wrapperStyle={{ outline: "none" }}
        />
        <Bar
          dataKey="answers"
          maxBarSize={22}
          name="Answers"
          radius={[0, 4, 4, 0]}
          shape={(props) => <MetallicBar fillId={gradientId} {...props} />}
        />
      </BarChart>
    </ChartContainer>
  );
}
