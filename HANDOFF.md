# PayTjek UI — handoff

Senest opdateret: 6. september 2026.

## Start her

Alt aktuelt arbejde ligger i denne isolerede projektmappe:

```text
/Users/leifandersson/Projects/salary-sight-ui-codex
```

Aktuel Git-status:

- Branch: `codex/middleware-integration`
- Seneste kodecommit: `24345f2 feat: align report workspace with document-first mockup`
- Arbejdstræet var rent før dette handoff-dokument blev tilføjet.
- Branchen har ingen konfigureret upstream. Kontrollér destinationen før et eventuelt push.
- Remote `origin`: `https://github.com/antongandersson/salary-sight-ui.git`

Fortsæt i denne mappe og på denne branch. Brug ikke den tidligere arbejdsmappe
`/Users/leifandersson/Documents/Codex/2026-09-02/har-x20/paytjek-render-codex`; den er ikke den
autoritative Codex-kopi.

## Produktmål og bindende principper

Frontend er arbejdsfladen for en lønkonsulent, som uploader en eller flere lønsedler og valgfrit
en ansættelseskontrakt eller en eksisterende member-context JSON-fil. PayTjek middleware behandler
dokumenterne og returnerer rapporterne, som UI'et gør forståelige og navigerbare.

Følgende må ikke ændres uden udtrykkelig beslutning fra produktejeren:

1. Middleware-API'ets output er den eneste autoritative kilde til resultatet.
2. Frontend må ikke genberegne, rette, supplere eller gætte på rule-engine-resultater.
3. Der må ikke ligge hardcodede eksempelresultater i den rigtige datavej.
4. UI'et må gerne filtrere efter middleware-feltet `visibility`, men må ikke opfinde sin egen
   synlighedspolitik.
5. `Alle kontroller` skal bevare rækkefølgen fra `report.checks`. Visuelle filtre må skjule
   kontroller, men aldrig omsortere dem.
6. `Overblik` er et pædagogisk lag over rapporterne. Det må ikke ændre den autoritative rapport.
7. Sporbarhed skal kunne føres tilbage til den konkrete sag, rapportgeneration, dataversion,
   uploadede dokumenter og filaftryk.
8. Vi har ikke adgang til middleware-backendens kode og skal ikke forsøge at bygge eller rette den.
   Kun API-kontrakten og det returnerede output er i scope.

## Det er implementeret

### Rigtig middleware-integration

Den oprindelige statiske eksempelrapport er fjernet. Frontend bruger nu demo-middleware som
standard og kan peges på et andet miljø med `VITE_PAYTJEK_API_BASE_URL`.

Implementeret flow:

1. Opret sag.
2. Upload eventuel member context til sagen.
3. Upload lønsedler og eventuel kontrakt som dokumentbatch.
4. Følg batchens rigtige status.
5. Hent rapportindeks og sagsdetaljer.
6. Hent alle færdige rapporter og vælg korrekt kombination af `period` og `slip_key`.
7. Vis rapport, dokumenter, context og provenance.

De anvendte endpoints findes samlet i `src/lib/paytjek-api.ts`:

- `POST /api/v1/cases`
- `PUT /api/v1/cases/{case_id}/context`
- `POST /api/v1/cases/{case_id}/batches`
- `GET /api/v1/cases/{case_id}/batches/{batch_id}`
- `GET /api/v1/cases/{case_id}/reports`
- `GET /api/v1/cases/{case_id}`
- `GET /api/v1/cases/{case_id}/reports/{period}?slip_key=...`

### Upload

- Én eller flere lønsedler som PDF.
- Valgfri kontrakt-PDF eller member-context JSON — aldrig begge samtidigt.
- Maksimum 30 PDF-filer i samme indsendelse.
- Maksimum 15 MB pr. PDF.
- Maksimum 1 MB for member context.
- Member context valideres som et JSON-objekt med `schema_version` og en ikke-tom `member_ref`.
- Middleware-dokumentklassifikation vises under behandlingen, inklusive uoverensstemmelse mellem
  valgt uploadfelt og genkendt dokumenttype.

### Rapportens informationsarkitektur

Rapportskærmen har fire faner:

- **Overblik**: kronologisk sag fra ældste til nyeste rapport. En periode vælges i tidslinjen, og
  dens lønseddel vises ved siden af på større skærme.
- **Alle kontroller**: dokument-først layout med lønseddel til venstre og en kompakt,
  interaktiv kontrolliste til højre. Kun den aktive kontrol foldes ud.
