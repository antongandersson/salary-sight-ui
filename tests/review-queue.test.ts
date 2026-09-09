import { describe, expect, test } from "bun:test";

import type { CaseSheet, CaseSheetMonthReference } from "../src/lib/case-sheet";
import { buildReviewQueue } from "../src/lib/review-queue";

function month(period: string, checkId: string, kr: number | null = null): CaseSheetMonthReference {
  return { period, check_id: checkId, slip_key: `slip-${period}`, kr, terminal: "MISMATCH" };
}

function caseSheet(overrides: Partial<CaseSheet>): CaseSheet {
  return {
    agreements: [],
    case: "test",
    control_points: { count: 0, label: "", note: "" },
    findings: [],
    findings_summary: {
      count: 0,
      money_rule: "",
      months_affected: 0,
      three_figures_rule: "",
      total_kr: null,
    },
    grundlag: {},
    needs_input: [],
    possible_claims: {
      count: 0,
      families: [],
      label: "",
      months_affected: 0,
      note: "",
      sum_rule: "",
      total_kr: null,
    },
    provenance: { built_from: "", llm_in_render_path: false, renderer: "" },
    schema: "test",
    session_id: "s",
    slips: {
      count: 0,
      first_period: "",
      last_period: "",
      missing_periods: [],
      periods: [],
      slip_keys: [],
    },
    totals_by_terminal: {},
    ...overrides,
  };
}

describe("buildReviewQueue", () => {
  test("alle måneder fra fund og krav kommer med, fund først, API-rækkefølge bevaret", () => {
    const sheet = caseSheet({
      findings: [
        {
          family: "mindstesats",
          first_month: "2025-05",
          last_month: "2025-06",
          months: [month("2025-05", "c1", 500), month("2025-06", "c2", 532)],
          months_count: 2,
          pattern: "",
          settlement_status: "",
          title: "Mindstesats — sats under gulvet",
          total_kr: 1032,
        },
      ],
      possible_claims: {
        count: 1,
        families: [
          {
            family: "overarbejde",
            months: [month("2026-01", "c3")],
            months_count: 1,
            settling_documents: [],
            title: "Overarbejde",
            total_kr: null,
          },
        ],
        label: "",
        months_affected: 1,
        note: "",
        sum_rule: "",
        total_kr: null,
      },
    });

    const queue = buildReviewQueue(sheet);
    expect(queue.map((item) => item.checkId)).toEqual(["c1", "c2", "c3"]);
    expect(queue[0]).toMatchObject({
      source: "finding",
      period: "2025-05",
      slipKey: "slip-2025-05",
      kr: 500,
      id: "c1@slip-2025-05",
    });
    expect(queue[2].source).toBe("claim");
  });

  test("tom case-sheet giver tom kø", () => {
    expect(buildReviewQueue(null)).toEqual([]);
  });
});
