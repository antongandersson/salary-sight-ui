export type Terminal = "OK" | "MISMATCH" | "FORBEHOLD" | "NEEDS_INPUT" | "REFUSED" | "KONTROLPUNKT";

export type ComputationInput = { label: string; source: string; value: number };

export type Kroner = {
  kr?: number | null;
  arithmetic?: string | null;
  convention?: string | null;
  explanation?: string | null;
  derived?: Array<{
    label: string;
    kr: number;
    text?: string;
    arithmetic?: string;
    proof?: string;
    rule_text?: string;
    source?: string;
  }> | null;
  factors?: ComputationInput[] | null;
  alternatives?: Record<string, unknown> | null;
  expected?: number | null;
  printed?: number | null;
  summed?: boolean | null;
};

export type CheckFinding = {
  kind: string;
  value: number | null;
  unit: string | null;
  conditional_amount: number | null;
  alternatives: string[] | null;
};

export type CheckFacts = Record<string, unknown>;

export type Check = {
  check_id: string;
  check_class: string;
  title: string;
  terminal: Terminal;
  visibility?: "internal" | "user_facing";
  section: string;
  surface: string;
  superseded?: string[];
  claim_axis?: string | null;
  basis?: unknown;
  note_source?: string | null;
  title_source?: string | null;
  pension_basis_facts?: CheckFacts | null;
  trin_facts?: CheckFacts | null;
  rounding_facts?: CheckFacts | null;
  substance?: "finding" | "generic" | null;
  duty?: string | null;
  note?: string | null;
  quotes?: string[];
  line_index?: number | null;
  authored?: boolean;
  closable_by_document?: boolean;
  finding?: CheckFinding | null;
  computation?: {
    arithmetic?: string | null;
    inputs?: ComputationInput[];
    sources?: string[];
  } | null;
  kroner?: Kroner | null;
  missing?: {
    artifact?: string;
    ask_target?: "member" | "unstated" | string;
    kind?: string;
    unlocks?: string;
    closable_by_document?: boolean;
    form?: string;
    who?: string;
    promise?: string;
  } | null;
};

export type SlipLine = {
  index: number;
  description: string | null;
  concept: string | null;
  amount: number | null;
  basis?: number | null;
  quantity?: number | null;
  rate?: number | null;
  lane: string;
  line_type: string;
  sign?: string | null;
  kind?: "transaction" | "balance" | string;
  role?: string | null;
  anchor?: string | null;
  tags?: string[];
  checks: string[];
  amount_unread?: boolean;
  admitted_status?: string | null;
  admitted_reason?: string | null;
};

export type ReportCounters = {
  checks_total: number;
  by_terminal: Partial<Record<Terminal, number>>;
  by_class: Record<string, number>;
  substance_by_terminal?: Partial<Record<Terminal, Partial<Record<"finding" | "generic", number>>>>;
  rows_total?: number;
  row_list_by_terminal?: Partial<Record<Terminal, number>>;
};

export type Report = {
  schema: string;
  slip: Record<string, unknown> & { period: string; slip_key: string; lines_total: number };
  session: Record<string, unknown>;
  context_facts: Record<string, unknown>;
  counters: ReportCounters;
  statutory: Record<string, unknown>;
  provenance: Record<string, string | boolean>;
  checks: Check[];
  lines: SlipLine[];
  missing_inputs: Array<{
    artifact: string;
    kind: string;
    unlocks: string;
    checks: string[];
    checks_count: number;
  }>;
  // Fjernet fra rapportformatet i september 2026; optional for ældre rapporter.
  questions?: Array<{
    key: string;
    label: string;
    question: string;
    raised: boolean;
    raised_by: Array<{ rule_id: string; detail: string; binding: string }>;
  }>;
  case_sheet_pointers?: Array<{ months_count: number; sheet_point: number; title: string }>;
  provenance_facts?: Record<string, unknown>;
  refusals: Check[];
  anchors: Record<string, number>;
};

export const TERMINALS: Record<
  Terminal,
  { label: string; short: string; tone: string; order: number }
> = {
  MISMATCH: { label: "Afvigelse med beløb", short: "Afvigelse", tone: "mismatch", order: 0 },
  NEEDS_INPUT: { label: "Kræver oplysning", short: "Mangler input", tone: "needs", order: 1 },
  FORBEHOLD: { label: "Forbehold — ikke afgjort", short: "Forbehold", tone: "forbehold", order: 2 },
  REFUSED: { label: "Kontrol ikke udført", short: "Ikke udført", tone: "refused", order: 3 },
  KONTROLPUNKT: { label: "Kontrolpunkt", short: "Kontrolpunkt", tone: "kontrolpunkt", order: 4 },
  OK: { label: "Uden bemærkning", short: "OK", tone: "ok", order: 5 },
};

export const CLASS_LABELS: Record<string, string> = {
  K1: "Sedlens egen regning",
  K2: "Lovkrav",
  K3: "Kontrakt",
  K4: "Overenskomst",
  K5: "Grundlag",
  K6: "Saldi over perioder",
  K7: "Tid og kapacitet",
  K8: "Typede vilkår",
};

export const SECTION_LABELS: Record<string, string> = {
  lines: "Lønsedlens linjer",
  slip_level: "Hele sedlen",
  cross_slip: "På tværs af perioder",
  coverage: "Dækning og grundoplysninger",
};

export function kr(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("da-DK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function moneyChecks(checks: Check[]): Check[] {
  return checks.filter((check) => (check.kroner?.kr ?? 0) > 0);
}

export function hasVisibilityPolicy(report: Report): boolean {
  return report.checks.some((check) => check.visibility !== undefined);
}

export function checksForUi(report: Report): Check[] {
  return hasVisibilityPolicy(report)
    ? report.checks.filter((check) => check.visibility === "user_facing")
    : report.checks;
}

export function allReportChecks(report: Report): Check[] {
  const checks = new Map(report.checks.map((check) => [check.check_id, check]));
  for (const refusal of report.refusals) {
    if (!checks.has(refusal.check_id)) checks.set(refusal.check_id, refusal);
  }
  return [...checks.values()];
}

export function checksForLine(report: Report, line: SlipLine): Check[] {
  const lineCheckIds = new Set(line.checks);
  return allReportChecks(report).filter(
    (check) => check.line_index === line.index || lineCheckIds.has(check.check_id),
  );
}

export function lineForCheck(report: Report, checkId: string): SlipLine | null {
  const check = allReportChecks(report).find((candidate) => candidate.check_id === checkId);
  return (
    report.lines.find(
      (line) => line.checks.includes(checkId) || line.index === check?.line_index,
    ) ?? null
  );
}

export function checkPosition(report: Report, checkId: string): number | null {
  const index = report.checks.findIndex((check) => check.check_id === checkId);
  return index === -1 ? null : index + 1;
}

export function periodShort(period: string): string {
  const [y, m] = period.split("-");
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "maj",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "dec",
  ];
  return `${months[Number(m) - 1]} ${y?.slice(2)}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  const months = [
    "januar",
    "februar",
    "marts",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return `${months[Number(m) - 1]} ${y}`;
}
