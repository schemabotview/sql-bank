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
    model: 'Read the plan from the bottom up',
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
        ['correct first', 'statement.sql'],
        ['production-shaped', `${grab(S1, /^SELECT (\d+)$/m)} postings`],
        ['fresh statistics', 'VACUUM ANALYZE'],
        ['change ONE thing', 'then measure'],
      ],
    },
  ],
  edges: [{ from: 'p1', to: 'p2' }, { from: 'p2', to: 'p3' }],
})

// §2 — EXPLAIN ANALYZE and statistics.
const S2 = session('perform/02-analyze')
const removed = grab(S2, /Rows Removed by Filter: (\d+)/)
const stats = result(S2, 'reltuples')
const analyze = sql('perform/02-analyze', {
    model: 'EXPLAIN ANALYZE counts the work',
  lit: 'EXPLAIN (ANALYZE', says: ['Rows Removed by Filter'],
  side: [
    {
      type: 'group', id: 'work', title: 'Work done for 10 rows', icon: 'workflow', tone: 'consume', children: [
        { type: 'item', id: 'w-read', title: `${stats.rows[0][1]} pages read`, sub: 'the whole table', icon: 'disk' },
        { type: 'item', id: 'w-rm', title: `${removed} rows thrown away`, sub: 'Rows Removed by Filter', icon: 'filter', tone: 'consume' },
        { type: 'item', id: 'w-kept', title: `${grab(S2, /Seq Scan on postings \(actual rows=(\d+)/)} rows returned`, sub: 'the statement page', icon: 'check', tone: 'store' },
      ],
    },
    table('st', 'What the planner believed (pg_class)', stats, 'ingest'),
  ],
  edges: [{ from: 'w-read', to: 'w-rm' }, { from: 'w-rm', to: 'w-kept' }],
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
    model: 'An index seeks on its leading columns',
  lit: 'CREATE INDEX by_account_day', says: ["Index Cond: ((account_id = 42) AND", 'Filter: (EXTRACT'],
  side: [
    {
      type: 'group', id: 'cmp', title: 'Two ways to say "April"', icon: 'filter', tone: 'consume', children: [
        { type: 'item', id: 'idx', title: 'INDEX (account_id, booked_on)', sub: 'sorted by the column, not by a function of it', icon: 'layers' },
        { type: 'item', id: 'c-r', title: "booked_on >= '2026-04-01' …", sub: 'both columns: Index Cond', icon: 'check', tone: 'store' },
        { type: 'item', id: 'c-f', title: 'extract(month FROM booked_on) = 4', sub: 'account only: the month is a Filter', icon: 'bell', tone: 'consume' },
      ],
    },
    {
      type: 'table', id: 'order', title: 'Column order in (account_id, booked_on)', tone: 'ingest', columns: ['query', 'uses the index?'], rows: [
        ['account AND day', 'fully'], ['account alone', 'yes: leading'], ['day alone', 'poorly'],
      ],
    },
  ],
  edges: [{ from: 'idx', to: 'c-r' }, { from: 'c-r', to: 'c-f', label: 'but' }],
})

// §5 — partial and covering indexes; the write cost.
const S5 = session('perform/05-covering')
const sizes = result(S5, 'pg_stat_user_indexes')
const covering = sql('perform/05-covering', {
    model: 'A covering index answers alone',
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
      type: 'table', id: 'cost', title: 'The write cost', tone: 'ingest', columns: ['each INSERT writes', 'rows'], rows: [
        ['the table row', '1'], ['every index entry', String(sizes.rows.length)], { id: 'p', cells: ['a partial index', 'matching only'], tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'io', to: 'sz', label: 'at a cost' }, { from: 'i1', to: 'i2' }],
})

// §6 — materialized views.
const S6 = session('perform/06-matview')
const r6 = (n: number) => { const r = S6.split('\n'); const idx = r.reduce<number[]>((a, l, i) => (l.startsWith('syndica=> SELECT postings') ? [...a, i] : a), []); return result(r.slice(idx[n]).join('\n'), 'SELECT postings').rows[0] }
const stale = r6(0), fresh = r6(1)
const matview = sql('perform/06-matview', {
    model: 'A materialized view stores the result',
  lit: ['CREATE MATERIALIZED VIEW', 'CREATE UNIQUE INDEX'], says: ['REFRESH MATERIALIZED'],
  side: [
    {
      type: 'group', id: 'fresh', title: '10 April, before and after REFRESH', icon: 'clock', tone: 'consume', children: [
        { type: 'item', id: 'f-stale', title: `after the INSERT: ${stale[0]} postings, ${stale[1]}`, sub: 'the stored result, unchanged', icon: 'layers', tone: 'consume' },
        { type: 'item', id: 'f-fresh', title: `after REFRESH: ${fresh[0]} postings, ${fresh[1]}`, sub: 'the query, run again', icon: 'check', tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'kinds', title: 'View or materialized view?', tone: 'ingest', columns: ['', 'view', 'materialized'], rows: [
        ['stores', 'the query', 'the RESULT'], ['reading', 'runs it', 'a table: fast'], ['fresh?', 'always', 'last REFRESH'],
      ],
    },
  ],
  edges: [{ from: 'f-stale', to: 'f-fresh', label: 'REFRESH' }],
})

export const performScenes: Record<string, SceneModel> = {
  'perform-baseline': baseline,
  'perform-analyze': analyze,
  'perform-btree': btree,
  'perform-composite': composite,
  'perform-covering': covering,
  'perform-matview': matview,
}
