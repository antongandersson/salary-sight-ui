import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { EmployerLetter } from "@/components/report/EmployerLetter";
import { EvidenceSheet } from "@/components/report/EvidenceSheet";
import { MemberQuestions } from "@/components/report/MemberQuestions";
import { PayslipWorkspace } from "@/components/report/PayslipWorkspace";
import { ReportOverview } from "@/components/report/ReportOverview";
import { ReviewQueue } from "@/components/report/ReviewQueue";
import { SourceProof } from "@/components/report/SourceProof";
import { ProcessingCase } from "@/components/upload/ProcessingCase";
import { UploadCase, type UploadSubmission } from "@/components/upload/UploadCase";
import { Button } from "@/components/ui/button";
import {
  createCase,
  getBatchStatus,
  getCaseDetail,
  getCaseSheet,
  getJobStatus,
  getLetterBasis,
  getReport,
  isDemoApi,
  listReports,
  PaytjekApiError,
  putBirthDate,
  putCaseContext,
  uploadBatch,
  uploadContract,
  type BatchStatus,
  type CaseSheetResult,
  type ContractUploadResponse,
  type DocumentSummary,
  type LetterBasis,
  type ReportIndexEntry,
  type ReportSource,
} from "@/lib/paytjek-api";
import { readyReports, reportKey } from "@/lib/report-index";
import { allReportChecks, periodLabel, type Report } from "@/lib/report";
import { buildReviewQueue, type ReviewItem } from "@/lib/review-queue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayTjek — upload og lønseddelkontrol" },
      {
        name: "description",
        content:
          "Upload lønsedler med kontrakt eller member context, og se middleware-resultatet i PayTjeks sagsskærm.",
      },
    ],
  }),
  component: PaytjekFlow,
});

type Phase = "upload" | "processing" | "report";
type ReportTab = "overblik" | "gennemgang" | "seddel" | "sporgsmaal" | "brev" | "datagrundlag";
type LoadedReport = {
  entry: ReportIndexEntry;
  key: string;
  report: Report;
  source: ReportSource;
};

const FAILED_STATES = new Set(["FAILED", "UNREADABLE"]);
const TERMINAL_JOB_STATES = new Set(["DONE", ...FAILED_STATES]);

function isTerminalJobState(state: string): boolean {
  return TERMINAL_JOB_STATES.has(state.toUpperCase());
}

function isFailedJobState(state: string): boolean {
  return FAILED_STATES.has(state.toUpperCase());
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Der opstod en ukendt fejl.";
}

function wasAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function loadReports(
  caseId: string,
  entries: readonly ReportIndexEntry[],
  signal?: AbortSignal,
): Promise<LoadedReport[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const result = await getReport(caseId, entry, signal);
      return {
        entry,
        key: reportKey(entry),
        report: result.report,
        source: result.source,
      };
    }),
  );
}

async function loadCaseSheet(
  caseId: string,
  signal?: AbortSignal,
): Promise<CaseSheetResult | null> {
  try {
    // Et stale case-sheet vises stadig — staleness mærkes i UI'et i stedet
    // for at kassere middlewarens data.
    return await getCaseSheet(caseId, signal);
  } catch (cause) {
    if (cause instanceof PaytjekApiError && cause.status === 404) return null;
    throw cause;
  }
}

async function loadLetterBasis(caseId: string, signal?: AbortSignal): Promise<LetterBasis | null> {
  try {
    return await getLetterBasis(caseId, signal);
  } catch (cause) {
    if (wasAborted(cause)) throw cause;
    return null;
  }
}

