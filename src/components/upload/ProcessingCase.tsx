import {
  CalendarDays,
  CheckCircle2,
  FileJson2,
  FileText,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BatchStatus } from "@/lib/paytjek-api";

const TERMINAL_STATES = new Set(["DONE", "FAILED", "UNREADABLE"]);

function jobIcon(state: string) {
  if (state === "DONE") return <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />;
  if (state === "FAILED" || state === "UNREADABLE") {
    return <TriangleAlert className="size-4 text-mismatch" aria-hidden="true" />;
  }
  return <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden="true" />;
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    QUEUED: "Venter",
    EXTRACTING: "Læser dokument",
    VERIFYING: "Kontrollerer",
    RENDERING: "Bygger rapport",
    DONE: "Færdig",
    FAILED: "Fejlede",
    UNREADABLE: "Kunne ikke læses",
  };
  return labels[state] ?? state.toLowerCase().replaceAll("_", " ");
}

function kindLabel(kind: string | undefined): string {
  const labels: Record<string, string> = {
    payslip: "Lønseddel",
    contract: "Kontrakt",
    unknown: "Ukendt dokument",
  };
  return kind ? (labels[kind.toLowerCase()] ?? kind) : "Klassificeres";
}

export function ProcessingCase({
  label,
  status,
  error,
  onCancel,
  contextFilename,
  birthDate,
}: {
  label: string;
  status: BatchStatus | null;
  error: string | null;
  onCancel: () => void;
  contextFilename: string | null;
  birthDate: string | null;
}) {
  const jobs = status?.jobs ?? [];
  const completed = jobs.filter((job) => TERMINAL_STATES.has(job.state)).length;
  const progress = jobs.length === 0 ? 12 : Math.max(12, (completed / jobs.length) * 100);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <main className="paper w-full max-w-2xl rounded-xl p-6 sm:p-8">
        <p className="label-caps">Sag · {label}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          PayTjek behandler dokumenterne
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Siden opdaterer automatisk og åbner rapporten, så snart middleware er færdig.
        </p>

        <Progress className="mt-6" value={progress} />

        <div className="mt-6 space-y-2" role="status" aria-live="polite">
          {contextFilename ? (
            <div className="flex items-center gap-3 rounded-md border border-ok/25 bg-ok-soft/45 p-3">
              <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />
              <FileJson2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[14px]">{contextFilename}</span>
              <span className="text-[12px] font-semibold text-ok">Member context registreret</span>
            </div>
          ) : null}
          {birthDate ? (
            <div className="flex items-center gap-3 rounded-md border border-ok/25 bg-ok-soft/45 p-3">
              <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-[14px]">Fødselsdato</span>
              <span className="text-[12px] font-semibold text-ok">Registreret på sagen</span>
            </div>
          ) : null}
          {jobs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-border p-3">
              <LoaderCircle className="size-4 animate-spin text-accent" aria-hidden="true" />
              <span className="text-[14px]">Opretter batch og fordeler dokumenter…</span>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3"
                key={job.job_id}
              >
                {jobIcon(job.state)}
                <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[14px] sm:basis-48">
                  {job.filename}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    job.kind === "unknown"
                      ? "bg-forbehold-soft text-forbehold"
                      : "bg-muted text-foreground"
                  }`}
                >
                  Genkendt som: {kindLabel(job.kind)}
                </span>
                <span className="text-[12px] font-semibold text-muted-foreground">
                  {stateLabel(job.state)}
                </span>
                {job.expected_kind &&
                job.kind &&
                job.kind !== "unknown" &&
                job.kind !== job.expected_kind ? (
                  <p className="basis-full pl-14 text-[12px] text-mismatch">
                    Dokumenttypen matcher ikke det valgte uploadfelt.
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>

        {error ? (
          <div
            className="mt-6 rounded-md border border-mismatch/40 bg-mismatch-soft p-4"
            role="alert"
          >
            <p className="text-[14px] font-semibold text-mismatch">Behandlingen stoppede</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={onCancel} type="button" variant="outline">
              Tilbage til upload
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
