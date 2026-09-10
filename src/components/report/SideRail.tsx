import { kr, type Report } from "@/lib/report";

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paper rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h2>
        {meta ? <span className="num text-[12px] text-muted-foreground">{meta}</span> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Disclosure({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="paper group rounded-lg">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[14px] font-semibold tracking-tight text-foreground">{title}</span>
        <span className="flex items-center gap-2">
          {meta ? <span className="num text-[12px] text-muted-foreground">{meta}</span> : null}
          <span className="text-[12px] font-semibold text-accent group-open:hidden">Vis</span>
          <span className="hidden text-[12px] font-semibold text-accent group-open:inline">
            Skjul
          </span>
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}

export function SideRail({ report }: { report: Report }) {
  const cf = report.context_facts as Record<string, { value?: unknown; label?: string }>;
  const session = report.session as Record<string, unknown>;
  const trin = session["trin_placement"] as Record<string, unknown> | undefined;
  const questions = (report.questions ?? []).filter((q) => q.raised);
  const weeklyHours = cf["timer_pr_uge"]?.value;

  function factValue(key: string): string {
    const fact = cf[key];
    if (fact && typeof fact === "object" && "value" in fact) {
      return fact.value == null ? "—" : String(fact.value);
    }
    return fact == null ? "—" : String(fact);
  }

  const facts: Array<[string, string]> = [
    ["Overenskomst", factValue("agreement_id")],
    ["Ansættelsesform", factValue("employment_type")],
    ["Uddannelsesår", factValue("elevaar")],
    ["Alder", factValue("alder")],
    ["Ugentlig norm", weeklyHours == null ? "—" : `${kr(Number(weeklyHours), 2)} t`],
    [
      "Aftalestart",
      String((cf["contract_start_date"] as { quote?: string } | undefined)?.quote ?? "—"),
    ],
    ["Dækning", String((cf["coverage"] as { status?: string } | undefined)?.status ?? "—")],
  ];

  return (
    <aside className="space-y-4">
      {report.missing_inputs.length > 0 ? (
        <Panel title="Mangler bilag eller tal" meta={`${report.missing_inputs.length}`}>
          <ul className="space-y-2.5">
            {report.missing_inputs.map((m, i) => (
              <li key={i} className="border-l-2 border-forbehold/60 pl-2.5">
                <p className="text-[14px] leading-snug text-foreground">{m.artifact}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {m.kind} · åbner: {m.unlocks} · {m.checks_count} kontrol
                  {m.checks_count === 1 ? "" : "ler"}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {questions.length > 0 ? (
        <Disclosure title="Mulige afklaringsspørgsmål" meta={`${questions.length} generelle`}>
          <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
            Screeningsspørgsmålene er ikke nødvendigvis nødvendige i denne sag og indgår ikke som
            opgaver i arbejdsplanen.
          </p>
          <ul className="space-y-2.5">
            {questions.map((q) => (
              <li key={q.key} className="border-l-2 border-border pl-2.5">
                <p className="text-[14px] leading-snug text-foreground">{q.question}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{q.label}</p>
              </li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      {questions.length === 0 && report.missing_inputs.length === 0 ? (
        <section className="rounded-lg border border-ok/25 bg-ok-soft/35 p-4">
          <h2 className="text-[14px] font-semibold text-foreground">
            Ingen åbne dataforespørgsler
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Rapporten efterspørger ikke flere oplysninger eller bilag.
          </p>
        </section>
      ) : null}

      <Disclosure title="Sagens grundlag" meta="kontrakt + oplyst">
        <dl className="space-y-1.5 text-[14px]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="num text-right font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        {trin ? (
          <p className="mt-3 rounded-md bg-muted/70 p-2.5 text-[13px] leading-relaxed text-muted-foreground">
            Trinindplacering: trin {String(trin["step"])} på stigen «{String(trin["ladder"])}»,
            dokumenteret af sedlen for {String(trin["documented_by_period"])} med trykt sats{" "}
            {kr(Number(trin["column_value"]))} kr/t. Ikke gættet.
          </p>
        ) : null}
      </Disclosure>

      <Disclosure title="Sessionen" meta={String(session["session_id"] ?? "—")}>
        <dl className="space-y-1.5 text-[14px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Sedler i sagen</dt>
            <dd className="num font-medium">{String(session["slips_in_session"])}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Denne seddels plads</dt>
            <dd className="num font-medium">
              {String(session["position"])} / {String(session["periods_in_session"])}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Forrige periode</dt>
            <dd className="num font-medium">{String(session["prior_period"])}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Manglende perioder</dt>
            <dd className="num font-medium">
              {(Array.isArray(session["missing_periods"]) && session["missing_periods"].length) ||
                "ingen"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Modsagt</dt>
            <dd className="num font-medium">{String(session["corroboration"])}</dd>
          </div>
        </dl>
      </Disclosure>

      <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
        {String(report.provenance["renderer"])} · ingen sprogmodel i visningsvejen. Rapporten viser
        kun det, reglerne og sedlen kan bære.
      </p>
    </aside>
  );
}
