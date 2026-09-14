export type CaseSheetMonthReference = {
  ask_target?: "member" | "unstated" | string | null;
  check_id: string;
  kr?: number | null;
  period: string;
  settling_document?: string | null;
  slip_key: string;
  terminal?: string;
  unlocks?: string | null;
  // Fuld måneds-beregning fra middleware (nyt format): gengives, aldrig
  // genberegnet.
  alternatives?: unknown;
  arithmetic?: string | null;
  coupling?: unknown;
  derived?: unknown;
  derived_total?: number | null;
  expected?: number | null;
  explanation?: string | null;
  how?: string | null;
  inputs?: unknown;
  line_description?: string | null;
  line_index?: number | null;
  month_index?: number | null;
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
  limitation_flag?: boolean;
  limitation_months?: string[];
  money_how?: string | null;
  months_affected?: string[];
  months_kr_determined?: number | null;
  months_kr_undetermined?: number | null;
  quote_source?: string | null;
  runs?: unknown;
  settled_period?: string | null;
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
  spec_2b_input?: unknown;
};

export type CaseSheetRefused = {
  count: number;
  families?: string[];
  family?: string;
  months_affected?: string[];
  months_count?: number;
  slips_count?: number;
  title?: string;
};

export type CaseSheetClaim = {
  axis?: string;
  balance_by_period?: unknown;
  by_layer?: unknown;
  check_class?: string;
  claim_no?: number;
  derived_components?: unknown;
  impacts?: unknown[];
  impacts_count?: number;
  last_impact_period?: string | null;
  layer_note?: string | null;
  months_affected?: string[];
  opened_period?: string | null;
  principal_kr?: number | null;
  remaining_balance_kr?: number | null;
  root_cause?: string | null;
  settlement_allocated?: unknown;
  settlement_candidates?: unknown;
  settlement_refusals?: unknown;
  settlement_status?: string | null;
  single_layer?: string | boolean | null;
  title: string;
};

export type CaseSheetClaimsLedger = {
  claims: CaseSheetClaim[];
  last_period?: string;
  schema?: string;
  scope_rule?: string;
  settlement_rule?: string;
  sum_rule?: string;
  totals_by_layer?: Record<
    string,
    {
      claims?: number;
      label?: string;
      principal_kr?: number | null;
      remaining_kr?: number | null;
    }
  >;
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
  rollup_unpriced_months?: number | null;
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
    months_affected?: string[];
    sum_rule?: string;
    total_kr?: number | null;
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
    grundforloeb_bestaaet?: CaseSheetGroundValue;
    satsberegning_dato?: CaseSheetGroundValue;
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
    excluded_by_mutual_exclusion_kr?: number | null;
    mutual_exclusion_note?: string | null;
    settled_by_a_later_slip?: unknown;
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
  by_class_terminal?: Record<string, Record<string, number>>;
  claims_ledger?: CaseSheetClaimsLedger;
  // Sagsniveau-kontroller ("Sagens dækning") — samme form som rapportens checks.
  coverage_checks?: Array<Record<string, unknown>>;
  document_list?: unknown[];
  forbehold?: CaseSheetNeedInput[];
  limitation_rule?: { text?: string; years?: number | null };
  pension?: unknown;
  recurring_issues?: Array<{
    ask_target?: string;
    families?: string[];
    issue_no?: number;
    key?: string;
    kind?: string;
    months_affected?: string[];
    months_count?: number;
    rows?: unknown;
    slips_count?: number;
    statement?: string | null;
    title?: string | null;
  }>;
  refused?: CaseSheetRefused[];
  step_timing?: CaseSheetStepTiming[];
  substance_summary?: Record<string, unknown>;
  totals_excluding_category_d?: Record<string, number>;
  totals_full_row_list?: Record<string, number>;
};
