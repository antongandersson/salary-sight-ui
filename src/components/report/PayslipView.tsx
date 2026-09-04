import { PayslipFacsimile } from "@/components/report/PayslipFacsimile";
import { checksForUi, kr, type Report } from "@/lib/report";

export function PayslipView({
  contained = false,
  onSelect,
  report,
  selectedCheckId = null,
  showTechnicalDetails = true,
}: {
  contained?: boolean;
  onSelect: (checkId: string) => void;
  report: Report;
  selectedCheckId?: string | null;
  showTechnicalDetails?: boolean;
}) {
  const uiCheckIds = new Set(checksForUi(report).map((check) => check.check_id));

  return (
    <div className="space-y-4">
      <PayslipFacsimile
        contained={contained}
        onSelect={onSelect}
        report={report}
        selectedCheckId={selectedCheckId}
      />

      {showTechnicalDetails ? (
        <details className="paper group overflow-hidden rounded-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-[13px] font-semibold text-foreground">
                Tekniske linjefelter
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Begreb, lane, linjetype, grundlag og kontrol-id’er
              </span>
            </span>
            <span className="text-[11px] font-semibold text-accent group-open:hidden">Vis</span>
            <span className="hidden text-[11px] font-semibold text-accent group-open:inline">
              Skjul
            </span>
          </summary>

          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[800px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-14 py-2 pl-4 text-left font-semibold">Linje</th>
                  <th className="py-2 text-left font-semibold">Begreb</th>
                  <th className="w-32 py-2 text-left font-semibold">Lane</th>
                  <th className="w-36 py-2 text-left font-semibold">Linjetype</th>
                  <th className="w-28 py-2 text-right font-semibold">Grundlag</th>
                  <th className="w-56 py-2 pr-4 text-right font-semibold">Kontrol-id’er</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr className="border-b border-border/60 last:border-0" key={line.index}>
                    <td className="num py-2 pl-4 text-muted-foreground">{line.index}</td>
                    <td className="py-2 pr-3 text-foreground">{line.concept ?? "—"}</td>
                    <td className="num py-2 pr-3 text-muted-foreground">{line.lane}</td>
                    <td className="num py-2 pr-3 text-muted-foreground">{line.line_type}</td>
                    <td className="num py-2 pr-3 text-right text-foreground">
                      {line.basis == null ? "—" : kr(line.basis)}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap justify-end gap-1">
                        {line.checks.some((checkId) => uiCheckIds.has(checkId)) ? (
                          line.checks
                            .filter((checkId) => uiCheckIds.has(checkId))
                            .map((checkId) => (
                              <button
                                className="num rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                                key={checkId}
                                onClick={() => onSelect(checkId)}
                                type="button"
                              >
                                {checkId}
                              </button>
                            ))
                        ) : (
                          <span className="text-[10px] text-muted-foreground">ingen</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
