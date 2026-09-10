import { ExternalLink } from "lucide-react";

export type RespondentAnswer = {
  questionKey: string;
  questionText: string | null;
  type: string;
  nps?: boolean;
  valueText: string | null;
  valueNumber: number | null;
  valueList: string[] | null;
  skipped: boolean;
};

export function answerDisplay(a: RespondentAnswer) {
  if (a.skipped) return "skipped";
  if (a.valueList?.length) return a.valueList.join(", ");
  if (a.valueText) return a.valueText;
  if (a.valueNumber !== null && a.valueNumber !== undefined) return String(a.valueNumber);
  return "—";
}

export function HubSpotContactLink({ href }: { href: string | null }) {
  if (!href) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
      href={href}
      onClick={(e) => e.stopPropagation()}
      rel="noopener noreferrer"
      target="_blank"
    >
      View
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

export function AnswerList({ answers }: { answers: RespondentAnswer[] }) {
  if (!answers.length) {
    return <p className="text-muted-foreground">None recorded</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {answers.map((a) => (
        <li className="rounded-lg border border-border bg-background/40 p-3" key={a.questionKey}>
          <p className="text-muted-foreground text-xs text-pretty">{a.questionText || a.questionKey}</p>
          <p className="mt-1 font-medium text-pretty">{answerDisplay(a)}</p>
        </li>
      ))}
    </ul>
  );
}
