import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { FileText, ShieldCheck, UploadCloud, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AgreementFamily } from "@/lib/paytjek-api";

const MAX_FILES = 30;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatSize(bytes: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

function validateFiles(files: readonly File[]): string | null {
  if (files.length > MAX_FILES) return "Du kan højst uploade 30 PDF-filer ad gangen.";
  const invalid = files.find((file) => !file.name.toLowerCase().endsWith(".pdf"));
  if (invalid) return `${invalid.name} er ikke en PDF-fil.`;
  const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES);
  return tooLarge ? `${tooLarge.name} er større end 15 MB.` : null;
}

export type UploadSubmission = {
  label: string;
  agreementFamily: AgreementFamily | null;
  files: File[];
};

export function UploadCase({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (submission: UploadSubmission) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [agreementFamily, setAgreementFamily] = useState<AgreementFamily | "auto">("auto");
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: readonly File[]) {
    const known = new Set(files.map(fileKey));
    const combined = [...files, ...incoming.filter((file) => !known.has(fileKey(file)))];
    const nextError = validateFiles(combined);
    setValidationError(nextError);
    if (nextError === null) setFiles(combined);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateFiles(files);
    if (!label.trim()) {
      setValidationError("Giv sagen et navn eller medlemsnummer.");
      return;
    }
    if (files.length === 0) {
      setValidationError("Tilføj mindst én lønseddel eller kontrakt som PDF.");
      return;
    }
    if (nextError !== null) {
      setValidationError(nextError);
      return;
    }
    setValidationError(null);
    await onSubmit({
      label: label.trim(),
      agreementFamily: agreementFamily === "auto" ? null : agreementFamily,
      files,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-baseline gap-3 px-6 py-4">
          <span className="text-sm font-bold tracking-tight text-accent">PAYTJEK</span>
          <span className="text-sm font-semibold text-foreground">Ny lønseddelkontrol</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[minmax(0,720px)_1fr]">
        <section className="paper rounded-xl p-6 sm:p-8">
          <p className="label-caps">Ny sag</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Upload lønsedler og kontrakt
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            PayTjek sender PDF-filerne samlet til middleware, som genkender dokumenttypen og
            opretter en kontrolrapport for hver lønperiode.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="case-label">Sag eller medlemsnummer</Label>
                <Input
                  autoComplete="off"
                  disabled={busy}
                  id="case-label"
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Fx medlem 10482"
                  value={label}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agreement">Overenskomst</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  disabled={busy}
                  id="agreement"
                  onChange={(event) =>
                    setAgreementFamily(event.target.value as AgreementFamily | "auto")
                  }
                  value={agreementFamily}
                >
                  <option value="auto">Find automatisk</option>
                  <option value="IND25">Industriens Overenskomst 2025–2028</option>
                  <option value="IND23">Industriens Overenskomst 2023–2025</option>
                </select>
              </div>
            </div>

            <div
              className={`rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? "border-accent bg-mismatch-soft/40" : "border-border bg-muted/30"
              }`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <UploadCloud className="mx-auto size-9 text-accent" aria-hidden="true" />
              <p className="mt-3 text-[15px] font-semibold text-foreground">
                Træk PDF-filer hertil
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Lønsedler og ansættelseskontrakt · højst 30 filer · 15 MB pr. fil
              </p>
              <Button
                className="mt-4"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                type="button"
                variant="outline"
              >
                Vælg filer
              </Button>
              <input
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={busy}
                id="documents"
                multiple
                onChange={handleFileInput}
                ref={inputRef}
                type="file"
              />
            </div>

            {files.length > 0 ? (
              <div aria-label="Valgte dokumenter" className="space-y-2">
                {files.map((file) => (
                  <div
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                    key={fileKey(file)}
                  >
                    <FileText className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                      {file.name}
                    </span>
                    <span className="num text-[11px] text-muted-foreground">
                      {formatSize(file.size)} MB
                    </span>
                    <Button
                      aria-label={`Fjern ${file.name}`}
                      disabled={busy}
                      onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {validationError || error ? (
              <Alert variant="destructive">
                <AlertDescription>{validationError ?? error}</AlertDescription>
              </Alert>
            ) : null}

            <Button className="w-full sm:w-auto" disabled={busy} size="lg" type="submit">
              {busy ? "Uploader dokumenter…" : "Start løntjek"}
            </Button>
          </form>
        </section>

        <aside className="space-y-4 lg:pt-12">
          <div className="paper rounded-lg p-5">
            <ShieldCheck className="size-5 text-ok" aria-hidden="true" />
            <h2 className="mt-3 text-[15px] font-semibold text-foreground">
              Ét samlet kontrolforløb
            </h2>
            <ol className="mt-4 space-y-4 text-[13px] text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> Upload lønsedler og kontrakt
              </li>
              <li>
                <strong className="text-foreground">2.</strong> Middleware læser og kontrollerer
              </li>
              <li>
                <strong className="text-foreground">3.</strong> Resultatet åbner i sagsskærmen
              </li>
            </ol>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Ingen eksempelrapport indlæses. Sagsskærmen vises kun med data fra de dokumenter, du
            sender til PayTjek.
          </p>
        </aside>
      </main>
    </div>
  );
}
