import { ChevronDown, ChevronRight, FileClock } from "lucide-react";
import { useState } from "react";

import type { CaseSheet } from "@/lib/case-sheet";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import { periodLabel } from "@/lib/report";

function shortPeriod(period: string): string {
  return `${period.slice(5)}/${period.slice(0, 4)}`;
}

function reportKey(entry: ReportIndexEntry): string {
  return `${entry.period}:${entry.slip_key}`;
}

function periodCounts(
  caseSheet: CaseSheet | null,
  entry: ReportIndexEntry,
): { findings: number; claims: number } {
  if (!caseSheet) return { findings: 0, claims: 0 };
  const matches = (reference: { period: string; slip_key: string }) =>
    reference.period === entry.period && reference.slip_key === entry.slip_key;
  return {
    findings: caseSheet.findings.reduce(
      (count, finding) => count + finding.months.filter(matches).length,
      0,
    ),
    claims: caseSheet.possible_claims.families.reduce(
      (count, family) => count + family.months.filter(matches).length,
      0,
    ),
  };
}

// Fold kun årene sammen når listen er lang; små sager viser alt.
const FOLD_THRESHOLD = 8;

// Kompakt vandret variant til smalle skærme, hvor den fulde rail ville
// skubbe lønposterne langt ned. Samme data, samme farvekoder.
export function PeriodStrip({
  caseSheet,
  entries,
  loading,
  onSelect,
  selectedKey,
}: {
  caseSheet: CaseSheet | null;
  entries: ReportIndexEntry[];
  loading: boolean;
  onSelect: (key: string) => void;
  selectedKey: string;
}) {
  return (
    <nav aria-label="Lønperioder" className="border-b border-border">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5">
        <span className="label-caps shrink-0">Perioder</span>
        {entries.map((entry) => {
          const key = reportKey(entry);
          const selected = key === selectedKey;
          const counts = periodCounts(caseSheet, entry);
          return (
            <button
              aria-label={`${periodLabel(entry.period)}${entry.is_revision ? ", revision" : ""}`}
              aria-pressed={selected}
              className={`num flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                selected
                  ? "border-accent bg-accent/8 font-semibold text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
              disabled={loading}
              key={key}
              onClick={() => onSelect(key)}
              type="button"
            >
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  counts.findings > 0
                    ? "bg-mismatch"
                    : counts.claims > 0
                      ? "bg-needs"
                      : caseSheet
                        ? "bg-ok"
                        : "bg-muted-foreground/35"
                }`}
                aria-hidden="true"
              />
              {shortPeriod(entry.period)}
              {entry.is_revision ? <span className="font-semibold text-accent">rev.</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function PeriodRail({
  caseSheet,
  contained = false,
  entries,
  loading,
  onSelect,
  selectedKey,
}: {
  caseSheet: CaseSheet | null;
  contained?: boolean;
  entries: ReportIndexEntry[];
  loading: boolean;
  onSelect: (key: string) => void;
  selectedKey: string;
}) {
  const superseded = new Set(
    entries.flatMap((entry) => (entry.revises_slip_key ? [entry.revises_slip_key] : [])),
  );
  const years: string[] = [];
  const byYear = new Map<string, ReportIndexEntry[]>();
  for (const entry of entries) {
    const year = entry.period.slice(0, 4);
    if (!byYear.has(year)) {
      years.push(year);
      byYear.set(year, []);
    }
    byYear.get(year)!.push(entry);
  }
  const selectedYear =
    entries.find((entry) => reportKey(entry) === selectedKey)?.period.slice(0, 4) ?? years[0];
  const [openYears, setOpenYears] = useState<ReadonlySet<string>>(
    () => new Set(entries.length > FOLD_THRESHOLD ? [selectedYear ?? ""] : years),
  );

  function toggleYear(year: string) {
    setOpenYears((current) => {
      const next = new Set(current);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }

  function yearSummary(year: string): string {
    const yearEntries = byYear.get(year) ?? [];
    const findings = yearEntries.reduce(
      (count, entry) => count + periodCounts(caseSheet, entry).findings,
      0,
    );
    return findings > 0 ? `${findings} fund` : `${yearEntries.length} rapp.`;
  }

  return (
    <aside
      className={contained ? "overflow-hidden" : "paper overflow-hidden rounded-xl"}
      aria-label="Lønperioder"
    >
      <div className="border-b border-border px-3 py-3">
        <p className="label-caps">Perioder</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {entries.length} rapport{entries.length === 1 ? "" : "er"}
        </p>
      </div>
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto py-1">
        {years.map((year) => {
          const open = openYears.has(year);
          const yearEntries = byYear.get(year) ?? [];
          return (
            <div key={year}>
              <button
                aria-expanded={open}
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() => toggleYear(year)}
                type="button"
              >
                {open ? (
                  <ChevronDown className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-3" aria-hidden="true" />
                )}
                <span className="num">{year}</span>
                <span className="ml-auto font-normal normal-case">{yearSummary(year)}</span>
              </button>
              {open
                ? yearEntries.map((entry) => {
                    const key = reportKey(entry);
                    const selected = key === selectedKey;
                    const isSuperseded = superseded.has(entry.slip_key);
                    const counts = periodCounts(caseSheet, entry);
                    return (
                      <button
                        aria-label={`${periodLabel(entry.period)}${entry.is_revision ? ", revision" : ""}`}
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[13px] transition-colors ${
                          selected
                            ? "border-l-accent bg-accent/8 font-semibold text-foreground"
                            : "border-l-transparent text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                        } ${isSuperseded ? "opacity-55" : ""}`}
                        disabled={loading}
                        key={key}
                        onClick={() => onSelect(key)}
                        type="button"
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            counts.findings > 0
                              ? "bg-mismatch"
                              : counts.claims > 0
                                ? "bg-needs"
                                : caseSheet
                                  ? "bg-ok"
                                  : "bg-muted-foreground/35"
                          }`}
                        />
                        <span className="num min-w-0 flex-1">{shortPeriod(entry.period)}</span>
                        {counts.findings > 0 ? (
                          <span className="num text-[11px] font-bold text-mismatch">
                            {counts.findings}
                          </span>
                        ) : counts.claims > 0 ? (
                          <span className="num text-[11px] font-bold text-needs">
                            {counts.claims}
                          </span>
                        ) : null}
                        {entry.is_revision ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                            <FileClock className="size-3" aria-hidden="true" /> rev.
                          </span>
                        ) : isSuperseded ? (
                          <span className="text-[11px]">erstattet</span>
                        ) : null}
                      </button>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
      <div className="space-y-1 border-t border-border bg-muted/25 px-3 py-2.5 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mismatch" /> Afgjort fund (antal)
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-needs" /> Muligt krav (antal)
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok" /> Ingen af de to
        </p>
      </div>
    </aside>
  );
}
