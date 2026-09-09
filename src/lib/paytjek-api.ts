import type { CaseSheet } from "@/lib/case-sheet";
import type { Report } from "@/lib/report";

const DEFAULT_API_BASE_URL =
  "https://paytjekdemoserviceseb3e8725-paytjek-platform-api.functions.fnc.pl-waw.scw.cloud";

export type AgreementFamily = "IND23" | "IND25";
export type DocumentKind = "payslip" | "contract" | "unknown";

export type BatchJob = {
  job_id: string;
  filename: string;
  kind?: DocumentKind | undefined;
  expected_kind?: Exclude<DocumentKind, "unknown"> | undefined;
  duplicate?: boolean | null | undefined;
  state: string;
  period?: string | null;
  error?: Record<string, unknown> | null;
};

export type BatchStatus = {
  batch_id: string;
  state: string;
  jobs: BatchJob[];
};

type CreateCaseResponse = {
  case_id: string;
  label: string;
};

export type CreateBatchResponse = {
  batch_id: string;
  jobs: Array<{
    job_id: string;
    filename: string;
    kind: DocumentKind;
    duplicate?: boolean | null;
  }>;
};

type RawCreateBatchResponse = {
  batch_id: string;
  jobs: Array<{
    job_id: string;
    filename: string;
    kind: string;
    duplicate?: boolean | null;
  }>;
};

export type ContractUploadResponse = {
  batch_id: string;
  job_id: string;
  document_id: string;
  filename: string;
  kind: "contract";
  duplicate?: boolean | null;
};

type RawContractUploadResponse = Omit<ContractUploadResponse, "kind"> & {
  kind?: string;
};

export type JobStatusResponse = {
  job_id: string;
  case_id: string;
  kind: DocumentKind;
  state: string;
  stage_timestamps: Record<string, string | null>;
  period?: string | null;
  report_ref?: string | null;
  error?: Record<string, unknown> | null;
};

type RawJobStatusResponse = Omit<JobStatusResponse, "kind"> & { kind: string };

export type ReportIndexEntry = {
  period: string;
  slip_key: string;
  generation: number;
  rendered_at?: string | null;
  inputs_digest: string;
  stale: boolean;
  report_url: string;
  html_url: string;
  is_revision?: boolean;
  revises_slip_key?: string | null;
};

export type ReportIndexResponse = {
  case_sheet?: {
    url: string;
    html_url?: string;
    generation?: number;
    inputs_digest?: string;
    rendered_at?: string | null;
    stale: boolean;
  };
  reports: ReportIndexEntry[];
};

export type LetterBasisFinding = {
  axis?: string;
  check_family?: string;
  family?: string;
  first_month: string;
  last_month: string;
  limitation_flag?: boolean;
  months: Array<{
    computation?: string | null;
    kr: number | null;
    line?: string | null;
    period: string;
    row_arithmetic?: string | null;
  }>;
  months_count: number;
  pattern?: string;
  quotes?: string[];
  settlement_status?: string;
  source_location?: string;
  title: string;
  total_kr: number | null;
};

export type LetterBasis = {
  agreements: string[];
  case: string;
  findings: LetterBasisFinding[];
  limitation_rule?: { text?: string; years?: number | null };
  provenance?: {
    built_from?: string;
    llm_in_render_path?: boolean;
    renderer?: string;
  };
  schema: string;
  session_id?: string;
  totals?: {
    axes?: Record<string, { findings: number; label: string; total_kr: number | null }>;
    count?: number;
    money_rule?: string;
    total_kr?: number | null;
  };
};

export type DocumentSummary = {
  document_id: string;
  batch_id: string;
  kind: string;
  filename: string;
  sha256: string;
  uploaded_at: string;
};

export type CaseDetail = {
  case_id: string;
  label: string;
  agreement_family?: string | null;
  created_at: string;
  context: Record<string, unknown>;
  documents: DocumentSummary[];
  reports: ReportIndexEntry[];
};

export type PutContextResponse = {
  case_id: string;
  revision: number;
  context: Record<string, unknown>;
  reaudit_enqueued: number;
  usercontext_v1: Record<string, unknown>;
};

export type ReportSource = {
  generation: number;
  inputsDigest: string;
  renderedAt: string | null;
  stale: boolean;
  verified: boolean;
};

export type ReportResult = {
  report: Report;
  source: ReportSource;
};

export type CaseSheetSource = {
  generation: number | null;
  inputsDigest: string | null;
  renderedAt: string | null;
  stale: boolean;
};

export type CaseSheetResult = {
  caseSheet: CaseSheet;
  source: CaseSheetSource;
};

export class PaytjekApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaytjekApiError";
  }
}

function baseUrl(): string {
  return (import.meta.env["VITE_PAYTJEK_API_BASE_URL"]?.trim() || DEFAULT_API_BASE_URL).replace(
    /\/$/,
    "",
  );
}

export function isDemoApi(): boolean {
  return baseUrl().toLowerCase().includes("demo");
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new PaytjekApiError(
      detail ? `Middleware afviste anmodningen: ${detail}` : "Middleware afviste anmodningen.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return json<T>(
    await fetch(`${baseUrl()}${path}`, {
      headers: { accept: "application/json" },
      signal: signal ?? null,
    }),
  );
}

