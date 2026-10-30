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

Plan approved (10 courses, 69 sections). **Scaffold in place, nothing authored.** Built and verified:
the app skeleton (empty registries), `spine.py` (continuous replay, checkpoints, timelines), the IDE
and timeline frames, and the checks — validated end to end on throwaway steps, then removed.

PostgreSQL **18.6** runs here from conda-forge (`scripts/setup-postgres.sh`; the throwaway steps
replayed cleanly on it). One blocker left: **graphl-flow 0.8.0 is not on npm yet** (psql prompts,
timeline-safe dedent). `package.json` pins `^0.7.0` so the repo installs; psql rows render as plain
output until it is bumped to `^0.8.0`.

Next: the pilot (`start`, `design`, `build` + the first timeline).

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
  type a value from a transcript; find lines with `lineOf`.
- Author in course order. An approved course is frozen; editing it means a full replay and a review
  of every later transcript that moved.
- Roles are cluster-wide: a replay drops `syndica_%` roles first; `dbteam` is the base role.
- A blocked statement in a timeline is CONFIRMED waiting on a lock (`pg_stat_activity`) before the
  timeline moves on; its output lands in the moment that released it; panes are padded so a row is
  one moment in both.

## Frames

`src/scenes/ide.ts`: `ideFrame` — explorer | editor (80 cols, 23 rows) over a psql console (80 cols,
13 rows — fold a long session with `sessionShow`, never retype it) | fixed side pane; and
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
