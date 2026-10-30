import type { SceneModel } from '@graphlearning/graphl-flow'
import { result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 6 — analytical SQL. Read-only. Finance's harder questions, each one query file; every value
// on a side pane is read from the replay.

type Tone = 'store' | 'consume' | 'ingest'
const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: Tone = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })

// §1 — CTEs.
const S1 = session('analyse/01-cte')
const st = result(S1, '01-statement.sql')
const cte = sql('analyse/01-cte', {
  lit: ['WITH tom AS', 'FROM opening, october'],
  side: [
    {
      type: 'group', id: 'stages', title: 'Three named stages, one answer', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'c1', title: 'tom', sub: "Tom's postings, each with its booked_at" },
        { type: 'item', id: 'c2', title: 'opening', sub: `before 1 October: ${st.rows[0][0]}` },
        { type: 'item', id: 'c3', title: 'october', sub: `in ${st.rows[0][1]}, out ${st.rows[0][2]}` },
        { type: 'item', id: 'c4', title: 'the final SELECT', sub: `closing balance ${st.rows[0][3]}`, tone: 'store' },
      ],
    },
    table('r', "Tom's October statement", st),
    { type: 'note', id: 'n', text: 'Each WITH stage is a named result the next can read. The statement checks itself: opening + in + out equals the balance query found.' },
  ],
  edges: [{ from: 'c1', to: 'c2' }, { from: 'c2', to: 'c3' }, { from: 'c3', to: 'c4' }],
})

// §2 — recursive CTEs and CYCLE.
const S2 = session('analyse/02-recursive')
const ch = result(S2, '02-chain.sql')
const recursive = sql('analyse/02-recursive', {
  lit: ['), chain AS (', ') CYCLE src'], says: [' t'],
  side: [
    {
      type: 'group', id: 'loop', title: 'Following the money from 1011', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'a', title: '1011', sub: 'Olivia', icon: 'user' },
        { type: 'item', id: 'b', title: '1012', sub: 'Hassan', icon: 'user' },
        { type: 'item', id: 'c', title: '1019', sub: 'Aisha', icon: 'user' },
      ],
    },
    table('r', 'Each hop, as the recursion found it', ch),
    {
      type: 'table', id: 'how', title: 'How a recursive CTE runs', tone: 'ingest', columns: ['part', 'does'], rows: [
        ['anchor', 'the first rows: transfers out of 1011'],
        ['recursive part', 'joins the last hop to the next transfer'],
        { id: 'cyc', cells: ['CYCLE src (PG 14+)', 'marks a repeat as looped, and stops there'], tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'a', to: 'b', label: 'hop 1' }, { from: 'b', to: 'c', label: 'hop 2' }],
})

// §3 — windows: the running balance.
const S3 = session('analyse/03-running')
const run = result(S3, '03-running.sql')
const low = run.rows.reduce((m, r) => (Number(r[3]) < Number(m[3]) ? r : m))
const running = sql('analyse/03-running', {
  lit: 'OVER (ORDER BY', says: [low[3]],
  side: [
    table('r', "Tom's statement, every line with its balance", { columns: ['day', 'amount', 'balance'], rows: run.rows.map((r) => [r[0], r[2], r[3]]) }),
    {
      type: 'group', id: 'win', title: 'A window keeps every row', icon: 'layers', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'g', title: 'GROUP BY', sub: 'many rows become one sum' },
        { type: 'item', id: 'w', title: 'sum() OVER (…)', sub: 'each row gets the sum of its window', tone: 'store' },
      ],
    },
    { type: 'note', id: 'n', text: `Lowest point: ${low[3]} on ${low[0]}, inside Tom's £100 overdraft. A statement needs every line AND a running total — a window gives both.` },
  ],
  edges: [{ from: 'g', to: 'w', label: 'versus' }],
})

// §4 — frames: ROWS versus RANGE.
const S4 = session('analyse/04-frames')
const fr = result(S4, '04-frames.sql')
const frames = sql('analyse/04-frames', {
  lit: ['ROWS  UNBOUNDED', 'RANGE UNBOUNDED'], says: [' 2400.00 |'],
  side: [
    table('r', 'The first three transactions, summed two ways', { columns: ['txn', 'amount', 'ROWS', 'RANGE'], rows: fr.rows.map((r) => [r[0], r[2], r[3], r[4]]) }, 'consume'),
    {
      type: 'table', id: 'why', title: 'The frame decides which rows count', tone: 'ingest', columns: ['frame', 'sums up to', 'so'], rows: [
        ['ROWS', 'THIS row', 'half a transaction'],
        { id: 'range', cells: ['RANGE (default)', 'the last PEER', 'whole transactions'], tone: 'store' },
      ],
    },
    { type: 'note', id: 'n', text: 'Two legs of one transaction share booked_at, so they tie in this order. RANGE never splits a tie — and shows the ledger balancing after every transaction.' },
  ],
})

