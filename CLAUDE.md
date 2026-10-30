# CLAUDE.md — sql-bank

> Workspace invariants live in the workspace `CLAUDE.md`. This file is only what is true here.

## What this repo is

A GraphL concept app: **SQL from beginner to professional, by building Syndica Bank's database**.
A section is `(scene, narration)`: one full-screen 16:9 frame, one chapter of the video.

**`COURSE-PLAN.md` is the source of truth.** Author from it; change it first, never drift from it.

Engine `@graphlearning/graphl-flow`, shell `@graphlearning/shell`, both published and pinned. Sister
repo: **python-expense-tracker** — port its infra (frames, checks, registry, shots, film); do not
reinvent it. The old `sql` repo (shop, `@graphlearning/flow`) is reference only: its timeline runner
and `db/verify` idea are worth porting, its scenes are not.

## Status

**All 10 courses authored — 69 sections, awaiting owner review.** 63 spine steps (4 of them
two-session timelines) replay on PostgreSQL 18.6 from an empty database in about a minute; scenes
and narration written (~14,900 words, ~100 min); `check` clean at 4K (56 template frames, one fit);
every frame looked at. No audio yet (narration is text).

Engine: graphl-flow **0.8.0**, published (psql prompts in consoles, timeline-safe dedent).

Things learned while authoring, now rules:
- PostgreSQL 18's `EXPLAIN ANALYZE` includes BUFFERS by default; the hit/read split depends on the
  cache, so plans are shown with `BUFFERS OFF, COSTS OFF, TIMING OFF, SUMMARY OFF`.
- A per-database setting is not copied by `CREATE DATABASE … TEMPLATE`; spine.py sets them on both paths.
- Revoking UPDATE on a referenced table breaks inserts into the referencing one: the foreign-key check
  takes `FOR KEY SHARE`, which needs UPDATE (secure §2 teaches it).
- Every referenced row carries an `xmax` lock marker after FK checks; MVCC demos use an unreferenced row.
- `\set VERBOSITY terse` / `\set QUIET on` keep long sessions inside the 20-row console.

Next: owner review; then audio (Colab + Chatterbox), recording, the film.

## Route contract

`#/` catalog; `#/<courseId>-<sectionId>` a section; `?capture=1` and `window.__scene.plan()` come
from the shell. Do not reimplement the shell.

## PostgreSQL 18, every output replayed

**18.6**, from conda-forge via micromamba (`scripts/setup-postgres.sh`, also the cloud setup script):
it pins the exact minor and needs no distro repo. The server listens on the unix socket in `/tmp` only;
binaries are linked into `/usr/local/bin`. Every banner, result, error and plan is
replayed, never typed. PostgreSQL-only behaviour is labelled (PG). Plans: shapes, rows, buffers —
never timings.

## The spine: one continuous database

All steps run in course order against ONE database, `syndica`; its state carries forward.
`scripts/spine.py` (run as root; read its docstring) replays from a fresh database — or from the
checkpoint `syndica_after_<course>` the previous course left — and diffs every transcript; `--write`
re-captures and regenerates `src/spine.gen.ts`.

```
spine/<course>/<NN-step>/
  step.json      {} | {"timeline": true} | {"volatile": true}
  files/<path>   files this step ADDS to syndica-db/ (the editor shows them)
  session.txt    the psql transcript (the console)        — or, for a timeline:
  timeline.txt   moments `A <prompt> sql` / `B <prompt> sql` -> session-a.txt + session-b.txt
```

- **Input is the transcript's prompt rows.** To author, write the rows you want typed (any prompt
  text), run `--write`; the runner fills in real prompts and output. A session that does not start
  with a shell row starts psql silently, so the pane shows only SQL.
- A step keeps its changes on purpose, or rolls back on screen. The runner fails a step that ends
  inside a transaction, a typed line that wraps, and a file added twice.
- Non-bank demos live in `sandbox` and are dropped on screen.
- No clock: explicit timestamps; business date 2026-10-31; nothing depends on `now()`. The runner
  creates `syndica` with timezone Europe/London, datestyle ISO, `lc_messages` C, deadlock_timeout 1s.
- **Scenes read the spine through `src/scenes/spine.ts`** (`session`, `file`, `tree`, `step`) — never
  type a value from a transcript; find lines with `lineOf`; pull tables, outputs and error verdicts
  out of it with `src/scenes/psql.ts` (`result`, `output`, `outcomes`, `grab`).
- The opening book is `scripts/gen-seed.py` → `spine/build/06-opening/files/seed/*.csv`. Its docstring
  lists the deliberately awkward cases later courses depend on; change it only with a full replay.
- Author in course order. An approved course is frozen; editing it means a full replay and a review
  of every later transcript that moved.
- Roles are cluster-wide: a replay drops `syndica_%` roles first; `dbteam` is the base role.
- A blocked statement in a timeline is CONFIRMED waiting on a lock (`pg_stat_activity`) before the
  timeline moves on; its output lands in the moment that released it; panes are padded so a row is
  one moment in both.

## Frames

`src/scenes/ide.ts`: `ideFrame` — explorer | editor (80 cols, 16 rows) over a psql console (80 cols,
20 rows — fold a long session with `sessionShow`, never retype it) | fixed side pane (`spread`, so
its cards fill the column); and
`timelineFrame` — session A | session B (60 cols each) | side pane, three equal columns whose box equals
the IDE template's, so every frame shares one fit. Concept frames (◆) are free-form. Every side pane
carries a diagram, not bullets. No edges between panes. Never write `x`/`y`.
Frames pass spine text through `verbatim` (a leading newline graphl-flow's dedent drops) so a
transcript that starts with blank rows keeps them.

## Checks, before handing over

```sh
npm run build && npx tsc --noEmit && npm run check   # content + render (4K)
sudo npm run check:spine                             # or: python3 scripts/spine.py [course] [--write]
npm run shots -- <course>                            # then LOOK
```

Checks are a floor, not proof.

## Invariants

- Stylesheets in order: graphl-flow, shell, `./theme.css` last.
- No `file:` installs committed.
- Narration: `.tts` → `.wav` via Colab + Chatterbox only; audio at `public/audio/<course>/<id>.wav`.
- Money is `numeric(14,2)`; the ledger is double-entry; balances are derived, never updated.
- Narration never claims the viewer has mastered anything.
- `SiteHeader` on the catalog page only.

## Working agreement

Author a whole course (spine, scenes, narration), render it, look, then hand over the routes. Say
what was built, verified and left out.
