import { ChevronDown } from "lucide-react";

import type { ReportIndexEntry } from "@/lib/paytjek-api";
import { reportKey } from "@/lib/report-index";
import { periodLabel } from "@/lib/report";

type PeriodNavigationProps = {
  entries: ReportIndexEntry[];
  loading: boolean;
  onSelect: (key: string) => void;
  selectedKey: string;
};

function shortPeriod(period: string): string {
  return `${period.slice(5)}/${period.slice(0, 4)}`;
}

export function PeriodStrip({ entries, loading, onSelect, selectedKey }: PeriodNavigationProps) {
  const superseded = new Set(
    entries.flatMap((entry) => (entry.revises_slip_key ? [entry.revises_slip_key] : [])),
  );
  return (
    <nav className="border-b border-border px-5 py-4" aria-label="Lønperioder">
      <label className="text-[13px] font-medium" htmlFor="payslip-period">
        Periode
      </label>
      <select
        className="mt-2 h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={loading}
        id="payslip-period"
        onChange={(event) => onSelect(event.target.value)}
        value={selectedKey}
      >
        {entries.map((entry) => (
          <option key={reportKey(entry)} value={reportKey(entry)}>
            {periodLabel(entry.period)}
            {entry.is_revision
              ? " · revision"
              : superseded.has(entry.slip_key)
                ? " · erstattet"
                : ""}
            {entries.filter((candidate) => candidate.period === entry.period).length > 1
              ? ` · ${entry.slip_key.slice(0, 6)}`
              : ""}
          </option>
        ))}
      </select>
    </nav>
  );
}

export function PeriodRail({ entries, loading, onSelect, selectedKey }: PeriodNavigationProps) {
  const superseded = new Set(
    entries.flatMap((entry) => (entry.revises_slip_key ? [entry.revises_slip_key] : [])),
  );
  const byYear = new Map<string, ReportIndexEntry[]>();
  const periodCounts = new Map<string, number>();
  for (const entry of entries) {
    const year = entry.period.slice(0, 4);
    const group = byYear.get(year) ?? [];
    group.push(entry);
    byYear.set(year, group);
    periodCounts.set(entry.period, (periodCounts.get(entry.period) ?? 0) + 1);
  }
  const selectedYear = entries
    .find((entry) => reportKey(entry) === selectedKey)
    ?.period.slice(0, 4);
  return (
    <nav aria-label="Lønperioder">
      <div className="px-5 py-5">
        <h2 className="text-lg font-semibold">Perioder</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {entries.length} rapport{entries.length === 1 ? "" : "er"}
        </p>
      </div>
      <div className="max-h-[740px] overflow-y-auto pb-4">
        {[...byYear].map(([year, yearEntries]) => (
          <details className="group" key={year} open={entries.length <= 8 || year === selectedYear}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className="size-3.5 -rotate-90 text-muted-foreground transition-transform group-open:rotate-0"
                aria-hidden="true"
              />
              {year}
            </summary>
            {yearEntries.map((entry) => {
              const selected = reportKey(entry) === selectedKey;
              const isSuperseded = superseded.has(entry.slip_key);
              const revision = entry.is_revision ? "revision" : isSuperseded ? "erstattet" : null;
              const duplicatePeriod = (periodCounts.get(entry.period) ?? 0) > 1;
              return (
                <button
                  aria-label={`${periodLabel(entry.period)}${revision ? `, ${revision}` : ""}${duplicatePeriod ? `, ${entry.slip_key.slice(0, 6)}` : ""}`}
                  aria-pressed={selected}
                  className={`relative block w-full px-5 py-3 pl-8 text-left text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-mismatch-soft/55 font-semibold" : "text-muted-foreground hover:bg-muted/30"} ${isSuperseded ? "opacity-65" : ""}`}
                  disabled={loading}
                  key={reportKey(entry)}
                  onClick={() => onSelect(reportKey(entry))}
                  title={entry.slip_key}
                  type="button"
                >
                  {selected ? (
                    <span
                      className="absolute bottom-2 left-1 top-2 w-[3px] rounded-full bg-accent"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="num">{shortPeriod(entry.period)}</span>
                  {revision || duplicatePeriod ? (
                    <span className="mt-1 block text-[10px] font-normal">
                      {revision}
                      {revision && duplicatePeriod ? " · " : ""}
                      {duplicatePeriod ? entry.slip_key.slice(0, 6) : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </details>
        ))}
      </div>
    </nav>
  );
}
