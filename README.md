# PayTjek

Brugerflade til upload og kontrol af danske lønsedler. Frontend opretter en sag i PayTjek
middleware, uploader lønsedler og enten en valgfri ansættelseskontrakt eller en member-context-fil
og viser middleware-rapporten uden at genberegne dens resultater.

## Lokalt miljø

Projektet bruger Bun:

```sh
bun install
bun run dev
```

Den lokale standardopsætning anvender PayTjeks demo-middleware. Brug derfor kun testdokumenter.
Et andet miljø vælges med:

```sh
VITE_PAYTJEK_API_BASE_URL=https://api.example.test bun run dev
```

## Dataflow

1. Frontend opretter en sag.
2. En valgfri member-context-fil valideres og knyttes til sagen.
3. Lønsedler og en eventuel kontrakt sendes som én dokumentbatch.
4. Middleware klassificerer og behandler hvert dokument.
5. Frontend følger den faktiske status og åbner rapporten, når den er klar.
6. Rapportens sag, dokumenter, context, generation og dataversion vises som sporbarhed.

Der ligger ingen eksempelrapport i frontendens datavej. En eksisterende sag kan åbnes med
`/?case_id=<uuid>&period=<YYYY-MM>&slip_key=<nøgle>`.

## Produktionskrav

En produktion skal konfigurere `VITE_PAYTJEK_API_BASE_URL` til produktions-middleware og må ikke
falde tilbage til demo-endpointet. Adgangskontrol, dokumentopbevaring og sikker visning af
originaldokumenter skal være afklaret før lancering.
