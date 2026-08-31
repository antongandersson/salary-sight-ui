import { kr, report } from "@/lib/report";

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
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {meta ? <span className="num text-[11px] text-muted-foreground">{meta}</span> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function SideRail() {
  const cf = report.context_facts as Record<string, { value?: unknown; label?: string }>;
  const session = report.session as Record<string, unknown>;
  const trin = session["trin_placement"] as Record<string, unknown> | undefined;
  const questions = report.questions.filter((q) => q.raised);

  const facts: Array<[string, string]> = [
    ["Overenskomst", String(cf["agreement_id"] ?? "—")],
    ["Ansættelsesform", String(cf["employment_type"]?.value ?? "—")],
    ["Uddannelsesår", String(cf["elevaar"]?.value ?? "—")],
    ["Alder", String(cf["alder"]?.value ?? "—")],
    ["Ugentlig norm", `${kr(Number(cf["timer_pr_uge"]?.value ?? 0), 2)} t`],
    [
      "Aftalestart",
      String((cf["contract_start_date"] as { quote?: string } | undefined)?.quote ?? "—"),
    ],
    ["Dækning", String((cf["coverage"] as { status?: string } | undefined)?.status ?? "—")],
  ];

  return (
    <aside className="space-y-4">
      <Panel title="Sagens grundlag" meta="kontrakt + oplyst">
        <dl className="space-y-1.5 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="num text-right font-medium text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
        {trin ? (
          <p className="mt-3 rounded-md bg-muted/70 p-2.5 text-[12px] leading-relaxed text-muted-foreground">
            Trinindplacering: trin {String(trin["step"])} på stigen «{String(trin["ladder"])}»,
            dokumenteret af sedlen for {String(trin["documented_by_period"])} med trykt sats{" "}
            {kr(Number(trin["column_value"]))} kr/t. Ikke gættet.
          </p>
        ) : null}
      </Panel>

      <Panel
        title="Spørgsmål til medlemmet"
        meta={`${questions.length} rejst`}
      >
        <ul className="space-y-2.5">
          {questions.map((q) => (
            <li key={q.key} className="border-l-2 border-needs/50 pl-2.5">
              <p className="text-[13px] leading-snug text-foreground">{q.question}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {q.label} · udløst af {q.raised_by.length} regel
                {q.raised_by.length === 1 ? "" : "r"}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Mangler bilag eller tal" meta={`${report.missing_inputs.length}`}>
        <ul className="space-y-2.5">
          {report.missing_inputs.map((m, i) => (
            <li key={i} className="border-l-2 border-forbehold/60 pl-2.5">
              <p className="text-[13px] leading-snug text-foreground">{m.artifact}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {m.kind} · åbner: {m.unlocks} · {m.checks_count} kontrol
                {m.checks_count === 1 ? "" : "ler"}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Sessionen" meta={String(session["session_id"])}>
        <dl className="space-y-1.5 text-[13px]">
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
              {(session["missing_periods"] as unknown[]).length || "ingen"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Modsagt</dt>
            <dd className="num font-medium">{String(session["corroboration"])}</dd>
          </div>
        </dl>
      </Panel>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        {String(report.provenance["renderer"])} · ingen sprogmodel i visningsvejen. Rapporten viser
        kun det, reglerne og sedlen kan bære.
      </p>
    </aside>
  );
}
