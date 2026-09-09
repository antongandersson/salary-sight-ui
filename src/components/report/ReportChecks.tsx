import { useMemo } from "react";

import { StatusPill } from "@/components/report/StatusPill";
import {
  checksForUi,
  CLASS_LABELS,
  hasVisibilityPolicy,
  type Check,
  type Report,
  type SlipLine,
  type Terminal,
} from "@/lib/report";

type Mode = "hurtig" | "revision";
export type CheckFilter = Terminal | "ALLE" | "OPMÆRKSOMHED";

function pad(position: number): string {
  return String(position).padStart(3, "0");
}

function lineLabel(line: SlipLine | undefined): string {
  if (!line) return "Kontrol på rapportniveau";
  return `${line.description ?? line.concept ?? "Lønlinje"} · linje ${line.index}`;
}

function ControlRow({
  active,
  check,
  line,
  mode,
  onSelect,
  position,
}: {
  active: boolean;
  check: Check;
  line: SlipLine | undefined;
  mode: Mode;
  onSelect: () => void;
  position: number;
}) {
  return (
    <li className="border-b border-border last:border-0">
      <button
        aria-pressed={active}
        className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-2.5 px-4 py-3 text-left transition-colors ${
          active ? "bg-accent/8" : "hover:bg-muted/40"
        }`}
        id={check.check_id}
        onClick={onSelect}
        type="button"
      >
        <span className="num pt-0.5 text-[11px] text-muted-foreground">{pad(position)}</span>
        <span className="min-w-0">
          <span className="flex items-start justify-between gap-3">
            <strong className="text-[13px] font-semibold leading-snug text-foreground">
              {check.title}
            </strong>
            <StatusPill terminal={check.terminal} />
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {CLASS_LABELS[check.check_class] ?? check.section} · {lineLabel(line)}
          </span>
          <span className="num mt-1 block text-[10px] text-muted-foreground">{check.check_id}</span>
          {check.note ? (
            <span
              className={`mt-2 block text-[11px] leading-relaxed text-muted-foreground ${
                mode === "hurtig" ? "line-clamp-2" : ""
              }`}
            >
              {check.note}
            </span>
          ) : null}
          {check.computation?.arithmetic ? (
            <span className="num mt-2 block whitespace-pre-line rounded-md border border-border bg-muted/40 p-2.5 text-[10px] leading-relaxed text-foreground">
              {check.computation.arithmetic}
            </span>
          ) : null}
          <span className="mt-2 block text-[10px] font-semibold text-accent">Åbn bevisark →</span>
        </span>
      </button>
    </li>
  );
}

export function ReportChecks({
  filter,
  focus,
  mode,
  onSelect,
  report,
}: {
  filter: CheckFilter;
  focus: string | null;
  mode: Mode;
  onSelect: (checkId: string) => void;
  report: Report;
}) {
  const { eligible, lineByCheckId, positionByCheckId, uiCheckCount } = useMemo(() => {
    const uiChecks = checksForUi(report);
    const filtered = uiChecks.filter(
      (check) =>
        filter === "ALLE" ||
        (filter === "OPMÆRKSOMHED" ? check.terminal !== "OK" : check.terminal === filter),
    );
    const positions = new Map(report.checks.map((check, index) => [check.check_id, index + 1]));
    const lines = new Map<string, SlipLine>();
    for (const line of report.lines) {
      for (const checkId of line.checks) {
        if (!lines.has(checkId)) lines.set(checkId, line);
      }
    }
    return {
      eligible: filtered,
      lineByCheckId: lines,
      positionByCheckId: positions,
      uiCheckCount: uiChecks.length,
    };
  }, [filter, report]);

  if (eligible.length === 0) {
    return (
      <p className="paper rounded-lg p-5 text-[13px] text-muted-foreground">
        Ingen kontroller matcher det valgte filter.
      </p>
    );
  }

  const selected = eligible.find((check) => check.check_id === focus) ?? eligible[0]!;

  return (
    <section className="paper overflow-hidden rounded-xl" aria-labelledby="controls-title">
      <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground" id="controls-title">
            {hasVisibilityPolicy(report) ? "Alle brugerrettede kontroller" : "Alle kontroller"}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Oprindelig rækkefølge fra API-rapporten
          </p>
        </div>
        <span className="num rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          {eligible.length}
        </span>
      </header>

      <ol className="max-h-[calc(100vh-15rem)] overflow-y-auto overscroll-contain">
        {eligible.map((check) => (
          <ControlRow
            active={selected.check_id === check.check_id}
            check={check}
            key={check.check_id}
            line={lineByCheckId.get(check.check_id)}
            mode={mode}
            onSelect={() => onSelect(check.check_id)}
            position={positionByCheckId.get(check.check_id) ?? 0}
          />
        ))}
      </ol>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5 text-[10px] text-muted-foreground">
        <span>
          Viser {eligible.length} af {uiCheckCount} i det valgte filter · {uiCheckCount} af{" "}
          {report.checks.length} kontroller fra API
        </span>
        <span>
          {hasVisibilityPolicy(report)
            ? "Kun kontroller markeret til brugerfladen af API'et"
            : "Ældre rapport uden visibility-felt"}
          {" · "}ingen omsortering
        </span>
      </footer>
    </section>
  );
}
