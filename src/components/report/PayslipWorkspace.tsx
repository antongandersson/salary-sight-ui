import { Calculator, ChevronRight, FileSearch, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type { CaseSheet } from "@/lib/case-sheet";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import {
  allReportChecks,
  checksForLine,
  kr,
  lineForCheck,
  periodLabel,
  TERMINALS,
  type Check,
  type Report,
  type SlipLine,
  type Terminal,
} from "@/lib/report";
import { PeriodRail, PeriodStrip } from "./PeriodRail";
import { StatusPill } from "./StatusPill";

const STATUS_BAR: Record<Terminal, string> = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
};

// Kun disse udfald fremhæves i lønpostlisten — alt andet dæmpes, så
// afvigelser springer i øjnene.
const ATTENTION_TERMINALS = new Set<Terminal>(["MISMATCH", "NEEDS_INPUT", "FORBEHOLD"]);

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

function slipSummary(checks: Check[]): string {
  const mismatches = checks.filter((check) => check.terminal === "MISMATCH").length;
  const needs = checks.filter((check) => check.terminal === "NEEDS_INPUT").length;
  const rest = checks.length - mismatches - needs;
  const parts: string[] = [];
  if (mismatches > 0) parts.push(`${mismatches} afvigelse${mismatches === 1 ? "" : "r"} med beløb`);
  if (needs > 0) parts.push(`${needs} kræver oplysning`);
  if (rest > 0) parts.push(`${rest} øvrige kontroller`);
  return parts.join(" · ");
}

const CALC_PREVIEW_LINES = 8;
const CALC_PREVIEW_SEGMENTS = 4;

// Deler et langt én-linjes regnestykke i middlewarens egne "; "-adskilte
// delsætninger. Flerlinjede regnestykker beholder deres egne linjer (de kan
// være tabel-opstillinger, hvor bullets ville ødelægge justeringen).
export function calcSegments(text: string): { mode: "lines" | "segments"; parts: string[] } {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 1) return { mode: "lines", parts: lines };
  const parts = text.split("; ");
  return { mode: parts.length > 1 ? "segments" : "lines", parts };
}

