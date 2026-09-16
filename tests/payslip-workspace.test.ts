import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PayslipWorkspace,
  partitionLines,
  slipLevelChecks,
} from "../src/components/report/PayslipWorkspace";
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

import { calcSegments } from "../src/components/report/PayslipWorkspace";

function renderWorkspace(input: Report): string {
  return renderToStaticMarkup(
    createElement(PayslipWorkspace, {
      entries: [],
      loading: false,
      onOpenEvidence: () => {},
      onSelectReport: () => {},
      report: input,
      selectedReportKey: "",
    }),
  );
}

describe("arbejdsbordets autoritative datagrundlag", () => {
  test("overskriften bruger API-optællingen og danner ingen beløbssum", () => {
    const first = { ...check("c-first", 0), terminal: "MISMATCH" as const, kroner: { kr: 71.11 } };
    const second = {
      ...check("c-second", 0),
      terminal: "MISMATCH" as const,
      kroner: { kr: 22.22, summed: false },
    };
    const input = report([first, second], [line(0, { kind: "transaction" })]);
    input.counters.by_terminal.MISMATCH = 7;
    const markup = renderWorkspace(input);
    const header = markup.split("</header>")[0] ?? "";
    expect(header).toContain("7");
    expect(header).toContain("afvigelse");
    expect(header).not.toContain("kr");
    expect(markup).toContain("71,11");
    expect(markup).toContain("c-second");
  });

  test("interne kontroller bevares, og ikke udført bliver aldrig til OK", () => {
    const refused = {
      ...check("c-refused", 0),
      terminal: "REFUSED" as const,
      visibility: "internal" as const,
    };
    const ok = { ...check("c-ok", 0), visibility: "internal" as const };
    const markup = renderWorkspace(report([ok, refused], [line(0)]));
    expect(markup).toContain("Ikke udført");
    expect(markup).toContain("c-ok");
    expect(markup).toContain("c-refused");
    expect(markup).not.toContain("i orden");
    expect(markup).toContain("Middleware har ikke leveret et særskilt regnestykke");
  });

  test("et leveret nulbeløb og kroner-regnestykket vises uden at udfylde manglende værdier", () => {
    const mismatch = {
      ...check("c-zero", 0),
      terminal: "MISMATCH" as const,
      kroner: {
        kr: 0,
        expected: 0,
        printed: null,
        arithmetic: "MIDDLEWARE_FORMULA_ONLY",
        summed: false,
      },
    };
    const markup = renderWorkspace(report([mismatch], [line(0, { rate: 9, basis: 100 })]));
    expect(markup).toContain("0,00");
    expect(markup).toContain("MIDDLEWARE_FORMULA_ONLY");
    expect(markup).toContain("Indgår ikke i opgørelsen");
    expect(markup).toContain("—");
    expect(markup).not.toContain("kr/t");
    expect(markup.replace(/<[^>]*>/g, "")).not.toContain("%");
  });
});

describe("calcSegments", () => {
  test("deler ét-linjes regnestykke på middlewarens semikolon-adskillelse", () => {
    const result = calcSegments(
      "trykt sats 94,00 < mindstesats 97,30; trinnet er ikke gættet; satsen udløb",
    );
    expect(result.mode).toBe("segments");
    expect(result.parts).toHaveLength(3);
    expect(result.parts[0]).toBe("trykt sats 94,00 < mindstesats 97,30");
  });

  test("flerlinjede regnestykker beholder deres egne linjer", () => {
    const result = calcSegments("linje 1\nlinje 2; med semikolon\nlinje 3");
    expect(result.mode).toBe("lines");
    expect(result.parts).toHaveLength(3);
  });

  test("kort regnestykke uden semikolon forbliver én linje", () => {
    const result = calcSegments("165,00 × 94,00 = 15.510,00");
    expect(result.mode).toBe("lines");
    expect(result.parts).toHaveLength(1);
  });
});
