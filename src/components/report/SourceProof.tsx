import { CheckCircle2, FileJson2, FileText, Fingerprint, Scale, TriangleAlert } from "lucide-react";

import type { CaseSheet } from "@/lib/case-sheet";
import type { DocumentSummary, ReportSource } from "@/lib/paytjek-api";

function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    payslip: "Lønseddel",
    contract: "Kontrakt",
    unknown: "Ukendt dokument",
  };
  return labels[kind.toLowerCase()] ?? kind;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Tidspunkt ikke oplyst";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SourceProof({
  caseContext,
  caseSheet,
  caseId,
  contextFilename,
  contextRevision,
  documents,
  source,
}: {
  caseContext: Record<string, unknown>;
  caseSheet?: CaseSheet | null;
  caseId: string;
  contextFilename: string | null;
  contextRevision: number | null;
  documents: DocumentSummary[];
  source: ReportSource;
}) {
  const contextEntries = Object.keys(caseContext).length;
  const hasContext = contextEntries > 0;
  const contract = documents.find((document) => document.kind.toLowerCase() === "contract");
  const primaryDocuments = [
    ...(contract ? [contract] : []),
    ...documents.filter((document) => document.document_id !== contract?.document_id).slice(0, 3),
  ];
  const remainingDocuments = documents.filter(
    (document) => !primaryDocuments.some((primary) => primary.document_id === document.document_id),
  );
  const basis = caseSheet
    ? [
        ["Ansættelsesform", caseSheet.grundlag.employment_type],
        ["Uddannelsesår", caseSheet.grundlag.elevaar],
        ["Ugentlig norm", caseSheet.grundlag.timer_pr_uge],
        ["Aftalestart", caseSheet.grundlag.contract_start_date],
        ["Dækning", caseSheet.grundlag.coverage],
      ].filter((item) => item[1] != null)
    : [];
  const ruleSources = caseSheet
    ? caseSheet.findings
        .filter((finding) => finding.source_location || finding.rule_id)
        .map((finding) => ({
          id: `${finding.rule_id ?? finding.family}:${finding.source_location ?? ""}`,
          label: finding.rule_id ?? finding.title,
          source: finding.source_location ?? finding.title,
        }))
        .filter(
          (item, index, items) =>
            items.findIndex((candidate) => candidate.id === item.id) === index,
        )
    : [];

  return (
    <section className="paper overflow-hidden rounded-xl" aria-labelledby="source-proof-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="label-caps text-accent">Grundlag & kilder</p>
          <h1
            className="mt-1 text-xl font-semibold tracking-tight text-foreground"
            id="source-proof-title"
          >
            Det rapporten bygger på
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            source.verified ? "bg-ok-soft text-ok" : "bg-forbehold-soft text-forbehold"
          }`}
        >
          {source.verified ? (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          ) : (
            <TriangleAlert className="size-3.5" aria-hidden="true" />
          )}
          {source.verified ? "API-data bekræftet" : "Kræver kontrol"}
        </span>
      </header>

      <div className="grid lg:grid-cols-2">
        <section className="px-5 py-4" aria-labelledby="basis-title">
          <h2 className="text-[14px] font-semibold text-foreground" id="basis-title">
            Sagens grundlag
          </h2>
          <dl className="mt-3 divide-y divide-border border-y border-border">
            {basis.map(([label, raw]) => {
              const item = raw as Record<string, unknown>;
              const value = item["value"] ?? item["status"] ?? "—";
              const itemSource = item["source"];
              const provenance = item["provenance"] as Record<string, unknown> | undefined;
              const unavailable = provenance?.["unavailable"];
              const limited = Array.isArray(unavailable) && unavailable.length > 0;
              return (
                <div
                  className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 py-3"
                  key={String(label)}
                >
                  <dt className="text-[11px] font-semibold text-muted-foreground">
                    {String(label)}
                  </dt>
                  <dd>
                    <p className="text-[12px] font-semibold text-foreground">{String(value)}</p>
                    {typeof itemSource === "string" ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{itemSource}</p>
                    ) : null}
                    {limited ? (
                      <p className="mt-1 text-[10px] font-semibold text-forbehold">
                        Begrænset proveniens
                      </p>
                    ) : null}
                  </dd>
                </div>
              );
            })}
          </dl>
          {!contract && !hasContext ? (
            <p className="mt-3 flex gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0 text-forbehold"
                aria-hidden="true"
              />
              Ingen kontrakt eller medlemskontekst er knyttet til sagen.
            </p>
          ) : null}
        </section>

        <section
          className="border-t border-border px-5 py-4 lg:border-l lg:border-t-0"
          aria-labelledby="sources-title"
        >
          <h2 className="text-[14px] font-semibold text-foreground" id="sources-title">
            Kilder og dokumenter
          </h2>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {ruleSources.map((item) => (
              <div className="flex items-start gap-3 py-3" key={item.id}>
                <Scale className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
                  <p
                    className="mt-0.5 truncate text-[11px] text-muted-foreground"
                    title={item.source}
                  >
                    {item.source}
                  </p>
                </div>
              </div>
            ))}
            {hasContext ? (
              <div className="flex items-start gap-3 py-3">
                <FileJson2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {contextFilename ?? "Sagsoplysninger"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {contextEntries} felter
                    {contextRevision == null ? "" : ` · revision ${contextRevision}`}
                  </p>
                </div>
              </div>
            ) : null}
            {primaryDocuments.map((document) => (
              <div className="flex items-start gap-3 py-3" key={document.document_id}>
                <FileText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {document.filename}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {kindLabel(document.kind)} · {document.sha256.slice(0, 10)}…
                  </p>
                </div>
              </div>
            ))}
          </div>

          {remainingDocuments.length > 0 ? (
            <details className="mt-3 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-accent">
                Vis yderligere {remainingDocuments.length} dokumenter
              </summary>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-muted/20 px-3">
                {remainingDocuments.map((document) => (
                  <li
                    className="flex items-center justify-between gap-3 py-2"
                    key={document.document_id}
                  >
                    <span className="truncate">{document.filename}</span>
                    <span className="shrink-0">{kindLabel(document.kind)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      </div>

      <footer className="grid gap-2 border-t border-border bg-muted/20 px-5 py-3 text-[10px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <span className="num truncate" title={caseId}>
          Sag {caseId}
        </span>
        <span className="num">Generation {source.generation}</span>
        <span>{formatDateTime(source.renderedAt)}</span>
        <span className="num flex items-center gap-1 truncate" title={source.inputsDigest}>
          <Fingerprint className="size-3 shrink-0" aria-hidden="true" />{" "}
          {source.inputsDigest.slice(0, 16)}…
        </span>
      </footer>
    </section>
  );
}
