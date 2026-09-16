import { describe, expect, test } from "bun:test";

import { pendingCaseInputs } from "../src/lib/case-inputs";
import type { CaseSheetNeedInput } from "../src/lib/case-sheet";

const birthDateQuestion: CaseSheetNeedInput = {
  artifact: "fødselsdato",
  ask_target: "member",
  count: 18,
  kind: "missing_input",
  months_affected: ["2026-06"],
  months_count: 1,
  slips_count: 18,
  unlocks: "pensionskontrol",
};
const ageQuestion = { ...birthDateQuestion, artifact: "oplysning der fastslår alder" };
const inputs = [birthDateQuestion, ageQuestion];

describe("pendingCaseInputs", () => {
  test("gemt middleware-dato skjuler kun fødselsdato og bevarer kildens spørgsmål", () => {
    const result = pendingCaseInputs(inputs, {
      birth_date: { value: "2000-02-29", provenance: "USER_SUPPLIED" },
    });
    expect(result).toEqual([ageQuestion]);
    expect(result[0]).toBe(ageQuestion);
    expect(inputs).toEqual([birthDateQuestion, ageQuestion]);
  });

  test("manglende, ufuldstændig eller ugyldig dato skjuler intet", () => {
    for (const value of [
      undefined,
      null,
      "",
      "2000",
      "2000-02",
      "2001-02-29",
      "2000-02-30",
      2000,
    ]) {
      expect(pendingCaseInputs(inputs, { birth_date: { value } })).toEqual(inputs);
    }
    expect(pendingCaseInputs(inputs, {})).toEqual(inputs);
  });

  test("fuld dato som streng understøttes også uden at bruge andre aldersfelter", () => {
    expect(pendingCaseInputs(inputs, { birth_date: "2000-01-01" })).toEqual([ageQuestion]);
    expect(pendingCaseInputs(inputs, { age: 26, birthDate: "2000-01-01" })).toEqual(inputs);
  });

  test("manglende spørgsmål erstattes ikke med frontend-spørgsmål", () => {
    expect(pendingCaseInputs([], { birth_date: "2000-01-01" })).toEqual([]);
  });
});