// Fremhæver tal (inkl. enheder som kr/t, kr og %) typografisk — teksten
// gengives ordret, kun formateringen ændres.
function NumText({ text }: { text: string }) {
  const parts = text.split(/(\d[\d.,]*(?:\s?(?:kr\/t|kr|%))?)/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span className="num font-medium text-foreground" key={index}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Calculation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { mode, parts } = calcSegments(text);

  if (mode === "segments") {
    const [first, ...rest] = parts;
    const clamped = !expanded && rest.length > CALC_PREVIEW_SEGMENTS + 1;
    const visible = clamped ? rest.slice(0, CALC_PREVIEW_SEGMENTS) : rest;
    return (
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <p className="label-caps text-[10px]">Regnestykket — ordret fra middleware</p>
        <p className="num mt-2 text-[13px] font-semibold leading-relaxed text-foreground">
          {first}
        </p>
        {visible.length > 0 ? (
          <div className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {visible.map((part, index) => (
              <p className="flex gap-2" key={index}>
                <span aria-hidden="true" className="text-accent">
                  ·
                </span>
                <span className="min-w-0">
                  <NumText text={part} />
                </span>
              </p>
            ))}
          </div>
        ) : null}
        {rest.length > CALC_PREVIEW_SEGMENTS + 1 ? (
          <button
            className="mt-2 text-[12px] font-semibold text-accent hover:underline"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {clamped ? `Vis hele regnestykket (${parts.length} punkter)` : "Vis færre"}
          </button>
        ) : null}
      </div>
    );
  }

  const clamped = !expanded && parts.length > CALC_PREVIEW_LINES + 2;
  return (
    <div>
      <pre className="num mt-4 whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-[13px] leading-relaxed text-foreground">
        {clamped ? `${parts.slice(0, CALC_PREVIEW_LINES).join("\n")}\n…` : text}
      </pre>
      {parts.length > CALC_PREVIEW_LINES + 2 ? (
        <button
          className="mt-1.5 text-[12px] font-semibold text-accent hover:underline"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {clamped ? `Vis hele regnestykket (${parts.length} linjer)` : "Vis færre"}
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
  const firstLine =
    lines.find((line) => checksForLine(report, line).length > 0) ?? lines[0] ?? null;
  const [selection, setSelection] = useState<number | "slip" | null>(
    firstLine?.index ?? (reportChecks.length > 0 ? "slip" : null),
  );
  const [requestedCheckId, setRequestedCheckId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const matchesQuery = (line: SlipLine) =>
    (line.description ?? line.concept ?? "").toLowerCase().includes(query.trim().toLowerCase());
  const filteredTransactions = query ? transactions.filter(matchesQuery) : transactions;
  const filteredBalances = query ? balances.filter(matchesQuery) : balances;
  const filteredLines = [...filteredTransactions, ...filteredBalances];
  const selectedLine =
    selection === "slip" ? null : (lines.find((line) => line.index === selection) ?? firstLine);
  const lineChecks =
    selection === "slip" ? reportChecks : selectedLine ? checksForLine(report, selectedLine) : [];
  const selectedCheck =
    lineChecks.find((check) => check.check_id === requestedCheckId) ?? strongestCheck(lineChecks);
  const allChecks = allReportChecks(report);
  const orderedChecks = [...lineChecks].sort(
    (left, right) => TERMINALS[left.terminal].order - TERMINALS[right.terminal].order,
  );
  const slipTerminal = strongestTerminal(reportChecks);
  const slipAttention = slipTerminal !== null && ATTENTION_TERMINALS.has(slipTerminal);

  // Statuschips i klart sprog: afvigelser (med sum), manglende oplysninger og
  // forbehold hver for sig — resten er i orden. Tallene er rene optællinger.
  const mismatchChecks = allChecks.filter((check) => check.terminal === "MISMATCH");
  const mismatchKr = mismatchChecks.reduce((sum, check) => sum + (check.kroner?.kr ?? 0), 0);
  const needsChecks = allChecks.filter((check) => check.terminal === "NEEDS_INPUT");
  const forbeholdCount = allChecks.filter((check) => check.terminal === "FORBEHOLD").length;
  const restCount = allChecks.length - mismatchChecks.length - needsChecks.length - forbeholdCount;

  // "Kræver handling": sedlens afvigelser og manglende oplysninger som direkte
  // indgange — klik vælger lønpost og kontrol i ét hop.
  const actionChecks = [...mismatchChecks, ...needsChecks];

  function openCheck(check: Check) {
    const target = lineForCheck(report, check.check_id);
    setSelection(target ? target.index : "slip");
    setRequestedCheckId(check.check_id);
  }

  function renderLine(line: SlipLine) {
    const checks = checksForLine(report, line);
    const terminal = strongestTerminal(checks);
    const selected = selection !== "slip" && line.index === selectedLine?.index;
    const attention = terminal !== null && ATTENTION_TERMINALS.has(terminal);
    const emphasized = attention || selected;
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
          className={`h-8 w-1 rounded-full ${attention && terminal ? STATUS_BAR[terminal] : "bg-border"}`}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <strong
            className={`block truncate text-[13px] ${
              emphasized ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            }`}
          >
            {line.description ?? line.concept ?? `Lønlinje ${line.index}`}
          </strong>
          {hint ? (
            <span className="num mt-0.5 block truncate text-[11px] text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        <span
          className={`num whitespace-nowrap text-[13px] ${
            emphasized ? "font-semibold text-foreground" : "text-muted-foreground"
          }`}
        >
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
    // overflow-clip (ikke -hidden): et scroll-container-forfader ville slå
    // beregningspanelets sticky bottom-sheet fra på smalle skærme.
    <section className="paper overflow-clip rounded-xl" aria-label="Lønseddelarbejdsbord">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="label-caps text-accent">Lønseddel + kontrol</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {periodLabel(report.slip.period)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {mismatchChecks.length > 0 ? (
            <span className="rounded-full border border-mismatch/30 bg-mismatch-soft px-2.5 py-1 text-mismatch">
              {mismatchChecks.length} afvigelse{mismatchChecks.length === 1 ? "" : "r"}
              {mismatchKr > 0 ? <span className="num"> · {kr(mismatchKr)} kr</span> : null}
            </span>
          ) : null}
          {needsChecks.length > 0 ? (
            <span className="rounded-full border border-needs/30 bg-needs-soft px-2.5 py-1 text-needs">
              {needsChecks.length} mangler oplysning
            </span>
          ) : null}
          {forbeholdCount > 0 ? (
            <span className="rounded-full border border-forbehold/35 bg-forbehold-soft px-2.5 py-1 text-forbehold">
              {forbeholdCount} forbehold
            </span>
          ) : null}
          {actionChecks.length === 0 && forbeholdCount === 0 ? (
            <span className="rounded-full border border-ok/25 bg-ok-soft px-2.5 py-1 text-ok">
              Alle {allChecks.length} kontroller i orden
            </span>
          ) : restCount > 0 ? (
            <span className="rounded-full border border-border bg-muted/35 px-2.5 py-1 text-muted-foreground">
              {restCount} øvrige i orden
            </span>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[136px_minmax(0,1.05fr)_minmax(300px,.95fr)]">
        <div className="hidden lg:block">
          <PeriodRail
            caseSheet={caseSheet}
            contained
            entries={entries}
            loading={loading}
            onSelect={onSelectReport}
            selectedKey={selectedReportKey}
          />
        </div>
        <div className="lg:hidden">
          <PeriodStrip
            caseSheet={caseSheet}
            entries={entries}
            loading={loading}
            onSelect={onSelectReport}
            selectedKey={selectedReportKey}
          />
        </div>

        <div className="border-t border-border lg:border-l lg:border-t-0">
          {actionChecks.length > 0 ? (
            <div className="border-b border-border bg-mismatch-soft/35">
              <p className="label-caps flex items-center gap-2 px-4 pb-1.5 pt-2.5 text-mismatch">
                <TriangleAlert className="size-3.5" aria-hidden="true" /> Kræver handling ·{" "}
                {actionChecks.length}
              </p>
              {actionChecks.map((check) => {
                const line = lineForCheck(report, check.check_id);
                const selected = check.check_id === selectedCheck?.check_id;
                const context = [
                  line?.description ?? line?.concept ?? "Hele lønsedlen",
                  check.terminal === "MISMATCH" &&
                  check.kroner?.expected != null &&
                  check.kroner?.printed != null
                    ? `forventet ${kr(check.kroner.expected)} · trykt ${kr(check.kroner.printed)}`
                    : null,
                  check.terminal === "NEEDS_INPUT" && check.missing?.artifact
                    ? `afventer ${check.missing.artifact}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <button
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-2.5 border-t border-border px-4 py-2 text-left transition-colors ${
                      selected ? "bg-accent/8" : "hover:bg-muted/35"
                    }`}
                    key={check.check_id}
                    onClick={() => openCheck(check)}
                    type="button"
                  >
                    <span
                      className={`h-7 w-1 shrink-0 rounded-full ${STATUS_BAR[check.terminal]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        {check.title}
                      </span>
                      <span className="num mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {context}
                      </span>
                    </span>
                    {check.terminal === "MISMATCH" && check.kroner?.kr != null ? (
                      <span className="num whitespace-nowrap text-[13px] font-semibold text-mismatch">
                        {kr(check.kroner.kr)} kr
                      </span>
                    ) : (
                      <span className="whitespace-nowrap text-[11px] font-semibold text-needs">
                        {TERMINALS[check.terminal].short}
                      </span>
                    )}
                    <ChevronRight
                      className={`size-4 shrink-0 ${selected ? "text-accent" : "text-muted-foreground/50"}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">Lønposter</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Alle sedlens linjer — afvigelser er fremhævet
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <input
                  aria-label="Filtrér lønposter"
                  className="h-7 w-36 rounded-md border border-input bg-card pl-7 pr-2 text-[12px] placeholder:text-muted-foreground/60"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtrér…"
                  type="search"
                  value={query}
                />
              </div>
              <span className="num whitespace-nowrap text-[11px] text-muted-foreground">
                {query ? `${filteredLines.length} af ${lines.length}` : lines.length} poster
              </span>
            </div>
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
                    className={`h-8 w-1 rounded-full ${slipAttention && slipTerminal ? STATUS_BAR[slipTerminal] : "bg-border"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <strong
                      className={`block truncate text-[13px] ${
                        slipAttention || selection === "slip"
                          ? "font-semibold text-foreground"
                          : "font-normal text-muted-foreground"
                      }`}
                    >
                      Hele lønsedlen
                    </strong>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {slipSummary(reportChecks)}
                    </span>
                  </span>
                  <span aria-hidden="true" />
                  <ChevronRight
                    className={`size-4 ${selection === "slip" ? "text-accent" : "text-muted-foreground/50"}`}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
              {filteredTransactions.map(renderLine)}
              {filteredBalances.length > 0 ? (
                <>
                  <p className="border-b border-border bg-muted/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Saldi
                  </p>
                  {filteredBalances.map(renderLine)}
                </>
              ) : null}
              {query && filteredLines.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-muted-foreground">
                  Ingen lønposter matcher »{query.trim()}«.
                </p>
              ) : null}
              {dropped.length > 0 ? (
                <details className="border-b border-border text-[11px] text-muted-foreground">
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
            <p className="px-4 py-8 text-[13px] text-muted-foreground">
              Rapporten indeholder ingen viste lønposter.
            </p>
          )}
        </div>

        {/* Under lg: fastgjort bund-panel, så regnestykket er synligt med det
            samme, når en lønpost vælges i den stakkede visning. */}
        <aside
          className="sticky bottom-0 z-10 max-h-[45vh] overflow-y-auto border-t border-border bg-card shadow-[0_-10px_24px_-16px_rgb(0_0_0/0.35)] lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:border-l lg:border-t-0 lg:bg-muted/15 lg:shadow-none"
          aria-live="polite"
        >
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold text-foreground">Beregning</h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
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
                          className={`min-w-0 flex-1 truncate text-[12px] ${
                            selected ? "font-semibold text-foreground" : "text-muted-foreground"
                          }`}
                          title={check.title}
                        >
                          {check.title}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
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
                  {selectedCheck.kroner?.expected != null ||
                  selectedCheck.kroner?.printed != null ? (
                    <div className="mt-3 flex gap-2">
                      {selectedCheck.kroner?.expected != null ? (
                        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5">
                          <p className="label-caps text-[10px]">Forventet</p>
                          <p className="num mt-0.5 text-[16px] font-semibold text-foreground">
                            {kr(selectedCheck.kroner.expected)}
                          </p>
                        </div>
                      ) : null}
                      {selectedCheck.kroner?.printed != null ? (
                        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5">
                          <p className="label-caps text-[10px]">Trykt på sedlen</p>
                          <p className="num mt-0.5 text-[16px] font-semibold text-foreground">
                            {kr(selectedCheck.kroner.printed)}
                          </p>
                        </div>
                      ) : null}
                      {selectedCheck.terminal === "MISMATCH" && selectedCheck.kroner?.kr != null ? (
                        <div className="flex-1 rounded-lg border border-mismatch/30 bg-mismatch-soft px-3 py-2.5">
                          <p className="label-caps text-[10px] text-mismatch">Afvigelse</p>
                          <p className="num mt-0.5 text-[16px] font-semibold text-mismatch">
                            {kr(selectedCheck.kroner.kr)}{" "}
                            <span className="text-[11px] font-normal">kr</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {calculation(selectedCheck) ? (
                    <Calculation
                      key={selectedCheck.check_id}
                      text={calculation(selectedCheck) ?? ""}
                    />
                  ) : (
                    <div className="mt-4 flex gap-2 rounded-lg border border-border bg-card p-4 text-[12px] leading-relaxed text-muted-foreground">
                      <Calculator
                        className="mt-0.5 size-4 shrink-0 text-accent"
                        aria-hidden="true"
                      />
                      Middleware har ikke leveret et særskilt regnestykke til denne kontrol.
                    </div>
                  )}
                  <button
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() => onOpenEvidence(selectedCheck.check_id)}
                    type="button"
                  >
                    <FileSearch className="size-3.5" aria-hidden="true" /> Åbn bevisark
                  </button>
                </div>
              ) : null}
            </div>
          ) : selectedLine ? (
            <div className="p-5 text-[13px] leading-relaxed text-muted-foreground">
              Ingen kontrol er knyttet til denne lønpost i middleware-rapporten.
            </div>
          ) : (
            <div className="p-5 text-[13px] leading-relaxed text-muted-foreground">
              Vælg en lønpost for at se dens kontrol og regnestykke.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
