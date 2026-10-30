# Building Syndica Bank's database: SQL from beginner to professional — plan

**Status: v1 plan, approved for size (2026-10-30).** Nothing is authored yet.

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

One pinned minor version. Every banner, result, error and plan is replayed on a real server, never
typed. Portable SQL is taught as SQL; PostgreSQL-only behaviour is labelled **(PG)**. Plans are
quoted as shapes, row counts and buffers, never timings.

## The database

| schema | tables |
| --- | --- |
| `ref` | `branches`, `products`, `merchant_categories` (a tree), `business_date` |
| `core` | `customers`, `accounts`, `account_holders` (N:M), `transactions`, `postings`, `cards` |
| `hr` | `employees` (a manager tree, each at a branch) |
| `audit` | `audit_log` (from `change`) |
| `perf` | generated large `postings` (from `perform`) |
| `sandbox` | throwaway demos, dropped on screen |

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
  step.sql       what the team writes this step (editor; run with \i), when the step has one
  session.txt    the real psql transcript (terminal)
  step.json      options: {"timeline": true}, {"volatile": true}, ...
```

The explorer shows `syndica-db/` gaining one file per step (`build/03-foreign-keys.sql`,
`queries/statement.sql`, …). Files are only added, never edited.

Verification: `spine.mjs` creates a fresh `syndica` and replays every step in course order against
it, diffing each transcript (`--write` re-captures). At the end of each course it saves a checkpoint
(`CREATE DATABASE syndica_after_<course> TEMPLATE syndica`), so `spine.mjs <course>` starts from the
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

- **IDE**: explorer (`syndica-db/`) | editor (80 cols) over `psql` terminal | fixed side pane. Every
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
| 2 | Recursive CTEs | employee tree; transfer chain A→B→C→A stopped by `CYCLE` |
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
| 2 | `DELETE` vs closing an account | soft close vs hard delete; retention |
| 3 | `INSERT … SELECT` | month-end interest postings |
| 4 | Upsert vs `MERGE` | the card settlement file, `\copy` to staging, then matched |
| 5 | Reversals | original + reversal = net zero, history intact |
| 6 | Triggers and the audit log | one statement → its side effects (`ALTER` as a tool) |

**8. `concurrency` · Transactions and concurrency · 7**

| # | Section | Side pane |
| --- | --- | --- |
| 1 | Invariants, ACID, `BEGIN`/`COMMIT`/savepoints | invariant → what protects it; the `=!>` prompt |
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
| 6 | Materialized views and `pg_stat_statements` | freshness vs speed; the top queries |

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

1. Infra: pinned PostgreSQL 18 + setup script; `spine.mjs` (continuous replay, checkpoints, timeline
   steps); frames ported from python-expense-tracker; checks. Engine first: graphl-flow must draw
   psql prompts (`syndica=>`, `=*>`, `=!>`) — today it knows only `$ `.
2. Pilot: `start` + `design` + `build`, and a spike of the timeline frame → owner review.
3. Courses 4–10 in order, each rendered, reviewed and frozen, then narrated.
4. Record all 10, assemble the one video.

## Decisions

1. Bank: Syndica Bank; the DB team builds it. Database `syndica`, project folder `syndica-db/`.
2. One continuous database through the course; no rebuilds, no migrations.
3. 10 courses, 69 sections, one video.
4. PostgreSQL 18, pinned.
