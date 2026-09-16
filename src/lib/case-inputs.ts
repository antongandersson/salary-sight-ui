import type { CaseSheetNeedInput } from "./case-sheet";

export function pendingCaseInputs(
  inputs: readonly CaseSheetNeedInput[],
  context: Record<string, unknown>,
): CaseSheetNeedInput[] {
  const birthDate = context["birth_date"];
  const value =
    birthDate && typeof birthDate === "object" && "value" in birthDate
      ? birthDate.value
      : birthDate;
  const date =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00Z`)
      : null;
  const hasBirthDate =
    date !== null && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;

  // Kun spørgsmålet skjules, når middleware allerede har gemt datoen.
  // Rapportens alder, status og faglige resultater ændres ikke.
  return inputs.filter(
    (input) => !(hasBirthDate && input.artifact.trim().toLowerCase() === "fødselsdato"),
  );
}
