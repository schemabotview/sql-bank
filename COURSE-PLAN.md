# Building Syndica Bank's database: SQL from beginner to professional — plan

**Status: all 10 courses authored (2026-10-30)** — 69 sections, awaiting owner review. Where authoring departed from v1, the table rows below say what was built.

## The idea

Syndica Bank's **DB team** builds the bank's core database, `syndica`, on PostgreSQL, from an empty
server to a secured, measured system. Every SQL concept is taught when the team first needs it. Each
course opens with a request from someone at the bank (Product, Finance, Operations, an incident
report, SRE, Audit), so no topic is taught for its own sake.

Why a bank: money must be exact, balances must never drift, two people really do act on one account
at once, and access really is regulated — types, constraints, transactions, isolation and security
all carry real stakes.

## Packaging

**One video, about 1 h 46 min: 10 courses, 69 sections** of ~92 s. A course is one YouTube chapter
group and the owner's review unit; a section is one chapter. Each section can also go out as a Short.

## Engine: PostgreSQL 18, pinned

Pinned to 18.6 (conda-forge). Every banner, result, error and plan is replayed on a real server, never
typed. Portable SQL is taught as SQL; PostgreSQL-only behaviour is labelled **(PG)**. Plans are
quoted as shapes, row counts and buffers, never timings.

## The database

| schema | tables |
| --- | --- |
| `ref` | `branches` (from `start`); `merchant_categories` (a tree) when a course first needs it |
| `core` | `customers`, `accounts`, `account_holders` (N:M), `transactions`, `postings` (from `build`); `cards` when needed |
| `hr` | `employees` (a manager tree, each at a branch) — when `analyse` first needs a hierarchy |
| `audit` | `audit_log` (from `change`) |
| `perf` | generated large `postings` (from `perform`) |
| `sandbox` | throwaway demos, dropped on screen |

Schema v1 (the end of `build`) is the six tables above marked `build`/`start`. An account's product is its
`kind` column (`current`, `savings`, `internal`), not a separate products table. Every table added later
arrives in the course that first needs it, by a new file — never by editing an earlier one.

**The ledger is double-entry**: a transaction posts signed `numeric(14,2)` amounts that sum to zero;
a balance is derived from postings, never stored or updated; mistakes are corrected by reversal.

**The seed is synthetic, owned and deliberately awkward**: a joint account; a customer with no
accounts and an account with no postings; `phone` and `closed_on` NULLs; a duplicate customer;
posting dates in islands and an account overdrawn three days running; a reversed transaction; a
transfer chain A→B→C→A. The business date is fixed at **2026-10-31**.

## The spine: one database, continuous

The course runs against **one database whose state carries through every step**: what the team did in
one section is still there in the next. No rebuilds, no migrations.

```
spine/<course>/<NN-step>/
  step.json      options: {"timeline": true}, {"volatile": true}
  files/<path>   files this step adds to syndica-db/ (editor), e.g. files/build/03-foreign-keys.sql
  session.txt    the real psql transcript (console); its prompt rows are the input
  timeline.txt   a two-session step instead -> session-a.txt + session-b.txt
```

The explorer shows `syndica-db/` as every file added up to the step (derived, never typed). Files are
only added, never edited.

Verification: `scripts/spine.py` creates a fresh `syndica` and replays every step in course order
against it, diffing each transcript (`--write` re-captures). After each course it saves a checkpoint
(`CREATE DATABASE syndica_after_<course> TEMPLATE syndica`), so `spine.py <course>` starts from the
previous course's checkpoint. A full replay is the gate before recording.

Rules:

1. A step **keeps its changes on purpose or rolls back on screen** (`BEGIN … ROLLBACK`).
2. Anything that is not the bank goes in `sandbox` and is dropped on screen.
3. **No clock**: postings carry explicit timestamps; no output depends on `now()`.
4. **Values are read from the session, never typed** (ids, counts, balances shift when an earlier step
   changes). Scenes take them from `session.txt` by regex.
5. **Author in course order; freeze a course once approved.** An edit to an approved step means a
   full replay; the runner lists every later transcript that moved.
6. Volatile output (`xmin`, `ctid`, pids) is masked, shape still checked.

## Frames

- **IDE**: explorer (`syndica-db/`) | editor (80 cols × 16 rows) over a `psql` console (80 × 20) | fixed side pane. Every
  side pane carries a diagram, never bullets.
