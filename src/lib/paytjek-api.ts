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

export type ReportIndexEntry = {
  period: string;
  slip_key: string;
  generation: number;
  rendered_at?: string | null;
  inputs_digest: string;
  stale: boolean;
  report_url: string;
  html_url: string;
};

type ReportIndexResponse = {
  reports: ReportIndexEntry[];
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
    jobs: result.jobs.map((job) => {
      const normalizedKind = job.kind.toLowerCase();
      return {
        ...job,
        kind:
          normalizedKind === "payslip" || normalizedKind === "contract"
            ? normalizedKind
            : "unknown",
      };
    }),
  };
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

export function listReports(caseId: string, signal?: AbortSignal): Promise<ReportIndexResponse> {
  return get<ReportIndexResponse>(`/api/v1/cases/${encodeURIComponent(caseId)}/reports`, signal);
}

export function getCaseDetail(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  return get<CaseDetail>(`/api/v1/cases/${encodeURIComponent(caseId)}`, signal);
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
