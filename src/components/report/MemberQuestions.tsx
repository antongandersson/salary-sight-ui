import { FileQuestion, LockKeyhole, UserRound } from "lucide-react";
import { useState } from "react";

import type { CaseSheet, CaseSheetNeedInput } from "@/lib/case-sheet";

function InputRow({
  input,
  selected,
  onToggle,
}: {
  input: CaseSheetNeedInput;
  selected: boolean;
  onToggle: () => void;
}) {
  const id = `question-${input.artifact.replaceAll(/[^a-zA-Z0-9]+/g, "-")}`;
  return (
    <label
      className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-4 last:border-0"
      htmlFor={id}
    >
      <input
        checked={selected}
        className="mt-0.5 size-4 accent-accent"
        id={id}
        onChange={onToggle}
        type="checkbox"
      />
      <span className="min-w-0 flex-1">
        <strong className="block text-[13px] font-semibold leading-snug text-foreground">
          {input.artifact}
        </strong>
        <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">
          {input.unlocks}
        </span>
        <span className="mt-2 block text-[10px] font-semibold text-needs">
          Påvirker {input.slips_count} {input.slips_count === 1 ? "lønseddel" : "lønsedler"} ·{" "}
          {input.kind}
        </span>
      </span>
    </label>
  );
}

export function MemberQuestions({ caseSheet }: { caseSheet: CaseSheet | null }) {
  const memberInputs =
    caseSheet?.needs_input.filter((input) => input.ask_target === "member") ?? [];
  const otherInputs = caseSheet?.needs_input.filter((input) => input.ask_target !== "member") ?? [];
  const [selected, setSelected] = useState<string[]>(() =>
    memberInputs.map((input) => input.artifact),
  );

  if (!caseSheet) {
    return (
      <p className="paper rounded-xl p-5 text-[13px] text-muted-foreground">
        Spørgsmål kan først grupperes, når middleware har leveret et case-sheet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps text-accent">Spørgsmål til medlem</p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Indhent det, der kan afgøre sagen
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Samme oplysning vises én gang, selv når den påvirker mange perioder.
          </p>
        </div>
        <span className="rounded-full bg-needs-soft px-3 py-1.5 text-[11px] font-semibold text-needs">
          {selected.length} valgt
        </span>
      </header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="paper overflow-hidden rounded-xl" aria-labelledby="member-input-title">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <UserRound className="size-4 text-needs" aria-hidden="true" />
            <div>
              <h2 className="text-[13px] font-semibold text-foreground" id="member-input-title">
                Kan indhentes fra medlemmet
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Direkte fra case-sheet · ask_target: member
              </p>
            </div>
          </div>
          {memberInputs.length > 0 ? (
            memberInputs.map((input) => (
              <InputRow
                input={input}
                key={input.artifact}
                onToggle={() =>
                  setSelected((current) =>
                    current.includes(input.artifact)
                      ? current.filter((item) => item !== input.artifact)
                      : [...current, input.artifact],
                  )
                }
                selected={selected.includes(input.artifact)}
              />
            ))
          ) : (
            <p className="px-4 py-5 text-[12px] text-muted-foreground">
              Middleware efterspørger ikke oplysninger fra medlemmet.
            </p>
          )}
          <p className="border-t border-border bg-muted/25 px-4 py-3 text-[10px] text-muted-foreground">
            Udvalget er lokal arbejdsstatus og ændrer ikke rapporten. Afsendelse og svarhistorik
            kræver integration med sagssystemet.
          </p>
        </section>
        <section className="paper overflow-hidden rounded-xl" aria-labelledby="other-input-title">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <LockKeyhole className="size-4 text-forbehold" aria-hidden="true" />
            <div>
              <h2 className="text-[13px] font-semibold text-foreground" id="other-input-title">
                Kan ikke lukkes af medlemmet
              </h2>
              <p className="text-[10px] text-muted-foreground">
                Rapporten placerer inputtet et andet sted
              </p>
            </div>
          </div>
          {otherInputs.length > 0 ? (
            <ul>
              {otherInputs.map((input) => (
                <li className="border-b border-border px-4 py-4 last:border-0" key={input.artifact}>
                  <div className="flex gap-2">
                    <FileQuestion
                      className="mt-0.5 size-4 shrink-0 text-forbehold"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[12px] font-semibold leading-snug text-foreground">
                        {input.artifact}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {input.unlocks}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-[12px] text-muted-foreground">
              Ingen øvrige input er efterspurgt.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