- **Lønseddel**: læsevenlig linjevisning plus valgfrie tekniske felter i et fold-ud-panel.
- **Datagrundlag**: kun dokumenter og sporbarhed; lønlinjerne gentages ikke her.

Kontroller og lønlinjer er koblet via `lines[].checks[]`. Klik på en kontrol fremhæver den
tilhørende lønlinje; klik på en lønlinje åbner dens første synlige kontrol.

### `visibility`

Rapporttypen understøtter nu:

```ts
visibility?: "internal" | "user_facing"
```

Politikken ligger i `src/lib/report.ts`:

- Hvis mindst én kontrol i rapporten har `visibility`, vises kun kontroller med
  `visibility: "user_facing"`.
- Hvis ingen kontroller har feltet, behandles rapporten som legacy-output, og alle kontroller
  vises. Det gør gamle rapporter læsbare, men de er ikke bevis for den nye visibility-kontrakt.
- Kontrolnumrene beregnes fortsat ud fra deres oprindelige position i `report.checks`, så filtre
  ikke ændrer den autoritative placering.

Den senest modtagne eksempel-JSON indeholdt 38 kontroller: 34 `internal` og 4 `user_facing`.
Frontend-helperen blev kontrolleret mod filen og returnerede præcis disse fire UI-kontroller:

- `K3-contract-unstated`
- `K4-IND25-elevlon-aar2-L000`
- `K7-E3-capacity`
- `K2-askat-sats`

Eksempelfilen ligger uden for repository her:

```text
/Users/leifandersson/.codex/attachments/00a4bcf1-7273-4289-8c99-8248280b3f7f/pasted-text.txt
```

## Centrale filer

- `src/routes/index.tsx` — hele upload-, polling-, genåbnings- og rapportflowet.
- `src/lib/paytjek-api.ts` — den eneste klient mod middleware.
- `src/lib/report.ts` — typer og præsentationshelpers, herunder visibility-politikken.
- `src/components/upload/UploadCase.tsx` — upload og klientvalidering.
- `src/components/upload/ProcessingCase.tsx` — batchstatus og dokumentklassifikation.
- `src/components/report/ReportOverview.tsx` — kronologisk sagsvisning.
- `src/components/report/ReportChecks.tsx` — autoritativ kontrolliste og visuelle filtre.
- `src/components/report/PayslipFacsimile.tsx` — dokumentlignende visning af udlæste lønlinjer.
- `src/components/report/PayslipView.tsx` — lønseddel og teknisk fold-ud-visning.
- `src/components/report/SourceProof.tsx` — dokumenter, context, rapportgeneration og filaftryk.
- `README.md` — kort lokal start og produktionsforbehold.

## Kendte problemer og åbne beslutninger

### 1. Den rigtige scrubbed lønseddel vises ikke endnu

Den nuværende `PayslipFacsimile` er en HTML-visning bygget udelukkende af middleware-rapportens
`lines`. Det er ikke den oprindelige scrubbed PDF eller et billede af dens side.

Den modtagne `page-metadata.json` beskriver siden, men giver ikke i sig selv de faktiske PDF-bytes
eller et sikkert aktiv, browseren kan vise. For at vise den rigtige scrubbed lønseddel skal et
fremtidigt middleware-output give frontend en autoriseret PDF-/billedressource eller et eksplicit
endpoint til dokumentvisning. Frontend må ikke gætte en intern filplacering.

Referencefil:

```text
/Users/leifandersson/Downloads/Februar 2026 scrubbet lønseddel.pdf/pages/page-1/page-metadata.json
```

### 2. Live-verifikation af `visibility` mangler på en ny sag

En ældre live-rapport havde 52 kontroller uden `visibility`. Den nye JSON-kontrakt er verificeret
lokalt, men bør også verificeres end-to-end ved at oprette en ny sag efter middlewareændringen.
Gamle rapporter får ikke automatisk de nye felter.

### 3. Gemte demo-sager er ikke permanente

Den senest anvendte URL gav `CASE_NOT_FOUND` for sag
`f942a0a2-e711-4c90-aa8a-4f04e7c5e7e5`. UI'et faldt derfor korrekt tilbage til uploadsiden med
fejlbeskeden. Opret en ny sag eller brug et gyldigt case-id ved næste visuelle test.

### 4. UI/UX er bedre, men ikke færdig

Den nuværende retning følger de godkendte ideer om en kronologisk sagsfortælling og layout B for
`Alle kontroller`. Produktopfattelsen ved seneste gennemgang var stadig, at siden var for rodet og
ikke ramte mockupperne præcist nok. Næste ændringer bør reducere visuel støj uden at ændre,
opsummere på ny eller omsortere middleware-data.

