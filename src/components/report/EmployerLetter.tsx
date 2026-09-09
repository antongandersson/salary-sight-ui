import { FileText, ShieldCheck } from "lucide-react";

import type { LetterBasis } from "@/lib/paytjek-api";
import { kr, periodLabel } from "@/lib/report";

function amount(value: number | null | undefined): string {
  return typeof value === "number" ? `${kr(value)} kr` : "Ikke opgjort";
}

export function EmployerLetter({ basis }: { basis: LetterBasis | null }) {
  if (!basis) {
    return (
      <section className="paper mx-auto max-w-3xl rounded-xl p-6 text-center">
        <FileText className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">
          Brevgrundlaget er ikke tilgængeligt
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
          Frontend danner ikke selv et krav eller et arbejdsgiverbrev. Funktionen åbner, når
          middleware leverer det autoritative endpoint <span className="num">case-sheet/brev</span>.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-accent">Brev til arbejdsgiver</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Autoritativt brevgrundlag</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Fund, perioder, beløb og citater gengives uden ny beregning.
          </p>
        </div>
        <span className="rounded-full bg-mismatch-soft px-3 py-1.5 text-[11px] font-semibold text-mismatch">
          {basis.findings.length} dokumenterede fund
        </span>
      </header>
      <article className="paper mx-auto max-w-4xl rounded-sm px-6 py-8 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="label-caps text-accent">Dansk Metal · brevgrundlag</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">
              Lønkrav · sag {basis.case}
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">{basis.agreements.join(" + ")}</p>
          </div>
          <div className="text-right">
            <p className="label-caps">Opgjort af middleware</p>
            <p className="num mt-1 text-xl font-semibold text-mismatch">
              {amount(basis.totals?.total_kr)}
            </p>
          </div>
        </div>
        <ol className="mt-2">
          {basis.findings.map((finding, index) => (
            <li
              className="border-b border-border py-5 last:border-0"
              key={`${finding.family ?? finding.check_family ?? finding.title}:${index}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-mismatch">
                    Dokumenteret afvigelse {index + 1}
                  </p>
                  <h3 className="mt-1 text-[14px] font-semibold leading-snug text-foreground">
                    {finding.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {periodLabel(finding.first_month)}–{periodLabel(finding.last_month)} ·{" "}
                    {finding.months_count} perioder
                    {finding.settlement_status ? ` · ${finding.settlement_status}` : ""}
                  </p>
                </div>
                <span className="num text-[14px] font-semibold text-mismatch">
                  {amount(finding.total_kr)}
                </span>
              </div>
              {finding.months[0]?.row_arithmetic || finding.months[0]?.computation ? (
                <pre className="num mt-3 whitespace-pre-wrap rounded-md bg-muted/45 p-3 text-[11px] leading-relaxed text-foreground">
                  {finding.months[0].row_arithmetic ?? finding.months[0].computation}
                </pre>
              ) : null}
              {finding.quotes?.length ? (
                <blockquote className="mt-3 border-l-2 border-accent pl-3 text-[12px] italic leading-relaxed text-muted-foreground">
                  “{finding.quotes[0]}”
                </blockquote>
              ) : null}
              {finding.source_location ? (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Kilde: {finding.source_location}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        {basis.limitation_rule?.text ? (
          <p className="mt-4 rounded-md border border-forbehold/30 bg-forbehold-soft p-3 text-[11px] leading-relaxed text-muted-foreground">
            {basis.limitation_rule.text}
          </p>
        ) : null}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ok" aria-hidden="true" />{" "}
            {basis.provenance?.renderer ?? "PayTjek middleware"}
          </span>
          <span className="num">{basis.schema}</span>
        </footer>
      </article>
      <p className="mx-auto max-w-4xl text-[11px] leading-relaxed text-muted-foreground">
        Dette er det låste dokumentationsgrundlag. Konsulentens redigerbare brevtekst og
        afsendelseshistorik skal ligge i et separat arbejdslag.
      </p>
    </div>
  );
}
