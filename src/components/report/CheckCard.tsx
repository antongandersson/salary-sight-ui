import { useState } from "react";
import { CLASS_LABELS, kr, type Check } from "@/lib/report";
import { ClassChip, StatusPill } from "./StatusPill";

function Evidence({ check }: { check: Check }) {
  const comp = check.computation;
  const money = check.kroner;
  return (
    <div className="mt-4 space-y-4 border-t border-dashed border-border pt-4">
      {comp?.arithmetic ? (
        <div>
          <p className="label-caps">Regnestykke</p>
          <p className="num mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-foreground">
            {comp.arithmetic}
          </p>
        </div>
      ) : null}

      {comp?.inputs?.length ? (
        <div>
          <p className="label-caps">Indgående tal</p>
          <table className="mt-1.5 w-full text-[13px]">
            <tbody>
              {comp.inputs.map((input, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="py-1 pr-3 align-top text-foreground">{input.label}</td>
                  <td className="num py-1 pr-3 text-right align-top tabular-nums text-foreground">
                    {kr(input.value)}
                  </td>
                  <td className="w-1/2 py-1 align-top text-muted-foreground">{input.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {money?.derived?.length ? (
        <div>
          <p className="label-caps">Afledte poster — vises ved siden af, indgår ikke i beløbet</p>
          <ul className="mt-1.5 space-y-2">
            {money.derived.map((d, i) => (
              <li key={i} className="rounded-md bg-muted/60 p-2.5 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{d.label}</span>
                  <span className="num shrink-0">{kr(d.kr)} kr</span>
                </div>
                {d.arithmetic ? (
                  <p className="num mt-1 text-[12px] text-muted-foreground">{d.arithmetic}</p>
                ) : null}
                {d.proof ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{d.proof}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {money?.convention ? (
        <div>
          <p className="label-caps">Opgørelseskonvention</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {money.convention}
          </p>
        </div>
      ) : null}

      {check.missing ? (
        <div className="rounded-md border border-needs/30 bg-needs-soft p-3">
          <p className="label-caps text-needs">Mangler for at kunne afgøres</p>
          <p className="mt-1 text-[13px] text-foreground">{check.missing.artifact}</p>
          {check.missing.unlocks ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Åbner: {check.missing.unlocks}
            </p>
          ) : null}
        </div>
      ) : null}

      {check.quotes?.length ? (
        <div>
          <p className="label-caps">Citater</p>
          <ul className="mt-1.5 space-y-1">
            {check.quotes.map((q, i) => (
              <li
                key={i}
                className="border-l-2 border-accent/60 pl-2.5 text-[13px] italic text-foreground"
              >
                «{q}»
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {comp?.sources?.length ? (
        <div>
          <p className="label-caps">Kilder</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {comp.sources.map((s, i) => (
              <li
                key={i}
                className="rounded-sm border border-border bg-surface px-2 py-0.5 text-[12px] text-muted-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="num text-[11px] text-muted-foreground">
        {check.check_id} · pligt {check.duty ?? "—"} ·{" "}
        {check.authored ? "formuleret kontrol" : "maskinregel"}
      </p>
    </div>
  );
}

export function CheckCard({
  check,
  mode,
  compact = false,
}: {
  check: Check;
  mode: "hurtig" | "revision";
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = mode === "revision" || open;
  const amount = check.kroner?.kr ?? null;

  return (
    <article
      className={`paper rounded-lg p-4 transition-colors ${
        amount ? "border-l-[3px] border-l-mismatch" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill terminal={check.terminal} />
            {!compact && (
              <ClassChip
                code={check.check_class}
                label={CLASS_LABELS[check.check_class] ?? check.section}
              />
            )}
            {check.line_index !== null && check.line_index !== undefined && (
              <span className="num text-[11px] text-muted-foreground">
                linje {check.line_index}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
            {check.title}
          </h3>
        </div>
        {amount ? (
          <div className="text-right">
            <p className="label-caps">Krav</p>
            <p className="num text-xl font-semibold text-mismatch">{kr(amount)} kr</p>
          </div>
        ) : null}
      </div>

      {check.note ? (
        <p
          className={`mt-2 text-[13px] leading-relaxed text-muted-foreground ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {check.note}
        </p>
      ) : null}

      {expanded ? <Evidence check={check} /> : null}

      {mode === "hurtig" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-[12px] font-semibold text-accent underline-offset-4 hover:underline"
        >
          {open ? "Skjul bevis" : "Vis bevis"}
        </button>
      ) : null}
    </article>
  );
}
