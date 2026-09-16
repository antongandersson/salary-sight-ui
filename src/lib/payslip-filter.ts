import type { CaseSheet, CaseSheetMonthReference } from "./case-sheet";
import type { Report } from "./report";

export type PayslipFilter = "all" | "finding" | "claim";
export type PayslipReferences = {
  findings: Map<string, CaseSheetMonthReference>;
  claims: Map<string, CaseSheetMonthReference>;
};

// Case-sheetets klassifikation og præcise rapportreference er autoritative.
// En terminal som NEEDS_INPUT er ikke i sig selv et muligt krav.
export function payslipReferences(caseSheet: CaseSheet | null, report: Report): PayslipReferences {
  function matching(families: { months: CaseSheetMonthReference[] }[]) {
    return new Map(
      families.flatMap((family) =>
        family.months
          .filter(
            (month) =>
              month.period === report.slip.period && month.slip_key === report.slip.slip_key,
          )
          .map((month) => [month.check_id, month] as const),
      ),
    );
  }
  return {
    findings: matching(caseSheet?.findings ?? []),
    claims: matching(caseSheet?.possible_claims.families ?? []),
  };
}

export function matchesPayslipFilter(
  checkId: string,
  filter: PayslipFilter,
  references: PayslipReferences,
): boolean {
  return (
    filter === "all" ||
    (filter === "finding" ? references.findings : references.claims).has(checkId)
  );
}
