import type { Report } from "@/lib/report";

const DEFAULT_API_BASE_URL =
  "https://paytjekdemoserviceseb3e8725-paytjek-platform-api.functions.fnc.pl-waw.scw.cloud";

export type AgreementFamily = "IND23" | "IND25";

export type BatchJob = {
  job_id: string;
  filename: string;
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

type CreateBatchResponse = {
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
  stale: boolean;
};

type ReportIndexResponse = {
  reports: ReportIndexEntry[];
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

  return json<CreateBatchResponse>(
    await fetch(`${baseUrl()}/api/v1/cases/${encodeURIComponent(caseId)}/batches`, {
      method: "POST",
      headers: { accept: "application/json" },
      body,
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

export function listReports(caseId: string, signal?: AbortSignal): Promise<ReportIndexResponse> {
  return get<ReportIndexResponse>(`/api/v1/cases/${encodeURIComponent(caseId)}/reports`, signal);
}

export function getReport(
  caseId: string,
  entry: ReportIndexEntry,
  signal?: AbortSignal,
): Promise<Report> {
  const query = new URLSearchParams({ slip_key: entry.slip_key });
  return get<Report>(
    `/api/v1/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(entry.period)}?${query}`,
    signal,
  );
}
