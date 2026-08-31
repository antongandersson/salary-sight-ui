import { kr, report, TERMINALS, type Terminal } from "@/lib/report";

const dotClass: Record<Terminal, string> = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
};

const laneLabels: Record<string, string> = {
  PAYMENT: "Udbetaling",
  SALDO: "Saldi",
  PARSE_DROPPED: "Ikke afkodet ved indlæsning",
};

export function SlipTable({ onSelect }: { onSelect: (checkId: string) => void }) {
  const byId = new Map(report.checks.map((c) => [c.check_id, c]));
  const lanes = ["PAYMENT", "SALDO", "PARSE_DROPPED"];

  return (
    <div className="paper overflow-hidden rounded-lg">
      {lanes.map((lane) => {
        const lines = report.lines.filter((l) => l.lane === lane);
        if (!lines.length) return null;
        return (
          <div key={lane}>
            <div className="border-b border-border bg-muted/60 px-4 py-2">
              <span className="label-caps">{laneLabels[lane] ?? lane}</span>
            </div>
            <table className="w-full text-[13px]">
              <tbody>
                {lines.map((line) => {
                  const checks = line.checks.map((id) => byId.get(id)).filter(Boolean);
                  const worst = checks
                    .map((c) => c!.terminal)
                    .sort((a, b) => TERMINALS[a].order - TERMINALS[b].order)[0];
                  return (
                    <tr
                      key={line.index}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="num w-10 py-2 pl-4 align-top text-[11px] text-muted-foreground">
                        {line.index}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <span className="text-foreground">{line.description ?? "—"}</span>
                        {line.quantity && line.rate ? (
                          <span className="num ml-2 text-[12px] text-muted-foreground">
                            {kr(line.quantity)} × {kr(line.rate)}
                          </span>
                        ) : null}
                      </td>
                      <td className="num w-32 py-2 pr-3 text-right align-top tabular-nums">
                        {line.amount !== null ? kr(line.amount) : "—"}
                      </td>
                      <td className="w-44 py-2 pr-4 align-top">
                        <div className="flex flex-wrap justify-end gap-1">
                          {checks.map((c) => (
                            <button
                              key={c!.check_id}
                              type="button"
                              onClick={() => onSelect(c!.check_id)}
                              title={`${c!.check_class} · ${c!.title}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                            >
                              <span className={`size-1.5 rounded-full ${dotClass[c!.terminal]}`} />
                              <span className="num">{c!.check_class}</span>
                            </button>
                          ))}
                          {!checks.length && worst === undefined ? (
                            <span className="text-[11px] text-muted-foreground">ingen kontrol</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
