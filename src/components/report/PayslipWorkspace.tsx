import { Calculator, ChevronRight, FileSearch } from "lucide-react";
import { useState } from "react";

import type { CaseSheet } from "@/lib/case-sheet";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import {
  allReportChecks,
  checksForLine,
  kr,
  periodLabel,
  TERMINALS,
  type Check,
  type Report,
  type SlipLine,
  type Terminal,
} from "@/lib/report";
import { PeriodRail } from "./PeriodRail";
import { StatusPill } from "./StatusPill";

const STATUS_BAR: Record<Terminal, string> = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
};

export function partitionLines(report: Report): {
  transactions: SlipLine[];
  balances: SlipLine[];
  dropped: SlipLine[];
} {
  const visible = report.lines.filter((line) => line.lane !== "PARSE_DROPPED");
  const dropped = report.lines.filter((line) => line.lane === "PARSE_DROPPED");
  const hasKind = visible.some((line) => line.kind === "transaction");
  return {
    transactions: hasKind ? visible.filter((line) => line.kind === "transaction") : visible,
    balances: hasKind ? visible.filter((line) => line.kind !== "transaction") : [],
    dropped,
  };
}

export function slipLevelChecks(report: Report): Check[] {
  const lineAttached = new Set(report.lines.flatMap((line) => line.checks));
  return allReportChecks(report).filter(
    (check) => check.line_index == null && !lineAttached.has(check.check_id),
  );
}

function strongestTerminal(checks: Check[]): Terminal | null {
  let strongest: Terminal | null = null;
  for (const check of checks) {
    if (strongest === null || TERMINALS[check.terminal].order < TERMINALS[strongest].order) {
      strongest = check.terminal;
    }
  }
  return strongest;
}

function strongestCheck(checks: Check[]): Check | null {
  let strongest: Check | null = null;
  for (const check of checks) {
    if (
      strongest === null ||
      TERMINALS[check.terminal].order < TERMINALS[strongest.terminal].order
    ) {
      strongest = check;
    }
  }
  return strongest;
}

function inputHint(line: SlipLine): string | null {
  if (line.quantity != null && line.rate != null) {
    return `${kr(line.quantity)} × ${kr(line.rate)} kr`;
  }
  if (line.basis != null && line.rate != null) {
    return `${kr(line.rate)} % af ${kr(line.basis)} kr`;
  }
  if (line.quantity != null) return `${kr(line.quantity)} enheder`;
  if (line.rate != null) return `Sats ${kr(line.rate)}`;
  return null;
}

function calculation(check: Check): string | null {
  return check.computation?.arithmetic ?? check.kroner?.arithmetic ?? null;
}

