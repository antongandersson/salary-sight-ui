import { ArrowRight, CircleDollarSign, FileQuestion, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import type { CaseSheet, CaseSheetFinding, CaseSheetMonthReference } from "@/lib/case-sheet";
import type { CaseSheetSource } from "@/lib/paytjek-api";
import { reportForReference, type ReportPointer } from "@/lib/report-index";
import { kr, periodLabel } from "@/lib/report";

export type OverviewReport = ReportPointer;

function amount(value: number | null): string {
  return typeof value === "number" ? `${kr(value)} kr` : "Ikke opgjort";
}

function findingReference(finding: CaseSheetFinding): CaseSheetMonthReference | null {
  return finding.months[0] ?? null;
}

function SummaryCard({
  description,
  eyebrow,
  icon,
  tone,
  value,
}: {
  description: string;
  eyebrow: string;
  icon: ReactNode;
  tone: "mismatch" | "needs" | "neutral";
  value: string;
}) {
  const colors =
    tone === "mismatch"
      ? "border-mismatch/25 bg-mismatch-soft/60 text-mismatch"
      : tone === "needs"
        ? "border-needs/30 bg-needs-soft/60 text-needs"
        : "border-border bg-muted/40 text-foreground";

  return (
    <article className={`rounded-xl border p-4 ${colors}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]">{eyebrow}</p>
        <span aria-hidden="true">{icon}</span>
      </div>
      <p className="num mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] opacity-75">{description}</p>
    </article>
  );
}

function EmptyCaseSheet({
  currentReportKey,
  onOpenReport,
  reports,
}: {
  currentReportKey: string;
  onOpenReport: (reportKey: string) => void;
  reports: readonly OverviewReport[];
}) {
  return (
    <section className="paper rounded-xl p-6" aria-labelledby="case-sheet-missing-title">
      <p className="label-caps text-accent">Sagsoversigt</p>
      <h1 className="mt-1 text-xl font-semibold text-foreground" id="case-sheet-missing-title">
        Samlet overblik er ikke klar endnu
      </h1>
      <p className="mt-2 text-[12px] text-muted-foreground">
        De enkelte lønsedler kan stadig åbnes. Frontend samler ikke selv sagen.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {reports.map((item) => (
          <button
            aria-pressed={item.key === currentReportKey}
            className={`rounded-md border px-3 py-2 text-[11px] font-semibold ${
              item.key === currentReportKey
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            key={item.key}
            onClick={() => onOpenReport(item.key)}
            type="button"
          >
            {periodLabel(item.period)}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ReportOverview({
  caseSheet,
  caseSheetSource,
  currentReportKey,
  onOpenReport,
  onSelect,
  reports,
}: {
  caseSheet: CaseSheet | null;
  caseSheetSource: CaseSheetSource | null;
  currentReportKey: string;
  onOpenReport: (reportKey: string) => void;
  onSelect: (reportKey: string, checkId: string) => void;
  reports: OverviewReport[];
}) {
  if (!caseSheet) {
    return (
      <EmptyCaseSheet
        currentReportKey={currentReportKey}
        onOpenReport={onOpenReport}
        reports={reports}
      />
    );
  }

  const visibleFindings = caseSheet.findings;
  const visibleInputs = caseSheet.needs_input;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-accent">Sagsoversigt</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {caseSheet.slips.count} lønperioder kontrolleret
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {periodLabel(caseSheet.slips.first_period)}–{periodLabel(caseSheet.slips.last_period)}
            {caseSheet.agreements.length > 0 ? ` · ${caseSheet.agreements.join(" + ")}` : ""}
          </p>
        </div>
        {typeof caseSheetSource?.generation === "number" ? (
          <span className="num rounded-full border border-border bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
            generation {caseSheetSource.generation}
          </span>
        ) : null}
      </header>

      <section aria-label="Sagens udfald">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            description={`${caseSheet.findings_summary.count} dokumenterede fund`}
            eyebrow="Afgjorte afvigelser"
            icon={<CircleDollarSign className="size-4" />}
            tone="mismatch"
            value={amount(caseSheet.findings_summary.total_kr)}
          />
          <SummaryCard
            description={`${caseSheet.possible_claims.count} mulige krav`}
            eyebrow="Kræver dokumentation"
            icon={<FileQuestion className="size-4" />}
            tone="needs"
            value={amount(caseSheet.possible_claims.total_kr)}
          />
          <SummaryCard
            description={caseSheet.control_points.label}
            eyebrow="Kontrolpunkter"
            icon={<ShieldCheck className="size-4" />}
            tone="neutral"
            value={String(caseSheet.control_points.count)}
          />
        </div>
        <p className="mt-2 px-1 text-[10px] text-muted-foreground">
          Opgørelserne er separate og kommer direkte fra middleware.
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="paper overflow-hidden rounded-xl" aria-labelledby="findings-title">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold text-foreground" id="findings-title">
              Dokumenterede fund
            </h2>
          </div>
          {visibleFindings.length > 0 ? (
            <ol>
              {visibleFindings.map((finding, index) => {
                const reference = findingReference(finding);
                const target = reference ? reportForReference(reports, reference) : null;
                const row = (
                  <>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mismatch-soft text-[10px] font-bold text-mismatch">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong
                        className="block truncate text-[11px] font-semibold text-foreground"
                        title={finding.title}
                      >
                        {finding.title}
                      </strong>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {periodLabel(finding.first_month)}–{periodLabel(finding.last_month)}
                      </span>
                    </span>
                    <span className="num whitespace-nowrap text-[12px] font-semibold text-mismatch">
                      {amount(finding.total_kr)}
                    </span>
                    {target && reference ? (
                      <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    ) : null}
                  </>
                );

                return (
                  <li className="border-b border-border last:border-0" key={finding.family}>
                    {target && reference ? (
                      <button
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/35"
                        onClick={() => onSelect(target.key, reference.check_id)}
                        type="button"
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="px-4 py-5 text-[12px] text-muted-foreground">Ingen afgjorte fund.</p>
          )}
        </section>

        <section className="paper overflow-hidden rounded-xl" aria-labelledby="input-title">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold text-foreground" id="input-title">
              Næste materiale
            </h2>
          </div>
          {visibleInputs.length > 0 ? (
            <ol>
              {visibleInputs.map((input, index) => (
                <li
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
                  key={`${input.artifact}:${index}`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-needs-soft text-[10px] font-bold text-needs">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-[11px] font-semibold text-foreground">
                      {input.artifact}
                    </strong>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {input.unlocks}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-5 text-[12px] text-muted-foreground">
              Der efterspørges ikke yderligere materiale.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
