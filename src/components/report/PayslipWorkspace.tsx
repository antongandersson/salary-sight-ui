import { Calculator, ChevronDown, ChevronRight, FileSearch, Search } from "lucide-react";
import { useState } from "react";

import type { CaseSheet } from "@/lib/case-sheet";
import { matchesPayslipFilter, payslipReferences, type PayslipFilter } from "@/lib/payslip-filter";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import { reportKey } from "@/lib/report-index";
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

function strongestCheck(checks: Check[]): Check | null {
  let strongest: Check | null = null;
  for (const check of checks) {
    if (strongest === null || TERMINALS[check.terminal].order < TERMINALS[strongest.terminal].order)
      strongest = check;
  }
  return strongest;
}

function defaultLine(report: Report, lines: SlipLine[]): SlipLine | null {
  return (
    lines.find((line) =>
      checksForLine(report, line).some((check) => check.terminal === "MISMATCH"),
    ) ??
    lines.find((line) => checksForLine(report, line).length > 0) ??
    lines[0] ??
    null
  );
}

function inputHint(line: SlipLine): string | null {
  if (line.quantity != null && line.rate != null)
    return `Antal ${kr(line.quantity)} · sats ${kr(line.rate)}`;
  if (line.basis != null && line.rate != null)
    return `Sats ${kr(line.rate)} · grundlag ${kr(line.basis)} kr`;
  if (line.quantity != null) return `Antal ${kr(line.quantity)}`;
  if (line.rate != null) return `Sats ${kr(line.rate)}`;
  return null;
}

export function calcSegments(text: string): { mode: "lines" | "segments"; parts: string[] } {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 1) return { mode: "lines", parts: lines };
  const parts = text.split("; ");
  return { mode: parts.length > 1 ? "segments" : "lines", parts };
}

// Uddraget og hele regnestykket kommer begge ordret fra middleware.
function Calculation({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { mode, parts } = calcSegments(text);
  const rawLines = text.split("\n");
  const hasMore = mode === "segments" ? parts.length > 1 : rawLines.length > 4;
  const preview = mode === "segments" ? (parts[0] ?? text) : rawLines.slice(0, 4).join("\n");
  return (
    <section className="mt-5 rounded-lg border border-border bg-muted/25 p-4">
      <h4 className="text-[12px] font-medium text-muted-foreground">Regnestykke fra middleware</h4>
      <pre className="num mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">
        {expanded || !hasMore ? text : preview}
      </pre>
      {hasMore ? (
        <button
          aria-expanded={expanded}
          className="mt-3 text-[12px] font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Vis uddrag" : "Vis hele regnestykket"}
        </button>
      ) : null}
    </section>
  );
}

const DISCLOSURE_STYLE =
  "flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden";

