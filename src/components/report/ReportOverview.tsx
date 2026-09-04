import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileQuestion,
  MessageCircleQuestion,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { StatusPill } from "@/components/report/StatusPill";
import { kr, type Check, type Report } from "@/lib/report";

const LIMITATION_TERMINALS = new Set(["FORBEHOLD", "KONTROLPUNKT", "REFUSED"]);

function StepHeading({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
        {number}
      </span>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
    </div>
  );
}

function OpenControlButton({ check, onSelect }: { check: Check; onSelect: (id: string) => void }) {
  return (
    <button
      className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-accent underline-offset-4 hover:underline"
      onClick={() => onSelect(check.check_id)}
      type="button"
    >
      Åbn kontrol
      <ArrowRight className="size-3" aria-hidden="true" />
    </button>
  );
}

function CheckRows({ checks, onSelect }: { checks: Check[]; onSelect: (id: string) => void }) {
  return (
    <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {checks.map((check) => {
        const amount = check.kroner?.kr;
        return (
          <li
            className="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
            key={check.check_id}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill terminal={check.terminal} />
                <span className="text-[13px] font-semibold text-foreground">{check.title}</span>
              </div>
              {check.missing?.artifact ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Mangler: {check.missing.artifact}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {amount !== null && amount !== undefined ? (
                <span className="num text-[13px] font-semibold text-mismatch">{kr(amount)} kr</span>
              ) : null}
              <OpenControlButton check={check} onSelect={onSelect} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReportOverview({
  onSelect,
  report,
}: {
  onSelect: (checkId: string) => void;
  report: Report;
}) {
  const missingInputs = report.missing_inputs;
  const mismatches = report.checks.filter((check) => check.terminal === "MISMATCH");
  const findings = report.checks.filter(
    (check) => check.substance === "finding" && check.terminal !== "MISMATCH",
  );
  const findingIds = new Set(findings.map((check) => check.check_id));
  const coveredNeedsInput = new Set(missingInputs.flatMap((input) => input.checks));
  const limitations = report.checks.filter(
    (check) =>
      !findingIds.has(check.check_id) &&
      (LIMITATION_TERMINALS.has(check.terminal) ||
        (check.terminal === "NEEDS_INPUT" && !coveredNeedsInput.has(check.check_id))),
  );
  const questions = report.questions.filter((question) => question.raised);
  const hasAction = missingInputs.length > 0 || mismatches.length > 0 || findings.length > 0;
  let nextStep = 1;

  return (
    <div className="space-y-4">
      <section className="paper rounded-xl px-5 py-5" aria-labelledby="overview-title">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <ClipboardList className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="label-caps">Overblik</p>
            <h1
              className="mt-1 text-xl font-semibold tracking-tight text-foreground"
              id="overview-title"
            >
              Sagens arbejdsplan
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Arbejdsgangen samler konkrete mangler, afvigelser og fund. Den ændrer ikke
              rule-engine-rapportens resultat eller rækkefølgen i “Alle kontroller”.
            </p>
          </div>
        </div>
      </section>

      {!hasAction ? (
        <section className="rounded-lg border border-ok/25 bg-ok-soft/35 p-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-ok" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-foreground">
              Rapporten indeholder ingen konkrete opgaver i arbejdsplanen.
            </p>
          </div>
        </section>
      ) : null}

      {missingInputs.length > 0 ? (
        <section className="paper rounded-lg p-4">
          <StepHeading number={nextStep++} title="Indhent manglende oplysninger eller bilag" />
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {missingInputs.map((input, index) => (
              <li className="px-4 py-3" key={`${input.kind}:${input.artifact}:${index}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{input.artifact}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Åbner: {input.unlocks}
                    </p>
                  </div>
                  <span className="num rounded-full bg-needs-soft px-2.5 py-1 text-[10px] font-semibold text-needs">
                    {input.checks_count} kontrol{input.checks_count === 1 ? "" : "ler"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2.5 rounded-md bg-muted/45 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <RotateCcw className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
            Når sagens oplysninger ændres, skal rule-engine danne en ny rapport. Den nuværende
            rapport redigeres ikke i browseren.
          </div>
        </section>
      ) : null}

      {mismatches.length > 0 ? (
        <section className="paper rounded-lg p-4">
          <StepHeading number={nextStep++} title="Gennemgå rapportens afvigelser" />
          <CheckRows checks={mismatches} onSelect={onSelect} />
        </section>
      ) : null}

      {findings.length > 0 ? (
        <section className="paper rounded-lg p-4">
          <StepHeading number={nextStep++} title="Foretag faglig vurdering af konkrete fund" />
          <CheckRows checks={findings} onSelect={onSelect} />
        </section>
      ) : null}

      {limitations.length > 0 ? (
        <details className="paper group overflow-hidden rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-forbehold" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">
                  Rapportens øvrige begrænsninger
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {limitations.length} kontrol{limitations.length === 1 ? "" : "ler"} uden konkret
                  opgave
                </span>
              </span>
            </span>
            <span className="text-[11px] font-semibold text-accent group-open:hidden">Vis</span>
            <span className="hidden text-[11px] font-semibold text-accent group-open:inline">
              Skjul
            </span>
          </summary>
          <div className="border-t border-border px-4 pb-4">
            <CheckRows checks={limitations} onSelect={onSelect} />
          </div>
        </details>
      ) : null}

      {questions.length > 0 ? (
        <details className="paper group overflow-hidden rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              <MessageCircleQuestion className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">
                  Mulige afklaringsspørgsmål
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Generelle screeningsspørgsmål — ikke nødvendigvis nødvendige i denne sag
                </span>
              </span>
            </span>
            <span className="num text-[11px] text-muted-foreground">{questions.length}</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {questions.map((question) => (
              <li className="px-4 py-3" key={question.key}>
                <p className="text-[13px] text-foreground">{question.question}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{question.label}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="flex gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        <FileQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Arbejdsplanens rækkefølge er en sagsgang, ikke en juridisk eller økonomisk prioritering.
      </p>
    </div>
  );
}
