import { TERMINALS, type Terminal } from "@/lib/report";

const toneClass: Record<Terminal, string> = {
  MISMATCH: "bg-mismatch-soft text-mismatch border-mismatch/30",
  NEEDS_INPUT: "bg-needs-soft text-needs border-needs/30",
  FORBEHOLD: "bg-forbehold-soft text-forbehold border-forbehold/30",
  REFUSED: "bg-refused-soft text-refused border-refused/30",
  KONTROLPUNKT: "bg-refused-soft text-refused border-refused/30",
  OK: "bg-ok-soft text-ok border-ok/25",
};

export function StatusPill({
  terminal,
  long = false,
}: {
  terminal: Terminal;
  long?: boolean;
}) {
  const meta = TERMINALS[terminal];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${toneClass[terminal]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {long ? meta.label : meta.short}
    </span>
  );
}

export function ClassChip({ code, label }: { code: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className="num font-semibold text-foreground">{code}</span>
      {label}
    </span>
  );
}
