# PayTjek

Brugerflade til upload og kontrol af danske lønsedler. Frontend opretter en sag i PayTjek
middleware, uploader lønsedler og en valgfri ansættelseskontrakt og viser middleware-rapporten
uden at genberegne dens resultater.

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
2. Lønsedler og valgfri kontrakt sendes som én batch.
3. Middleware klassificerer og behandler hvert dokument.
4. Frontend følger den faktiske status og åbner rapporten, når den er klar.
5. Rapportens sag, dokumenter, generation og dataversion vises som sporbarhed.

Der ligger ingen eksempelrapport i frontendens datavej. En eksisterende sag kan åbnes med
`/?case_id=<uuid>&period=<YYYY-MM>&slip_key=<nøgle>`.

## Produktionskrav

En produktion skal konfigurere `VITE_PAYTJEK_API_BASE_URL` til produktions-middleware og må ikke
falde tilbage til demo-endpointet. Adgangskontrol, dokumentopbevaring og sikker visning af
originaldokumenter skal være afklaret før lancering.
