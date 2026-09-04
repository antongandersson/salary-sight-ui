import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PayslipView } from "@/components/report/PayslipView";
import { ReportChecks, type CheckFilter } from "@/components/report/ReportChecks";
import { ReportOverview } from "@/components/report/ReportOverview";
import { SideRail } from "@/components/report/SideRail";
import { SourceProof } from "@/components/report/SourceProof";
import { ProcessingCase } from "@/components/upload/ProcessingCase";
import { UploadCase, type UploadSubmission } from "@/components/upload/UploadCase";
import { Button } from "@/components/ui/button";
import {
  createCase,
  getBatchStatus,
  getCaseDetail,
  getReport,
  isDemoApi,
  listReports,
  putCaseContext,
  uploadBatch,
  type BatchStatus,
  type DocumentSummary,
  type ReportIndexEntry,
  type ReportSource,
} from "@/lib/paytjek-api";
import { checksForUi, periodLabel, TERMINALS, type Report, type Terminal } from "@/lib/report";

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

type Mode = "hurtig" | "revision";
type Phase = "upload" | "processing" | "report";
type ReportTab = "overblik" | "kontroller" | "seddel" | "datagrundlag";
type LoadedReport = {
  entry: ReportIndexEntry;
  key: string;
  report: Report;
  source: ReportSource;
};

const TERMINAL_ORDER: Terminal[] = [
  "MISMATCH",
  "NEEDS_INPUT",
  "FORBEHOLD",
  "REFUSED",
  "KONTROLPUNKT",
  "OK",
];
const FAILED_STATES = new Set(["FAILED", "UNREADABLE"]);

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Der opstod en ukendt fejl.";
}

function wasAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function reportKey(entry: ReportIndexEntry): string {
  return `${entry.period}:${entry.slip_key}`;
}

