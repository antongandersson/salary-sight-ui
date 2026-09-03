import { FileText } from "lucide-react";

import { kr, type Report } from "@/lib/report";

const dotClass = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
} as const;

export function PayslipFacsimile({
  onSelect,
  report,
}: {
  onSelect: (checkId: string) => void;
  report: Report;
}) {
  const checksById = new Map(report.checks.map((check) => [check.check_id, check]));

  return (
    <div className="paper overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <p className="label-caps">Indlæst lønseddel</p>
          <p className="num mt-1 text-[13px] text-muted-foreground">
            {report.slip.slip_key} · periode {report.slip.period}
          </p>
        </div>
        <FileText className="size-5 text-accent" aria-hidden="true" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
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
              const checks = line.checks.flatMap((id) => {
                const check = checksById.get(id);
                return check ? [check] : [];
              });
              const hasMismatch = checks.some((check) => check.terminal === "MISMATCH");
              return (
                <tr
                  className={`border-b border-border/60 last:border-0 ${
                    hasMismatch ? "bg-mismatch-soft/40" : "hover:bg-muted/40"
                  }`}
                  key={line.index}
                >
                  <td className="num py-2 pl-6 text-[11px] text-muted-foreground">{line.index}</td>
                  <td className="py-2 pr-3 text-foreground">{line.description ?? "—"}</td>
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
                          className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
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

      <p className="border-t border-border bg-muted/30 px-6 py-4 text-[12px] leading-relaxed text-muted-foreground">
        Dette er middleware-dataenes linjevisning. Den originale PDF gengives ikke som konstrueret
        eksempeldata.
      </p>
    </div>
  );
}
