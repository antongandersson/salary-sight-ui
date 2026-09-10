import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCheck,
  Database,
  FileQuestion,
  Quote,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { kr, type Check, type CheckFacts, type Report } from "@/lib/report";
import { StatusPill } from "./StatusPill";

function displayValue(value: number | string | null | undefined): string {
  if (typeof value === "number") return kr(value);
  if (value === null || value === undefined) return "—";
  return String(value);
}

function factLabel(key: string): string {
  return key.replaceAll("_", " ");
}

// Generisk visning af middlewarens faktabundter (pension_basis_facts,
// trin_facts, rounding_facts) — alt vises, intet omfortolkes.
function FactValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") return <>{value ? "ja" : "nej"}</>;
  if (typeof value === "number")
    return <span className="num">{value.toLocaleString("da-DK")}</span>;
  if (typeof value === "string") return <>{value}</>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div className="rounded border border-border bg-card px-3 py-2" key={index}>
            <FactValue value={item} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="space-y-1">
      {Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
        <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-2" key={key}>
          <dt className="text-[11px] text-muted-foreground">{factLabel(key)}</dt>
          <dd className="min-w-0 text-[12px] leading-relaxed text-foreground">
            <FactValue value={entry} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const FACT_SECTIONS: Array<[keyof Check, string]> = [
  ["pension_basis_facts", "Pensionsgrundlag"],
  ["trin_facts", "Løntrin"],
  ["rounding_facts", "Afrunding"],
];

export type EvidenceQueueNav = {
  index: number;
  total: number;
  reviewed: boolean;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onReviewedNext: () => void;
};

export function EvidenceSheet({
  check,
  onOpenChange,
  onShowQuestions,
  open,
  queueNav,
  report,
}: {
  check: Check | null;
  onOpenChange: (open: boolean) => void;
  onShowQuestions: () => void;
  open: boolean;
  queueNav?: EvidenceQueueNav | null;
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
            <span className="num text-[11px] text-muted-foreground">
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
              <span className="pb-0.5 text-[12px] text-muted-foreground">
                {check.kroner?.summed === false ? "indgår ikke i opgørelsen" : "fra rapporten"}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        {queueNav ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/25 px-6 py-2.5">
            <span className="text-[12px] font-semibold text-muted-foreground">
              Gennemgang {queueNav.index + 1} af {queueNav.total}
              {queueNav.reviewed ? " · gennemgået" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <Button
                disabled={!queueNav.onPrev}
                onClick={() => queueNav.onPrev?.()}
                size="sm"
                type="button"
                variant="outline"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" /> Forrige
              </Button>
              <Button onClick={queueNav.onReviewedNext} size="sm" type="button">
                <CheckCheck className="size-3.5" aria-hidden="true" /> Gennemgået
                {queueNav.onNext ? " + næste" : ""}
              </Button>
              <Button
                disabled={!queueNav.onNext}
                onClick={() => queueNav.onNext?.()}
                size="sm"
                type="button"
                variant="outline"
              >
                Næste <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </span>
          </div>
        ) : null}

        <div className="space-y-7 px-6 py-6">
          {check.superseded?.length ? (
            <p className="rounded-md border border-border bg-muted/35 px-3 py-2 text-[12px] text-muted-foreground">
              Denne kontrol erstatter: <span className="num">{check.superseded.join(", ")}</span>
            </p>
          ) : null}
          {check.note ? (
            <section aria-labelledby="evidence-explanation">
              <h2 className="label-caps" id="evidence-explanation">
                Forklaring fra rapporten
              </h2>
              <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-foreground">
                {check.note}
              </p>
            </section>
          ) : null}

          {check.computation?.arithmetic ? (
            <section aria-labelledby="evidence-arithmetic">
              <h2
                className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
                id="evidence-arithmetic"
              >
                <Calculator className="size-4 text-accent" aria-hidden="true" /> Regnestykket
              </h2>
              <pre className="num mt-2 whitespace-pre-wrap rounded-md border border-border bg-muted/45 p-4 text-[13px] leading-relaxed text-foreground">
                {check.computation.arithmetic}
              </pre>
            </section>
          ) : null}

          {check.computation?.inputs?.length ? (
            <section aria-labelledby="evidence-inputs">
              <h2
                className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
                id="evidence-inputs"
              >
                <Database className="size-4 text-accent" aria-hidden="true" /> Hvert tal og dets
                kilde
              </h2>
              <div className="mt-2 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[520px] text-[13px]">
                  <thead className="bg-muted/45 text-[11px] uppercase tracking-wide text-muted-foreground">
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

          {FACT_SECTIONS.map(([field, label]) => {
            const facts = check[field] as CheckFacts | null | undefined;
            if (!facts || typeof facts !== "object" || Object.keys(facts).length === 0) {
              return null;
            }
            return (
              <section aria-label={`Faktagrundlag — ${label}`} key={field}>
                <h2 className="label-caps">Faktagrundlag — {label}</h2>
                <div className="mt-2 rounded-md border border-border bg-muted/20 p-3">
                  <FactValue value={facts} />
                </div>
              </section>
            );
          })}

          {check.quotes?.length ? (
            <section aria-labelledby="evidence-quotes">
              <h2
                className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
                id="evidence-quotes"
              >
                <Quote className="size-4 text-accent" aria-hidden="true" /> Citater
              </h2>
              <div className="mt-2 space-y-2">
                {check.quotes.map((quote, index) => (
                  <blockquote
                    className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] italic leading-relaxed text-foreground"
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
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
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
                className="flex items-center gap-2 text-[13px] font-semibold text-needs"
                id="evidence-missing"
              >
                <FileQuestion className="size-4" aria-hidden="true" /> Det der mangler
              </h2>
              <p className="mt-2 text-[14px] font-semibold text-foreground">
                {check.missing.artifact}
              </p>
              {check.missing.unlocks ? (
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
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
                <p className="mt-3 text-[12px] italic text-muted-foreground">
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
                    className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                    key={`${source}:${index}`}
                  >
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" aria-hidden="true" />{" "}
                    {source}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
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
