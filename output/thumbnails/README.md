# Thumbnails

`film.png` — the thumbnail for the single full-course video (`scripts/out/film.mp4`).
Rebuild any variant with:

```sh
npm run thumb:film -- --theme dark --source diagram --out output/thumbnails/film.png
```

`--source` picks what the card shows, `--theme` is `dark` | `teal` | `light`, and `--mark` is
`database` (lucide, the app's own icon set) | `prompt` (psql's `=>`).

## Which card, and why

Chosen by downscaling each candidate to **168px** — the width the mobile feed actually renders —
and to 360px (search and the suggested sidebar), then looking. At 168px **no card text survives in
any variant**; what survives is shape and colour, so that is what the choice is made on.

| variant | card | reads at 168px |
| --- | --- | --- |
| `film.png` (shipped) | `diagram` — the real `build-foreign-keys` side pane | four tables joined by drawn edges: a schema |
| `film-schema.png` | `schema` — two tables and their joined key | a wall of text with some teal in it |
| `film-query.png` | `join` — the query file beside the rows it returned | undifferentiated text |
| `film-types.png` | `types` — the float that is not `0.3` | the biggest single focal object of the four |
| `film-teal.png`, `film-light.png` | the shipped card, other themes | |
| `film-prompt.png` | the shipped card, psql `=>` mark | |

`film-types.png` is the most *legible* at feed size — one enormous number beats any layout — but it
does not say "relational tables and joins", so it is kept as the alternative, not the default.

## Nothing on the card is typed

- `diagram` screenshots the live pane (`[data-id="links"]` on `#/build-foreign-keys`) through the
  same vite + `data-fit="ready"` + paused-SVG path `scripts/shots.mjs` uses. Re-drawing those edges
  here would be a second source of truth that drifts from the scenes; a screenshot cannot.
  Captured at a 4K viewport, where the pane is 1320px wide — more than the ~733px it occupies in the
  delivered cover, so it lands as a downscale.
- `schema` reads its tables from the `design-review` scene through the registry the checks use, and
  highlights whichever two columns the real `ON` clause in `queries/combine/01-join.sql` names.
- `join` and `types` cut their rows out of spine `session.txt` files.

Each source throws rather than renders if the scene or session it depends on stops saying what it
said — so a cover can never promise a database the course does not build.

## The mark: not the PostgreSQL elephant

"PostgreSQL" and Slonik are trademarks of the PostgreSQL Community Association of Canada, and a
monetised channel is a commercial use. The course teaches databases and SQL, not PostgreSQL's
branding, so the cover carries a generic database glyph (lucide, ISC — already a dependency) or
psql's `=>` prompt. Both are ours to use and say the same thing, and **no vendor logo is vendored
into this repo.**
