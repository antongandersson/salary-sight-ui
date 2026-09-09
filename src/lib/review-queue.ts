import type { CaseSheet, CaseSheetMonthReference } from "./case-sheet";

export type ReviewItem = {
  id: string;
  source: "finding" | "claim";
  family: string;
  familyTitle: string;
  period: string;
  slipKey: string;
  checkId: string;
  kr: number | null;
  terminal: string | null;
};

export function reviewItemId(reference: Pick<CaseSheetMonthReference, "check_id" | "slip_key">) {
  return `${reference.check_id}@${reference.slip_key}`;
}

/**
 * Alle måneds-referencer fra case-sheetets fund og mulige krav, i API-rækkefølge
 * (fund først). Kun organisering — beløb, terminaler og rækkefølge inden for
 * hver familie kommer uændret fra middleware.
 */
export function buildReviewQueue(caseSheet: CaseSheet | null): ReviewItem[] {
  if (!caseSheet) return [];
  const items: ReviewItem[] = [];
  const push = (
    source: ReviewItem["source"],
    family: string,
    familyTitle: string,
    months: CaseSheetMonthReference[],
  ) => {
    for (const month of months) {
      items.push({
        id: reviewItemId(month),
        source,
        family,
        familyTitle,
        period: month.period,
        slipKey: month.slip_key,
        checkId: month.check_id,
        kr: month.kr ?? null,
        terminal: month.terminal ?? null,
      });
    }
  };
  for (const finding of caseSheet.findings) {
    push("finding", finding.family, finding.title, finding.months);
  }
  for (const claim of caseSheet.possible_claims.families) {
    push("claim", claim.family, claim.title, claim.months);
  }
  return items;
}
