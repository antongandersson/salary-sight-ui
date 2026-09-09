import { ArrowRight, Calculator, Database, FileQuestion, Quote, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kr, type Check, type Report } from "@/lib/report";
import { StatusPill } from "./StatusPill";

function displayValue(value: number | string | null | undefined): string {
  if (typeof value === "number") return kr(value);
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function EvidenceSheet({
  check,
  onOpenChange,
  onShowQuestions,
  open,
  report,
}: {
  check: Check | null;
  onOpenChange: (open: boolean) => void;
  onShowQuestions: () => void;
  open: boolean;
  report: Report;
}) {
  if (!check) return null;
  const amount = check.kroner?.kr;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="!left-auto !right-0 !top-0 !h-dvh !w-[min(720px,94vw)] !max-w-none !translate-x-0 !translate-y-0 content-start gap-0 overflow-y-auto border-y-0 border-r-0 bg-background p-0 sm:!rounded-none">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 pr-14 text-left backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill long terminal={check.terminal} />
            <span className="num text-[10px] text-muted-foreground">
              {check.line_index == null ? "Rapportniveau" : `Lønlinje ${check.line_index}`}
            </span>
          </div>
          <DialogTitle className="mt-3 text-2xl leading-tight">{check.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Dokumentation og kilder for den valgte kontrol
          </DialogDescription>
          {amount != null ? (
            <div className="mt-3 flex items-end gap-2">
              <span className="num text-2xl font-semibold text-mismatch">{kr(amount)} kr</span>
              <span className="pb-0.5 text-[11px] text-muted-foreground">
                {check.kroner?.summed === false ? "indgår ikke i opgørelsen" : "fra rapporten"}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        <div className="space-y-7 px-6 py-6">
          {check.note ? (
            <section aria-labelledby="evidence-explanation">
              <h2 className="label-caps" id="evidence-explanation">
                Forklaring fra rapporten
              </h2>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
                {check.note}
              </p>
            </section>
          ) : null}

          {check.computation?.arithmetic ? (
            <section aria-labelledby="evidence-arithmetic">
              <h2
                className="flex items-center gap-2 text-[12px] font-semibold text-foreground"
                id="evidence-arithmetic"
              >
                <Calculator className="size-4 text-accent" aria-hidden="true" /> Regnestykket
              </h2>
              <pre className="num mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/45 p-4 text-[12px] leading-relaxed text-foreground">
                {check.computation.arithmetic}
              </pre>
            </section>
          ) : null}

          {check.computation?.inputs?.length ? (
            <section aria-labelledby="evidence-inputs">
              <h2
                className="flex items-center gap-2 text-[12px] font-semibold text-foreground"
                id="evidence-inputs"
              >
                <Database className="size-4 text-accent" aria-hidden="true" /> Hvert tal og dets
                kilde
              </h2>
              <div className="mt-2 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[520px] text-[12px]">
                  <thead className="bg-muted/45 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Tal</th>
                      <th className="px-3 py-2 text-right">Værdi</th>
                      <th className="px-3 py-2 text-left">Kilde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {check.computation.inputs.map((input, index) => (
                      <tr className="border-t border-border" key={`${input.label}:${index}`}>
                        <td className="px-3 py-2 text-foreground">{input.label}</td>
                        <td className="num px-3 py-2 text-right text-foreground">
                          {displayValue(input.value)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{input.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {check.quotes?.length ? (
            <section aria-labelledby="evidence-quotes">
              <h2
                className="flex items-center gap-2 text-[12px] font-semibold text-foreground"
                id="evidence-quotes"
              >
                <Quote className="size-4 text-accent" aria-hidden="true" /> Citater
              </h2>
              <div className="mt-2 space-y-2">
                {check.quotes.map((quote, index) => (
                  <blockquote
                    className="border-l-2 border-accent bg-surface px-4 py-3 text-[13px] italic leading-relaxed text-foreground"
                    key={index}
                  >
                    “{quote}”
                  </blockquote>
                ))}
              </div>
            </section>
          ) : null}

          {check.kroner?.convention ? (
            <section
              className="rounded-md border border-border bg-muted/35 p-4"
              aria-labelledby="evidence-boundary"
            >
              <h2 className="label-caps" id="evidence-boundary">
                Opgørelseskonvention
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {check.kroner.convention}
              </p>
            </section>
          ) : null}

          {check.missing ? (
            <section
              className="rounded-md border border-needs/30 bg-needs-soft p-4"
              aria-labelledby="evidence-missing"
            >
              <h2
                className="flex items-center gap-2 text-[12px] font-semibold text-needs"
                id="evidence-missing"
              >
                <FileQuestion className="size-4" aria-hidden="true" /> Det der mangler
              </h2>
              <p className="mt-2 text-[13px] font-semibold text-foreground">
                {check.missing.artifact}
              </p>
              {check.missing.unlocks ? (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Afgør: {check.missing.unlocks}
                </p>
              ) : null}
              {check.missing.ask_target === "member" ? (
                <Button
                  className="mt-3"
                  onClick={onShowQuestions}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Se spørgsmål til medlem <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              ) : (
                <p className="mt-3 text-[11px] italic text-muted-foreground">
                  Rapporten placerer ikke denne oplysning hos medlemmet.
                </p>
              )}
            </section>
          ) : null}

          {check.computation?.sources?.length ? (
            <section aria-labelledby="evidence-sources">
              <h2 className="label-caps" id="evidence-sources">
                Kilder
              </h2>
              <ul className="mt-2 space-y-1.5">
                {check.computation.sources.map((source, index) => (
                  <li
                    className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground"
                    key={`${source}:${index}`}
                  >
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />{" "}
                    {source}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground">
            <span>Regelmotor · ingen ny beregning i frontend</span>
            <span className="num">
              {check.check_id} · {report.slip.slip_key}
            </span>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