- **Concept** (◆ full scene): a canonical picture that needs the whole 16:9 frame, real output inside.
- **Timeline**: session A | session B, two real transcripts aligned row by row, plus the side pane.

## The courses

**1. `start` · Why a database, and first contact · 7**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Why a bank can't run on spreadsheets | two tellers, one balance file: lost update, no audit, no rules |
| 2 | What the DB team will build | **the project map**: design → build → query → change → concurrency → perform → secure |
| 3 | ◆ A server, a database, a client | teller app / ATM / `psql` → PostgreSQL → disk |
| 4 | The first table: `ref.branches` | `CREATE`, `INSERT`, `SELECT`: statement → server → rows |
| 5 | Anatomy of a statement | token table: keywords, identifiers, literals, comments |
| 6 | `psql` itself | `\d`, `\x`; prompts `=>` / `=*>`; meta-command vs SQL |
| 7 | The first errors | error anatomy: `ERROR`, `LINE`, caret, SQLSTATE |

**2. `design` · Design the bank · 6**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | From requirements to entities | entity sketch from Product's brief |
| 2 | Relationships: joint accounts | crow's foot, 1:N vs N:M → `account_holders` |
| 3 | Keys: natural and surrogate | account number vs `account_id` |
| 4 | Normalisation | a wide sheet in `sandbox` → anomalies → 3NF |
| 5 | ◆ Double-entry bookkeeping | a transfer as two postings summing to zero |
| 6 | Data types, and the design review | float vs `numeric` (`0.1+0.2`), `timestamptz`; **the full ER** |

**3. `build` · Build it, and make it refuse bad data · 7**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | `CREATE TABLE`, defaults, identity | column → type → default → generated |
| 2 | Primary, unique and composite keys | a duplicate refused, by which key |
| 3 | Foreign keys | dependency arrows; `ON DELETE RESTRICT` for money |
| 4 | `CHECK`, `NOT NULL`, and what NULL means | `closed_on` NULL = open; three meanings of NULL |
| 5 | Predict: accepted or refused | six records, rule and verdict each |
| 6 | Opening the bank: `INSERT`, `RETURNING`, `\copy` | load order: branches → customers → accounts → postings |
| 7 | Read the catalogue | `information_schema` / `\d+` → the schema it describes |

**4. `query` · Ask one table questions · 8**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | `SELECT`, `DISTINCT`, result grain | what one result row means |
| 2 | `WHERE`, `IN`, `BETWEEN`, `LIKE` | `BETWEEN` on `timestamptz` misses the 31st; half-open ranges |
| 3 | NULL and three-valued logic | truth table; why `= NULL` is empty |
| 4 | Expressions, casts, functions | interest, rounding, integer division, `date_trunc`, masking |
| 5 | `CASE` | fee tiers; the first true branch wins |
| 6 | Deterministic ordering and paging | statement pages: `OFFSET` vs keyset; ties |
| 7 | Aggregates, `GROUP BY`, `HAVING` | balances from postings; `count(*)` vs `count(col)` |
| 8 | ◆ Logical processing order | FROM → … → LIMIT; the WHERE-vs-HAVING bug |

**5. `combine` · Combine tables · 8**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Joins, grain, inner join | join board with counts |
| 2 | Outer joins and predicate placement | `ON` vs `WHERE`: customers with no accounts |
| 3 | Self-joins | employee → manager; a transfer's two legs |
| 4 | Duplicate amplification | a joint account doubles a customer total |
| 5 | Subqueries: scalar, derived, correlated, `LATERAL` | the last 3 postings per account |
| 6 | `EXISTS` and the `NOT IN` NULL trap | the NULL that empties the result |
| 7 | `UNION`, `INTERSECT`, `EXCEPT` | Venn with real counts |
| 8 | Views | `account_balance` → the query it stands for |

**6. `analyse` · Analytical SQL · 8**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | CTEs | a monthly statement in stages |
| 2 | Recursive CTEs | transfer chain A→B→C→A stopped by `CYCLE` (the employee tree was dropped: no `hr` schema was needed) |
| 3 | Windows: the running balance | partitions, the window moving down rows |
| 4 | Frames | `ROWS` vs `RANGE` on same-timestamp postings |
| 5 | Ranking, top-N, dedup | rank vs dense_rank vs row_number |
| 6 | `LAG`, `LEAD`, moving averages | month over month; 30-day spend |
| 7 | Gaps and islands | consecutive days overdrawn |
| 8 | `ROLLUP`, `GROUPING SETS`, `FILTER` | branch × product subtotal grid |

