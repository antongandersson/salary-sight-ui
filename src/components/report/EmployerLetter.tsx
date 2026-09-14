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
        <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
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
          <p className="mt-1 text-[13px] text-muted-foreground">
            Fund, perioder, beløb og citater gengives uden ny beregning.
          </p>
        </div>
        <span className="rounded-full bg-mismatch-soft px-3 py-1.5 text-[12px] font-semibold text-mismatch">
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
            <p className="mt-1 text-[12px] text-muted-foreground">{basis.agreements.join(" + ")}</p>
          </div>
          <div className="text-right">
            <p className="label-caps">Opgjort af middleware</p>
            <p className="num mt-1 text-xl font-semibold text-mismatch">
              {amount(basis.totals?.total_kr)}
            </p>
            {basis.totals &&
            (basis.totals.konsekvent != null ||
              basis.totals.enkeltstaaende != null ||
              basis.totals.findings_with_undetermined_kr ||
              basis.totals.limitation_flagged) ? (
              <p className="num mt-1 text-[11px] text-muted-foreground">
                {[
                  basis.totals.konsekvent != null ? `${basis.totals.konsekvent} konsekvente` : null,
                  basis.totals.enkeltstaaende != null
                    ? `${basis.totals.enkeltstaaende} enkeltstående`
                    : null,
                  basis.totals.findings_with_undetermined_kr
                    ? `${basis.totals.findings_with_undetermined_kr} med ubestemt beløb`
                    : null,
                  basis.totals.limitation_flagged
                    ? `${basis.totals.limitation_flagged} berørt af forældelse`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
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
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-mismatch">
                    Dokumenteret afvigelse {index + 1}
                  </p>
                  <h3 className="mt-1 text-[14px] font-semibold leading-snug text-foreground">
                    {finding.title}
                  </h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {periodLabel(finding.first_month)}–{periodLabel(finding.last_month)} ·{" "}
                    {finding.months_count} perioder
                    {finding.settlement_status ? ` · ${finding.settlement_status}` : ""}
                    {finding.settled_period
                      ? ` · afregnet ${periodLabel(finding.settled_period)}`
                      : ""}
                    {finding.months_kr_undetermined
                      ? ` · ${finding.months_kr_undetermined} måneder uden fastsat beløb`
                      : ""}
                    {finding.limitation_flag ? " · berørt af forældelsesfrist" : ""}
                  </p>
                </div>
                <span className="num text-[14px] font-semibold text-mismatch">
                  {amount(finding.total_kr)}
                </span>
              </div>
              {finding.months[0]?.row_arithmetic || finding.months[0]?.computation ? (
                <pre className="num mt-3 whitespace-pre-wrap rounded-md bg-muted/45 p-3 text-[12px] leading-relaxed text-foreground">
                  {finding.months[0].row_arithmetic ?? finding.months[0].computation}
                </pre>
              ) : null}
              {finding.quotes?.length ? (
                <blockquote className="mt-3 border-l-2 border-accent pl-3 text-[13px] italic leading-relaxed text-muted-foreground">
                  “{finding.quotes[0]}”
                </blockquote>
              ) : null}
              {finding.source_location ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Kilde: {finding.source_location}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        {basis.step_timing?.length ? (
          <section className="mt-5 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-foreground">Trin-forløb</h3>
            <ul className="mt-2 space-y-2">
              {basis.step_timing.map((step, index) => (
                <li className="flex items-start justify-between gap-3 text-[12px]" key={index}>
                  <span className="min-w-0 text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                      {step.label ?? `Trin ${index + 1}`}
                    </strong>
                    {step.headline ? ` — ${step.headline}` : ""}
                  </span>
                  {step.rollup_kr != null ? (
                    <span className="num shrink-0 font-semibold text-mismatch">
                      {amount(step.rollup_kr)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {basis.recurring_issues?.length ? (
          <section className="mt-5 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-foreground">Gennemgående forhold</h3>
            <ul className="mt-2 space-y-2">
              {basis.recurring_issues.map((issue, index) => (
                <li className="text-[12px] leading-relaxed text-muted-foreground" key={index}>
                  {issue.statement ?? issue.title ?? "—"}
                  {issue.months_count ? (
                    <span className="num"> · {issue.months_count} måneder</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {basis.control_points?.note || basis.control_points?.count != null ? (
          <p className="mt-4 rounded-md border border-border bg-muted/25 p-3 text-[12px] leading-relaxed text-muted-foreground">
            {basis.control_points?.count != null
              ? `${basis.control_points.count} kontrolpunkter`
              : ""}
            {basis.control_points?.total_kr != null
              ? ` · ${amount(basis.control_points.total_kr)}`
              : ""}
            {basis.control_points?.note ? ` — ${basis.control_points.note}` : ""}
          </p>
        ) : null}
        {basis.limitation_rule?.text ? (
          <p className="mt-4 rounded-md border border-forbehold/30 bg-forbehold-soft p-3 text-[12px] leading-relaxed text-muted-foreground">
            {basis.limitation_rule.text}
          </p>
        ) : null}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-ok" aria-hidden="true" />{" "}
            {basis.provenance?.renderer ?? "PayTjek middleware"}
          </span>
          <span className="num">{basis.schema}</span>
        </footer>
      </article>
      <p className="mx-auto max-w-4xl text-[12px] leading-relaxed text-muted-foreground">
        Dette er det låste dokumentationsgrundlag. Konsulentens redigerbare brevtekst og
        afsendelseshistorik skal ligge i et separat arbejdslag.
      </p>
    </div>
  );
}
