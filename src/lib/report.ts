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
};

export type Check = {
  check_id: string;
  check_class: string;
  title: string;
  terminal: Terminal;
  visibility?: "internal" | "user_facing";
  section: string;
  surface: string;
  substance?: "finding" | "generic" | null;
  duty?: string | null;
  note?: string | null;
  quotes?: string[];
  line_index?: number | null;
  authored?: boolean;
  closable_by_document?: boolean;
  computation?: {
    arithmetic?: string | null;
    inputs?: ComputationInput[];
    sources?: string[];
  } | null;
  kroner?: Kroner | null;
  missing?: {
    artifact?: string;
    kind?: string;
    unlocks?: string;
    closable_by_document?: boolean;
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
  questions: Array<{
    key: string;
    label: string;
    question: string;
    raised: boolean;
    raised_by: Array<{ rule_id: string; detail: string; binding: string }>;
  }>;
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
