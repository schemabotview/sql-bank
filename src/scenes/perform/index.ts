import type { SceneModel } from '@graphlearning/graphl-flow'
import { lineOf } from '../ide'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 9 — performance with evidence. perf.postings is 30,000 generated rows — exactly ANALYZE's
// sample, so its statistics, and so its plans, repeat on every replay. Plans are shown with COSTS,
// BUFFERS and TIMING off: shapes and row counts, never timings or cache state.

type Tone = 'store' | 'consume' | 'ingest'
const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: Tone = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })

// §1 — baseline and EXPLAIN.
const S1 = session('perform/01-baseline')
const baseline = sql('perform/01-baseline', {
  file: 'perform/01-perf-data.sql', lit: ['CREATE TABLE perf.postings', 'FROM generate_series'], says: ['Seq Scan', 'Sort'],
  side: [
    {
      type: 'group', id: 'plan', title: 'The plan, read from the bottom up', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'p1', title: 'Seq Scan on postings', sub: 'read EVERY row; keep account 42 from April' },
        { type: 'item', id: 'p2', title: 'Sort by booked_on', sub: 'then put the survivors in date order', tone: 'consume' },
        { type: 'item', id: 'p3', title: 'the statement page', sub: '10 lines for one customer' },
      ],
    },
    {
      type: 'table', id: 'rules', title: 'Before tuning anything', tone: 'store', columns: ['rule', 'here'], rows: [
        ['the query is correct first', 'perform/statement.sql'],
        ['data shaped like production', `${grab(S1, /^SELECT (\d+)$/m)} postings, 300 accounts`],
        ['fresh statistics', 'VACUUM ANALYZE'],
        ['measure, then change ONE thing', 'every section below'],
      ],
    },
    { type: 'note', id: 'n', text: 'Ten lines on the page; thirty thousand rows read to find them. Every step of this stage is measured against this plan.' },
  ],
  edges: [{ from: 'p1', to: 'p2' }, { from: 'p2', to: 'p3' }],
})

// §2 — EXPLAIN ANALYZE and statistics.
const S2 = session('perform/02-analyze')
const removed = grab(S2, /Rows Removed by Filter: (\d+)/)
const stats = result(S2, 'reltuples')
const analyze = sql('perform/02-analyze', {
  lit: 'EXPLAIN (ANALYZE', says: ['Rows Removed by Filter'],
  side: [
    {
      type: 'table', id: 'work', title: 'Work done for 10 rows', tone: 'consume', columns: ['measure', 'value'], rows: [
        ['rows returned', grab(S2, /Seq Scan on postings \(actual rows=(\d+)/)],
        { id: 'rm', cells: ['rows read and thrown away', removed], tone: 'consume' },
        ['pages read: the whole table', stats.rows[0][1]],
      ],
    },
    table('st', 'What the planner believed (pg_class)', stats, 'ingest'),
    { type: 'note', id: 'n', text: 'EXPLAIN shows the plan; EXPLAIN ANALYZE also RUNS it and counts. Estimates come from statistics — stale ones are the commonest reason for a bad plan.' },
  ],
})

// §3 — ◆ how a B-tree index finds rows.
const S3 = session('perform/03-btree')
const btree: SceneModel = {
  title: 'How a B-tree index finds rows',
  sub: 'A sorted tree of keys: a few page reads from the root to the rows — at any table size',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'tree', title: 'by_account (account_id)', icon: 'layers', tone: 'ingest', children: [
        { type: 'item', id: 'root', title: 'root page', sub: 'the first key of each leaf page below it', icon: 'boxes' },
        { type: 'item', id: 'leaf', title: 'leaf page holding account 42', sub: 'keys in order: its 100 entries side by side, each a row address (ctid)', tone: 'store' },
        { type: 'item', id: 'heap', title: 'table pages', sub: 'fetch those 100 rows; filter April: 10 left', icon: 'disk' },
        { type: 'note', id: 'depth', text: 'This index is 216 kB — about 27 pages: one root over the leaves. A billion-row table adds a few BRANCH levels between them, so a search stays a handful of page reads.' },
      ],
    },
    {
      type: 'group', id: 'lab', title: 'The same query, with the index', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S3, highlight: [lineOf(S3, 'Bitmap Index Scan'), lineOf(S3, 'Rows Removed')] },
        {
          type: 'table', id: 'cmp', title: 'Rows thrown away', tone: 'store', columns: ['plan', 'rows removed'], rows: [
            ['Seq Scan (§2)', removed], { id: 'ix', cells: ['index on account_id', grab(S3, /Rows Removed by Filter: (\d+)/)], tone: 'store' },
          ],
        },
      ],
    },
  ],
  edges: [{ from: 'root', to: 'leaf' }, { from: 'leaf', to: 'heap' }],
}