**7. `change` · Change data safely · 6**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Affected rows first, then `UPDATE` | predicted vs actual count; rollback; why money is never updated |
| 2 | `DELETE` vs closing an account | the confirmed duplicate Priya Shah deleted; an account with history refused, stays closed |
| 3 | `INSERT … SELECT` | Amelia's missing holder row, ids looked up by account number and email |
| 4 | Upsert vs `MERGE` | the property team's branch list: `MERGE … RETURNING merge_action()` vs `ON CONFLICT` |
| 5 | Reversals | original + reversal = net zero, history intact |
| 6 | Triggers and the audit log | one statement → its side effects (`ALTER` as a tool) |

**8. `concurrency` · Transactions and concurrency · 7**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Invariants, ACID, `BEGIN`/`COMMIT`/savepoints | ACID; a savepoint; the `=!>` prompt (adds `core.balance()`, `core.withdraw()`) |
| 2 | ◆ MVCC (PG) | row versions, snapshots, why `VACUUM` exists |
| 3 | The incident: a lost update | timeline: two ATMs both read 500 |
| 4 | Isolation levels and write skew | joint-account overdraft; `SERIALIZABLE` refuses (40001) |
| 5 | Locks and blocking | `FOR UPDATE`; lock graph |
| 6 | Deadlocks | opposite transfers → lock in id order |
| 7 | Worked case: a transfer that is always correct | retries + idempotency key + locks, one function |

**9. `perform` · Performance with evidence · 6**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Baseline and `EXPLAIN` | `VACUUM ANALYZE` first; plan tree of the slow statement page |
| 2 | `EXPLAIN ANALYZE` and statistics | estimated vs actual rows |
| 3 | ◆ How a B-tree index finds rows | root → leaf → heap |
| 4 | Composite indexes, index-friendly predicates | `(account_id, posted_at)`; `date(col)` vs range |
| 5 | Partial and covering indexes; the write cost | buffers before/after; inserts with and without |
| 6 | Materialized views | stale until `REFRESH … CONCURRENTLY`; `pg_stat_statements` described, not run (its timings vary per replay) |

**10. `secure` · Secure it, and go live · 6**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Roles, `GRANT`, `REVOKE` | permission matrix from `has_table_privilege()` |
| 2 | Least privilege, an append-only ledger | role graph; the refused `UPDATE` on postings |
| 3 | Masking views and row-level security | a teller sees only their branch (PG) |
| 4 | SQL injection and parameters | value vs identifier vs code; `PREPARE`, `format('%I')` |
| 5 | A day at Syndica Bank | one customer's day through every layer built |
| 6 | Where next | other engines, operations, warehousing: what this did not cover |

## How a section teaches

Objective → mental model (side pane) → the SQL and its real result → a misconception or failure, run
for real → summary → bridge to the next request. Safety arrives with the operation: the first
`UPDATE`, `DELETE` or `\copy` carries its affected-row check and rollback. Narration explains, never
reads SQL aloud, and never claims the viewer has mastered anything. A ◆ detour is ≤ 120 s.

## Deferred

Production migrations, partitioning, JSONB, backups/PITR, replication, monitoring, full-text and
spatial. Candidate follow-up: "Running Syndica in production".

## Build order

1. Infra — **done (2026-10-30)**: setup script, `spine.py` (continuous replay, checkpoints, timeline
   steps), IDE + timeline frames, checks; graphl-flow 0.8.0 draws psql prompts (awaiting publish).
   PostgreSQL 18.6 installed from conda-forge.
2. Pilot: `start` + `design` + `build`, and a spike of the timeline frame → owner review.
3. Courses 4–10 in order, each rendered, reviewed and frozen, then narrated.
4. Record all 10, assemble the one video.

## Decisions

1. Bank: Syndica Bank; the DB team builds it. Database `syndica`, project folder `syndica-db/`.
2. One continuous database through the course; no rebuilds, no migrations.
3. 10 courses, 69 sections, one video.
4. PostgreSQL 18, pinned.
