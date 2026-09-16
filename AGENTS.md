<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Autoritativt datagrundlag

PayTjek-middleware er den eneste autoritative kilde til faglige resultater. Frontend må
organisere og formatere API-data, men må ikke opfinde beløb, regnestykker, statusser,
enheder eller konklusioner. Beløbssummer skal leveres af middleware. Manglende data må
ikke erstattes af gættede værdier, og "ikke udført" må aldrig fremstilles som "OK".
