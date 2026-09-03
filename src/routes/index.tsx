import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { CheckCard } from "@/components/report/CheckCard";
import { PayslipFacsimile } from "@/components/report/PayslipFacsimile";
import { SideRail } from "@/components/report/SideRail";
import { SlipTable } from "@/components/report/SlipTable";
import { StatusPill } from "@/components/report/StatusPill";
import { ProcessingCase } from "@/components/upload/ProcessingCase";
import { UploadCase, type UploadSubmission } from "@/components/upload/UploadCase";
import { Button } from "@/components/ui/button";
import {
  createCase,
  getBatchStatus,
  getReport,
  listReports,
  uploadBatch,
  type BatchStatus,
  type ReportIndexEntry,
} from "@/lib/paytjek-api";
import {
  moneyChecks,
  periodLabel,
  SECTION_LABELS,
  sortChecks,
  TERMINALS,
  type Report,
  type Terminal,
} from "@/lib/report";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayTjek — upload og lønseddelkontrol" },
      {
        name: "description",
        content: "Upload lønsedler og kontrakt, og se middleware-resultatet i PayTjeks sagsskærm.",
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

function PaytjekFlow() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseId, setCaseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [caseLabel, setCaseLabel] = useState("");
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [report, setReport] = useState<Report | null>(null);
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

    void listReports(resumeCaseId, controller.signal)
      .then(async (index) => {
        const ready = index.reports.filter((entry) => !entry.stale);
        const requestedPeriod = search.get("period");
        const requestedSlipKey = search.get("slip_key");
        const selected =
          ready.find(
            (entry) =>
              (requestedPeriod === null || entry.period === requestedPeriod) &&
              (requestedSlipKey === null || entry.slip_key === requestedSlipKey),
          ) ?? ready[0];
        if (!selected) throw new Error("Sagen har endnu ingen færdig rapport.");

        const payload = await getReport(resumeCaseId, selected, controller.signal);
        if (controller.signal.aborted) return;
        setCaseId(resumeCaseId);
        setCaseLabel(search.get("label") ?? `Sag ${resumeCaseId.slice(0, 8)}`);
        setReportEntries(ready);
        setSelectedReportKey(reportKey(selected));
        setReport(payload);
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
      const batch = await uploadBatch(createdCase.case_id, submission.files);
      setCaseId(createdCase.case_id);
      setBatchId(batch.batch_id);
      setCaseLabel(createdCase.label);
      setBatchStatus({
        batch_id: batch.batch_id,
        state: "queued",
        jobs: batch.jobs.map((job) => ({
          job_id: job.job_id,
          filename: job.filename,
          state: "QUEUED",
        })),
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
        setBatchStatus(status);

        if (status.state.toLowerCase() === "complete") {
          const index = await listReports(caseId, controller.signal);
          const ready = index.reports.filter((entry) => !entry.stale);
          const first = ready[0];
          if (first) {
            const payload = await getReport(caseId, first, controller.signal);
            if (controller.signal.aborted) return;
            setReportEntries(ready);
            setSelectedReportKey(reportKey(first));
            setReport(payload);
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
      setReport(await getReport(caseId, entry));
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
    setReportEntries([]);
    setSelectedReportKey("");
  }

  if (phase === "processing") {
    return <ProcessingCase error={error} label={caseLabel} onCancel={reset} status={batchStatus} />;
  }

  if (phase === "report" && report) {
    return (
      <CaseScreen
        caseLabel={caseLabel}
        error={error}
        loading={reportLoading}
        onNewCase={reset}
        onSelectReport={selectReport}
        report={report}
        reportEntries={reportEntries}
        selectedReportKey={selectedReportKey}
      />
    );
  }

  return <UploadCase busy={busy} error={error} onSubmit={start} />;
}

function CaseScreen({
  caseLabel,
  error,
  loading,
  onNewCase,
  onSelectReport,
  report,
  reportEntries,
  selectedReportKey,
}: {
  caseLabel: string;
  error: string | null;
  loading: boolean;
  onNewCase: () => void;
  onSelectReport: (key: string) => Promise<void>;
  report: Report;
  reportEntries: ReportIndexEntry[];
  selectedReportKey: string;
}) {
  const [mode, setMode] = useState<Mode>("hurtig");
  const [filter, setFilter] = useState<Terminal | "ALLE">("ALLE");
  const [tab, setTab] = useState<"kontroller" | "seddel" | "dokumentdata">("kontroller");
  const [focus, setFocus] = useState<string | null>(null);

  const checks = report.checks;
  const money = useMemo(() => moneyChecks(checks), [checks]);
  const counts = useMemo(() => {
    const result: Partial<Record<Terminal, number>> = {};
    for (const check of checks) result[check.terminal] = (result[check.terminal] ?? 0) + 1;
    return result;
  }, [checks]);
  const visible = useMemo(
    () =>
      sortChecks(filter === "ALLE" ? checks : checks.filter((check) => check.terminal === filter)),
    [checks, filter],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    for (const check of visible)
      groups.set(check.section, [...(groups.get(check.section) ?? []), check]);
    return [...groups.entries()];
  }, [visible]);
  const focused = focus ? checks.find((check) => check.check_id === focus) : null;
  const unresolved = checks.length - (counts.OK ?? 0);

  function showCheck(checkId: string) {
    setFocus(checkId);
    setTab("kontroller");
    setFilter("ALLE");
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
            <span>Seddel {report.slip.slip_key}</span>
            <span>{String(report.slip["agreement_id"] ?? "—")}</span>
            <span>
              {report.lines.length} linjer · {checks.length} kontroller
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
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
        <section className="paper rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
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
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-5">
              {TERMINAL_ORDER.filter((terminal) => counts[terminal]).map((terminal) => (
                <button
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    filter === terminal
                      ? "border-foreground/40 bg-muted"
                      : "border-border hover:bg-muted/60"
                  }`}
                  key={terminal}
                  onClick={() => {
                    setTab("kontroller");
                    setFilter(filter === terminal ? "ALLE" : terminal);
                  }}
                  type="button"
                >
                  <span className="num block text-2xl font-semibold text-foreground">
                    {counts[terminal]}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                    {TERMINALS[terminal].short}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <p className="label-caps">Det, der bærer beløbet</p>
            {money.length > 0 ? (
              money.map((check) => <CheckCard check={check} key={check.check_id} mode={mode} />)
            ) : (
              <p className="text-[13px] text-muted-foreground">
                Ingen kontante kravposter i perioden.
              </p>
            )}
            <p className="text-[12px] text-muted-foreground">
              {Math.max(0, unresolved - money.length)} øvrige rækker er ikke afgjort som beløb.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              {(["kontroller", "seddel", "dokumentdata"] as const).map((nextTab) => (
                <button
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
                    ? "Alle kontroller"
                    : nextTab === "seddel"
                      ? "Lønsedlen linje for linje"
                      : "Dokumentdata"}
                </button>
              ))}
              {tab === "kontroller" ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
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
                    <button key={terminal} onClick={() => setFilter(terminal)} type="button">
                      <span className={filter === terminal ? "opacity-100" : "opacity-60"}>
                        <StatusPill terminal={terminal} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {tab === "kontroller" ? (
              <div className="mt-4 space-y-6">
                {grouped.map(([section, groupChecks]) => (
                  <section key={section}>
                    <h2 className="label-caps mb-2">
                      {SECTION_LABELS[section] ?? section} · {groupChecks.length}
                    </h2>
                    <div className="space-y-3">
                      {groupChecks.map((check) => (
                        <div
                          className={focus === check.check_id ? "rounded-lg ring-2 ring-ring" : ""}
                          id={check.check_id}
                          key={check.check_id}
                        >
                          <CheckCard check={check} mode={mode} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
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