### 5. Ingen automatiserede tests endnu

Der findes ikke en testkommando i `package.json`. Der er kun build, lint og manuel browsertest.
Visibility-helperen og rapportens interaktioner bør dækkes med fixtures, før produktionslancering.

### 6. Produktionsforhold er ikke afklaret

- Standard-URL'en er demo-middleware og må ikke være produktionsfallback.
- Adgangskontrol og autentificering er ikke implementeret her.
- Sikker opbevaring og fremvisning af lønsedler/kontrakter er ikke afklaret.
- API-fejl vises relativt råt og kan få en mere pædagogisk præsentation.
- Lovable/GitHub-synkronisering betyder, at publiceret historik ikke må force-pushes, rebaseres
  eller omskrives.

## Problemer vi løb ind i

- Det første forsøg tog udgangspunkt i en forkert render-mappe og endte med hardcodede data og et
  UI, som ikke svarede til det rigtige Lovable-projekt. Arbejdet blev flyttet til en isoleret kopi
  af `antongandersson/salary-sight-ui`, og eksempelrapporten blev fjernet.
- En anden agent arbejdede samtidig i den oprindelige mappe. Derfor blev denne Codex-kopi
  isoleret i `/Users/leifandersson/Projects/salary-sight-ui-codex`.
- Lokal kørsel fra den tidligere Documents/Codex-mappe gav både Bun-fejl om lavt antal åbne filer
  og Node-fejlen `EPERM: process.cwd`. Arbejd fra den isolerede Projects-mappe og fra et nyt
  terminalvindue. Hvis Bun igen melder om 256 file descriptors, kan grænsen i den konkrete shell
  hæves med `ulimit -n 65536` før install/start.
- Flere tidlige forsøg på at gøre overblikket til en actionplan skabte mere støj. Den guidede
  rapportvisning blev derfor eksplicit rullet tilbage i commit `0b1402e`.

## Lokal start

```sh
cd /Users/leifandersson/Projects/salary-sight-ui-codex
git switch codex/middleware-integration
bun install
bun run dev -- --host 127.0.0.1 --port 5183
```

Åbn derefter `http://127.0.0.1:5183/` og opret en ny testsag. Demo-miljøet må kun få
testdokumenter.

En eksisterende gyldig rapport kan åbnes med:

```text
http://127.0.0.1:5183/?case_id=<uuid>&period=<YYYY-MM>&slip_key=<nøgle>
```

## Verifikation ved handoff

Kørt 6. september 2026 på commit `24345f2` før tilføjelsen af dette dokument:

- `bun run build` — bestået.
- `bun run lint` — bestået med 0 fejl og 6 eksisterende `react-refresh`-advarsler i generiske
  shadcn UI-filer.
- Arbejdstræ — rent før `HANDOFF.md` blev tilføjet.

## Anbefalet næste etape

1. Start lokalt og opret en helt ny demo-sag for at verificere det aktuelle middleware-output.
2. Kontrollér i browseren, at en rapport med `visibility` kun viser `user_facing`, mens rækkefølge
   og kontrolnumre stadig matcher `report.checks`.
3. Sammenhold `Overblik` og `Alle kontroller` visuelt med de tidligere godkendte mockupper og
   forenkle hierarkiet uden at ændre datafortællingen.
4. Få afklaret den konkrete API-kontrakt for sikker visning af den scrubbed PDF. Implementér først
   dokumentvisningen, når middleware-outputtet giver et autoritativt aktiv eller endpoint.
5. Tilføj fixtures og automatiserede tests for legacy/visibility, flerperiodiske sager,
   dublerede perioder med forskellige `slip_key` og kontrol↔lønlinje-navigation.
6. Før produktion: konfigurér produktions-API, autentificering, dokumentadgang, fejlpræsentation og
   en eksplicit no-demo-fallback.

## Commitforløb på arbejdsbranchen

```text
3cd5014 feat: connect Lovable UI to PayTjek middleware
9a469ee fix: render checks in authoritative report order
baf1aee feat: add production-ready upload provenance flow
2bce26b feat: support member context json input
d643550 refactor: clarify report information hierarchy
7a8e7f0 feat: add read-only report overview
ea46361 feat: add guided report review
0b1402e Revert "feat: add guided report review"
5280d05 feat: turn report overview into case action plan
fe6741e feat: add authoritative chronological case view
24345f2 feat: align report workspace with document-first mockup
```

