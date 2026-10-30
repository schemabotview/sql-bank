# sql-bank

**Building Syndica Bank's database: SQL from beginner to professional** — a GraphL concept app.

Syndica Bank's DB team builds the bank's core database on PostgreSQL 18, from an empty server to a
secured, measured system: 10 courses, 69 sections, one ~1 h 46 min video. Every result, error and
plan on screen is replayed on a real server.

- [`COURSE-PLAN.md`](./COURSE-PLAN.md) — the source of truth: courses, sections, side panes, the spine.
- [`CLAUDE.md`](./CLAUDE.md) — authoring rules and invariants.

Scenes render with `@graphlearning/graphl-flow`; the app shell is `@graphlearning/shell`.

```sh
npm install
npm run dev                                   # the app on :5173
sudo bash scripts/setup-postgres.sh           # PostgreSQL 18.6 (conda-forge) + the dbteam login
sudo python3 scripts/spine.py [course] [--write]   # replay the spine on one continuous database
npm run check                                 # content + render at 4K
npm run shots -- <course>                     # PNGs in out/shots/, then look
npm run build
```

**Status:** pilot authored — `start`, `design`, `build` (20 sections), awaiting review.