function documentKind(value: string): DocumentKind {
  const normalized = value.toLowerCase();
  return normalized === "payslip" || normalized === "contract" ? normalized : "unknown";
}

export async function createCase(
  label: string,
  agreementFamily: AgreementFamily | null,
): Promise<CreateCaseResponse> {
  return json<CreateCaseResponse>(
    await fetch(`${baseUrl()}/api/v1/cases`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        label,
        ...(agreementFamily === null ? {} : { agreement_family: agreementFamily }),
      }),
    }),
  );
}

export async function uploadBatch(
  caseId: string,
  files: readonly File[],
): Promise<CreateBatchResponse> {
  const body = new FormData();
  for (const file of files) body.append("files", file, file.name);

  const result = await json<RawCreateBatchResponse>(
    await fetch(`${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/batches`, {
      method: "POST",
      headers: { accept: "application/json" },
      body,
    }),
  );
  return {
    batch_id: result.batch_id,
    jobs: result.jobs.map((job) => ({ ...job, kind: documentKind(job.kind) })),
  };
}

export async function uploadContract(caseId: string, file: File): Promise<ContractUploadResponse> {
  const body = new FormData();
  body.append("file", file, file.name);

  const result = await json<RawContractUploadResponse>(
    await fetch(`${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/contract`, {
      method: "POST",
      headers: { accept: "application/json" },
      body,
    }),
  );
  return { ...result, kind: "contract" };
}

export async function putCaseContext(
  caseId: string,
  context: Record<string, unknown>,
): Promise<PutContextResponse> {
  return json<PutContextResponse>(
    await fetch(`${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/context`, {
      method: "PUT",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(context),
    }),
  );
}

export async function putBirthDate(caseId: string, birthDate: string): Promise<PutContextResponse> {
  return json<PutContextResponse>(
    await fetch(`${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/birth-date`, {
      method: "PUT",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ birth_date: birthDate }),
    }),
  );
}

export function getBatchStatus(
  caseId: string,
  batchId: string,
  signal?: AbortSignal,
): Promise<BatchStatus> {
  return get<BatchStatus>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/batches/${encodeURIComponent(batchId)}`,
    signal,
  );
}

export async function getJobStatus(
  jobId: string,
  signal?: AbortSignal,
): Promise<JobStatusResponse> {
  const result = await get<RawJobStatusResponse>(
    `/api/v1/jobs/${encodeURIComponent(jobId)}`,
    signal,
  );
  return { ...result, kind: documentKind(result.kind) };
}

export function listReports(caseId: string, signal?: AbortSignal): Promise<ReportIndexResponse> {
  return get<ReportIndexResponse>(`/api/v1/cases/${encodeURIComponent(caseId)}/reports`, signal);
}

export function getCaseDetail(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  return get<CaseDetail>(`/api/v1/cases/${encodeURIComponent(caseId)}`, signal);
}

export async function getCaseSheet(caseId: string, signal?: AbortSignal): Promise<CaseSheetResult> {
  const response = await fetch(
    `${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/case-sheet`,
    {
      headers: { accept: "application/json" },
      signal: signal ?? null,
    },
  );
  const caseSheet = await json<CaseSheet>(response);
  const generationValue = response.headers.get("x-report-generation");
  const generation = generationValue === null ? Number.NaN : Number(generationValue);

  return {
    caseSheet,
    source: {
      generation: Number.isFinite(generation) ? generation : null,
      inputsDigest: response.headers.get("x-report-inputs-digest"),
      renderedAt: response.headers.get("x-report-rendered-at"),
      stale: response.headers.get("x-report-stale") === "true",
    },
  };
}

export function getLetterBasis(caseId: string, signal?: AbortSignal): Promise<LetterBasis> {
  return get<LetterBasis>(`/api/v1/cases/${encodeURIComponent(caseId)}/case-sheet/brev`, signal);
}

export async function getReport(
  caseId: string,
  entry: ReportIndexEntry,
  signal?: AbortSignal,
): Promise<ReportResult> {
  const query = new URLSearchParams({ slip_key: entry.slip_key });
  const response = await fetch(
    `${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(entry.period)}?${query}`,
    {
      headers: { accept: "application/json" },
      signal: signal ?? null,
    },
  );
  const report = await json<Report>(response);
  const headerGenerationValue = response.headers.get("x-report-generation");
  const headerGeneration =
    headerGenerationValue === null ? Number.NaN : Number(headerGenerationValue);
  const headerDigest = response.headers.get("x-report-inputs-digest");
  const headerRenderedAt = response.headers.get("x-report-rendered-at");
  const headerStale = response.headers.get("x-report-stale");
  const generation = Number.isFinite(headerGeneration) ? headerGeneration : entry.generation;
  const inputsDigest = headerDigest ?? entry.inputs_digest;
  const stale = headerStale === null ? entry.stale : headerStale === "true";
  const identityMatches =
    report.slip.period === entry.period && report.slip.slip_key === entry.slip_key;

  return {
    report,
    source: {
      generation,
      inputsDigest,
      renderedAt: headerRenderedAt ?? entry.rendered_at ?? null,
      stale,
      verified:
        identityMatches &&
        generation === entry.generation &&
        inputsDigest === entry.inputs_digest &&
        stale === entry.stale,
    },
  };
}