// §4 — composite indexes and index-friendly predicates.
const composite = sql('perform/04-composite', {
  lit: 'CREATE INDEX by_account_day', says: ["Index Cond: ((account_id = 42) AND", 'Filter: (EXTRACT'],
  side: [
    {
      type: 'table', id: 'cmp', title: 'Two ways to say "April"', tone: 'consume', columns: ['predicate', 'the index uses'], rows: [
        { id: 'r', cells: ["booked_on >= '2026-04-01'", 'both columns: Index Cond'], tone: 'store' },
        { id: 'f', cells: ['extract(month FROM booked_on) = 4', 'account only; month is a Filter'], tone: 'consume' },
      ],
    },
    {
      type: 'table', id: 'order', title: 'Column order in (account_id, booked_on)', tone: 'ingest', columns: ['query', 'uses the index?'], rows: [
        ['account = 42 AND day >= …', 'fully: equality, then range'], ['account = 42', 'yes: the leading column'], ['day >= … alone', 'poorly: not the leading column'],
      ],
    },
    { type: 'note', id: 'n', text: 'An index is sorted by the column, not by a function of it. Wrap the column in a function and the index can no longer seek on it: compare the column to a range instead.' },
  ],
})

// §5 — partial and covering indexes; the write cost.
const S5 = session('perform/05-covering')
const sizes = result(S5, 'pg_stat_user_indexes')
const covering = sql('perform/05-covering', {
  lit: ['CREATE INDEX by_account_day', 'INCLUDE (amount)'], says: ['Index Only Scan', 'Heap Fetches: 0'],
  side: [
    {
      type: 'group', id: 'io', title: 'Answered from the index alone', icon: 'layers', tone: 'store', children: [
        { type: 'item', id: 'i1', title: 'Index Only Scan', sub: 'account, day and amount are all in the index' },
        { type: 'item', id: 'i2', title: `Heap Fetches: ${grab(S5, /Heap Fetches: (\d+)/)}`, sub: 'after VACUUM marked the pages all-visible', tone: 'store' },
      ],
    },
    table('sz', 'Every index is a second copy to keep', sizes, 'consume'),
    {
      type: 'table', id: 'cost', title: 'The write cost', tone: 'ingest', columns: ['each INSERT into postings', 'writes'], rows: [
        ['the table row', '1'], ['every index entry', String(sizes.rows.length)], { id: 'p', cells: ['a partial index (WHERE …)', 'only matching rows: smaller'], tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'i1', to: 'i2' }],
})

// §6 — materialized views.
const S6 = session('perform/06-matview')
const r6 = (n: number) => { const r = S6.split('\n'); const idx = r.reduce<number[]>((a, l, i) => (l.startsWith('syndica=> SELECT postings') ? [...a, i] : a), []); return result(r.slice(idx[n]).join('\n'), 'SELECT postings').rows[0] }
const stale = r6(0), fresh = r6(1)
const matview = sql('perform/06-matview', {
  lit: ['CREATE MATERIALIZED VIEW', 'CREATE UNIQUE INDEX'], says: ['REFRESH MATERIALIZED'],
  side: [
    {
      type: 'table', id: 'fresh', title: '10 April, before and after REFRESH', tone: 'consume', columns: ['moment', 'postings', 'net'], rows: [
        { id: 's', cells: ['after the INSERT', stale[0], stale[1]], tone: 'consume' }, { id: 'f', cells: ['after REFRESH', fresh[0], fresh[1]], tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'kinds', title: 'View or materialized view?', tone: 'ingest', columns: ['', 'view', 'materialized view'], rows: [
        ['stores', 'the query', 'the RESULT'], ['reading', 'runs the query', 'reads a table: fast'], ['fresh?', 'always', 'as of the last REFRESH'],
      ],
    },
    { type: 'note', id: 'n', text: 'In production, pg_stat_statements ranks every query by total time — it is how the team would have found this page. (Described, not run: its timings change on every replay.)' },
  ],
})

export const performScenes: Record<string, SceneModel> = {
  'perform-baseline': baseline,
  'perform-analyze': analyze,
  'perform-btree': btree,
  'perform-composite': composite,
  'perform-covering': covering,
  'perform-matview': matview,
}