function readyReports(entries: readonly ReportIndexEntry[]): ReportIndexEntry[] {
  return entries
    .filter((entry) => !entry.stale)
    .sort((left, right) =>
      right.period === left.period
        ? right.slip_key.localeCompare(left.slip_key)
        : right.period.localeCompare(left.period),
    );
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

function PaytjekFlow() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [caseLabel, setCaseLabel] = useState("");
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [caseContext, setCaseContext] = useState<Record<string, unknown>>({});
  const [contextFilename, setContextFilename] = useState<string | null>(null);
  const [contextRevision, setContextRevision] = useState<number | null>(null);
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

        const reports = await loadReports(resumeCaseId, ready, controller.signal);
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
      if (submission.memberContext) {
        const contextResult = await putCaseContext(
          createdCase.case_id,
          submission.memberContext.payload,
        );
        setCaseContext(contextResult.context);
        setContextFilename(submission.memberContext.file.name);
        setContextRevision(contextResult.revision);
      }
      const selectedDocuments = [
        ...submission.payslips.map((file) => ({ file, expectedKind: "payslip" as const })),
        ...(submission.contract
          ? [{ file: submission.contract, expectedKind: "contract" as const }]
          : []),
      ];
      const batch = await uploadBatch(
        createdCase.case_id,
        selectedDocuments.map((document) => document.file),
      );
      const expectedKindsByFilename = new Map<
        string,
        Array<(typeof selectedDocuments)[number]["expectedKind"]>
      >();
      for (const document of selectedDocuments) {
        const expectedKinds = expectedKindsByFilename.get(document.file.name) ?? [];
        expectedKinds.push(document.expectedKind);
        expectedKindsByFilename.set(document.file.name, expectedKinds);
      }
      setCaseId(createdCase.case_id);
      setBatchId(batch.batch_id);
      setCaseLabel(createdCase.label);
      setBatchStatus({
        batch_id: batch.batch_id,
        state: "queued",
        jobs: batch.jobs.map((job) => {
          const expectedKinds = expectedKindsByFilename.get(job.filename);
          return {
            job_id: job.job_id,
            filename: job.filename,
            kind: job.kind,
            expected_kind: expectedKinds?.shift(),
            duplicate: job.duplicate,
            state: "QUEUED",
          };
        }),
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
        const status = await getBatchStatus(caseId, batchId, controller.signal);
        if (controller.signal.aborted) return;
        setBatchStatus((current) => ({
          ...status,
          jobs: status.jobs.map((job) => {
            const existing = current?.jobs.find((candidate) => candidate.job_id === job.job_id);
            return {
              ...job,
              kind: existing?.kind,
              expected_kind: existing?.expected_kind,
              duplicate: existing?.duplicate,
            };
          }),
        }));

        if (status.state.toLowerCase() === "complete") {
          const [index, detail] = await Promise.all([
            listReports(caseId, controller.signal),
            getCaseDetail(caseId, controller.signal),
          ]);
          const ready = readyReports(index.reports);
          const first = ready[0];
          if (first) {
            const reports = await loadReports(caseId, ready, controller.signal);
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
            setPhase("report");
            return;
          }

          const everyDocumentFailed =
            status.jobs.length > 0 && status.jobs.every((job) => FAILED_STATES.has(job.state));
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
  }, [batchId, caseId, error, phase]);

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
    setCaseLabel("");
    setBatchStatus(null);
    setReport(null);
    setReportSource(null);
    setDocuments([]);
    setCaseContext({});
    setContextFilename(null);
    setContextRevision(null);
    setReportEntries([]);
    setLoadedReports([]);
    setSelectedReportKey("");
  }

  if (phase === "processing") {
    return (
      <ProcessingCase
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
        contextFilename={contextFilename}
        contextRevision={contextRevision}
        documents={documents}
        error={error}
        loading={reportLoading}
        onNewCase={reset}
        onSelectReport={selectReport}
        report={report}
        reportEntries={reportEntries}
        reports={loadedReports}
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
  contextFilename,
  contextRevision,
  documents,
  error,
  loading,
  onNewCase,
  onSelectReport,
  report,
  reportEntries,
  reports,
  reportSource,
  selectedReportKey,
}: {
  caseId: string;
  caseLabel: string;
  caseContext: Record<string, unknown>;
  contextFilename: string | null;
  contextRevision: number | null;
  documents: DocumentSummary[];
  error: string | null;
  loading: boolean;
  onNewCase: () => void;
  onSelectReport: (key: string) => Promise<void>;
  report: Report;
  reportEntries: ReportIndexEntry[];
  reports: LoadedReport[];
  reportSource: ReportSource;
  selectedReportKey: string;
}) {
  const [mode, setMode] = useState<Mode>("hurtig");
  const [filter, setFilter] = useState<CheckFilter>("ALLE");
  const [tab, setTab] = useState<ReportTab>("overblik");
  const [focus, setFocus] = useState<string | null>(null);

  const checks = checksForUi(report);
  const counts = checks.reduce<Partial<Record<Terminal, number>>>((result, check) => {
    result[check.terminal] = (result[check.terminal] ?? 0) + 1;
    return result;
  }, {});
  const focused = focus ? checks.find((check) => check.check_id === focus) : null;
  const activeCheckId = focused?.check_id ?? checks[0]?.check_id ?? null;
  const attentionCount = checks.filter((check) => check.terminal !== "OK").length;
  const reportsByPeriod = new Map<string, number>();
  for (const entry of reportEntries) {
    reportsByPeriod.set(entry.period, (reportsByPeriod.get(entry.period) ?? 0) + 1);
  }

  async function showCheck(checkId: string, nextReportKey = selectedReportKey) {
    if (nextReportKey !== selectedReportKey) await onSelectReport(nextReportKey);
    setFocus(checkId);
    setTab("kontroller");
    setFilter("ALLE");
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.getElementById(checkId)?.scrollIntoView({ block: "center" }),
      ),
    );
  }

  async function openReport(nextReportKey: string) {
    if (nextReportKey !== selectedReportKey) await onSelectReport(nextReportKey);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-tight text-accent">PAYTJEK</span>
            <span className="text-sm font-semibold text-foreground">Lønseddelkontrol</span>
          </div>
          <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>{caseLabel}</span>
            <span>Periode {periodLabel(report.slip.period)}</span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isDemoApi() ? (
              <span className="rounded-full border border-forbehold/40 bg-forbehold-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-forbehold">
                Testmiljø
              </span>
            ) : null}
            {reportEntries.length > 1 ? (
              <select
                aria-label="Vælg lønperiode"
                className="h-8 rounded-md border border-input bg-card px-2 text-[12px]"
                disabled={loading}
                onChange={(event) => void onSelectReport(event.target.value)}
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
            className="mb-4 rounded-md border border-mismatch/40 bg-mismatch-soft p-3 text-[13px] text-mismatch"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="paper flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
          {(["overblik", "kontroller", "seddel", "datagrundlag"] as ReportTab[]).map((nextTab) => (
            <button
              aria-pressed={tab === nextTab}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                tab === nextTab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              key={nextTab}
              onClick={() => {
                setTab(nextTab);
                if (nextTab === "kontroller") setFilter("ALLE");
              }}
              type="button"
            >
              {nextTab === "overblik"
                ? "Overblik"
                : nextTab === "kontroller"
                  ? `Alle kontroller ${checks.length}`
                  : nextTab === "seddel"
                    ? "Lønseddel"
                    : "Datagrundlag"}
            </button>
          ))}

          {tab === "kontroller" ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
                {(["hurtig", "revision"] as Mode[]).map((nextMode) => (
                  <button
                    aria-pressed={mode === nextMode}
                    className={`rounded-[5px] px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      mode === nextMode
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    key={nextMode}
                    onClick={() => setMode(nextMode)}
                    type="button"
                  >
                    {nextMode === "hurtig" ? "Kort" : "Med dokumentation"}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filtrer kontroller"
                className="h-8 rounded-md border border-input bg-card px-2 text-[11px] font-semibold text-foreground"
                onChange={(event) => setFilter(event.target.value as CheckFilter)}
                value={filter}
              >
                <option value="ALLE">Alle kontroller ({checks.length})</option>
                <option value="OPMÆRKSOMHED">Kræver opmærksomhed ({attentionCount})</option>
                {TERMINAL_ORDER.filter((terminal) => counts[terminal]).map((terminal) => (
                  <option key={terminal} value={terminal}>
                    {TERMINALS[terminal].short} ({counts[terminal]})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {tab === "overblik" ? (
          <div className="mt-5">
            <ReportOverview
              currentReportKey={selectedReportKey}
              onOpenReport={(nextReportKey) => void openReport(nextReportKey)}
              onSelect={(nextReportKey, checkId) => void showCheck(checkId, nextReportKey)}
              reports={reports.map((item) => ({ key: item.key, report: item.report }))}
            />
          </div>
        ) : tab === "datagrundlag" ? (
          <div className="mx-auto mt-4 max-w-5xl">
            <SourceProof
              caseContext={caseContext}
              caseId={caseId}
              contextFilename={contextFilename}
              contextRevision={contextRevision}
              defaultOpen
              documents={documents}
              source={reportSource}
            />
          </div>
        ) : tab === "kontroller" ? (
          <div className="mt-5">
            <header className="mb-5">
              <p className="label-caps text-accent">Dokumentet først</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                Alle kontroller på den lønseddel, de vedrører
              </h1>
              <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                Vælg en kontrol i listen eller en lønlinje i dokumentet. Den aktive kontrol peger
                direkte på lønlinjen, mens middleware-rækkefølgen forbliver uændret.
              </p>
            </header>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(520px,1.25fr)_minmax(340px,.75fr)]">
              <div className="lg:sticky lg:top-24">
                <PayslipView
                  contained
                  onSelect={(checkId) => void showCheck(checkId)}
                  report={report}
                  selectedCheckId={activeCheckId}
                  showTechnicalDetails={false}
                />
              </div>
              <ReportChecks
                filter={filter}
                focus={activeCheckId}
                mode={mode}
                onSelect={(checkId) => void showCheck(checkId)}
                report={report}
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <PayslipView onSelect={(checkId) => void showCheck(checkId)} report={report} />

              {focused ? (
                <p className="num mt-4 text-[11px] text-muted-foreground">
                  Valgt fra lønsedlen: {focused.check_id}
                </p>
              ) : null}
            </div>

            <SideRail report={report} />
          </div>
        )}
      </main>
    </div>
  );
}
