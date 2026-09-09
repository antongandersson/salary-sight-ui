import { FileText } from "lucide-react";

import {
  checkPosition,
  checksForLine,
  kr,
  lineForCheck,
  periodLabel,
  type Report,
} from "@/lib/report";

const dotClass = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
} as const;

export function PayslipFacsimile({
  contained = false,
  onSelect,
  report,
  selectedCheckId = null,
}: {
  contained?: boolean;
  onSelect: (checkId: string) => void;
  report: Report;
  selectedCheckId?: string | null;
}) {
  const selectedPosition = selectedCheckId ? checkPosition(report, selectedCheckId) : null;
  const selectedLine = selectedCheckId ? lineForCheck(report, selectedCheckId) : null;

  return (
    <section className="paper overflow-hidden rounded-xl" aria-labelledby="payslip-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className="label-caps text-accent">Lønsedlens linjer</p>
          <h2 className="mt-1 text-[15px] font-semibold text-foreground" id="payslip-title">
            Lønseddel · {periodLabel(report.slip.period)}
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Direkte fra rule-engine/API-outputtet
          </p>
          <p className="num mt-0.5 text-[11px] text-muted-foreground">
            {selectedLine
              ? `Kontrol ${String(selectedPosition ?? "—").padStart(3, "0")} peger på linje ${selectedLine.index}`
              : report.slip.slip_key}
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          <FileText className="size-3.5 text-accent" aria-hidden="true" />
          {report.lines.length} linjer
        </span>
      </div>

      <div
        className={`overflow-auto bg-muted/35 p-3 sm:p-5 ${
          contained ? "max-h-[calc(100vh-15rem)]" : ""
        }`}
      >
        <div className="mx-auto min-w-[680px] max-w-[820px] overflow-hidden rounded-sm bg-card shadow-[0_10px_30px_rgba(30,35,40,.12)]">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[12px] uppercase tracking-wide text-muted-foreground">
                <th className="w-16 py-2 pl-6 text-left font-semibold">Linje</th>
                <th className="py-2 text-left font-semibold">Beskrivelse</th>
                <th className="w-28 py-2 text-right font-semibold">Antal</th>
                <th className="w-28 py-2 text-right font-semibold">Sats</th>
                <th className="w-32 py-2 text-right font-semibold">Beløb</th>
                <th className="w-40 py-2 pr-6 text-right font-semibold">Kontrol</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => {
                const checks = checksForLine(report, line);
                const hasMismatch = checks.some((check) => check.terminal === "MISMATCH");
                const selected = selectedCheckId ? line.checks.includes(selectedCheckId) : false;
                return (
                  <tr
                    className={`border-b border-border/60 last:border-0 ${
                      selected
                        ? "bg-forbehold-soft shadow-[inset_3px_0_0_var(--forbehold)]"
                        : hasMismatch
                          ? "bg-mismatch-soft/30"
                          : "hover:bg-muted/40"
                    }`}
                    key={line.index}
                  >
                    <td className="num py-2 pl-6 text-[12px] text-muted-foreground">
                      {line.index}
                    </td>
                    <td className="py-2 pr-3 text-foreground">
                      {checks.length > 0 ? (
                        <button
                          className="w-full text-left hover:text-accent"
                          onClick={() => onSelect(checks[0]!.check_id)}
                          type="button"
                        >
                          {line.description ?? "—"}
                        </button>
                      ) : (
                        (line.description ?? "—")
                      )}
                    </td>
                    <td className="num py-2 text-right text-muted-foreground">
                      {line.quantity == null ? "" : kr(line.quantity)}
                    </td>
                    <td className="num py-2 text-right text-muted-foreground">
                      {line.rate == null ? "" : kr(line.rate)}
                    </td>
                    <td className="num py-2 text-right text-foreground">
                      {line.amount == null ? "—" : kr(line.amount)}
                    </td>
                    <td className="py-2 pr-6">
                      <div className="flex flex-wrap justify-end gap-1">
                        {checks.map((check) => (
                          <button
                            className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-0.5 text-[12px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                            key={check.check_id}
                            onClick={() => onSelect(check.check_id)}
                            title={`${check.check_class} · ${check.title}`}
                            type="button"
                          >
                            <span className={`size-1.5 rounded-full ${dotClass[check.terminal]}`} />
                            <span className="num">{check.check_class}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="border-t border-border bg-muted/30 px-5 py-3 text-[12px] leading-relaxed text-muted-foreground">
        Lønlinjerne kommer direkte fra rule-engine/API-outputtet. Klik på en linje eller
        kontrolmarkør for at åbne den tilhørende autoritative kontrol.
      </p>
    </section>
  );
}
