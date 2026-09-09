import { describe, expect, test } from "bun:test";

import { partitionLines, slipLevelChecks } from "../src/components/report/PayslipWorkspace";
import type { Check, Report, SlipLine } from "../src/lib/report";

function check(checkId: string, lineIndex?: number | null): Check {
  return {
    check_id: checkId,
    check_class: "K4",
    title: checkId,
    terminal: "OK",
    section: "lines",
    surface: "test",
    ...(lineIndex !== undefined ? { line_index: lineIndex } : {}),
  };
}

function line(index: number, extra: Partial<SlipLine> = {}): SlipLine {
  return {
    index,
    description: `Linje ${index}`,
    concept: null,
    amount: null,
    lane: "PAY",
    line_type: "test",
    checks: [],
    ...extra,
  };
}

function report(checks: Check[], lines: SlipLine[]): Report {
  return {
    schema: "test-report-v1",
    slip: { period: "2026-06", slip_key: "slip", lines_total: lines.length },
    session: {},
    context_facts: {},
    counters: { checks_total: checks.length, by_terminal: {}, by_class: {} },
    statutory: {},
    provenance: {},
    checks,
    lines,
    missing_inputs: [],
    questions: [],
    refusals: [],
    anchors: {},
  };
}

describe("partitionLines", () => {
  test("intet API-data forsvinder: transaktioner, saldi og PARSE_DROPPED partitioneres", () => {
    const lines = [
      line(0, { kind: "transaction" }),
      line(1, { kind: "balance" }),
      line(2, { kind: "transaction", lane: "PARSE_DROPPED" }),
    ];
    const { transactions, balances, dropped } = partitionLines(report([], lines));
    expect(transactions.map((l) => l.index)).toEqual([0]);
    expect(balances.map((l) => l.index)).toEqual([1]);
    expect(dropped.map((l) => l.index)).toEqual([2]);
    expect(transactions.length + balances.length + dropped.length).toBe(lines.length);
  });

  test("legacy-rapport uden kind viser alle synlige linjer", () => {
    const lines = [line(0), line(1, { lane: "PARSE_DROPPED" })];
    const { transactions, balances, dropped } = partitionLines(report([], lines));
    expect(transactions.map((l) => l.index)).toEqual([0]);
    expect(balances).toEqual([]);
    expect(dropped.map((l) => l.index)).toEqual([1]);
  });
});

describe("slipLevelChecks", () => {
  test("kontroller uden linjetilknytning får en indgang", () => {
    const checks = [check("c-line", 0), check("c-listed"), check("c-slip", null)];
    const lines = [line(0, { checks: ["c-listed"] })];
    expect(slipLevelChecks(report(checks, lines)).map((c) => c.check_id)).toEqual(["c-slip"]);
  });
});
