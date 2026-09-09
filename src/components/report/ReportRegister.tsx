import type { CaseSheet } from "@/lib/case-sheet";
import type { ReportIndexEntry } from "@/lib/paytjek-api";
import { periodLabel } from "@/lib/report";
import { cn } from "@/lib/utils";

interface ReportRegisterProps {
  caseSheet: CaseSheet | null;
  entries: ReportIndexEntry[];
  onOpen: (entry: ReportIndexEntry) => void;
}

function matchesReference(
  reference: { period: string; slip_key: string },
  entry: ReportIndexEntry,
) {
  return reference.period === entry.period && reference.slip_key === entry.slip_key;
}

export function ReportRegister({ caseSheet, entries, onOpen }: ReportRegisterProps) {
  const superseded = new Set(
    entries.flatMap((entry) => (entry.revises_slip_key ? [entry.revises_slip_key] : [])),
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-[hsl(var(--dm-border))] bg-white shadow-[0_14px_45px_hsl(var(--dm-navy)/0.06)]">
      <div className="border-b border-[hsl(var(--dm-border))] px-6 py-5">
        <p className="dm-kicker">Sagens register</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[hsl(var(--dm-navy))]">
              Alle lønsedler i én arbejdsliste
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[hsl(var(--dm-muted))]">
              Find hurtigt perioden med fund, mulige krav eller manglende input. Beløb og afgørelser
              kommer udelukkende fra PayTjek-sagsarket.
            </p>
          </div>
          <span className="dm-status-pill dm-status-pill--muted">{entries.length} lønsedler</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--dm-border))] bg-[hsl(var(--dm-surface))] text-xs font-bold uppercase tracking-[0.12em] text-[hsl(var(--dm-muted))]">
              <th className="px-6 py-3">Lønseddel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Afgjorte fund</th>
              <th className="px-4 py-3 text-right">Mulige krav</th>
              <th className="px-4 py-3 text-right">Input</th>
              <th className="px-6 py-3 text-right">Handling</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const findings =
                caseSheet?.findings.filter((finding) =>
                  finding.months.some((reference) => matchesReference(reference, entry)),
                ).length ?? 0;
              const possibleClaims =
                caseSheet?.possible_claims.families.filter((family) =>
                  family.months.some((reference) => matchesReference(reference, entry)),
                ).length ?? 0;
              const neededInputs =
                caseSheet?.needs_input.filter((input) =>
                  input.months_affected.includes(entry.period),
                ).length ?? 0;
              const isSuperseded = superseded.has(entry.slip_key);

              const status = isSuperseded
                ? "Erstattet"
                : findings > 0
                  ? "Afgjort fund"
                  : possibleClaims > 0
                    ? "Muligt krav"
                    : neededInputs > 0
                      ? "Mangler input"
                      : "Kontrolleret";

              return (
                <tr
                  key={`${entry.period}:${entry.slip_key}`}
                  className={cn(
                    "border-b border-[hsl(var(--dm-border))] last:border-b-0",
                    isSuperseded && "bg-slate-50 text-slate-500",
                  )}
                >
                  <td className="px-6 py-4">
                    <p className="font-bold text-[hsl(var(--dm-navy))]">
                      {periodLabel(entry.period)}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-[hsl(var(--dm-muted))]">
                      {entry.slip_key.slice(0, 12)}
                      {entry.generation ? ` · generation ${entry.generation}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "dm-status-pill",
                        findings > 0 && !isSuperseded
                          ? "dm-status-pill--danger"
                          : possibleClaims > 0 || neededInputs > 0
                            ? "dm-status-pill--warning"
                            : "dm-status-pill--muted",
                      )}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">{findings}</td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">
                    {possibleClaims}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums">
                    {neededInputs}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(entry)}
                      className="dm-focus rounded-full border border-[hsl(var(--dm-cyan))] px-4 py-2 text-xs font-bold text-[hsl(var(--dm-cyan-dark))] transition hover:bg-[hsl(var(--dm-cyan-pale))]"
                    >
                      Åbn lønseddel
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!caseSheet && (
        <p className="border-t border-[hsl(var(--dm-border))] bg-amber-50 px-6 py-3 text-xs leading-5 text-amber-900">
          Sagen har endnu ikke et sagsark. Registeret viser derfor perioderne, men ingen beregnede
          optællinger.
        </p>
      )}
    </section>
  );
}
