import { CheckCircle2, FileJson2, FileText, Fingerprint, TriangleAlert } from "lucide-react";

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
  caseId,
  contextFilename,
  contextRevision,
  documents,
  source,
}: {
  caseContext: Record<string, unknown>;
  caseId: string;
  contextFilename: string | null;
  contextRevision: number | null;
  documents: DocumentSummary[];
  source: ReportSource;
}) {
  const contract = documents.find((document) => document.kind.toLowerCase() === "contract");
  const contextEntries = Object.keys(caseContext).length;
  const hasContext = contextEntries > 0;

  return (
    <section className="paper mt-4 rounded-lg p-4" aria-labelledby="source-proof-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">Sporbarhed</p>
          <h2 className="mt-1 text-[15px] font-semibold text-foreground" id="source-proof-title">
            Datagrundlag for rapporten
          </h2>
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
          {source.verified ? "API-data bekræftet" : "Datakilde kræver kontrol"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {hasContext ? (
          <div className="rounded-md border border-ok/25 bg-ok-soft/35 p-3">
            <div className="flex items-center gap-2">
              <FileJson2 className="size-4 shrink-0 text-ok" aria-hidden="true" />
              <span className="truncate text-[12px] font-semibold text-foreground">
                {contextFilename ?? (contract ? "Udledt sagskontekst" : "Member context")}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              <strong className="text-foreground">{contextEntries}</strong> kontekstfelter knyttet
              til sagen
            </p>
            <p className="num mt-1 text-[10px] text-muted-foreground">
              {contextRevision === null
                ? "Gemte sagsoplysninger"
                : `Context revision ${contextRevision}`}
            </p>
          </div>
        ) : null}
        {documents.length > 0 ? (
          documents.map((document) => (
            <div
              className="rounded-md border border-border bg-muted/25 p-3"
              key={document.document_id}
            >
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate text-[12px] font-semibold text-foreground">
                  {document.filename}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Genkendt som <strong className="text-foreground">{kindLabel(document.kind)}</strong>
              </p>
              <p className="num mt-1 truncate text-[10px] text-muted-foreground">
                Filaftryk {document.sha256.slice(0, 12)}…
              </p>
            </div>
          ))
        ) : (
          <p className="text-[12px] text-muted-foreground">Dokumentlisten kunne ikke hentes.</p>
        )}
      </div>

      {!contract && !hasContext ? (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <TriangleAlert className="size-3.5 text-forbehold" aria-hidden="true" />
          Der er hverken kontrakt eller member context på sagen. Rapporten kan derfor mangle
          ansættelsesvilkår.
        </p>
      ) : null}

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Sag</dt>
          <dd className="num mt-0.5 truncate text-foreground" title={caseId}>
            {caseId}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rapportversion</dt>
          <dd className="num mt-0.5 text-foreground">Generation {source.generation}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dannet</dt>
          <dd className="mt-0.5 text-foreground">{formatDateTime(source.renderedAt)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Fingerprint className="size-3" aria-hidden="true" /> Dataversion
          </dt>
          <dd className="num mt-0.5 truncate text-foreground" title={source.inputsDigest}>
            {source.inputsDigest.slice(0, 16)}…
          </dd>
        </div>
      </dl>
    </section>
  );
}
