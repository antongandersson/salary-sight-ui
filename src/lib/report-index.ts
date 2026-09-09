import type { ReportIndexEntry } from "@/lib/paytjek-api";

export type ReportPointer = {
  key: string;
  period: string;
  slipKey: string;
};

export function reportKey(entry: Pick<ReportIndexEntry, "period" | "slip_key">): string {
  return `${entry.period}:${entry.slip_key}`;
}

export function readyReports(entries: readonly ReportIndexEntry[]): ReportIndexEntry[] {
  const fresh = entries.filter((entry) => !entry.stale);
  // Er ALT markeret stale (middleware har bumpet generation), vises de stale
  // rapporter frem for ingenting — de mærkes som forældede i UI'et.
  const usable = fresh.length > 0 ? fresh : [...entries];
  return usable.sort((left, right) =>
    right.period === left.period
      ? right.slip_key.localeCompare(left.slip_key)
      : right.period.localeCompare(left.period),
  );
}

export function reportForReference<T extends ReportPointer>(
  reports: readonly T[],
  reference: { period: string; slip_key: string },
): T | null {
  return (
    reports.find(
      (report) => report.period === reference.period && report.slipKey === reference.slip_key,
    ) ?? null
  );
}

export function reportForPeriod<T extends ReportPointer>(
  reports: readonly T[],
  period: string,
): T | null {
  return reports.find((report) => report.period === period) ?? null;
}
