import { describe, expect, test } from "bun:test";

import type { ReportIndexEntry } from "../src/lib/paytjek-api";
import {
  readyReports,
  reportForPeriod,
  reportForReference,
  reportKey,
  type ReportPointer,
} from "../src/lib/report-index";

function entry(
  period: string,
  slipKey: string,
  options: { stale?: boolean; generation?: number } = {},
): ReportIndexEntry {
  return {
    period,
    slip_key: slipKey,
    generation: options.generation ?? 1,
    inputs_digest: `${period}:${slipKey}`,
    stale: options.stale ?? false,
    report_url: `/reports/${period}/${slipKey}`,
    html_url: `/reports/${period}/${slipKey}.html`,
  };
}

describe("rapportindeks", () => {
  test("fjerner stale rapporter og sorterer nyeste periode først", () => {
    const input = [
      entry("2025-12", "b"),
      entry("2026-01", "a"),
      entry("2026-02", "stale", { stale: true }),
      entry("2026-01", "z"),
    ];

    expect(readyReports(input).map(reportKey)).toEqual(["2026-01:z", "2026-01:a", "2025-12:b"]);
    expect(input.map(reportKey)).toEqual(["2025-12:b", "2026-01:a", "2026-02:stale", "2026-01:z"]);
  });

  test("er alle rapporter stale, vises de alligevel frem for ingenting", () => {
    const input = [entry("2026-01", "a", { stale: true }), entry("2026-02", "b", { stale: true })];
    expect(readyReports(input).map(reportKey)).toEqual(["2026-02:b", "2026-01:a"]);
  });

  test("samme periode med to slip-nøgler forbliver to forskellige rapporter", () => {
    const original = entry("2024-10", "original");
    const revision = entry("2024-10", "revision");

    expect(reportKey(original)).not.toBe(reportKey(revision));
    expect(new Set(readyReports([original, revision]).map(reportKey)).size).toBe(2);
  });
});

describe("navigation fra case-sheet", () => {
  const reports: ReportPointer[] = [
    { key: "2024-10:original", period: "2024-10", slipKey: "original" },
    { key: "2024-10:revision", period: "2024-10", slipKey: "revision" },
    { key: "2024-11:november", period: "2024-11", slipKey: "november" },
  ];

  test("period + slip_key vælger den præcise rapportrevision", () => {
    expect(reportForReference(reports, { period: "2024-10", slip_key: "revision" })?.key).toBe(
      "2024-10:revision",
    );
  });

  test("en ukendt reference falder ikke over på en anden lønseddel", () => {
    expect(reportForReference(reports, { period: "2024-10", slip_key: "findes-ikke" })).toBeNull();
  });

  test("periodeopslag bruges kun som eksplicit fallback", () => {
    expect(reportForPeriod(reports, "2024-11")?.key).toBe("2024-11:november");
  });
});
