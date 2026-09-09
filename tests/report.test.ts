import { describe, expect, test } from "bun:test";

import {
  checkPosition,
  checksForLine,
  checksForUi,
  hasVisibilityPolicy,
  lineForCheck,
  type Check,
  type Report,
  type SlipLine,
} from "../src/lib/report";

function check(checkId: string, visibility?: "internal" | "user_facing"): Check {
  return {
    check_id: checkId,
    check_class: "K4",
    title: checkId,
    terminal: "OK",
    section: "lines",
    surface: "test",
    ...(visibility ? { visibility } : {}),
  };
}

function line(index: number, checks: string[]): SlipLine {
  return {
    index,
    description: `Linje ${index}`,
    concept: null,
    amount: null,
    lane: "PAY",
    line_type: "test",
    checks,
  };
}

function report(checks: Check[], lines: SlipLine[]): Report {
  return {
    schema: "test-report-v1",
    slip: { period: "2026-06", slip_key: "slip-a", lines_total: lines.length },
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

describe("visibility-kontrakten", () => {
  test("legacy-rapporter viser alle kontroller i API-rækkefølge", () => {
    const input = report([check("K1"), check("K2"), check("K3")], []);

    expect(hasVisibilityPolicy(input)).toBe(false);
    expect(checksForUi(input).map((item) => item.check_id)).toEqual(["K1", "K2", "K3"]);
  });

  test("rapporter med visibility viser kun user_facing uden omsortering", () => {
    const input = report(
      [
        check("uden-felt"),
        check("synlig-1", "user_facing"),
        check("intern", "internal"),
        check("synlig-2", "user_facing"),
      ],
      [],
    );

    expect(hasVisibilityPolicy(input)).toBe(true);
    expect(checksForUi(input).map((item) => item.check_id)).toEqual(["synlig-1", "synlig-2"]);
  });
});

describe("kontrol og lønlinje", () => {
  test("koblingen viser alle linjens kontroller i rapportens rækkefølge", () => {
    const salaryLine = line(7, ["synlig-2", "intern", "synlig-1"]);
    const input = report(
      [
        check("synlig-1", "user_facing"),
        check("intern", "internal"),
        check("synlig-2", "user_facing"),
      ],
      [salaryLine],
    );

    expect(checksForLine(input, salaryLine).map((item) => item.check_id)).toEqual([
      "synlig-1",
      "intern",
      "synlig-2",
    ]);
    expect(lineForCheck(input, "synlig-2")?.index).toBe(7);
    expect(checkPosition(input, "synlig-2")).toBe(3);
  });

  test("ukendte kontrol-id'er giver et neutralt resultat", () => {
    const input = report([check("K1")], [line(1, ["K1"])]);

    expect(lineForCheck(input, "findes-ikke")).toBeNull();
    expect(checkPosition(input, "findes-ikke")).toBeNull();
  });
});