export function PayslipWorkspace({
  caseSheet,
  entries,
  loading,
  onOpenEvidence,
  onSelectReport,
  report,
  selectedReportKey,
}: {
  caseSheet: CaseSheet | null;
  entries: ReportIndexEntry[];
  loading: boolean;
  onOpenEvidence: (checkId: string) => void;
  onSelectReport: (key: string) => void;
  report: Report;
  selectedReportKey: string;
}) {
  const { transactions, balances, dropped } = partitionLines(report);
  const lines = [...transactions, ...balances];
  const reportChecks = slipLevelChecks(report);
  const firstLine =
    lines.find((line) => checksForLine(report, line).length > 0) ?? lines[0] ?? null;
  const [selection, setSelection] = useState<number | "slip" | null>(
    firstLine?.index ?? (reportChecks.length > 0 ? "slip" : null),
  );
  const [requestedCheckId, setRequestedCheckId] = useState<string | null>(null);
  const selectedLine =
    selection === "slip" ? null : (lines.find((line) => line.index === selection) ?? firstLine);
  const lineChecks =
    selection === "slip" ? reportChecks : selectedLine ? checksForLine(report, selectedLine) : [];
  const selectedCheck =
    lineChecks.find((check) => check.check_id === requestedCheckId) ?? strongestCheck(lineChecks);
  const allChecks = allReportChecks(report);
  const attentionCount = allChecks.filter((check) => check.terminal !== "OK").length;
  const slipTerminal = strongestTerminal(reportChecks);

  function renderLine(line: SlipLine) {
    const checks = checksForLine(report, line);
    const terminal = strongestTerminal(checks);
    const selected = selection !== "slip" && line.index === selectedLine?.index;
    const hint = inputHint(line);
    return (
      <button
        aria-pressed={selected}
        className={`group grid w-full grid-cols-[4px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
          selected ? "bg-accent/8" : "hover:bg-muted/35"
        }`}
        key={line.index}
        onClick={() => {
          setSelection(line.index);
          setRequestedCheckId(null);
        }}
        type="button"
      >
        <span
          className={`h-8 w-1 rounded-full ${terminal ? STATUS_BAR[terminal] : "bg-border"}`}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <strong className="block truncate text-[12px] font-semibold text-foreground">
            {line.description ?? line.concept ?? `Lønlinje ${line.index}`}
          </strong>
          {hint ? (
            <span className="num mt-0.5 block truncate text-[10px] text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        <span className="num whitespace-nowrap text-[12px] font-semibold text-foreground">
          {line.amount == null ? "—" : `${kr(line.amount)} kr`}
        </span>
        <ChevronRight
          className={`size-4 ${selected ? "text-accent" : "text-muted-foreground/50"}`}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <section className="paper overflow-hidden rounded-xl" aria-label="Lønseddelarbejdsbord">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="label-caps text-accent">Lønseddel + kontrol</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {periodLabel(report.slip.period)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold">
          <span className="rounded-full border border-border bg-muted/35 px-2.5 py-1 text-muted-foreground">
            {allChecks.length} kontroller
          </span>
          {attentionCount > 0 ? (
            <span className="rounded-full border border-needs/30 bg-needs-soft px-2.5 py-1 text-needs">
              {attentionCount} markeret
            </span>
          ) : (
            <span className="rounded-full border border-ok/25 bg-ok-soft px-2.5 py-1 text-ok">
              Alle OK
            </span>
          )}
        </div>
      </header>

      <div className="grid min-h-[620px] xl:grid-cols-[150px_minmax(390px,1.05fr)_minmax(330px,.95fr)]">
        <PeriodRail
          caseSheet={caseSheet}
          contained
          entries={entries}
          loading={loading}
          onSelect={onSelectReport}
          selectedKey={selectedReportKey}
        />

        <div className="border-t border-border xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[12px] font-semibold text-foreground">Lønposter</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Vælg en post</p>
            </div>
            <span className="num text-[10px] text-muted-foreground">{lines.length} poster</span>
          </div>

          {lines.length > 0 || reportChecks.length > 0 ? (
            <div className="max-h-[680px] overflow-y-auto" style={{ contentVisibility: "auto" }}>
              {reportChecks.length > 0 ? (
                <button
                  aria-pressed={selection === "slip"}
                  className={`group grid w-full grid-cols-[4px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
                    selection === "slip" ? "bg-accent/8" : "hover:bg-muted/35"
                  }`}
                  onClick={() => {
                    setSelection("slip");
                    setRequestedCheckId(null);
                  }}
                  type="button"
                >
                  <span
                    className={`h-8 w-1 rounded-full ${slipTerminal ? STATUS_BAR[slipTerminal] : "bg-border"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px] font-semibold text-foreground">
                      Hele lønsedlen
                    </strong>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {reportChecks.length} kontroller uden lønpost
                    </span>
                  </span>
                  <span aria-hidden="true" />
                  <ChevronRight
                    className={`size-4 ${selection === "slip" ? "text-accent" : "text-muted-foreground/50"}`}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
              {transactions.map(renderLine)}
              {balances.length > 0 ? (
                <>
                  <p className="border-b border-border bg-muted/25 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Saldi
                  </p>
                  {balances.map(renderLine)}
                </>
              ) : null}
              {dropped.length > 0 ? (
                <details className="border-b border-border text-[10px] text-muted-foreground">
                  <summary className="cursor-pointer px-3 py-2 font-semibold">
                    {dropped.length} linjer udeladt af parser (PARSE_DROPPED)
                  </summary>
                  <ul>
                    {dropped.map((line) => (
                      <li
                        className="flex items-center justify-between gap-3 px-3 py-1.5"
                        key={line.index}
                      >
                        <span className="truncate">
                          {line.description ?? line.concept ?? `Lønlinje ${line.index}`}
                        </span>
                        <span className="num shrink-0">
                          {line.amount == null ? "—" : `${kr(line.amount)} kr`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : (
            <p className="px-4 py-8 text-[12px] text-muted-foreground">
              Rapporten indeholder ingen viste lønposter.
            </p>
          )}
        </div>

        <aside
          className="border-t border-border bg-muted/15 xl:border-l xl:border-t-0"
          aria-live="polite"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[12px] font-semibold text-foreground">Beregning</h2>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {selection === "slip"
                ? "Hele lønsedlen"
                : (selectedLine?.description ?? "Vælg en lønpost")}
            </p>
          </div>

          {lineChecks.length > 0 ? (
            <div className="p-4">
              {lineChecks.length > 1 ? (
                <div
                  className="mb-4 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Kontroller på lønposten"
                >
                  {lineChecks.map((check) => (
                    <button
                      aria-label={`${TERMINALS[check.terminal].short}: ${check.title}`}
                      aria-pressed={check.check_id === selectedCheck?.check_id}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                        check.check_id === selectedCheck?.check_id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                      key={check.check_id}
                      onClick={() => setRequestedCheckId(check.check_id)}
                      title={check.title}
                      type="button"
                    >
                      {TERMINALS[check.terminal].short}
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedCheck ? (
                <div>
                  <StatusPill long terminal={selectedCheck.terminal} />
                  <h3 className="mt-3 text-[15px] font-semibold leading-snug text-foreground">
                    {selectedCheck.title}
                  </h3>
                  {calculation(selectedCheck) ? (
                    <pre className="num mt-4 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-[12px] leading-relaxed text-foreground">
                      {calculation(selectedCheck)}
                    </pre>
                  ) : (
                    <div className="mt-4 flex gap-2 rounded-lg border border-border bg-card p-4 text-[11px] leading-relaxed text-muted-foreground">
                      <Calculator
                        className="mt-0.5 size-4 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      Middleware har ikke leveret et særskilt regnestykke til denne kontrol.
                    </div>
                  )}
                  <button
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() => onOpenEvidence(selectedCheck.check_id)}
                    type="button"
                  >
                    <FileSearch className="size-3.5" aria-hidden="true" /> Åbn bevisark
                  </button>
                </div>
              ) : null}
            </div>
          ) : selectedLine ? (
            <div className="p-5 text-[12px] leading-relaxed text-muted-foreground">
              Ingen kontrol er knyttet til denne lønpost i middleware-rapporten.
            </div>
          ) : (
            <div className="p-5 text-[12px] leading-relaxed text-muted-foreground">
              Vælg en lønpost for at se dens kontrol og regnestykke.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
