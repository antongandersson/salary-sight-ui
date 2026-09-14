import { ArrowRight, CircleDollarSign, FileQuestion } from "lucide-react";

import { kr, periodShort } from "@/lib/report";
import type { ReviewItem } from "@/lib/review-queue";

function terminalTone(terminal: string | null): string {
  switch (terminal) {
    case "MISMATCH":
      return "bg-mismatch";
    case "NEEDS_INPUT":
      return "bg-needs";
    case "FORBEHOLD":
      return "bg-forbehold";
    default:
      return "bg-border";
  }
}

type FamilyGroup = {
  family: string;
  familyTitle: string;
  source: ReviewItem["source"];
  items: ReviewItem[];
};

function groupByFamily(items: ReviewItem[]): FamilyGroup[] {
  const groups: FamilyGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.family === item.family && last.source === item.source) {
      last.items.push(item);
    } else {
      groups.push({
        family: item.family,
        familyTitle: item.familyTitle,
        source: item.source,
        items: [item],
      });
    }
  }
  return groups;
}

function GroupSection({
  groups,
  icon,
  onOpen,
  onToggleReviewed,
  reviewed,
  title,
}: {
  groups: FamilyGroup[];
  icon: React.ReactNode;
  onOpen: (item: ReviewItem) => void;
  onToggleReviewed: (id: string) => void;
  reviewed: ReadonlySet<string>;
  title: string;
}) {
  if (groups.length === 0) return null;
  return (
    <section className="paper overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {icon}
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
      </div>
      {groups.map((group) => (
        <div
          className="border-b border-border last:border-0"
          key={`${group.source}:${group.family}`}
        >
          <p className="bg-muted/25 px-4 py-2 text-[12px] font-semibold text-foreground">
            {group.familyTitle}
            <span className="ml-2 font-normal text-muted-foreground">
              {group.items.length} {group.items.length === 1 ? "måned" : "måneder"}
            </span>
          </p>
          <ol>
            {group.items.map((item) => {
              const done = reviewed.has(item.id);
              return (
                <li
                  className="flex items-center gap-3 border-t border-border px-4 py-2"
                  key={item.id}
                >
                  <input
                    aria-label={`Markér ${group.familyTitle} ${periodShort(item.period)} som gennemgået`}
                    checked={done}
                    className="size-4 accent-primary"
                    onChange={() => onToggleReviewed(item.id)}
                    type="checkbox"
                  />
                  <span
                    className={`h-6 w-1 shrink-0 rounded-full ${terminalTone(item.terminal)}`}
                    aria-hidden="true"
                  />
                  <button
                    className={`flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:text-accent ${
                      done ? "text-muted-foreground" : "text-foreground"
                    }`}
                    onClick={() => onOpen(item)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold">
                        {periodShort(item.period)}
                        {item.olderThanLimitation ? (
                          <span className="ml-2 rounded-full bg-forbehold-soft px-1.5 py-0.5 text-[10px] font-semibold text-forbehold">
                            ældre end forældelsesfrist
                          </span>
                        ) : null}
                      </span>
                      {item.expected != null || item.printed != null ? (
                        <span className="num block text-[11px] text-muted-foreground">
                          {item.expected != null ? `forventet ${kr(item.expected)}` : ""}
                          {item.expected != null && item.printed != null ? " · " : ""}
                          {item.printed != null ? `trykt ${kr(item.printed)}` : ""}
                          {item.lineDescription ? ` · ${item.lineDescription}` : ""}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      {item.kr != null ? (
                        <span className="num text-[13px] font-semibold">{kr(item.kr)} kr</span>
                      ) : null}
                      <ArrowRight className="size-3.5 text-accent" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}

export function ReviewQueue({
  onOpen,
  onToggleReviewed,
  queue,
  reviewed,
}: {
  onOpen: (item: ReviewItem) => void;
  onToggleReviewed: (id: string) => void;
  queue: ReviewItem[];
  reviewed: ReadonlySet<string>;
}) {
  if (queue.length === 0) {
    return (
      <section className="paper rounded-xl p-6">
        <p className="label-caps text-accent">Gennemgang</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">Ingen punkter til gennemgang</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Case-sheetet indeholder ingen dokumenterede fund eller mulige krav.
        </p>
      </section>
    );
  }

  const doneCount = queue.filter((item) => reviewed.has(item.id)).length;
  const groups = groupByFamily(queue);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps text-accent">Gennemgang</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {doneCount} af {queue.length} punkter gennemgået
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Markeringerne er kun lokal arbejdstilstand — de gemmes ikke i sagssystemet.
          </p>
        </div>
        <div
          aria-label={`${doneCount} af ${queue.length} gennemgået`}
          className="h-2 w-48 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemax={queue.length}
          aria-valuemin={0}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-ok transition-all"
            style={{ width: `${queue.length ? (doneCount / queue.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <GroupSection
        groups={groups.filter((group) => group.source === "finding")}
        icon={<CircleDollarSign className="size-4 text-mismatch" aria-hidden="true" />}
        onOpen={onOpen}
        onToggleReviewed={onToggleReviewed}
        reviewed={reviewed}
        title="Dokumenterede fund"
      />
      <GroupSection
        groups={groups.filter((group) => group.source === "claim")}
        icon={<FileQuestion className="size-4 text-needs" aria-hidden="true" />}
        onOpen={onOpen}
        onToggleReviewed={onToggleReviewed}
        reviewed={reviewed}
        title="Mulige krav — kræver dokumentation"
      />
    </div>
  );
}
