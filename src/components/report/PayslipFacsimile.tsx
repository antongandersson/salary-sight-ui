import { kr, report, TERMINALS, type Terminal } from "@/lib/report";

const dotClass: Record<Terminal, string> = {
  MISMATCH: "bg-mismatch",
  NEEDS_INPUT: "bg-needs",
  FORBEHOLD: "bg-forbehold",
  REFUSED: "bg-refused",
  KONTROLPUNKT: "bg-refused",
  OK: "bg-ok",
};

type Row = {
  code?: string;
  label: string;
  basis?: number | null;
  rate?: string | null;
  total?: number | null;
  indent?: boolean;
  bold?: boolean;
  muted?: boolean;
  lineIndex?: number;
};

/** Trykt rækkefølge som på den originale DataLøn-seddel. */
const printedRows: Row[] = [
  { code: "0001", label: "Arbejdstimer", basis: 165, lineIndex: 14 },
  { code: "1213", label: "Normaltimer 1 x sats", basis: 165, rate: "94,00", total: 15510, lineIndex: 0 },
  {
    label: "Arbejdsmarkedspension, medarbejderprocent",
    basis: 19483.47,
    rate: "2%",
    total: -389.67,
    lineIndex: 1,
  },
  { label: "ATP-bidrag af løn", total: -99, lineIndex: 2 },
  { label: "AM-bidrag", basis: 15021.33, rate: "8%", total: -1202, lineIndex: 3 },
  { label: "A-skat", basis: 8280, rate: "37%", total: -3064, lineIndex: 4 },
  { label: "A-Indkomst", basis: 13819.33, muted: true, indent: true, lineIndex: 15 },
  { label: "Skattefradrag (Hovedkort)", basis: 5530, muted: true, indent: true, lineIndex: 16 },
  { label: "Til udbetaling", total: 10755.33, bold: true, lineIndex: 8 },
  { label: "Pension overføres til (01865846)", total: 2532.86, lineIndex: 17 },
  { label: "Virksomhedsprocent (11,00%)", basis: 2143.19, muted: true, indent: true, lineIndex: 18 },
  { label: "Medarbejderbidrag", basis: 389.67, muted: true, indent: true, lineIndex: 19 },
  { label: "Feriepenge overføres til Feriekonto", total: 1130.46, lineIndex: 20 },
  { label: "Fritvalg, opsparet", basis: 15595.71, rate: "9%", total: 1403.61, lineIndex: 5 },
  { label: "Søgnehelligdag, opsparet", basis: 15510, rate: "4%", total: 620.4, lineIndex: 6 },
  { label: "Store bededagstillæg, opsparet", basis: 19047.06, rate: "0,45%", total: 85.71, lineIndex: 7 },
];

const feriedage = [
  ["Lovpligtige, indeværende år", "18,72", "0,00", "18,72"],
  ["I alt", "18,72", "0,00", "18,72"],
];

const feriepenge = [
  ["Feriepengegrundlag", "15.595,71", "124.029,14"],
  ["Feriepengeopsparing", "1.949,46", "15.503,63"],
  ["AM-bidrag (8,00%)", "156,00", "1.241,00"],
  ["A-skat", "663,00", "5.271,00"],
  ["A-indkomst", "1.793,46", "14.262,63"],
  ["Feriepenge efter skat", "1.130,46", "8.991,63"],
];

const opsparinger = [
  ["Fritvalg", "6.890,45", "0,00", "6.890,45"],
  ["Søgnehelligdag", "3.045,60", "0,00", "3.045,60"],
  ["Store bededagstillæg", "1.684,16", "0,00", "1.684,16"],
];

const saldi = [
  ["Arbejdstimer", "810,00"],
  ["AM-grundlag", "83.302,15"],
  ["AM-bidrag, samlet", "6.666,00"],
  ["A-Indkomst", "76.636,15"],
  ["ATP, medarbejderbidrag", "495,00"],
  ["ATP, virksomhedsbidrag", "990,00"],
  ["A-skat, samlet", "18.110,00"],
  ["Arbejdsmarkedspension, medarbejderbidrag", "1.912,93"],
  ["Arbejdsmarkedspension, virksomhedsbidrag", "10.521,11"],
  ["Store bededagstillæg, grundlag", "374.259,31"],
];

