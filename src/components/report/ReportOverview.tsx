import { ArrowRight, CalendarRange, FileText, ShieldCheck } from "lucide-react";

import { StatusPill } from "@/components/report/StatusPill";
import { kr, periodLabel, type Check, type Report, type Terminal } from "@/lib/report";

const TERMINAL_ORDER: Terminal[] = [
  "MISMATCH",
  "NEEDS_INPUT",
  "FORBEHOLD",
  "REFUSED",
  "KONTROLPUNKT",
  "OK",
];

export type OverviewReport = {
  key: string;
  report: Report;
};

function ReportCheck({ check, onSelect }: { check: Check; onSelect: () => void }) {
  const amount = check.kroner?.kr;
  const description = check.note ?? check.duty ?? check.missing?.unlocks;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill terminal={check.terminal} />
          <span className="text-[13px] font-semibold text-foreground">{check.title}</span>
        </div>
        {description ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {check.missing?.artifact ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{check.missing.artifact}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {amount !== null && amount !== undefined ? (
          <span className="num text-[13px] font-semibold text-mismatch">{kr(amount)} kr</span>
        ) : null}
        <button
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent underline-offset-4 hover:underline"
          onClick={onSelect}
          type="button"
        >
          Åbn kontrol
          <ArrowRight className="size-3" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function TerminalCounts({ report }: { report: Report }) {
  const counts = report.counters.row_list_by_terminal ?? report.counters.by_terminal;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {TERMINAL_ORDER.flatMap((terminal) => {
        const count = counts[terminal] ?? 0;
        return count > 0 ? (
          <span className="inline-flex items-center gap-1.5" key={terminal}>
            <StatusPill terminal={terminal} />
            <span className="num text-[11px] text-muted-foreground">{count}</span>
          </span>
        ) : (
          []
        );
      })}
    </div>
  );
}

function TimelineReport({
  current,
  item,
  onOpen,
  onSelect,
}: {
  current: boolean;
  item: OverviewReport;
  onOpen: () => void;
  onSelect: (checkId: string) => void;
}) {
  const { report } = item;
  const nonOkChecks = report.checks.filter((check) => check.terminal !== "OK");

  return (
    <li className="relative pl-9">
      <span
        aria-hidden="true"
        className={`absolute left-[7px] top-5 size-3 rounded-full ring-4 ring-background ${
          nonOkChecks.length > 0 ? "bg-forbehold" : "bg-ok"
        }`}
      />
      <article
        className={`paper overflow-hidden rounded-lg ${current ? "ring-2 ring-accent/45" : ""}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                {periodLabel(report.slip.period)}
              </h2>
              {current ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Valgt rapport
                </span>
              ) : null}
            </div>
            <p className="num mt-1 text-[11px] text-muted-foreground">
              {report.slip.slip_key} · {report.counters.checks_total} kontroller
            </p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent underline-offset-4 hover:underline"
            onClick={onOpen}
            type="button"
          >
            Vis denne rapport
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        </header>

        <div className="px-4 py-3">
          <p className="label-caps mb-2">Terminalfordeling fra API-rapporten</p>
          <TerminalCounts report={report} />
        </div>

        {nonOkChecks.length > 0 ? (
          <details open={current}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-t border-border px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="text-[12px] font-semibold text-foreground">
                Kontroller med andet udfald end OK
              </span>
              <span className="num text-[11px] text-muted-foreground">{nonOkChecks.length}</span>
            </summary>
            <ul className="divide-y divide-border border-t border-border bg-card">
              {nonOkChecks.map((check) => (
                <ReportCheck
                  check={check}
                  key={check.check_id}
                  onSelect={() => onSelect(check.check_id)}
                />
              ))}
            </ul>
          </details>
        ) : null}
      </article>
    </li>
  );
}

export function ReportOverview({
  currentReportKey,
  onOpenReport,
  onSelect,
  reports,
}: {
  currentReportKey: string;
  onOpenReport: (reportKey: string) => void;
  onSelect: (reportKey: string, checkId: string) => void;
  reports: OverviewReport[];
}) {
  const chronological = [...reports].sort((left, right) => {
    const periodOrder = left.report.slip.period.localeCompare(right.report.slip.period);
    return periodOrder === 0
      ? left.report.slip.slip_key.localeCompare(right.report.slip.slip_key)
      : periodOrder;
  });

  return (
    <div className="space-y-4">
      <section className="paper rounded-xl px-5 py-5" aria-labelledby="overview-title">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CalendarRange className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="label-caps">Overblik</p>
            <h1
              className="mt-1 text-xl font-semibold tracking-tight text-foreground"
              id="overview-title"
            >
              Sagens kronologiske rapportforløb
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
              Perioderne vises kronologisk. Hver periode gengiver sin egen API-rapport uden nye
              beregninger, tværgående summer eller faglige fortolkninger i browseren.
            </p>
          </div>
        </div>
      </section>

      <section className="paper rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <FileText className="size-4 text-accent" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-foreground">
              {chronological.length} færdig{chronological.length === 1 ? "" : "e"} API-rapport
              {chronological.length === 1 ? "" : "er"}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            {chronological.length === 1
              ? "Enkelt upload"
              : `${periodLabel(chronological[0]!.report.slip.period)}–${periodLabel(
                  chronological.at(-1)!.report.slip.period,
                )}`}
          </span>
        </div>
      </section>

      <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-3 before:top-5 before:w-px before:bg-border">
        {chronological.map((item) => (
          <TimelineReport
            current={item.key === currentReportKey}
            item={item}
            key={item.key}
            onOpen={() => onOpenReport(item.key)}
            onSelect={(checkId) => onSelect(item.key, checkId)}
          />
        ))}
      </ol>

      <p className="flex gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        “Alle kontroller” viser fortsat den valgte rapports kontroller i middleware-rækkefølge.
      </p>
    </div>
  );
}