// §5 — ranking, top-N, dedup.
const S5 = session('analyse/05-ranking')
const rk = result(S5, '05-rank.sql')
const dup = result(S5, 'PARTITION BY full_name')
const ranking = sql('analyse/05-ranking', {
  lit: ['rank()', 'row_number()'], says: [dup.rows[0][1]],
  side: [
    table('r', 'Card payments per account, three ways to rank', { columns: ['account', 'payments', 'rank', 'dense', 'row'], rows: rk.rows }),
    {
      type: 'table', id: 'diff', title: 'After a tie', tone: 'ingest', columns: ['function', 'gives the next row'], rows: [
        ['rank()', 'skips: 2, 2, 4'], ['dense_rank()', 'no gap: 2, 2, 3'], { id: 'rn', cells: ['row_number()', 'unique: 2, 3, 4'], tone: 'store' },
      ],
    },
    { type: 'table', id: 'dup', title: 'Duplicates: row_number() > 1 per name', tone: 'consume', columns: dup.columns, rows: dup.rows },
  ],
})

// §6 — LAG and LEAD.
const S6 = session('analyse/06-lag')
const mo = result(S6, '06-lag.sql')
const gaps = result(S6, 'AS gap')
const lag = sql('analyse/06-lag', {
  lit: ['lag(card_spend)', 'card_spend - lag'], says: [mo.rows[1][3]],
  side: [
    table('r', 'Card spending, month on month', { columns: ['month', 'spend', 'previous', 'change'], rows: mo.rows.map((r) => r.map((c) => c || '—')) }),
    table('g', "Days since Tom's previous transaction", { columns: gaps.columns, rows: gaps.rows.map((r) => r.map((c) => c || '—')) }, 'ingest'),
    { type: 'note', id: 'n', text: 'lag() reads the previous row in the window’s order, lead() the next. The first row has no previous: NULL, shown here as —.' },
  ],
})

// §7 — gaps and islands.
const S7 = session('analyse/07-islands')
const isl = result(S7, '07-islands.sql')
const islands = sql('analyse/07-islands', {
  from: 'WITH days AS', lit: ['day - row_number()', 'GROUP BY island'],
  side: [
    table('r', 'Runs of days Tom ended overdrawn', isl, 'consume'),
    {
      type: 'table', id: 'trick', title: 'Why day − row number finds a run', tone: 'ingest', columns: ['overdrawn day', 'row number', 'day − n'], rows: [
        ['2026-10-06', '1', '2026-10-05'], ['2026-10-07', '2', '2026-10-05'], ['2026-10-08', '3', '2026-10-05'],
      ],
    },
    { type: 'note', id: 'n', text: 'Consecutive days rise by one, and so does their row number, so the difference stays put: one value per run. A gap starts a new value — a new island.' },
  ],
})

// §8 — ROLLUP, GROUPING SETS, FILTER.
const S8 = session('analyse/08-rollup')
const ru = result(S8, '08-rollup.sql')
const rollup = sql('analyse/08-rollup', {
  lit: ['FILTER', 'GROUP BY ROLLUP'], says: [ru.rows.at(-1)![2]],
  side: [
    table('r', 'Balances, with subtotals', { columns: ['branch', 'kind', 'balance', 'open', 'level'], rows: ru.rows.map((r) => r.map((c) => c || '(all)')) }),
    {
      type: 'table', id: 'how', title: 'ROLLUP (branch, kind) groups by', tone: 'ingest', columns: ['grouping', 'level'], rows: [
        ['(branch, kind)', '0: each cell'], ['(branch)', '1: a branch subtotal'], { id: 'all', cells: ['()', '3: the grand total'], tone: 'store' },
      ],
    },
    { type: 'note', id: 'n', text: 'A rolled-up column shows NULL; GROUPING() says which NULLs mean "all". FILTER counted open accounts only, so Ben’s closed account is in no count.' },
  ],
})

export const analyseScenes: Record<string, SceneModel> = {
  'analyse-cte': cte,
  'analyse-recursive': recursive,
  'analyse-running': running,
  'analyse-frames': frames,
  'analyse-ranking': ranking,
  'analyse-lag': lag,
  'analyse-islands': islands,
  'analyse-rollup': rollup,
}
