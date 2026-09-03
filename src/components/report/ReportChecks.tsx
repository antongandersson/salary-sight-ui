import { useMemo } from "react";

import { CheckCard } from "@/components/report/CheckCard";
import { kr, type Check, type Report, type SlipLine, type Terminal } from "@/lib/report";

const SECTION_ORDER = ["coverage", "slip_level", "cross_slip"] as const;
const SECTION_TITLES: Record<string, string> = {
  coverage: "Dækning, grundlag og formalia",
  slip_level: "Sedlens egne totaler (brutto → netto)",
  cross_slip: "På tværs af sedler (saldi)",
};

type Mode = "hurtig" | "revision";
export type CheckFilter = Terminal | "ALLE" | "OPMÆRKSOMHED";

function value(value: number | null | undefined): string {
  return value == null ? "—" : kr(value);
}

function LineHeader({ line }: { line: SlipLine }) {
  return (
    <header className="grid gap-3 border-b border-border bg-muted/45 px-4 py-3 lg:grid-cols-[3rem_minmax(14rem,1fr)_7rem_7rem_8rem_8rem]">
      <div>
        <p className="label-caps">Linje</p>
        <p className="num mt-1 text-[12px] font-semibold">{line.index}</p>
      </div>
      <div className="min-w-0">
        <p className="label-caps">Beskrivelse</p>
        <p
          className="mt-1 truncate text-[13px] font-semibold text-foreground"
          title={line.description ?? ""}
        >
          {line.description ?? "Uden beskrivelse"}
        </p>
        <p className="num mt-0.5 text-[10px] text-muted-foreground">
          {line.concept ?? "ukendt begreb"} · {line.lane}
        </p>
      </div>
      <div>
        <p className="label-caps">Antal</p>
        <p className="num mt-1 text-[12px]">{value(line.quantity)}</p>
      </div>
      <div>
        <p className="label-caps">Sats</p>
        <p className="num mt-1 text-[12px]">{value(line.rate)}</p>
      </div>
      <div>
        <p className="label-caps">Grundlag</p>
        <p className="num mt-1 text-[12px]">{value(line.basis)}</p>
      </div>
      <div className="lg:text-right">
        <p className="label-caps">Beløb</p>
        <p className="num mt-1 text-[12px] font-semibold">
          {line.amount_unread ? "—" : `${line.sign === "-" ? "−" : ""}${value(line.amount)}`}
        </p>
      </div>
    </header>
  );
}

function LineGroup({
  checks,
  focus,
  line,
  mode,
}: {
  checks: Check[];
  focus: string | null;
  line: SlipLine;
  mode: Mode;
}) {
  return (
    <article className="paper overflow-hidden rounded-lg [contain-intrinsic-size:auto_24rem] [content-visibility:auto]">
      <LineHeader line={line} />
      {line.amount_unread ? (
        <p className="border-b border-border px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
          Beløbsfeltet gav ingen værdi; det er ikke det samme som 0,00 kr.
          {line.admitted_status ? ` Platformens registrering: ${line.admitted_status}` : ""}
          {line.admitted_reason ? ` · ${line.admitted_reason}` : ""}
        </p>
      ) : null}
      <div className="divide-y divide-border">
        {checks.map((check) => (
          <div
            className={focus === check.check_id ? "relative z-10 ring-2 ring-inset ring-ring" : ""}
            id={check.check_id}
            key={check.check_id}
          >
            <CheckCard check={check} embedded mode={mode} />
          </div>
        ))}
      </div>
    </article>
  );
}

export function ReportChecks({
  filter,
  focus,
  mode,
  report,
}: {
  filter: CheckFilter;
  focus: string | null;
  mode: Mode;
  report: Report;
}) {
  const groups = useMemo(() => {
    const eligible = report.checks.filter(
      (check) =>
        filter === "ALLE" ||
        (filter === "OPMÆRKSOMHED" ? check.terminal !== "OK" : check.terminal === filter),
    );
    const byId = new Map(eligible.map((check) => [check.check_id, check]));
    const rendered = new Set<string>();

    const lines = report.lines.flatMap((line) => {
      const checks = line.checks.flatMap((checkId) => {
        const check = byId.get(checkId);
        if (!check) return [];
        rendered.add(checkId);
        return [check];
      });
      return checks.length > 0 ? [{ line, checks }] : [];
    });

    const sections = SECTION_ORDER.flatMap((section) => {
      const checks = eligible.filter(
        (check) => check.section === section && !rendered.has(check.check_id),
      );
      for (const check of checks) rendered.add(check.check_id);
      return checks.length > 0 ? [{ key: section, title: SECTION_TITLES[section], checks }] : [];
    });

    const leftovers = eligible.filter((check) => !rendered.has(check.check_id));
    return { lines, sections, leftovers };
  }, [filter, report]);

  if (groups.lines.length === 0 && groups.sections.length === 0 && groups.leftovers.length === 0) {
    return (
      <p className="paper rounded-lg p-5 text-[13px] text-muted-foreground">
        Ingen kontroller matcher det valgte filter.
      </p>
    );
  }

  return (
    <div className="space-y-7">
      {groups.lines.length > 0 ? (
        <section>
          <h2 className="label-caps mb-2">Lønlinjer med kontroller · {groups.lines.length}</h2>
          <div className="space-y-4">
            {groups.lines.map(({ line, checks }) => (
              <LineGroup checks={checks} focus={focus} key={line.index} line={line} mode={mode} />
            ))}
          </div>
        </section>
      ) : null}

      {groups.sections.map((group) => (
        <section key={group.key}>
          <h2 className="label-caps mb-2">
            {group.title} · {group.checks.length}
          </h2>
          <div className="paper divide-y divide-border overflow-hidden rounded-lg">
            {group.checks.map((check) => (
              <div
                className={
                  focus === check.check_id ? "relative z-10 ring-2 ring-inset ring-ring" : ""
                }
                id={check.check_id}
                key={check.check_id}
              >
                <CheckCard check={check} embedded mode={mode} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {groups.leftovers.length > 0 ? (
        <section>
          <h2 className="label-caps mb-2">Øvrige kontroller · {groups.leftovers.length}</h2>
          <div className="paper divide-y divide-border overflow-hidden rounded-lg">
            {groups.leftovers.map((check) => (
              <div
                className={
                  focus === check.check_id ? "relative z-10 ring-2 ring-inset ring-ring" : ""
                }
                id={check.check_id}
                key={check.check_id}
              >
                <CheckCard check={check} embedded mode={mode} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
