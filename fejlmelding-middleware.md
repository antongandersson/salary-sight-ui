# Fejlmelding og ønsker til PayTjek-middleware

Fra: PayTjek-frontend (Dansk Metal-arbejdsbordet)
Dato: 14. september 2026
Miljø: demo-middleware (`paytjekdemoserviceseb3e8725-…-api.functions.fnc.pl-waw.scw.cloud`)
Reference-sag: DM-C1, case_id `63758bbf-8f07-46f8-b6a0-ce8c41a682fc`
(case-sheet-generation 22, schema `demobuild-case-sheet-v2` / `demobuild-brev-grundlag-v2`)

---

## 1. Genberegnings-storm: stale-flaget ryddes aldrig (fejl, høj prioritet)

**Observeret 9.–11. september** (på den daværende demo-instans, DM-C1 hed dengang
`0cb6cd5c-9df4-4eef-a06b-2c8322adb949`; miljøet er siden nulstillet):

- Et almindeligt `GET` på case-sheet/rapporter for en sag, der er markeret `stale`,
  enqueue'er en fuld re-render af **alle** sagens rapporter — men renderingen
  markerer aldrig sagen frisk igen.
- Konsekvens: DM-C1 gik fra generation 36 til 67 på 14 minutter alene ved
  almindelige sideåbninger. Gentagne opslag oversvømmer arbejdskøen; en brugers
  upload 9/9 blev ekstremt langsom (jobs stod i `QUEUED` i minutter).
- Reproduceret med `curl` uden om frontenden, så det er ikke klient-adfærd.
- UI-konsekvens: badgen "Forældet generation" står permanent på ramte sager.

**Ønske:** renderingen skal rydde stale-flaget, når den nye generation er skrevet
(eller GET skal ikke enqueue'e, når et re-render allerede er i kø).

## 2. Parser: uafkodede rækker på de nyeste lønsedler (fejl)

- De nyeste lønsedler i flere sager har uafkodede rækker (`PARSE_DROPPED`,
  `amount_unread`) — heriblandt selve **arbejdsgiverpensions-linjen**.
- Det udløser forbeholdet "Manglende bidrag — pension — uafkodede rækker på
  sedlen" fra maj 2026 og frem.
- Bekræftet som backend-/dokumentkvalitetsproblem, ikke en frontendfejl.
- I DM-C1 ses det også som needs_input-posterne "en tydeligere kopi af lønsedlen
  uden uafkodede rækker" (5 sedler) og refusal-familien "Sedlen er ikke læst
  fuldt ud — 1 felt(er) kunne ikke indlæses" (7 sedler).

## 3. `step_timing` mangler en `sum_rule` (ønske, dokumentation)

Case-sheetets øvrige beløbssektioner forklarer selv, hvordan deres tal må
lægges sammen (`possible_claims.sum_rule`, `claims_ledger.sum_rule` osv.).
`step_timing` har ingen — og dens `rollup_kr` **kan netop ikke summeres**:

- Vinduerne overlapper: i DM-C1 dækker "satsændring pr. 01.05.2025
  (uddannelsesår 1)" månederne 2025-05…2025-09, mens "uddannelsesår 2" dækker
  2025-07…2025-09. Juli–september (6.840,01 kr) indgår i **begge** rollups.
- Vinduerne lukker ved satsskiftet: oktober 2025 (663,00 kr, hvor sedlen
  skiftede til 82,95 men stadig lå under trinnets 94,00) ligger uden for alle
  rollup-vinduer, men er med i fundene.
- Afstemning: Σ rollups 17.513,86 = fund-total 11.336,85 + 6.840,01
  (dobbelttalt overlap) − 663,00 (kun i fundene). Tallene er altså korrekte,
  men en læser, der summerer tidslinjen, får et tal, der hverken er kravet
  eller noget andet meningsfuldt.

**Ønske:** giv `step_timing` en `sum_rule`/`note` i stil med: "rollup-beløb pr.
satsændring overlapper og kan ikke summeres; det samlede krav står i fundene".
Frontenden viser gerne teksten, men må ikke selv formulere den faglige
konklusion (produktprincip: alle faglige udsagn skal kunne spores til API-output).

## 4. Brev-grundlagets `step_timing` mangler rollup-felterne (uoverensstemmelse)

- I case-sheetet har hvert `step_timing`-element `rollup_kr`,
  `rollup_months`, `rollup_unpriced_months`, `window_months` m.fl. (25 felter).
- I `GET …/case-sheet/brev` har de samme fire elementer kun 12 felter —
  `rollup_kr`/`rollup_months` mangler helt, så brevets trin-forløb står uden
  beløb.
- Hvis det er bevidst (beløbene hører hjemme i fundene), er en note nok; hvis
  ikke, mangler felterne i brev-rendereren.

## 5. Småting

- `rollup_unpriced_months` er en **liste** af perioder i det nye format —
  bekræft gerne, at det er den blivende kontrakt (frontenden håndterer nu
  begge dele, liste og antal).
- Demo-nulstillingen 14/9 gav nye case_id'er; hvis nulstillinger sker igen, er
  et heads-up rart, da gemte links (`?case_id=…`) dør stumt med 404.

---

*Alle tal ovenfor er fra den vedhæftede/eksporterede DM-C1-kørsel
(`case_sheet.json` generation 22, 14. sep 2026) og kan genfindes dér.*
