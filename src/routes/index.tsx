import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { PayslipFacsimile } from "@/components/report/PayslipFacsimile";
import { ReportChecks, type CheckFilter } from "@/components/report/ReportChecks";
import { SideRail } from "@/components/report/SideRail";
import { SlipTable } from "@/components/report/SlipTable";
import { SourceProof } from "@/components/report/SourceProof";
import { StatusPill } from "@/components/report/StatusPill";
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
import { kr, moneyChecks, periodLabel, TERMINALS, type Report, type Terminal } from "@/lib/report";

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

        const result = await getReport(resumeCaseId, selected, controller.signal);
        if (controller.signal.aborted) return;
        setCaseId(resumeCaseId);
        setCaseLabel(detail.label);
        setDocuments(detail.documents);
        setCaseContext(detail.context);
        setReportEntries(ready);
        setSelectedReportKey(reportKey(selected));
        setReport(result.report);
        setReportSource(result.source);
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
            const result = await getReport(caseId, first, controller.signal);
            if (controller.signal.aborted) return;
            setCaseLabel(detail.label);
            setDocuments(detail.documents);
            setCaseContext(detail.context);
            setReportEntries(ready);
            setSelectedReportKey(reportKey(first));
            setReport(result.report);
            setReportSource(result.source);
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
    setReportLoading(true);
    setError(null);
    try {
      const result = await getReport(caseId, entry);
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
  reportSource: ReportSource;
  selectedReportKey: string;
}) {
  const [mode, setMode] = useState<Mode>("hurtig");
  const [filter, setFilter] = useState<CheckFilter>("OPMÆRKSOMHED");
  const [tab, setTab] = useState<"kontroller" | "seddel" | "dokumentdata">("kontroller");
  const [focus, setFocus] = useState<string | null>(null);

  const checks = report.checks;
  const money = useMemo(() => moneyChecks(checks), [checks]);
  const undecidedFindings = useMemo(
    () => checks.filter((check) => check.substance === "finding"),
    [checks],
  );
  const rowsTotal = report.counters.rows_total ?? checks.length;
  const counts = report.counters.row_list_by_terminal ?? report.counters.by_terminal;
  const focused = focus ? checks.find((check) => check.check_id === focus) : null;
  const unresolved = rowsTotal - (counts.OK ?? 0);
  const attentionCount = checks.filter((check) => check.terminal !== "OK").length;

  function showCheck(checkId: string) {
    const selected = checks.find((check) => check.check_id === checkId);
    setFocus(checkId);
    setTab("kontroller");
    setFilter(selected?.terminal === "OK" ? "OK" : "OPMÆRKSOMHED");
    requestAnimationFrame(() =>
      document.getElementById(checkId)?.scrollIntoView({ block: "center" }),
    );
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
            <span>
              {report.lines.length} lønlinjer · {report.counters.checks_total} kontroller
            </span>
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
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
              {(["hurtig", "revision"] as Mode[]).map((nextMode) => (
                <button
                  aria-pressed={mode === nextMode}
                  className={`rounded-[5px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    mode === nextMode
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  key={nextMode}
                  onClick={() => setMode(nextMode)}
                  type="button"
                >
                  {nextMode === "hurtig" ? "Hurtig triage" : "Revisionsvisning"}
                </button>
              ))}
            </div>
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
        <section className="paper rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="label-caps">Kontante krav i denne periode</p>
              <p className="num mt-1 text-4xl font-bold tracking-tight text-mismatch">
                {money.length} <span className="text-xl font-semibold">kravposter</span>
              </p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Beløbene vises pr. afvigelse nedenfor. PayTjek lægger dem ikke sammen til et nyt
                tal, som middleware ikke selv har leveret.
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-3">
              {TERMINAL_ORDER.filter((terminal) => counts[terminal]).map((terminal) => (
                <div className="flex flex-col" key={terminal}>
                  <dt className="order-2 mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {TERMINALS[terminal].short}
                  </dt>
                  <dd className="num order-1 text-2xl font-semibold text-foreground">
                    {counts[terminal]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps">Det, der bærer beløbet</p>
              <p className="text-[11px] text-muted-foreground">
                {Math.max(0, unresolved - money.length)} øvrige ikke-afgjorte rækker
              </p>
            </div>
            {money.length > 0 ? (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                {money.map((check) => (
                  <li key={check.check_id}>
                    <button
                      className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left hover:bg-muted/45"
                      onClick={() => showCheck(check.check_id)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {check.title}
                        </span>
                        <span className="num mt-0.5 block text-[10px] text-muted-foreground">
                          {check.check_class} · {check.check_id}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[14px] font-semibold text-mismatch">
                        {kr(check.kroner?.kr)} kr
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Ingen kontante kravposter i perioden.
              </p>
            )}
          </div>
        </section>

        {report.counters.substance_by_terminal && undecidedFindings.length > 0 ? (
          <details className="paper mt-4 rounded-lg border-l-[3px] border-l-forbehold px-4 py-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-foreground">
              {undecidedFindings.length} ikke-afgjorte kontroller har et konkret fund
            </summary>
            <ul className="mt-3 space-y-2 border-t border-border pt-3">
              {undecidedFindings.map((check) => (
                <li key={check.check_id}>
                  <button
                    className="text-left text-[13px] font-semibold text-foreground underline-offset-4 hover:text-accent hover:underline"
                    onClick={() => showCheck(check.check_id)}
                    type="button"
                  >
                    {check.check_class} · {TERMINALS[check.terminal].short} — {check.title}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <SourceProof
          caseContext={caseContext}
          caseId={caseId}
          contextFilename={contextFilename}
          contextRevision={contextRevision}
          documents={documents}
          source={reportSource}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              {(["kontroller", "seddel", "dokumentdata"] as const).map((nextTab) => (
                <button
                  aria-pressed={tab === nextTab}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    tab === nextTab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  key={nextTab}
                  onClick={() => setTab(nextTab)}
                  type="button"
                >
                  {nextTab === "kontroller"
                    ? "Kontroller"
                    : nextTab === "seddel"
                      ? "Lønsedlen linje for linje"
                      : "Dokumentdata"}
                </button>
              ))}
              {tab === "kontroller" ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    aria-pressed={filter === "OPMÆRKSOMHED"}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      filter === "OPMÆRKSOMHED"
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                    onClick={() => setFilter("OPMÆRKSOMHED")}
                    type="button"
                  >
                    Opmærksomhed {attentionCount}
                  </button>
                  <button
                    aria-pressed={filter === "ALLE"}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      filter === "ALLE"
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                    onClick={() => setFilter("ALLE")}
                    type="button"
                  >
                    Alle {checks.length}
                  </button>
                  {TERMINAL_ORDER.filter((terminal) => counts[terminal]).map((terminal) => (
                    <button
                      aria-pressed={filter === terminal}
                      key={terminal}
                      onClick={() => setFilter(terminal)}
                      type="button"
                    >
                      <span className={filter === terminal ? "opacity-100" : "opacity-60"}>
                        <StatusPill terminal={terminal} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {tab === "kontroller" ? (
              <div className="mt-4">
                <ReportChecks filter={filter} focus={focus} mode={mode} report={report} />
              </div>
            ) : tab === "seddel" ? (
              <div className="mt-4">
                <SlipTable onSelect={showCheck} report={report} />
              </div>
            ) : (
              <div className="mt-4">
                <PayslipFacsimile onSelect={showCheck} report={report} />
              </div>
            )}

            {focused ? (
              <p className="num mt-4 text-[11px] text-muted-foreground">
                Valgt fra lønsedlen: {focused.check_id}
              </p>
            ) : null}
          </div>

          <SideRail report={report} />
        </div>
      </main>
    </div>
  );
}
