import { ArrowRight, CheckCircle2, CircleAlert, FileQuestion } from "lucide-react";

import { StatusPill } from "@/components/report/StatusPill";
import { kr, TERMINALS, type Check, type Report, type Terminal } from "@/lib/report";

const SECONDARY_TERMINALS: Terminal[] = ["FORBEHOLD", "KONTROLPUNKT", "REFUSED"];

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "danger" | "needs" | "ok";
}) {
  const tones = {
    danger: "bg-mismatch-soft/55 text-mismatch",
    needs: "bg-needs-soft/60 text-needs",
    ok: "bg-ok-soft/55 text-ok",
  } as const;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}
      >
        {icon}
      </span>
      <div>
        <p className="num text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[12px] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function AttentionRow({ check, onSelect }: { check: Check; onSelect: (checkId: string) => void }) {
  const amount = check.kroner?.kr;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill long terminal={check.terminal} />
            <span className="num text-[10px] text-muted-foreground">{check.check_id}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
            {check.title}
          </h3>
          {check.note ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {check.note}
            </p>
          ) : null}
          {check.missing?.artifact ? (
            <div className="mt-3 rounded-md border border-needs/25 bg-needs-soft/45 px-3 py-2">
              <p className="text-[12px] font-semibold text-foreground">
                Mangler: {check.missing.artifact}
              </p>
              {check.missing.unlocks ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Oplysningen åbner: {check.missing.unlocks}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          {amount !== null && amount !== undefined ? (
            <div className="text-right">
              <p className="label-caps">Beløb i rapporten</p>
              <p className="num mt-0.5 text-[17px] font-semibold text-mismatch">{kr(amount)} kr</p>
            </div>
          ) : null}
          <button
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent underline-offset-4 hover:underline"
            onClick={() => onSelect(check.check_id)}
            type="button"
          >
            Åbn den fulde kontrol
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
}

export function ReportOverview({
  onSelect,
  report,
}: {
  onSelect: (checkId: string) => void;
  report: Report;
}) {
  const counts = report.counters.row_list_by_terminal ?? report.counters.by_terminal;
  const rowsTotal = report.counters.rows_total ?? report.checks.length;
  const attention = report.checks.filter((check) => check.terminal !== "OK");
  const okCount = counts.OK ?? 0;
  const progress = rowsTotal === 0 ? 0 : Math.min(100, Math.round((okCount / rowsTotal) * 100));

  return (
    <div className="space-y-4">
      <section className="paper overflow-hidden rounded-xl" aria-labelledby="overview-title">
        <div className="border-b border-border px-5 py-5">
          <p className="label-caps">Resultat fra rule-engine</p>
          <h1
            className="mt-1 text-xl font-semibold tracking-tight text-foreground"
            id="overview-title"
          >
            Her er det, rapporten viser
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Overblikket gengiver rapportens egne udfald. Der er ikke beregnet nye beløb, ændret
            status eller flyttet rundt på kontrollerne.
          </p>
        </div>

        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric
            icon={<CircleAlert className="size-4" aria-hidden="true" />}
            label="Afvigelser"
            tone="danger"
            value={counts.MISMATCH ?? 0}
          />
          <Metric
            icon={<FileQuestion className="size-4" aria-hidden="true" />}
            label="Mangler input"
            tone="needs"
            value={counts.NEEDS_INPUT ?? 0}
          />
          <Metric
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            label="Rækker med status OK"
            tone="ok"
            value={okCount}
          />
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between gap-4 text-[12px]">
            <span className="font-semibold text-foreground">
              {okCount} af {rowsTotal} publicerede rækker har status OK
            </span>
            <span className="num text-muted-foreground">{progress}%</span>
          </div>
          <div
            aria-label={`${okCount} af ${rowsTotal} publicerede rækker har status OK`}
            aria-valuemax={rowsTotal}
            aria-valuemin={0}
            aria-valuenow={okCount}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div className="h-full rounded-full bg-ok" style={{ width: `${progress}%` }} />
          </div>

          {SECONDARY_TERMINALS.some((terminal) => (counts[terminal] ?? 0) > 0) ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Andre udfald i rapporten:</span>
              {SECONDARY_TERMINALS.filter((terminal) => (counts[terminal] ?? 0) > 0).map(
                (terminal) => (
                  <span className="num" key={terminal}>
                    {counts[terminal]} {TERMINALS[terminal].short}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="attention-title">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground" id="attention-title">
              Det skal undersøges
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Vist i samme rækkefølge som middleware-rapporten.
            </p>
          </div>
          <span className="num text-[11px] text-muted-foreground">
            {attention.length} kontrol{attention.length === 1 ? "" : "ler"}
          </span>
        </div>

        {attention.length > 0 ? (
          <ul className="paper divide-y divide-border overflow-hidden rounded-lg">
            {attention.map((check) => (
              <AttentionRow check={check} key={check.check_id} onSelect={onSelect} />
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-ok/25 bg-ok-soft/35 p-4">
            <p className="text-[13px] font-semibold text-foreground">
              Rapporten har ingen kontroller uden status OK.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