export function PayslipFacsimile({ onSelect }: { onSelect: (checkId: string) => void }) {
  const byId = new Map(report.checks.map((c) => [c.check_id, c]));
  const checksByLine = new Map<number, string[]>();
  for (const line of report.lines) {
    if (line.checks.length) checksByLine.set(line.index, line.checks);
  }

  return (
    <div className="paper overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border px-6 py-5">
        <div>
          <p className="label-caps">Lønseddel · DataLøn</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Medarbejder anonymiseret · Ansættelse 17.06.2024 · Lønkonto NemKonto
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] font-semibold text-foreground">Jacobsens Biler ApS</p>
          <p className="num text-[12px] text-muted-foreground">CVR-nr. 42661244</p>
        </div>
      </div>

      <div className="grid gap-4 border-b border-border bg-muted/50 px-6 py-4 sm:grid-cols-3">
        <div>
          <p className="label-caps">Lønperiode</p>
          <p className="mt-0.5 text-[14px] font-semibold text-foreground">Maj 2026</p>
          <p className="num text-[12px] text-muted-foreground">01.05.2026 – 31.05.2026</p>
        </div>
        <div>
          <p className="label-caps">Udbetalingsdato</p>
          <p className="num mt-0.5 text-[14px] font-semibold text-foreground">29.05.2026</p>
        </div>
        <div className="sm:text-right">
          <p className="label-caps">Til udbetaling</p>
          <p className="num mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            {kr(10755.33)} <span className="text-base font-semibold">kr.</span>
          </p>
        </div>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="w-12 py-2 pl-6 text-left font-semibold">Nr.</th>
            <th className="py-2 text-left font-semibold">Beskrivelse</th>
            <th className="w-32 py-2 text-right font-semibold">Grundlag</th>
            <th className="w-20 py-2 text-right font-semibold">Sats</th>
            <th className="w-32 py-2 text-right font-semibold">Total</th>
            <th className="w-40 py-2 pr-6 text-right font-semibold">Kontrol</th>
          </tr>
        </thead>
        <tbody>
          {printedRows.map((row, i) => {
            const ids = row.lineIndex !== undefined ? (checksByLine.get(row.lineIndex) ?? []) : [];
            const checks = ids.map((id) => byId.get(id)).filter(Boolean);
            const worst = checks
              .map((c) => c!.terminal)
              .sort((a, b) => TERMINALS[a].order - TERMINALS[b].order)[0];
            const flagged = worst === "MISMATCH" || worst === "NEEDS_INPUT";
            return (
              <tr
                key={i}
                className={`border-b border-border/60 last:border-0 ${
                  flagged ? "bg-mismatch-soft/40" : "hover:bg-muted/40"
                }`}
              >
                <td className="num py-2 pl-6 text-left text-[11px] text-muted-foreground">
                  {row.code ?? ""}
                </td>
                <td
                  className={`py-2 pr-3 ${row.indent ? "pl-4" : ""} ${
                    row.muted ? "text-muted-foreground" : "text-foreground"
                  } ${row.bold ? "font-semibold" : ""}`}
                >
                  {row.label}
                </td>
                <td className="num py-2 text-right tabular-nums text-muted-foreground">
                  {row.basis !== undefined && row.basis !== null ? kr(row.basis) : ""}
                </td>
                <td className="num py-2 text-right tabular-nums text-muted-foreground">
                  {row.rate ?? ""}
                </td>
                <td
                  className={`num py-2 text-right tabular-nums ${
                    row.bold ? "font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  {row.total !== undefined && row.total !== null ? kr(row.total) : ""}
                </td>
                <td className="py-2 pr-6">
                  <div className="flex flex-wrap justify-end gap-1">
                    {checks.map((c) => (
                      <button
                        key={c!.check_id}
                        type="button"
                        onClick={() => onSelect(c!.check_id)}
                        title={`${c!.check_class} · ${c!.title}`}
                        className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      >
                        <span className={`size-1.5 rounded-full ${dotClass[c!.terminal]}`} />
                        <span className="num">{c!.check_class}</span>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="grid gap-8 border-t border-border bg-muted/40 px-6 py-5 text-[12px] lg:grid-cols-2">
        <div className="space-y-5">
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Feriedage</span>
              <span className="flex gap-6">
                <span className="w-16 text-right">Optjent</span>
                <span className="w-16 text-right">Afholdt</span>
                <span className="w-16 text-right">Rest</span>
              </span>
            </div>
            {feriedage.map(([label, ...cols]) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-foreground">{label}</span>
                <span className="num flex gap-6 tabular-nums text-muted-foreground">
                  {cols.map((v, i) => (
                    <span key={i} className="w-16 text-right">
                      {v}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Feriepenge</span>
              <span className="flex gap-6">
                <span className="w-20 text-right">I perioden</span>
                <span className="w-20 text-right">I ferieåret</span>
              </span>
            </div>
            {feriepenge.map(([label, ...cols]) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-foreground">{label}</span>
                <span className="num flex gap-6 tabular-nums text-muted-foreground">
                  {cols.map((v, i) => (
                    <span key={i} className="w-20 text-right">
                      {v}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Opsparinger</span>
              <span className="flex gap-6">
                <span className="w-16 text-right">Opsparet</span>
                <span className="w-16 text-right">Brugt</span>
                <span className="w-16 text-right">Rest</span>
              </span>
            </div>
            {opsparinger.map(([label, ...cols]) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-foreground">{label}</span>
                <span className="num flex gap-6 tabular-nums text-muted-foreground">
                  {cols.map((v, i) => (
                    <span key={i} className="w-16 text-right">
                      {v}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Saldi</span>
              <span>År til dato</span>
            </div>
            {saldi.map(([label, v]) => (
              <div key={label} className="flex justify-between py-0.5">
                <span className="text-foreground">{label}</span>
                <span className="num tabular-nums text-muted-foreground">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t border-border px-6 py-2 text-[11px] text-muted-foreground">
        <span>Bilag nr. 24</span>
        <span>Side 1 af 1</span>
      </div>
    </div>
  );
}
