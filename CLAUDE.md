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

Plan approved (10 courses, 69 sections). Nothing authored. Next: infra, then the pilot
(`start`, `design`, `build` + a timeline-frame spike).

## Route contract

`#/` catalog; `#/<courseId>-<sectionId>` a section; `?capture=1` and `window.__scene.plan()` come
from the shell. Do not reimplement the shell.

## PostgreSQL 18, every output replayed

One pinned minor version, installed by a setup script. Every banner, result, error and plan is
replayed, never typed. PostgreSQL-only behaviour is labelled (PG). Plans: shapes, rows, buffers —
never timings.

## The spine: one continuous database

`spine/<course>/<NN-step>/` = `step.sql` (optional, the editor) + `session.txt` (the psql
transcript) + `step.json`. All steps run in course order against ONE database, `syndica`; its state
carries forward. `spine.mjs` replays from a fresh database (or from the previous course's checkpoint
`syndica_after_<course>`) and diffs every transcript; `--write` re-captures.

- A step keeps its changes on purpose, or rolls back on screen. Never leave accidental state.
- Non-bank demos live in `sandbox` and are dropped on screen.
- No clock: explicit timestamps; business date 2026-10-31; nothing depends on `now()`.
- **Scenes read values from `session.txt`, never type them** — ids and counts move when an earlier
  step changes.
- Author in course order. An approved course is frozen; editing it means a full replay and a review
  of every later transcript that moved.
- `syndica-db/` files are only added, never edited.
- Roles are cluster-wide: a fresh replay drops `syndica_*` roles too.

## Frames

IDE (explorer | editor 80 cols over psql terminal | fixed side pane), concept (◆), timeline
(session A | session B | side pane). Every IDE side pane carries a diagram, not bullets. No edges
between panes. Never write `x`/`y`.

## Checks, before handing over

```sh
npm run build && npx tsc --noEmit && npm run check   # content + render (4K)
npm run check:spine
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