function PaytjekFlow() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [contractUpload, setContractUpload] = useState<ContractUploadResponse | null>(null);
  const [caseLabel, setCaseLabel] = useState("");
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [caseSheetResult, setCaseSheetResult] = useState<CaseSheetResult | null>(null);
  const [letterBasis, setLetterBasis] = useState<LetterBasis | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [caseContext, setCaseContext] = useState<Record<string, unknown>>({});
  const [contextFilename, setContextFilename] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState<number | null>(null);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [reportEntries, setReportEntries] = useState<ReportIndexEntry[]>([]);
  const [loadedReports, setLoadedReports] = useState<LoadedReport[]>([]);
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const resumeCaseId = search.get("case_id");
    if (!resumeCaseId) return;

    const controller = new AbortController();
    setBusy(true);
    setError(null);

    void Promise.all([
      listReports(resumeCaseId, controller.signal),
      getCaseDetail(resumeCaseId, controller.signal),
    ])
      .then(async ([index, detail]) => {
        const ready = readyReports(index.reports);
        const requestedPeriod = search.get("period");
        const requestedSlipKey = search.get("slip_key");
        const selected =
          ready.find(
            (entry) =>
              (requestedPeriod === null || entry.period === requestedPeriod) &&
              (requestedSlipKey === null || entry.slip_key === requestedSlipKey),
          ) ?? ready[0];
        if (!selected) throw new Error("Sagen har endnu ingen færdig rapport.");

        const [reports, caseSheet, loadedLetterBasis] = await Promise.all([
          loadReports(resumeCaseId, [selected], controller.signal),
          loadCaseSheet(resumeCaseId, controller.signal),
          loadLetterBasis(resumeCaseId, controller.signal),
        ]);
        const selectedReport = reports.find((candidate) => candidate.key === reportKey(selected));
        if (!selectedReport) throw new Error("Den valgte rapport kunne ikke hentes.");
        if (controller.signal.aborted) return;
        setCaseId(resumeCaseId);
        setCaseLabel(detail.label);
        setDocuments(detail.documents);
        setCaseContext(detail.context);
        setReportEntries(ready);
        setLoadedReports(reports);
        setSelectedReportKey(selectedReport.key);
        setReport(selectedReport.report);
        setReportSource(selectedReport.source);
        setCaseSheetResult(caseSheet);
        setLetterBasis(loadedLetterBasis);
        setPhase("report");
      })
      .catch((cause: unknown) => {
        if (!wasAborted(cause)) setError(message(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });

    return () => controller.abort();
  }, []);

  async function start(submission: UploadSubmission) {
    setBusy(true);
    setError(null);
    try {
      const createdCase = await createCase(submission.label, submission.agreementFamily);
      let contextResult = null;
      if (submission.memberContext) {
        contextResult = await putCaseContext(createdCase.case_id, submission.memberContext.payload);
        setContextFilename(submission.memberContext.file.name);
      }
      if (submission.birthDate) {
        contextResult = await putBirthDate(createdCase.case_id, submission.birthDate);
      }
      if (contextResult) {
        setCaseContext(contextResult.context);
        setContextRevision(contextResult.revision);
      }
      setBirthDate(submission.birthDate);
      const [batch, uploadedContract] = await Promise.all([
        uploadBatch(createdCase.case_id, submission.payslips),
        submission.contract
          ? uploadContract(createdCase.case_id, submission.contract)
          : Promise.resolve(null),
      ]);
      setCaseId(createdCase.case_id);
      setBatchId(batch.batch_id);
      setContractUpload(uploadedContract);
      setCaseLabel(createdCase.label);
      setBatchStatus({
        batch_id: batch.batch_id,
        state: "queued",
        jobs: [
          ...batch.jobs.map((job) => ({
            job_id: job.job_id,
            filename: job.filename,
            kind: job.kind,
            expected_kind: "payslip" as const,
            duplicate: job.duplicate,
            state: "QUEUED",
          })),
          ...(uploadedContract
            ? [
                {
                  job_id: uploadedContract.job_id,
                  filename: uploadedContract.filename,
                  kind: uploadedContract.kind,
                  expected_kind: "contract" as const,
                  duplicate: uploadedContract.duplicate,
                  state: "QUEUED",
                },
              ]
            : []),
        ],
      });
      setPhase("processing");
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (phase !== "processing" || caseId === "" || batchId === "" || error !== null) return;

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const [status, contractStatus] = await Promise.all([
          getBatchStatus(caseId, batchId, controller.signal),
          contractUpload
            ? getJobStatus(contractUpload.job_id, controller.signal)
            : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        const contractJob =
          contractUpload && contractStatus
            ? {
                job_id: contractStatus.job_id,
                filename: contractUpload.filename,
                // The dedicated contract endpoint declares the document kind. The
                // job endpoint is polled for processing state, not reclassification.
                kind: contractUpload.kind,
                expected_kind: "contract" as const,
                duplicate: contractUpload.duplicate,
                state: contractStatus.state,
                ...(contractStatus.period !== undefined ? { period: contractStatus.period } : {}),
                ...(contractStatus.error !== undefined ? { error: contractStatus.error } : {}),
              }
            : null;
        const allJobsComplete =
          status.state.toLowerCase() === "complete" &&
          (contractJob === null || isTerminalJobState(contractJob.state));
        const currentJobs = [...status.jobs, ...(contractJob === null ? [] : [contractJob])];
        setBatchStatus((current) => ({
          ...status,
          state: allJobsComplete ? "complete" : "processing",
          jobs: currentJobs.map((job) => {
            if (contractJob?.job_id === job.job_id) return contractJob;
            const existing = current?.jobs.find((candidate) => candidate.job_id === job.job_id);
            return {
              ...job,
              kind: existing?.kind,
              expected_kind: existing?.expected_kind,
              duplicate: existing?.duplicate,
            };
          }),
        }));

        if (allJobsComplete) {
          const [index, detail] = await Promise.all([
            listReports(caseId, controller.signal),
            getCaseDetail(caseId, controller.signal),
          ]);
          const ready = readyReports(index.reports);
          const first = ready[0];
          if (first) {
            const [caseSheet, loadedLetterBasis] = await Promise.all([
              loadCaseSheet(caseId, controller.signal),
              loadLetterBasis(caseId, controller.signal),
            ]);
            if (!caseSheet) {
              timer = setTimeout(poll, 1500);
              return;
            }
            const reports = await loadReports(caseId, [first], controller.signal);
            const selectedReport = reports.find((candidate) => candidate.key === reportKey(first));
            if (!selectedReport) throw new Error("Den valgte rapport kunne ikke hentes.");
            if (controller.signal.aborted) return;
            setCaseLabel(detail.label);
            setDocuments(detail.documents);
            setCaseContext(detail.context);
            setReportEntries(ready);
            setLoadedReports(reports);
            setSelectedReportKey(selectedReport.key);
            setReport(selectedReport.report);
            setReportSource(selectedReport.source);
            setCaseSheetResult(caseSheet);
            setLetterBasis(loadedLetterBasis);
            setPhase("report");
            return;
          }

          const everyDocumentFailed =
            currentJobs.length > 0 && currentJobs.every((job) => isFailedJobState(job.state));
          if (everyDocumentFailed) {
            setError("Ingen af dokumenterne kunne behandles, så der blev ikke dannet en rapport.");
            return;
          }
        }

        timer = setTimeout(poll, 1500);
      } catch (cause) {
        if (!wasAborted(cause)) setError(message(cause));
      }
    }

    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [batchId, caseId, contractUpload, error, phase]);

  async function selectReport(nextKey: string) {
    const entry = reportEntries.find((candidate) => reportKey(candidate) === nextKey);
    if (!entry) return;
    const loaded = loadedReports.find((candidate) => candidate.key === nextKey);
    if (loaded) {
      setReport(loaded.report);
      setReportSource(loaded.source);
      setSelectedReportKey(nextKey);
      return;
    }
    setReportLoading(true);
    setError(null);
    try {
      const result = await getReport(caseId, entry);
      setLoadedReports((current) => [
        ...current,
        { entry, key: nextKey, report: result.report, source: result.source },
      ]);
      setReport(result.report);
      setReportSource(result.source);
      setSelectedReportKey(nextKey);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setReportLoading(false);
    }
  }

  function reset() {
    setPhase("upload");
    setBusy(false);
    setError(null);
    setCaseId("");
    setBatchId("");
    setContractUpload(null);
    setCaseLabel("");
    setBatchStatus(null);
    setReport(null);
    setReportSource(null);
    setCaseSheetResult(null);
    setLetterBasis(null);
    setDocuments([]);
    setCaseContext({});
    setContextFilename(null);
    setContextRevision(null);
    setBirthDate(null);
    setReportEntries([]);
    setLoadedReports([]);
    setSelectedReportKey("");
  }

  if (phase === "processing") {
    return (
      <ProcessingCase
        birthDate={birthDate}
        contextFilename={contextFilename}
        error={error}
        label={caseLabel}
        onCancel={reset}
        status={batchStatus}
      />
    );
  }

  if (phase === "report" && report && reportSource) {
    return (
      <CaseScreen
        caseId={caseId}
        caseLabel={caseLabel}
        caseContext={caseContext}
        caseSheetResult={caseSheetResult}
        contextFilename={contextFilename}
        contextRevision={contextRevision}
        documents={documents}
        error={error}
        letterBasis={letterBasis}
        loading={reportLoading}
        onNewCase={reset}
        onSelectReport={selectReport}
        report={report}
        reportEntries={reportEntries}
        reportSource={reportSource}
        selectedReportKey={selectedReportKey}
      />
    );
  }

  return <UploadCase busy={busy} error={error} onSubmit={start} />;
}

