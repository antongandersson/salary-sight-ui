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

const CALC_PREVIEW_LINES = 8;

function Calculation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const clamped = !expanded && lines.length > CALC_PREVIEW_LINES + 2;
  return (
    <div>
      <pre className="num mt-4 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-[12px] leading-relaxed text-foreground">
        {clamped ? `${lines.slice(0, CALC_PREVIEW_LINES).join("\n")}\n…` : text}
      </pre>
      {lines.length > CALC_PREVIEW_LINES + 2 ? (
        <button
          className="mt-1.5 text-[11px] font-semibold text-accent hover:underline"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {clamped ? `Vis hele regnestykket (${lines.length} linjer)` : "Vis færre"}
        </button>
      ) : null}
    </div>
  );
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
  // Kun egentlige afvigelser og inputbehov promoveres til egne rækker —
  // forbehold/kontrolpunkter/OK samles under "Hele lønsedlen", ellers
  // drukner lønposterne i meta-kontroller.
  const attentionReportChecks = reportChecks.filter(
    (check) => check.terminal === "MISMATCH" || check.terminal === "NEEDS_INPUT",
  );
  const routineReportChecks = reportChecks.filter(
    (check) => !attentionReportChecks.includes(check),
  );
  const routineTerminal = strongestTerminal(routineReportChecks);
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
  const orderedChecks = [...lineChecks].sort(
    (left, right) => TERMINALS[left.terminal].order - TERMINALS[right.terminal].order,
  );

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
              {attentionReportChecks.map((check) => {
                const selected = selection === "slip" && selectedCheck?.check_id === check.check_id;
                return (
                  <button
                    aria-pressed={selected}
                    className={`group grid w-full grid-cols-[4px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
                      selected ? "bg-accent/8" : "hover:bg-muted/35"
                    }`}
                    key={check.check_id}
                    onClick={() => {
                      setSelection("slip");
                      setRequestedCheckId(check.check_id);
                    }}
                    type="button"
                  >
                    <span
                      className={`h-8 w-1 rounded-full ${STATUS_BAR[check.terminal]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-[12px] font-semibold text-foreground">
                        {check.title}
                      </strong>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {TERMINALS[check.terminal].label} · hele lønsedlen
                      </span>
                    </span>
                    <span className="num whitespace-nowrap text-[12px] font-semibold text-foreground">
                      {check.kroner?.kr == null ? "" : `${kr(check.kroner.kr)} kr`}
                    </span>
                    <ChevronRight
                      className={`size-4 ${selected ? "text-accent" : "text-muted-foreground/50"}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
              {routineReportChecks.length > 0 ? (
                <button
                  aria-pressed={
                    selection === "slip" &&
                    !attentionReportChecks.some(
                      (check) => check.check_id === selectedCheck?.check_id,
                    )
                  }
                  className={`group grid w-full grid-cols-[4px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors ${
                    selection === "slip" &&
                    !attentionReportChecks.some(
                      (check) => check.check_id === selectedCheck?.check_id,
                    )
                      ? "bg-accent/8"
                      : "hover:bg-muted/35"
                  }`}
                  onClick={() => {
                    setSelection("slip");
                    setRequestedCheckId(strongestCheck(routineReportChecks)?.check_id ?? null);
                  }}
                  type="button"
                >
                  <span
                    className={`h-8 w-1 rounded-full ${
                      routineTerminal === null || routineTerminal === "OK"
                        ? "bg-border"
                        : STATUS_BAR[routineTerminal]
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px] font-semibold text-foreground">
                      Hele lønsedlen
                    </strong>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {routineReportChecks.length} øvrige kontroller uden lønpost
                    </span>
                  </span>
                  <span aria-hidden="true" />
                  <ChevronRight className="size-4 text-muted-foreground/50" aria-hidden="true" />
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
              {orderedChecks.length > 1 ? (
                <div
                  className="mb-4 overflow-hidden rounded-lg border border-border"
                  role="group"
                  aria-label="Kontroller på lønposten"
                >
                  {orderedChecks.map((check) => {
                    const selected = check.check_id === selectedCheck?.check_id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-2 border-b border-border px-2.5 py-1.5 text-left transition-colors last:border-0 ${
                          selected ? "bg-accent/10" : "bg-card hover:bg-muted/35"
                        }`}
                        key={check.check_id}
                        onClick={() => setRequestedCheckId(check.check_id)}
                        type="button"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${STATUS_BAR[check.terminal]}`}
                          aria-hidden="true"
                        />
                        <span
                          className={`min-w-0 flex-1 truncate text-[11px] ${
                            selected ? "font-semibold text-foreground" : "text-muted-foreground"
                          }`}
                          title={check.title}
                        >
                          {check.title}
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                          {TERMINALS[check.terminal].short}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedCheck ? (
                <div>
                  <StatusPill long terminal={selectedCheck.terminal} />
                  <h3 className="mt-3 text-[15px] font-semibold leading-snug text-foreground">
                    {selectedCheck.title}
                  </h3>
                  {calculation(selectedCheck) ? (
                    <Calculation
                      key={selectedCheck.check_id}
                      text={calculation(selectedCheck) ?? ""}
                    />
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
