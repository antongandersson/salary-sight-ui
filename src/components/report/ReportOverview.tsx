import { ArrowRight, CalendarRange, ShieldCheck } from "lucide-react";

import { PayslipFacsimile } from "@/components/report/PayslipFacsimile";
import { checksForUi, periodLabel, type Report } from "@/lib/report";

export type OverviewReport = {
  key: string;
  report: Report;
};

function ReportStatus({ report }: { report: Report }) {
  const checks = checksForUi(report);
  const ok = checks.filter((check) => check.terminal === "OK").length;
  const attention = checks.length - ok;

  return (
    <div className="flex flex-wrap gap-2 text-[10px]">
      <span className="rounded-full bg-ok-soft px-2 py-1 font-semibold text-ok">
        {ok} uden bemærkning
      </span>
      {attention > 0 ? (
        <span className="rounded-full bg-forbehold-soft px-2 py-1 font-semibold text-forbehold">
          {attention} øvrige udfald
        </span>
      ) : null}
    </div>
  );
}

function TimelineReport({
  current,
  item,
  onOpen,
}: {
  current: boolean;
  item: OverviewReport;
  onOpen: () => void;
}) {
  const { report } = item;
  const checks = checksForUi(report);

  return (
    <li className="relative pl-7">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-5 size-3 rounded-full ring-4 ring-card ${
          current ? "bg-accent" : "bg-border"
        }`}
      />
      <button
        aria-current={current ? "true" : undefined}
        className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
          current
            ? "border-accent/45 bg-accent/5 shadow-sm"
            : "border-border bg-card hover:border-foreground/20 hover:bg-muted/35"
        }`}
        onClick={onOpen}
        type="button"
      >
        <span className="flex items-start justify-between gap-4">
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <strong className="text-[14px] font-semibold text-foreground">
                {periodLabel(report.slip.period)}
              </strong>
              {current ? (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Valgt
                </span>
              ) : null}
            </span>
            <span className="num mt-1 block text-[10px] text-muted-foreground">
              {report.slip.slip_key} · {checks.length} kontroller i visningen
            </span>
          </span>
          <ArrowRight className="mt-1 size-4 shrink-0 text-accent" aria-hidden="true" />
        </span>
        <span className="mt-3 block border-t border-border/70 pt-3">
          <ReportStatus report={report} />
        </span>
      </button>
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
  const current =
    chronological.find((item) => item.key === currentReportKey) ?? chronological.at(-1) ?? null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <CalendarRange className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="label-caps text-accent">Kronologisk sag</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Sagens rapportforløb
            </h1>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Vælg en periode for at se den tilhørende lønseddel. Statusser og rækkefølge kommer
              direkte fra periodens middleware-rapport.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
          {chronological.length === 1 ? "1 lønseddel" : `${chronological.length} lønsedler`}
        </span>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,.72fr)_minmax(520px,1.28fr)]">
        <section className="paper overflow-hidden rounded-xl" aria-labelledby="timeline-title">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-semibold text-foreground" id="timeline-title">
              Perioder i sagen
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Ældste til nyeste · vælg en rapport
            </p>
          </div>
          <ol className="relative space-y-2 px-4 py-4 before:absolute before:bottom-8 before:left-[21px] before:top-8 before:w-px before:bg-border">
            {chronological.map((item) => (
              <TimelineReport
                current={item.key === currentReportKey}
                item={item}
                key={item.key}
                onOpen={() => onOpenReport(item.key)}
              />
            ))}
          </ol>
        </section>

        {current ? (
          <div className="lg:sticky lg:top-24">
            <PayslipFacsimile
              contained
              onSelect={(checkId) => onSelect(current.key, checkId)}
              report={current.report}
              selectedCheckId={null}
            />
          </div>
        ) : null}
      </div>

      <p className="flex gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Overblikket viser rapporternes egne værdier. Den fulde kontrolrækkefølge ligger uændret
        under “Alle kontroller”.
      </p>
    </div>
  );
}
