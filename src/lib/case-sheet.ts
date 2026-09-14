export type CaseSheetMonthReference = {
  ask_target?: "member" | "unstated" | string | null;
  check_id: string;
  kr?: number | null;
  period: string;
  settling_document?: string | null;
  slip_key: string;
  terminal?: string;
  unlocks?: string | null;
  // Fra case-sheetets måneds-beregninger (nyt format) — vises i Gennemgangen,
  // aldrig genberegnet.
  expected?: number | null;
  line_description?: string | null;
  older_than_limitation?: boolean | null;
  printed?: number | null;
};

export type CaseSheetFinding = {
  axis?: string;
  check_class?: string;
  family: string;
  first_month: string;
  last_month: string;
  months: CaseSheetMonthReference[];
  months_count: number;
  pattern: string;
  settlement_status: string;
  settled?: boolean;
  note?: string | null;
  quotes?: string[];
  rule_id?: string | null;
  source_location?: string | null;
  title: string;
  total_kr: number | null;
};

export type CaseSheetPossibleClaimFamily = {
  family: string;
  months: CaseSheetMonthReference[];
  months_count: number;
  settling_documents: string[];
  title: string;
  total_kr: number | null;
};

export type CaseSheetNeedInput = {
  artifact: string;
  ask_target?: "member" | "unstated" | string;
  count: number;
  families?: string[];
  kind: string;
  months_affected: string[];
  months_count: number;
  slips_count: number;
  unlocks: string;
};

export type CaseSheetStepTiming = {
  derivation?: string | null;
  due_month?: string | null;
  floor?: number | null;
  floor_convention?: string | null;
  headline?: string | null;
  kind?: string | null;
  label?: string | null;
  ladder?: unknown;
  missing_artifact?: string | null;
  missing_months?: string[];
  months_late?: number | null;
  moved_month?: string | null;
  quote?: string | null;
  rate_after?: number | null;
  rate_before?: number | null;
  rate_before_month?: string | null;
  rendered_on_slip?: boolean | string | null;
  rollup_kr?: number | null;
  rollup_months?: number | null;
  // Liste af perioder uden fastsat beløb (kan i ældre data være et antal).
  rollup_unpriced_months?: string[] | number | null;
  rule_id?: string | null;
  source_location?: string | null;
  terminal?: string | null;
  window_k4_terminals?: unknown;
  window_months?: unknown;
};

type CaseSheetGroundValue = {
  label?: string;
  page?: number | null;
  provenance?: Record<string, unknown> | null;
  quote?: string | null;
  source?: string;
  value?: string | number | boolean | null;
};

type CaseSheetCoverage = {
  evidence?: Record<string, unknown> | null;
  source?: string;
  status?: string;
};

export type CaseSheet = {
  agreements: string[];
  case: string;
  control_points: {
    count: number;
    families?: Array<{
      check_class?: string;
      count: number;
      family: string;
      months_affected: string[];
      months_count: number;
      slips_count: number;
      terminals: string[];
      title: string;
    }>;
    label: string;
    note: string;
  };
  findings: CaseSheetFinding[];
  findings_summary: {
    axes?: Record<string, { findings: number; label: string; total_kr: number | null }>;
    count: number;
    money_rule: string;
    months_affected: number;
    three_figures_rule: string;
    total_kr: number | null;
  };
  grundlag: {
    contract_start_date?: CaseSheetGroundValue;
    coverage?: CaseSheetCoverage;
    elevaar?: CaseSheetGroundValue;
    employment_type?: CaseSheetGroundValue;
    staff_group?: CaseSheetGroundValue;
    timer_pr_uge?: CaseSheetGroundValue;
  };
  needs_input: CaseSheetNeedInput[];
  possible_claims: {
    count: number;
    families: CaseSheetPossibleClaimFamily[];
    label: string;
    months_affected: number;
    note: string;
    sum_rule: string;
    total_kr: number | null;
  };
  provenance: {
    built_from: string;
    llm_in_render_path: boolean;
    renderer: string;
  };
  schema: string;
  session_id: string;
  slips: {
    count: number;
    first_period: string;
    last_period: string;
    missing_periods: string[];
    periods: string[];
    slip_keys: string[];
  };
  totals_by_terminal: Record<string, number>;
  document_list?: unknown[];
  limitation_rule?: { text?: string; years?: number | null };
  recurring_issues?: unknown[];
  step_timing?: CaseSheetStepTiming[];
};
