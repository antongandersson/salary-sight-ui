import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCard } from "@/components/report/CheckCard";
import { PayslipFacsimile } from "@/components/report/PayslipFacsimile";
import { SideRail } from "@/components/report/SideRail";
import { SlipTable } from "@/components/report/SlipTable";
import { StatusPill } from "@/components/report/StatusPill";
import {
  claimTotal,
  derivedTotal,
  kr,
  moneyChecks,
  periodLabel,
  report,
  SECTION_LABELS,
  sortChecks,
  TERMINALS,
  type Terminal,
} from "@/lib/report";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Paytjek sagsskærm — lønseddelkontrol for faglige konsulenter" },
      {
        name: "description",
        content:
          "Overblik over en kørt lønseddelkontrol: kravbeløb først, derefter forbehold, manglende bilag og fuld sporbarhed pr. kontrol.",
      },
      { property: "og:title", content: "Paytjek sagsskærm — lønseddelkontrol" },
      {
        property: "og:description",
        content:
          "Kravbeløb, afvigelser, forbehold og bevisførelse for én lønperiode — bygget til faglige konsulenter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaseScreen,
});

type Mode = "hurtig" | "revision";

const TERMINAL_ORDER: Terminal[] = [
  "MISMATCH",
  "NEEDS_INPUT",
  "FORBEHOLD",
  "REFUSED",
  "KONTROLPUNKT",
  "OK",
];

function CaseScreen() {
  const [mode, setMode] = useState<Mode>("hurtig");
  const [filter, setFilter] = useState<Terminal | "ALLE">("ALLE");
  const [tab, setTab] = useState<"kontroller" | "seddel" | "original">("kontroller");
  const [focus, setFocus] = useState<string | null>(null);

  const checks = report.checks;
  const money = useMemo(() => moneyChecks(checks), [checks]);
  const total = useMemo(() => claimTotal(checks), [checks]);
  const derived = useMemo(() => derivedTotal(checks), [checks]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const check of checks) c[check.terminal] = (c[check.terminal] ?? 0) + 1;
    return c;
  }, [checks]);

  const visible = useMemo(() => {
    const list = filter === "ALLE" ? checks : checks.filter((c) => c.terminal === filter);
    return sortChecks(list);
  }, [checks, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const c of visible) {
      const arr = map.get(c.section) ?? [];
      arr.push(c);
      map.set(c.section, arr);
    }
    return [...map.entries()];
  }, [visible]);

  const focused = focus ? checks.find((c) => c.check_id === focus) : null;
  const period = periodLabel(report.slip.period);
  const unresolved = checks.length - (counts["OK"] ?? 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-tight text-accent">PAYTJEK</span>
            <span className="text-sm font-semibold text-foreground">Lønseddelkontrol</span>
          </div>
          <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>Periode {period}</span>
            <span>Seddel {report.slip.slip_key}</span>
            <span>{String(report.slip["agreement_id"])}</span>
            <span>{report.lines.length} linjer · {checks.length} kontroller</span>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
            {(["hurtig", "revision"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-[5px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "hurtig" ? "Hurtig triage" : "Revisionsvisning"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Pengesporet først */}
        <section className="paper rounded-xl p-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <p className="label-caps">Kontant krav i denne periode</p>
              <p className="num mt-1 text-5xl font-bold tracking-tight text-mismatch">
                {kr(total)} <span className="text-2xl font-semibold">kr</span>
              </p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Summen af {money.length} afvigelser med beløb. Afledte poster på{" "}
                <span className="num">{kr(derived)} kr</span> er regnet af sedlens egne procenter og
                indgår <em>ikke</em> i beløbet.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-5">
              {TERMINAL_ORDER.filter((t) => counts[t]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab("kontroller");
                    setFilter(filter === t ? "ALLE" : t);
                  }}
                  className={`rounded-md border px-3 py-2 text-left transition-colors ${
                    filter === t ? "border-foreground/40 bg-muted" : "border-border hover:bg-muted/60"
                  }`}
                >
                  <span className="num block text-2xl font-semibold text-foreground">
                    {counts[t]}
                  </span>
                  <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
                    {TERMINALS[t].short}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-border pt-5">
            <p className="label-caps">Det, der bærer beløbet</p>
            {money.map((c) => (
              <CheckCard key={c.check_id} check={c} mode={mode} />
            ))}
            <p className="text-[12px] text-muted-foreground">
              {unresolved - money.length} øvrige rækker er ikke afgjort som beløb: forbehold,
              manglende oplysninger og én kontrol, der bevidst ikke er udført.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              {(["kontroller", "seddel", "original"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "kontroller"
                    ? "Alle kontroller"
                    : t === "seddel"
                      ? "Lønsedlen linje for linje"
                      : "Original lønseddel"}
                </button>
              ))}
              {tab === "kontroller" ? (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilter("ALLE")}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      filter === "ALLE"
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Alle {checks.length}
                  </button>
                  {TERMINAL_ORDER.filter((t) => counts[t]).map((t) => (
                    <button key={t} type="button" onClick={() => setFilter(t)}>
                      <span className={filter === t ? "opacity-100" : "opacity-60"}>
                        <StatusPill terminal={t} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {tab === "kontroller" ? (
              <div className="mt-4 space-y-6">
                {grouped.map(([section, list]) => (
                  <section key={section}>
                    <h2 className="label-caps mb-2">
                      {SECTION_LABELS[section] ?? section} · {list.length}
                    </h2>
                    <div className="space-y-3">
                      {list.map((c) => (
                        <div
                          key={c.check_id}
                          id={c.check_id}
                          className={focus === c.check_id ? "ring-2 ring-ring rounded-lg" : ""}
                        >
                          <CheckCard check={c} mode={mode} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : tab === "seddel" ? (
              <div className="mt-4 space-y-4">
                <SlipTable
                  onSelect={(id) => {
                    setFocus(id);
                    setTab("kontroller");
                    setFilter("ALLE");
                    requestAnimationFrame(() =>
                      document.getElementById(id)?.scrollIntoView({ block: "center" }),
                    );
                  }}
                />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Rækker markeret «Ikke afkodet ved indlæsning» er en mangel ved indlæsningen af
                  sedlen — ikke ved sedlen. De tal, de måtte trykke, har ikke indgået i
                  kontrollerne.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <PayslipFacsimile
                  onSelect={(id) => {
                    setFocus(id);
                    setTab("kontroller");
                    setFilter("ALLE");
                    requestAnimationFrame(() =>
                      document.getElementById(id)?.scrollIntoView({ block: "center" }),
                    );
                  }}
                />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  Sedlen er gengivet som den er trykt fra DataLøn. Røde rækker er dem, en kontrol
                  har rejst en indsigelse mod — klik på kontrolmærket for at se beregningen.
                </p>
              </div>
            )}

            {focused ? (
              <p className="mt-4 num text-[11px] text-muted-foreground">
                Valgt fra lønsedlen: {focused.check_id}
              </p>
            ) : null}
          </div>

          <SideRail />
        </div>
      </main>
    </div>
  );
}