function CaseScreen({
  caseId,
  caseLabel,
  caseContext,
  caseSheetResult,
  contextFilename,
  contextRevision,
  documents,
  error,
  letterBasis,
  loading,
  onNewCase,
  onSelectReport,
  report,
  reportEntries,
  reportSource,
  selectedReportKey,
}: {
  caseId: string;
  caseLabel: string;
  caseContext: Record<string, unknown>;
  caseSheetResult: CaseSheetResult | null;
  contextFilename: string | null;
  contextRevision: number | null;
  documents: DocumentSummary[];
  error: string | null;
  letterBasis: LetterBasis | null;
  loading: boolean;
  onNewCase: () => void;
  onSelectReport: (key: string) => Promise<void>;
  report: Report;
  reportEntries: ReportIndexEntry[];
  reportSource: ReportSource;
  selectedReportKey: string;
}) {
  const [tab, setTab] = useState<ReportTab>("overblik");
  const [focus, setFocus] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(new Set());

  const checks = allReportChecks(report);
  const focused = focus ? (checks.find((check) => check.check_id === focus) ?? null) : null;
  const reviewQueue = buildReviewQueue(caseSheetResult?.caseSheet ?? null);
  const queueIndex = focused
    ? reviewQueue.findIndex(
        (item) => item.checkId === focused.check_id && item.slipKey === report.slip.slip_key,
      )
    : -1;
  const queueItem = queueIndex >= 0 ? reviewQueue[queueIndex] : undefined;
  const queuePrev = queueIndex > 0 ? reviewQueue[queueIndex - 1] : undefined;
  const queueNext =
    queueIndex >= 0 && queueIndex < reviewQueue.length - 1
      ? reviewQueue[queueIndex + 1]
      : undefined;

  function toggleReviewed(id: string) {
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openQueueItem(item: ReviewItem) {
    void showCheck(item.checkId, reportKey({ period: item.period, slip_key: item.slipKey }));
  }
  const reportsByPeriod = new Map<string, number>();
  for (const entry of reportEntries) {
    reportsByPeriod.set(entry.period, (reportsByPeriod.get(entry.period) ?? 0) + 1);
  }

  function selectControl(checkId: string) {
    setFocus(checkId);
    setEvidenceOpen(true);
  }

  async function showCheck(checkId: string, nextReportKey = selectedReportKey) {
    if (nextReportKey !== selectedReportKey) await onSelectReport(nextReportKey);
    setFocus(checkId);
    setTab("seddel");
    setEvidenceOpen(true);
  }

  async function openReport(nextReportKey: string) {
    if (nextReportKey !== selectedReportKey) await onSelectReport(nextReportKey);
    setFocus(null);
    setEvidenceOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-tight text-accent">PAYTJEK</span>
            <span className="text-sm font-semibold text-foreground">Lønseddelkontrol</span>
          </div>
          <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>{caseLabel}</span>
            <span>Periode {periodLabel(report.slip.period)}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isDemoApi() ? (
              <span className="rounded-full border border-forbehold/40 bg-forbehold-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-forbehold">
                Testmiljø
              </span>
            ) : null}
            {reportEntries.find((entry) => reportKey(entry) === selectedReportKey)?.stale ? (
              <span
                className="rounded-full border border-forbehold/40 bg-forbehold-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-forbehold"
                title="Rapportindekset markerer denne rapport som forældet — middleware har en nyere generation undervejs."
              >
                Forældet generation
              </span>
            ) : null}
            {reportEntries.length > 1 ? (
              <select
                aria-label="Vælg lønperiode"
                className="h-8 rounded-md border border-input bg-card px-2 text-[13px]"
                disabled={loading}
                onChange={(event) => void openReport(event.target.value)}
                value={selectedReportKey}
              >
                {reportEntries.map((entry) => (
                  <option key={reportKey(entry)} value={reportKey(entry)}>
                    {periodLabel(entry.period)}
                    {(reportsByPeriod.get(entry.period) ?? 0) > 1
                      ? ` · ${entry.slip_key.slice(0, 6)}`
                      : ""}
                  </option>
                ))}
              </select>
            ) : null}
            <Button onClick={onNewCase} size="sm" type="button" variant="outline">
              Ny sag
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {error ? (
          <p
            className="mb-4 rounded-md border border-mismatch/40 bg-mismatch-soft p-3 text-[14px] text-mismatch"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="paper flex flex-wrap items-center gap-1 rounded-lg px-3 py-1.5">
          {(
            [
              "overblik",
              "gennemgang",
              "seddel",
              "sporgsmaal",
              "brev",
              "datagrundlag",
            ] as ReportTab[]
          ).map((nextTab) => (
            <button
              aria-pressed={tab === nextTab}
              className={`rounded-md px-3 py-1.5 text-[14px] font-semibold transition-colors ${
                tab === nextTab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              key={nextTab}
              onClick={() => setTab(nextTab)}
              type="button"
            >
              {nextTab === "overblik"
                ? "Sagsoversigt"
                : nextTab === "gennemgang"
                  ? `Gennemgang ${reviewQueue.length}`
                  : nextTab === "seddel"
                    ? `Lønsedler ${reportEntries.length}`
                    : nextTab === "sporgsmaal"
                      ? `Spørgsmål ${caseSheetResult?.caseSheet.needs_input.filter((input) => input.ask_target === "member").length ?? 0}`
                      : nextTab === "brev"
                        ? "Arbejdsgiverbrev"
                        : "Grundlag & kilder"}
            </button>
          ))}
        </div>

        {tab === "overblik" ? (
          <div className="mt-5">
            <ReportOverview
              caseSheet={caseSheetResult?.caseSheet ?? null}
              caseSheetSource={caseSheetResult?.source ?? null}
              currentReportKey={selectedReportKey}
              onOpenReport={(nextReportKey) => {
                void openReport(nextReportKey);
                setTab("seddel");
              }}
              onSelect={(nextReportKey, checkId) => void showCheck(checkId, nextReportKey)}
              reports={reportEntries.map((entry) => ({
                key: reportKey(entry),
                period: entry.period,
                slipKey: entry.slip_key,
              }))}
            />
          </div>
        ) : tab === "gennemgang" ? (
          <div className="mt-5">
            <ReviewQueue
              onOpen={openQueueItem}
              onToggleReviewed={toggleReviewed}
              queue={reviewQueue}
              reviewed={reviewed}
            />
          </div>
        ) : tab === "sporgsmaal" ? (
          <div className="mt-5">
            <MemberQuestions caseSheet={caseSheetResult?.caseSheet ?? null} />
          </div>
        ) : tab === "brev" ? (
          <div className="mt-5">
            <EmployerLetter basis={letterBasis} />
          </div>
        ) : tab === "datagrundlag" ? (
          <div className="mx-auto mt-4 max-w-5xl">
            <SourceProof
              caseContext={caseContext}
              caseId={caseId}
              caseSheet={caseSheetResult?.caseSheet ?? null}
              contextFilename={contextFilename}
              contextRevision={contextRevision}
              documents={documents}
              source={reportSource}
            />
          </div>
        ) : (
          <div className="mt-5">
            <PayslipWorkspace
              caseSheet={caseSheetResult?.caseSheet ?? null}
              entries={reportEntries}
              key={report.slip.slip_key}
              loading={loading}
              onOpenEvidence={selectControl}
              onSelectReport={(nextKey) => void openReport(nextKey)}
              report={report}
              selectedReportKey={selectedReportKey}
            />
          </div>
        )}
      </main>
      <EvidenceSheet
        check={focused}
        onOpenChange={setEvidenceOpen}
        onShowQuestions={() => {
          setEvidenceOpen(false);
          setTab("sporgsmaal");
        }}
        open={evidenceOpen}
        queueNav={
          queueItem
            ? {
                index: queueIndex,
                total: reviewQueue.length,
                reviewed: reviewed.has(queueItem.id),
                onPrev: queuePrev ? () => openQueueItem(queuePrev) : null,
                onNext: queueNext ? () => openQueueItem(queueNext) : null,
                onReviewedNext: () => {
                  setReviewed((current) => new Set(current).add(queueItem.id));
                  if (queueNext) openQueueItem(queueNext);
                },
              }
            : null
        }
        report={report}
      />
    </div>
  );
}
