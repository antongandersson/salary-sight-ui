import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

import { StatusPill } from "@/components/report/StatusPill";
import { kr, type Check, type Report } from "@/lib/report";

function Intro({
  attention,
  hasProgress,
  onOpenReport,
  onStart,
  report,
}: {
  attention: Check[];
  hasProgress: boolean;
  onOpenReport: () => void;
  onStart: () => void;
  report: Report;
}) {
  const claimCount = attention.filter((check) => (check.kroner?.kr ?? 0) > 0).length;
  const questionCount = report.questions.filter((question) => question.raised).length;
  const missingCount = report.missing_inputs.length;
  const hasAttention = attention.length > 0;

  return (
    <section className="paper overflow-hidden rounded-xl" aria-labelledby="overview-title">
      <div className="px-6 py-7 sm:px-8 sm:py-9">
        <div className="flex size-11 items-center justify-center rounded-full bg-accent/10 text-accent">
          {hasAttention ? (
            <SearchCheck className="size-5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-5" aria-hidden="true" />
          )}
        </div>
        <p className="label-caps mt-5">Resultat fra rule-engine</p>
        <h1
          className="mt-1 max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          id="overview-title"
        >
          {hasAttention
            ? `${attention.length} forhold kræver gennemgang`
            : "Ingen forhold kræver gennemgang"}
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
          {hasAttention
            ? "Gå rapportens forhold igennem ét ad gangen. Beregninger og teknisk dokumentation vises kun, når du beder om dem."
            : "Alle publicerede kontroller i rapporten har status OK."}
        </p>

        {hasAttention ? (
          <dl className="mt-6 max-w-2xl divide-y divide-border rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2.5 text-[13px] text-foreground">
                <CircleAlert className="size-4 text-mismatch" aria-hidden="true" />
                Kravposter med beløb i rapporten
              </dt>
              <dd className="num font-semibold text-foreground">{claimCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2.5 text-[13px] text-foreground">
                <FileQuestion className="size-4 text-needs" aria-hidden="true" />
                Spørgsmål til medlemmet
              </dt>
              <dd className="num font-semibold text-foreground">{questionCount}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="flex items-center gap-2.5 text-[13px] text-foreground">
                <FileQuestion className="size-4 text-forbehold" aria-hidden="true" />
                Manglende bilag eller tal
              </dt>
              <dd className="num font-semibold text-foreground">{missingCount}</dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {hasAttention ? (
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              onClick={onStart}
              type="button"
            >
              {hasProgress ? "Fortsæt gennemgang" : "Start gennemgang"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            className="rounded-md border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
            onClick={onOpenReport}
            type="button"
          >
            Se hele rapporten
          </button>
        </div>
      </div>

      <div className="flex gap-2.5 border-t border-border bg-muted/25 px-6 py-3.5 text-[11px] leading-relaxed text-muted-foreground sm:px-8">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        Overblikket viser kun værdier, som allerede findes i middleware-rapporten. Den fulde rapport
        ændres ikke.
      </div>
    </section>
  );
}

function ReviewItem({
  check,
  current,
  onBack,
  onMarkReviewed,
  onOpenControl,
  onPrevious,
  reviewedCount,
  total,
}: {
  check: Check;
  current: number;
  onBack: () => void;
  onMarkReviewed: () => void;
  onOpenControl: () => void;
  onPrevious: () => void;
  reviewedCount: number;
  total: number;
}) {
  const amount = check.kroner?.kr;
  const position = current + 1;
  const progress = Math.round((position / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <button
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Tilbage til overblik
        </button>
        <p className="num text-[11px] text-muted-foreground">
          Forhold {position} af {total} · {reviewedCount} markeret gennemgået
        </p>
      </div>

      <div
        aria-label={`Forhold ${position} af ${total}`}
        aria-valuemax={total}
        aria-valuemin={1}
        aria-valuenow={position}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
      </div>

      <article className="paper overflow-hidden rounded-xl">
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <StatusPill long terminal={check.terminal} />
          <h1 className="mt-4 max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {check.title}
          </h1>

          {amount !== null && amount !== undefined ? (
            <div className="mt-6 rounded-lg border border-mismatch/25 bg-mismatch-soft/45 p-4">
              <p className="label-caps text-mismatch">Beløb opgjort i rapporten</p>
              <p className="num mt-1 text-2xl font-semibold text-mismatch">{kr(amount)} kr</p>
            </div>
          ) : null}

          {check.missing?.artifact ? (
            <div className="mt-6 rounded-lg border border-needs/25 bg-needs-soft/45 p-4">
              <p className="label-caps text-needs">Det mangler for at komme videre</p>
              <p className="mt-1.5 text-[14px] font-semibold text-foreground">
                {check.missing.artifact}
              </p>
              {check.missing.unlocks ? (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Oplysningen åbner: {check.missing.unlocks}
                </p>
              ) : null}
            </div>
          ) : null}

          {check.note ? (
            <details className="group mt-6 rounded-lg border border-border">
              <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Se rule-engineens begrundelse</span>
                <span className="hidden group-open:inline">Skjul rule-engineens begrundelse</span>
              </summary>
              <p className="border-t border-border px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                {check.note}
              </p>
            </details>
          ) : null}

          <button
            className="mt-5 text-[12px] font-semibold text-accent underline-offset-4 hover:underline"
            onClick={onOpenControl}
            type="button"
          >
            Se beregning, kilder og original kontrol
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-6 py-4 sm:px-8">
          <button
            className="text-[12px] font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:opacity-35"
            disabled={current === 0}
            onClick={onPrevious}
            type="button"
          >
            Forrige forhold
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            onClick={onMarkReviewed}
            type="button"
          >
            {position === total ? "Afslut gennemgang" : "Gennemgået — næste"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </article>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        “Gennemgået” er kun din lokale læsemarkering. Den ændrer ikke kontrollens status eller
        rapportens resultat.
      </p>
    </div>
  );
}

function Complete({
  onOpenReport,
  onRestart,
  total,
}: {
  onOpenReport: () => void;
  onRestart: () => void;
  total: number;
}) {
  return (
    <section className="paper rounded-xl px-6 py-9 text-center sm:px-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <p className="label-caps mt-5">Gennemgangen er færdig</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {total} forhold er markeret som gennemgået
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
        Markeringen dokumenterer kun, hvad du har set i denne visning. Middleware-rapportens
        statusser og resultat er uændrede.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
          onClick={onOpenReport}
          type="button"
        >
          Se hele rapporten
        </button>
        <button
          className="rounded-md border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground hover:bg-muted"
          onClick={onRestart}
          type="button"
        >
          Gennemgå igen
        </button>
      </div>
    </section>
  );
}

export function ReportOverview({
  onOpenReport,
  onSelect,
  report,
}: {
  onOpenReport: () => void;
  onSelect: (checkId: string) => void;
  report: Report;
}) {
  const attention = report.checks.filter((check) => check.terminal !== "OK");
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);
  const [current, setCurrent] = useState(0);
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set());
  const check = attention[current];

  function markReviewed() {
    if (!check) return;
    setReviewed((previous) => new Set(previous).add(check.check_id));
    if (current === attention.length - 1) {
      setComplete(true);
      return;
    }
    setCurrent((position) => position + 1);
  }

  function restart() {
    setReviewed(new Set());
    setCurrent(0);
    setComplete(false);
    setStarted(true);
  }

  if (complete) {
    return <Complete onOpenReport={onOpenReport} onRestart={restart} total={attention.length} />;
  }

  if (started && check) {
    return (
      <ReviewItem
        check={check}
        current={current}
        onBack={() => setStarted(false)}
        onMarkReviewed={markReviewed}
        onOpenControl={() => onSelect(check.check_id)}
        onPrevious={() => setCurrent((position) => Math.max(0, position - 1))}
        reviewedCount={reviewed.size}
        total={attention.length}
      />
    );
  }

  return (
    <Intro
      attention={attention}
      hasProgress={current > 0 || reviewed.size > 0}
      onOpenReport={onOpenReport}
      onStart={() => setStarted(true)}
      report={report}
    />
  );
}
