import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { BriefcaseBusiness, FileJson2, FileText, ShieldCheck, UploadCloud, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDemoApi, type AgreementFamily } from "@/lib/paytjek-api";

const MAX_FILES = 30;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 1024 * 1024;
const COMPLETE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function formatSize(bytes: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);
}

function validatePdf(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf")) return `${file.name} er ikke en PDF-fil.`;
  return file.size > MAX_FILE_BYTES ? `${file.name} er større end 15 MB.` : null;
}

export type MemberContextUpload = {
  file: File;
  payload: Record<string, unknown>;
};

async function readMemberContext(file: File): Promise<MemberContextUpload> {
  if (!file.name.toLowerCase().endsWith(".json")) {
    throw new Error(`${file.name} er ikke en JSON-fil.`);
  }
  if (file.size > MAX_CONTEXT_BYTES) {
    throw new Error(`${file.name} er større end 1 MB.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error(`${file.name} indeholder ikke gyldig JSON.`);
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Member context skal være ét JSON-objekt.");
  }

  const payload = value as Record<string, unknown>;
  if (payload["schema_version"] === undefined) {
    throw new Error("Member context mangler schema_version.");
  }
  if (typeof payload["member_ref"] !== "string" || payload["member_ref"].trim() === "") {
    throw new Error("Member context mangler member_ref.");
  }
  return { file, payload };
}

type DocumentPickerProps = {
  acceptMultiple: boolean;
  busy: boolean;
  description: string;
  files: File[];
  icon: typeof FileText;
  id: string;
  label: string;
  onFiles: (files: File[]) => void;
  optional?: boolean;
};

function DocumentPicker({
  acceptMultiple,
  busy,
  description,
  files,
  icon: Icon,
  id,
  label,
  onFiles,
  optional = false,
}: DocumentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function receive(incoming: readonly File[]) {
    if (acceptMultiple) {
      const known = new Set(files.map(fileKey));
      onFiles([...files, ...incoming.filter((file) => !known.has(fileKey(file)))]);
      return;
    }
    onFiles(incoming[0] ? [incoming[0]] : []);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    receive(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    receive(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-muted p-2">
          <Icon className="size-5 text-accent" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[14px] font-semibold" htmlFor={id}>
              {label}
            </Label>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {optional ? "Valgfri" : "Påkrævet"}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <div
        className={`mt-4 rounded-md border border-dashed px-4 py-5 text-center transition-colors ${
          dragging ? "border-accent bg-mismatch-soft/40" : "border-border bg-muted/20"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <UploadCloud className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-[12px] text-muted-foreground">
          Træk {acceptMultiple ? "PDF-filer" : "en PDF-fil"} hertil
        </p>
        <Button
          className="mt-3"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {acceptMultiple ? "Vælg lønsedler" : "Vælg kontrakt"}
        </Button>
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={busy}
          id={id}
          multiple={acceptMultiple}
          onChange={handleInput}
          ref={inputRef}
          type="file"
        />
      </div>

      {files.length > 0 ? (
        <div aria-label={`Valgte filer til ${label.toLowerCase()}`} className="mt-3 space-y-2">
          {files.map((file) => (
            <div
              className="flex items-center gap-2 rounded-md bg-muted/45 px-3 py-2"
              key={fileKey(file)}
            >
              <FileText className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                {file.name}
              </span>
              <span className="num text-[10px] text-muted-foreground">
                {formatSize(file.size)} MB
              </span>
              <Button
                aria-label={`Fjern ${file.name}`}
                disabled={busy}
                onClick={() => onFiles(files.filter((item) => item !== file))}
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
    </div>
  );
}

function MemberContextPicker({
  busy,
  context,
  onContext,
  onError,
}: {
  busy: boolean;
  context: MemberContextUpload | null;
  onContext: (context: MemberContextUpload | null) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function receive(files: readonly File[]) {
    const file = files[0];
    if (!file) return;
    try {
      onContext(await readMemberContext(file));
      onError(null);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Member context kunne ikke læses.");
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void receive(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void receive(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-muted p-2">
          <FileJson2 className="size-5 text-accent" aria-hidden="true" />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-[14px] font-semibold" htmlFor="member-context">
              Member context
            </Label>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Alternativ
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Upload den kontrakt-afledte JSON-fil, når kontrakten allerede er blevet behandlet.
          </p>
        </div>
      </div>

      <div
        className={`mt-4 rounded-md border border-dashed px-4 py-5 text-center transition-colors ${
          dragging ? "border-accent bg-mismatch-soft/40" : "border-border bg-muted/20"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <UploadCloud className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-[12px] text-muted-foreground">Træk en JSON-fil hertil</p>
        <Button
          className="mt-3"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          Vælg member context
        </Button>
        <input
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          id="member-context"
          onChange={handleInput}
          ref={inputRef}
          type="file"
        />
      </div>

      {context ? (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/45 px-3 py-2">
          <FileJson2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
            {context.file.name}
          </span>
          <span className="num text-[10px] text-muted-foreground">
            {String(context.payload["member_ref"])}
          </span>
          <Button
            aria-label={`Fjern ${context.file.name}`}
            disabled={busy}
            onClick={() => onContext(null)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type UploadSubmission = {
  label: string;
  agreementFamily: AgreementFamily | null;
  birthDate: string | null;
  payslips: File[];
  contract: File | null;
  memberContext: MemberContextUpload | null;
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
  const [label, setLabel] = useState("");
  const [agreementFamily, setAgreementFamily] = useState<AgreementFamily | "auto">("auto");
  const [birthDate, setBirthDate] = useState("");
  const [payslips, setPayslips] = useState<File[]>([]);
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const [memberContext, setMemberContext] = useState<MemberContextUpload | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function validateDocuments(nextPayslips: readonly File[], nextContract: readonly File[]) {
    const allFiles = [...nextPayslips, ...nextContract];
    if (allFiles.length > MAX_FILES) return "Du kan højst uploade 30 PDF-filer ad gangen.";
    return allFiles.map(validatePdf).find((result) => result !== null) ?? null;
  }

  function updatePayslips(next: File[]) {
    const nextError = validateDocuments(next, contractFiles);
    setValidationError(nextError);
    if (nextError === null) setPayslips(next);
  }

  function updateContract(next: File[]) {
    const nextError = validateDocuments(payslips, next);
    setValidationError(nextError);
    if (nextError === null) setContractFiles(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) {
      setValidationError("Giv sagen et navn eller medlemsnummer.");
      return;
    }
    if (payslips.length === 0) {
      setValidationError("Tilføj mindst én lønseddel som PDF.");
      return;
    }
    if (birthDate !== "" && !COMPLETE_ISO_DATE.test(birthDate)) {
      setValidationError("Fødselsdato skal være en fuld dato.");
      return;
    }
    if (contractFiles.length > 0 && memberContext) {
      setValidationError("Vælg enten kontrakt-PDF eller member context — ikke begge dele.");
      return;
    }
    const nextError = validateDocuments(payslips, contractFiles);
    if (nextError !== null) {
      setValidationError(nextError);
      return;
    }
    setValidationError(null);
    await onSubmit({
      label: label.trim(),
      agreementFamily: agreementFamily === "auto" ? null : agreementFamily,
      birthDate: birthDate || null,
      payslips,
      contract: contractFiles[0] ?? null,
      memberContext,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-baseline gap-3 px-6 py-4">
          <span className="text-sm font-bold tracking-tight text-accent">PAYTJEK</span>
          <span className="text-sm font-semibold text-foreground">Ny lønseddelkontrol</span>
          {isDemoApi() ? (
            <span className="ml-auto rounded-full border border-forbehold/40 bg-forbehold-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-forbehold">
              Testmiljø
            </span>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-6 py-10 lg:grid-cols-[minmax(0,760px)_1fr]">
        <section className="paper rounded-xl p-6 sm:p-8">
          <p className="label-caps">Ny sag</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Kontrollér dine lønsedler
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Opret sagen, vælg lønsedlerne og tilføj eventuelt ansættelseskontrakten. PayTjek viser
            bagefter præcis, hvordan hvert dokument blev genkendt.
          </p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-3">
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="birth-date">Fødselsdato</Label>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Valgfri
                  </span>
                </div>
                <Input
                  autoComplete="bday"
                  disabled={busy}
                  id="birth-date"
                  onChange={(event) => setBirthDate(event.target.value)}
                  type="date"
                  value={birthDate}
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Registreres direkte på sagen som en fuld dato.
                </p>
              </div>
            </div>

            <DocumentPicker
              acceptMultiple
              busy={busy}
              description="Upload én eller flere lønsedler. Der dannes en rapport for hver genkendt lønperiode."
              files={payslips}
              icon={FileText}
              id="payslips"
              label="Lønsedler"
              onFiles={updatePayslips}
            />

            <div>
              <p className="label-caps">Ansættelsesgrundlag</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Vælg kontrakt-PDF eller en allerede dannet member-context-fil.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DocumentPicker
                acceptMultiple={false}
                busy={busy}
                description="Bruges til ansættelsesvilkår og datagrundlag. PayTjek skal bekræfte dokumenttypen."
                files={contractFiles}
                icon={BriefcaseBusiness}
                id="contract"
                label="Ansættelseskontrakt"
                onFiles={updateContract}
                optional
              />
              <MemberContextPicker
                busy={busy}
                context={memberContext}
                onContext={setMemberContext}
                onError={setValidationError}
              />
            </div>

            <p className="text-[11px] text-muted-foreground">
              PDF · højst 30 dokumenter samlet · 15 MB pr. dokument · member context højst 1 MB
            </p>

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
              Du kan følge datagrundlaget
            </h2>
            <ol className="mt-4 space-y-4 text-[13px] text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> Dokumenterne uploades til din sag
              </li>
              <li>
                <strong className="text-foreground">2.</strong> PayTjek viser den genkendte
                dokumenttype
              </li>
              <li>
                <strong className="text-foreground">3.</strong> Rapporten mærkes med kilde og
                version
              </li>
            </ol>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Der indlæses ingen eksempelrapport. Resultatet åbner først, når middleware har dannet en
            rapport til denne sag.
          </p>
        </aside>
      </main>
    </div>
  );
}
