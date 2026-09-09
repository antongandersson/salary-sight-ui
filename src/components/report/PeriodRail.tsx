import { FileClock } from "lucide-react";

import type { CaseSheet } from "@/lib/case-sheet";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import { periodLabel } from "@/lib/report";

function shortPeriod(period: string): string {
  return `${period.slice(5)}/${period.slice(0, 4)}`;
}

function reportKey(entry: ReportIndexEntry): string {
  return `${entry.period}:${entry.slip_key}`;
}

function periodTone(caseSheet: CaseSheet | null, entry: ReportIndexEntry): string {
  if (!caseSheet) return "bg-muted-foreground/35";
  const matches = (reference: { period: string; slip_key: string }) =>
    reference.period === entry.period && reference.slip_key === entry.slip_key;
  if (caseSheet.findings.some((finding) => finding.months.some(matches))) return "bg-mismatch";
  if (caseSheet.possible_claims.families.some((family) => family.months.some(matches))) {
    return "bg-needs";
  }
  return "bg-ok";
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

  return (
    <aside
      className={contained ? "overflow-hidden" : "paper overflow-hidden rounded-xl"}
      aria-label="Lønperioder"
    >
      <div className="border-b border-border px-3 py-3">
        <p className="label-caps">Perioder</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {entries.length} rapport{entries.length === 1 ? "" : "er"}
        </p>
      </div>
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto py-1">
        {entries.map((entry) => {
          const key = reportKey(entry);
          const selected = key === selectedKey;
          const isSuperseded = superseded.has(entry.slip_key);
          return (
            <button
              aria-label={`${periodLabel(entry.period)}${entry.is_revision ? ", revision" : ""}`}
              aria-pressed={selected}
              className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[12px] transition-colors ${
                selected
                  ? "border-l-accent bg-accent/8 font-semibold text-foreground"
                  : "border-l-transparent text-muted-foreground hover:bg-muted/45 hover:text-foreground"
              } ${isSuperseded ? "opacity-55" : ""}`}
              disabled={loading}
              key={key}
              onClick={() => onSelect(key)}
              type="button"
            >
              <span className={`size-2 shrink-0 rounded-full ${periodTone(caseSheet, entry)}`} />
              <span className="num min-w-0 flex-1">{shortPeriod(entry.period)}</span>
              {entry.is_revision ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent">
                  <FileClock className="size-3" aria-hidden="true" /> rev.
                </span>
              ) : isSuperseded ? (
                <span className="text-[10px]">erstattet</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="space-y-1 border-t border-border bg-muted/25 px-3 py-2.5 text-[10px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-mismatch" /> Afgjort fund
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-needs" /> Muligt krav
        </p>
        <p className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok" /> Ingen af de to
        </p>
      </div>
    </aside>
  );
}