export function PayslipWorkspace({
  caseSheet,
  entries,
  filter,
  focusedCheckId,
  loading,
  onFilterChange,
  onFocusCheck,
  onOpenEvidence,
  onSelectReport,
  report,
  selectedReportKey,
}: {
  caseSheet: CaseSheet | null;
  entries: ReportIndexEntry[];
  filter: PayslipFilter;
  focusedCheckId: string | null;
  loading: boolean;
  onFilterChange: (filter: PayslipFilter) => void;
  onFocusCheck: (checkId: string | null) => void;
  onOpenEvidence: (checkId: string) => void;
  onSelectReport: (key: string) => void;
  report: Report;
  selectedReportKey: string;
}) {
  const { transactions, balances, dropped } = partitionLines(report);
  const lines = [...transactions, ...balances];
  const reportChecks = slipLevelChecks(report);
  const references = payslipReferences(caseSheet, report);
  const firstLine = defaultLine(report, lines);
  const [selection, setSelection] = useState<number | "slip" | null>(
    firstLine?.index ?? (reportChecks.length > 0 ? "slip" : null),
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const hasFilters = normalizedQuery !== "" || filter !== "all";
  const matchesCategory = (check: Check) =>
    matchesPayslipFilter(check.check_id, filter, references);

  function matchesFilter(line: SlipLine): boolean {
    return (
      (line.description ?? line.concept ?? "").toLowerCase().includes(normalizedQuery) &&
      (filter === "all" || checksForLine(report, line).some(matchesCategory))
    );
  }

  const filteredTransactions = transactions.filter(matchesFilter);
  const filteredBalances = balances.filter(matchesFilter);
  const filteredDropped = dropped.filter(matchesFilter);
  const filteredLines = [...filteredTransactions, ...filteredBalances];
  const filteredReportChecks = reportChecks.filter(
    (check) => matchesCategory(check) && check.title.toLowerCase().includes(normalizedQuery),
  );
  const focusedLine = focusedCheckId ? lineForCheck(report, focusedCheckId) : null;
  const showingSlip =
    filteredReportChecks.some((check) => check.check_id === focusedCheckId) ||
    (!focusedLine && selection === "slip" && filteredReportChecks.length > 0) ||
    (filter !== "all" &&
      filteredLines.length === 0 &&
      filteredDropped.length === 0 &&
      filteredReportChecks.length > 0);
  const selectedLine = showingSlip
    ? null
    : ([...filteredLines, ...filteredDropped].find(
        (line) => line.index === (focusedLine?.index ?? selection),
      ) ?? defaultLine(report, [...filteredLines, ...filteredDropped]));
  const lineChecks = showingSlip
    ? reportChecks
    : selectedLine
      ? checksForLine(report, selectedLine)
      : [];
  const selectedCheck =
    lineChecks.find((check) => check.check_id === focusedCheckId) ??
    strongestCheck(showingSlip ? filteredReportChecks : lineChecks.filter(matchesCategory)) ??
    strongestCheck(lineChecks);
  const orderedChecks = [...lineChecks].sort(
    (left, right) => TERMINALS[left.terminal].order - TERMINALS[right.terminal].order,
  );
  const selectedBalance = filteredBalances.some((line) => line.index === selectedLine?.index);
  const selectedDropped = filteredDropped.some((line) => line.index === selectedLine?.index);
  // API-optælling; ingen lokal beløbssum eller konklusion om øvrige kontroller.
  const mismatchCount = report.counters.by_terminal.MISMATCH;
  const arithmetic = selectedCheck?.computation?.arithmetic ?? selectedCheck?.kroner?.arithmetic;
  const selectedClaim = selectedCheck ? references.claims.get(selectedCheck.check_id) : undefined;
  const selectedAmount = selectedClaim ? selectedClaim.kr : selectedCheck?.kroner?.kr;
  const categoryFamilies =
    filter === "claim"
      ? caseSheet?.possible_claims.families
      : filter === "finding"
        ? caseSheet?.findings
        : undefined;
  const otherPeriods = entries.filter(
    (entry) =>
      reportKey(entry) !== selectedReportKey &&
      categoryFamilies?.some((family) =>
        family.months.some(
          (month) => month.period === entry.period && month.slip_key === entry.slip_key,
        ),
      ),
  );

  function renderLine(line: SlipLine) {
    const mismatch = checksForLine(report, line).some((check) => check.terminal === "MISMATCH");
    const possibleClaim = checksForLine(report, line).some((check) =>
      references.claims.has(check.check_id),
    );
    const selected = !showingSlip && line.index === selectedLine?.index;
    const hint = inputHint(line);
    return (
      <button
        aria-pressed={selected}
        className={`group relative grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? (possibleClaim && filter === "claim" ? "bg-needs-soft/55" : mismatch ? "bg-mismatch-soft/55" : "bg-muted/45") : "hover:bg-muted/30"}`}
        key={line.index}
        onClick={() => {
          setSelection(line.index);
          onFocusCheck(null);
        }}
        type="button"
      >
        {mismatch || possibleClaim || selected ? (
          <span
            className={`absolute bottom-3 left-1 top-3 w-[3px] rounded-full ${possibleClaim && filter === "claim" ? "bg-needs" : mismatch ? "bg-mismatch" : possibleClaim ? "bg-needs" : "bg-muted-foreground/40"}`}
            aria-hidden="true"
          />
        ) : null}
        <span className="min-w-0">
          <strong
            className={`block text-[14px] leading-snug ${selected || mismatch ? "font-semibold" : "font-normal"}`}
          >
            {line.description ?? line.concept ?? `Lønlinje ${line.index}`}
          </strong>
          {hint ? (
            <span className="num mt-1 block text-[12px] text-muted-foreground">{hint}</span>
          ) : null}
          {mismatch ? (
            <span className="mt-2 inline-block rounded border border-mismatch/20 bg-mismatch-soft px-2 py-0.5 text-[11px] font-medium text-mismatch">
              Afvigelse
            </span>
          ) : null}
          {possibleClaim ? (
            <span className="ml-1 mt-2 inline-block rounded border border-needs/20 bg-needs-soft px-2 py-0.5 text-[11px] font-medium text-needs">
              Muligt krav
            </span>
          ) : null}
        </span>
        <span
          className={`num whitespace-nowrap text-[14px] ${selected ? "font-semibold" : "text-muted-foreground"}`}
        >
          {line.amount == null ? "—" : `${kr(line.amount)} kr`}
        </span>
        <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
      </button>
    );
  }

  function renderReportCheck(check: Check) {
    const claim = references.claims.has(check.check_id);
    const selected = selectedCheck?.check_id === check.check_id && showingSlip;
    return (
      <button
        aria-pressed={selected}
        className={`block w-full border-t border-border px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? (claim ? "bg-needs-soft/55" : "bg-mismatch-soft/55") : "hover:bg-muted/30"}`}
        key={check.check_id}
        type="button"
        onClick={() => {
          setSelection("slip");
          onFocusCheck(check.check_id);
        }}
      >
        <strong className="block text-[14px] font-semibold">{check.title}</strong>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-[11px] ${claim ? "bg-needs-soft text-needs" : "bg-mismatch-soft text-mismatch"}`}
        >
          {claim ? "Muligt krav" : "Afgjort afvigelse"}
        </span>
      </button>
    );
  }

  return (
    <section
      className="paper overflow-clip rounded-xl"
      aria-label="Lønseddelarbejdsbord"
      aria-busy={loading}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Lønsedler</h1>
          <p className="text-lg text-muted-foreground">{periodLabel(report.slip.period)}</p>
        </div>
        {mismatchCount !== undefined ? (
          <span
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${mismatchCount > 0 ? "border-mismatch/20 bg-mismatch-soft/50 text-mismatch" : "border-border bg-muted/25 text-muted-foreground"}`}
          >
            {mismatchCount} afvigelse{mismatchCount === 1 ? "" : "r"}
          </span>
        ) : null}
      </header>
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[180px_minmax(0,1.15fr)_minmax(320px,1fr)] xl:grid-cols-[200px_minmax(0,1.15fr)_minmax(340px,1fr)]">
        <div className="hidden lg:block">
          <PeriodRail
            entries={entries}
            loading={loading}
            onSelect={onSelectReport}
            selectedKey={selectedReportKey}
          />
        </div>
        <div className="lg:hidden">
          <PeriodStrip
            entries={entries}
            loading={loading}
            onSelect={onSelectReport}
            selectedKey={selectedReportKey}
          />
        </div>
        <div className="min-w-0 border-t border-border lg:border-l lg:border-t-0">
          <div className="border-b border-border px-5 py-5">
            <h2 className="text-lg font-semibold">Lønposter</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {hasFilters ? `${filteredLines.length} af ${lines.length}` : lines.length} poster
              {hasFilters && filteredReportChecks.length > 0
                ? ` · ${filteredReportChecks.length} kontrol${filteredReportChecks.length === 1 ? "" : "ler"} for hele lønsedlen`
                : ""}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="relative min-w-[160px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <input
                  aria-label="Søg i lønposter"
                  className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-[13px] placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    onFocusCheck(null);
                  }}
                  placeholder="Søg i lønposter…"
                  type="search"
                  value={query}
                />
              </div>
            </div>
            <fieldset
              aria-label="Vis lønposter"
              className="mt-3 flex flex-wrap gap-1 rounded-lg border border-border bg-muted/25 p-1"
            >
              {(
                [
                  { value: "all", label: "Alle poster" },
                  { value: "finding", label: "Afgjorte afvigelser" },
                  { value: "claim", label: "Mulige krav" },
                ] as const
              ).map((option) => (
                <label className="cursor-pointer" key={option.value}>
                  <input
                    className="peer sr-only"
                    name="payslip-filter"
                    type="radio"
                    disabled={!caseSheet && option.value !== "all"}
                    checked={filter === option.value}
                    onChange={() => onFilterChange(option.value)}
                  />
                  <span
                    className={`block rounded-md px-3 py-2 text-[12px] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring ${filter === option.value ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {option.label}
                  </span>
                </label>
              ))}
            </fieldset>
            {!caseSheet ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Sagens opdeling i fund og mulige krav er ikke klar endnu.
              </p>
            ) : null}
          </div>
          <div className="max-h-[50dvh] overflow-y-auto lg:max-h-[680px]">
            {filteredTransactions.map(renderLine)}
            {filteredLines.length === 0 &&
            filteredReportChecks.length === 0 &&
            filteredDropped.length === 0 ? (
              <div className="px-5 py-8 text-[13px] leading-relaxed text-muted-foreground">
                <p>
                  {!caseSheet && filter !== "all"
                    ? "Middlewareens opdeling er ikke klar endnu."
                    : hasFilters
                      ? normalizedQuery
                        ? "Ingen lønposter eller kontroller matcher din søgning."
                        : filter === "claim"
                          ? "Ingen mulige krav i denne lønperiode."
                          : "Ingen afgjorte afvigelser i denne lønperiode."
                      : "Rapporten indeholder ingen lønposter."}
                </p>
                {!normalizedQuery && otherPeriods.length > 0 ? (
                  <>
                    <p className="mt-3">
                      {filter === "claim"
                        ? "Mulige krav findes i:"
                        : "Afgjorte afvigelser findes i:"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {otherPeriods.map((entry) => (
                        <button
                          className="rounded border border-border bg-card px-2 py-1 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          key={reportKey(entry)}
                          onClick={() => onSelectReport(reportKey(entry))}
                          type="button"
                        >
                          {periodLabel(entry.period)}
                          {entry.is_revision ? " · revision" : ""}
                          {entries.filter((candidate) => candidate.period === entry.period).length >
                          1
                            ? ` · ${entry.slip_key.slice(0, 6)}`
                            : ""}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {filteredBalances.length > 0 ? (
              <details
                className="group border-b border-border"
                open={selectedBalance || hasFilters || undefined}
              >
                <summary className={`${DISCLOSURE_STYLE} px-5 py-4`}>
                  Saldi
                  <ChevronDown
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                {filteredBalances.map(renderLine)}
              </details>
            ) : null}
            {filteredReportChecks.length > 0 ? (
              <details
                className="group border-b border-border"
                open={
                  showingSlip ||
                  filter !== "all" ||
                  filteredReportChecks.some((check) => references.claims.has(check.check_id)) ||
                  undefined
                }
              >
                <summary className={`${DISCLOSURE_STYLE} px-5 py-4`}>
                  Kontroller for hele lønsedlen
                  <ChevronDown
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                {filter === "all" ? (
                  <>
                    {filteredReportChecks
                      .filter((check) => references.claims.has(check.check_id))
                      .map(renderReportCheck)}
                    <button
                      aria-pressed={showingSlip}
                      className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${showingSlip ? "bg-muted/45" : "hover:bg-muted/30"}`}
                      onClick={() => {
                        setSelection("slip");
                        onFocusCheck(null);
                      }}
                      type="button"
                    >
                      <span>
                        Åbn kontroller{" "}
                        <span className="ml-2 text-muted-foreground">
                          ({filteredReportChecks.length})
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  filteredReportChecks.map(renderReportCheck)
                )}
              </details>
            ) : null}
            {filteredDropped.length > 0 ? (
              <details className="group border-b border-border" open={selectedDropped || undefined}>
                <summary
                  className={`${DISCLOSURE_STYLE} px-5 py-4 text-[12px] text-muted-foreground`}
                >
                  Linjer udeladt af middleware ({filteredDropped.length})
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                {filteredDropped.map(renderLine)}
              </details>
            ) : null}
          </div>
        </div>
        <aside
          className="min-w-0 border-t border-border bg-card lg:border-l lg:border-t-0"
          aria-live="polite"
          aria-label="Valgt kontrol"
        >
          <div className="px-5 py-5 lg:p-6">
            <p className="label-caps text-muted-foreground">
              {showingSlip ? "Hele lønsedlen" : "Valgt lønpost"}
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight">
              {showingSlip
                ? "Kontroller for hele lønsedlen"
                : (selectedLine?.description ?? selectedLine?.concept ?? "Vælg en lønpost")}
            </h2>
            {selectedCheck ? (
              <>
                {selectedClaim ? (
                  <p className="mt-4 text-[12px] font-medium text-needs">
                    Muligt krav — kræver dokumentation
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap items-start gap-3 rounded-lg bg-muted/30 px-3 py-3">
                  <StatusPill terminal={selectedCheck.terminal} />
                  <h3 className="min-w-0 flex-1 text-[14px] font-semibold leading-relaxed">
                    {selectedCheck.title}
                  </h3>
                </div>
                {selectedAmount != null ? (
                  <div className="mt-5">
                    <p className="text-[12px] text-muted-foreground">
                      {selectedClaim
                        ? "Muligt beløb — betinget"
                        : selectedCheck.terminal === "MISMATCH"
                          ? "Afvigelse"
                          : "Beløb fra kontrollen"}
                    </p>
                    <p
                      className={`num mt-1 text-2xl font-semibold ${selectedClaim ? "text-needs" : selectedCheck.terminal === "MISMATCH" ? "text-mismatch" : "text-foreground"}`}
                    >
                      {kr(selectedAmount)} kr
                    </p>
                    {selectedCheck.kroner?.summed === false ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Indgår ikke i opgørelsen
                      </p>
                    ) : null}
                  </div>
                ) : selectedCheck.terminal === "MISMATCH" ? (
                  <p className="mt-5 text-[13px] text-muted-foreground">
                    Middleware har ikke opgjort et beløb.
                  </p>
                ) : null}
                {selectedClaim?.settling_document ? (
                  <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                    Kræver: {selectedClaim.settling_document}
                  </p>
                ) : null}
                {selectedCheck.kroner?.expected != null || selectedCheck.kroner?.printed != null ? (
                  <dl className="mt-5 grid grid-cols-2 divide-x divide-border">
                    <div className="pr-4">
                      <dt className="text-[12px] text-muted-foreground">Forventet</dt>
                      <dd className="num mt-1 text-[16px] font-semibold">
                        {kr(selectedCheck.kroner?.expected)}
                      </dd>
                    </div>
                    <div className="pl-4">
                      <dt className="text-[12px] text-muted-foreground">Trykt på sedlen</dt>
                      <dd className="num mt-1 text-[16px] font-semibold">
                        {kr(selectedCheck.kroner?.printed)}
                      </dd>
                    </div>
                  </dl>
                ) : null}
                {arithmetic ? (
                  <Calculation key={selectedCheck.check_id} text={arithmetic} />
                ) : (
                  <p className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-muted/25 p-4 text-[12px] leading-relaxed text-muted-foreground">
                    <Calculator className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Middleware har ikke leveret et særskilt regnestykke til denne kontrol.
                  </p>
                )}
                <button
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => onOpenEvidence(selectedCheck.check_id)}
                  type="button"
                >
                  <FileSearch className="size-4" aria-hidden="true" />
                  Åbn bevisark
                </button>
                {orderedChecks.length > 1 ? (
                  <details
                    className="group mt-6 border-t border-border pt-4"
                    key={showingSlip ? "slip" : selectedLine?.index}
                  >
                    <summary className={DISCLOSURE_STYLE}>
                      {showingSlip
                        ? "Andre kontroller for hele lønsedlen"
                        : "Andre kontroller på denne post"}
                      <ChevronDown
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="text-[12px] text-muted-foreground">Se alle kontroller</p>
                    <div
                      className="mt-3 overflow-hidden rounded-lg border border-border"
                      role="group"
                      aria-label="Vælg kontrol"
                    >
                      {orderedChecks.map((check) => (
                        <button
                          aria-pressed={check.check_id === selectedCheck.check_id}
                          className={`flex w-full items-start gap-2.5 border-b border-border px-3 py-3 text-left text-[12px] transition-colors last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${check.check_id === selectedCheck.check_id ? "bg-accent/5" : "hover:bg-muted/35"}`}
                          key={check.check_id}
                          onClick={() => onFocusCheck(check.check_id)}
                          type="button"
                        >
                          <span
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_BAR[check.terminal]}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 leading-relaxed">{check.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {TERMINALS[check.terminal].short}
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
                {selectedLine
                  ? "Ingen kontrol er knyttet til denne lønpost i middleware-rapporten."
                  : "Vælg en lønpost for at se dens kontrol og regnestykke."}
              </p>
            )}
            <p className="mt-6 border-t border-border pt-4 text-[11px] text-muted-foreground">
              Resultater og regnestykker fra middleware
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
