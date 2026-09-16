import { describe, expect, test } from "bun:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PayslipWorkspace,
  partitionLines,
  slipLevelChecks,
} from "../src/components/report/PayslipWorkspace";
import type { Check, Report, SlipLine } from "../src/lib/report";
import type { CaseSheet, CaseSheetMonthReference } from "../src/lib/case-sheet";
import { matchesPayslipFilter, payslipReferences } from "../src/lib/payslip-filter";

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

function caseSheet(
  claims: CaseSheetMonthReference[],
  findings: CaseSheetMonthReference[] = [],
): CaseSheet {
  return {
    agreements: [],
    case: "test",
    control_points: { count: 0, label: "", note: "" },
    findings: [
      {
        family: "finding",
        title: "API finding",
        months: findings,
        months_count: findings.length,
        first_month: "",
        last_month: "",
        pattern: "",
        settlement_status: "",
        total_kr: null,
      },
    ],
    findings_summary: {
      count: findings.length,
      money_rule: "",
      months_affected: 0,
      three_figures_rule: "",
      total_kr: null,
    },
    grundlag: {},
    needs_input: [],
    possible_claims: {
      count: claims.length,
      families: [
        {
          family: "claim",
          title: "API claim",
          months: claims,
          months_count: claims.length,
          settling_documents: [],
          total_kr: null,
        },
      ],
      label: "",
      months_affected: 0,
      note: "",
      sum_rule: "",
      total_kr: null,
    },
    provenance: { built_from: "", llm_in_render_path: false, renderer: "" },
    schema: "test",
    session_id: "test",
    slips: {
      count: 0,
      first_period: "",
      last_period: "",
      missing_periods: [],
      periods: [],
      slip_keys: [],
    },
    totals_by_terminal: {},
  };
}

function reference(
  checkId: string,
  extra: Partial<CaseSheetMonthReference> = {},
): CaseSheetMonthReference {
  return { check_id: checkId, period: "2026-06", slip_key: "slip", ...extra };
}

function renderWorkspace(
  input: Report,
  overrides: Partial<ComponentProps<typeof PayslipWorkspace>> = {},
): string {
  return renderToStaticMarkup(
    createElement(PayslipWorkspace, {
      caseSheet: null,
      entries: [],
      filter: "all",
      focusedCheckId: null,
      loading: false,
      onFilterChange: () => {},
      onFocusCheck: () => {},
      onOpenEvidence: () => {},
      onSelectReport: () => {},
      report: input,
      selectedReportKey: "",
      ...overrides,
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

describe("fund og mulige krav fra case-sheet", () => {
  test("kun den præcise periode og revision matches; terminalen klassificerer ikke kravet", () => {
    const source = caseSheet(
      [
        reference("claim", { terminal: "REFUSED" }),
        reference("old-revision", { slip_key: "old" }),
        reference("other-month", { period: "2026-05" }),
      ],
      [reference("finding")],
    );
    const refs = payslipReferences(source, report([], []));
    expect([...refs.claims.keys()]).toEqual(["claim"]);
    expect(matchesPayslipFilter("claim", "claim", refs)).toBe(true);
    expect(matchesPayslipFilter("unclassified-needs-input", "claim", refs)).toBe(false);
    expect(matchesPayslipFilter("finding", "finding", refs)).toBe(true);
    expect(matchesPayslipFilter("claim", "finding", refs)).toBe(false);
    expect(payslipReferences(null, report([], [])).claims.size).toBe(0);
  });

  test("kravfilter åbner kravkontrollen på en post med både MISMATCH og NEEDS_INPUT", () => {
    const checks: Check[] = [
      { ...check("deviation", 0), terminal: "MISMATCH", kroner: { kr: 999 } },
      { ...check("claim", 0), terminal: "NEEDS_INPUT" },
      { ...check("unclassified-input", 1), terminal: "NEEDS_INPUT" },
    ];
    const markup = renderWorkspace(report(checks, [line(0), line(1)]), {
      caseSheet: caseSheet([reference("claim", { kr: 75.5, settling_document: "API document" })]),
      filter: "claim",
    });
    expect(markup.match(/<h3[^>]*>(.*?)<\/h3>/)?.[1]).toBe("claim");
    expect(markup).toContain("75,50");
    expect(markup).toContain("Muligt beløb — betinget");
    expect(markup).toContain("API document");
    expect(markup).not.toContain("unclassified-input");
    expect(markup).not.toContain("999,00");
  });

  test("krav for hele lønsedlen er direkte tilgængelige, også under Alle poster, og nulbeløb bevares", () => {
    const input = report([{ ...check("whole-slip", null), terminal: "NEEDS_INPUT" }], [line(0)]);
    const sheet = caseSheet([reference("whole-slip", { kr: 0 })]);
    const filtered = renderWorkspace(input, { caseSheet: sheet, filter: "claim" });
    expect(filtered).toContain("0,00 kr");
    expect(filtered.match(/<h3[^>]*>(.*?)<\/h3>/)?.[1]).toBe("whole-slip");
    const all = renderWorkspace(input, { caseSheet: sheet });
    expect(all).toContain("Muligt krav");
    expect(all).toMatch(/<details[^>]*open=""[^>]*><summary[^>]*>Kontroller for hele lønsedlen/);
  });

  test("manglende case-sheet giver ikke en konklusion om ingen mulige krav", () => {
    const markup = renderWorkspace(report([], [line(0)]), { filter: "claim" });
    expect(markup).toContain("opdeling er ikke klar endnu");
    expect(markup).not.toContain("Ingen mulige krav");
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
