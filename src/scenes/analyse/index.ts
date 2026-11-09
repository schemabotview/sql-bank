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
    model: 'WITH: a query in named stages',
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
  ],
  edges: [{ from: 'c1', to: 'c2' }, { from: 'c2', to: 'c3' }, { from: 'c3', to: 'c4' }],
})

// §2 — recursive CTEs and CYCLE.
const S2 = session('analyse/02-recursive')
const ch = result(S2, '02-chain.sql')
const recursive = sql('analyse/02-recursive', {
    model: 'A recursive CTE follows hop after hop',
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
  ],
  edges: [{ from: 'a', to: 'b', label: 'hop 1' }, { from: 'b', to: 'c', label: 'hop 2' }],
})

// §3 — windows: the running balance.
const S3 = session('analyse/03-running')
const run = result(S3, '03-running.sql')
const low = run.rows.reduce((m, r) => (Number(r[3]) < Number(m[3]) ? r : m))
const running = sql('analyse/03-running', {
    model: 'A window keeps every row',
  lit: 'OVER (ORDER BY', says: [low[3]],
  side: [
    table('r', "Tom's statement, every line with its balance", { columns: ['day', 'amount', 'balance'], rows: run.rows.map((r) => [r[0], r[2], r[3]]) }),
    {
      type: 'group', id: 'win', title: 'A window keeps every row', icon: 'layers', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'g', title: 'GROUP BY', sub: 'many rows become one sum' },
        { type: 'item', id: 'w', title: 'sum() OVER (…)', sub: 'each row gets the sum of its window', tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'g', to: 'w', label: 'versus' }],
})

// §4 — frames: ROWS versus RANGE.
const S4 = session('analyse/04-frames')
const fr = result(S4, '04-frames.sql')
const frames = sql('analyse/04-frames', {
    model: 'The frame decides which rows count',
  lit: ['ROWS  UNBOUNDED', 'RANGE UNBOUNDED'], says: [' 2400.00 |'],
  side: [
    table('r', 'The first three transactions, summed two ways', { columns: ['txn', 'amount', 'ROWS', 'RANGE'], rows: fr.rows.map((r) => [r[0], r[2], r[3], r[4]]) }, 'consume'),
    {
      type: 'group', id: 'why', title: 'Two legs of one transaction tie', icon: 'layers', tone: 'ingest', children: [
        { type: 'item', id: 'w-rows', title: 'ROWS: up to THIS row', sub: 'half a transaction', icon: 'filter', tone: 'consume' },
        { type: 'item', id: 'w-range', title: 'RANGE (default): up to the last peer', sub: 'whole transactions: the ledger balances', icon: 'check', tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'w-rows', to: 'w-range', label: 'or' }],
})

// §5 — ranking, top-N, dedup.
const S5 = session('analyse/05-ranking')
const rk = result(S5, '05-rank.sql')
const dup = result(S5, 'PARTITION BY full_name')
const ranking = sql('analyse/05-ranking', {
    model: 'rank, dense_rank, row_number: ties differ',
  lit: ['rank()', 'row_number()'], says: [dup.rows[0][1]],
  side: [
    table('r', 'Card payments per account: the top 6', { columns: ['account', 'payments', 'rank', 'dense', 'row'], rows: rk.rows.slice(0, 6) }),
    { type: 'table', id: 'dup', title: 'Duplicates: row_number() > 1 per name', tone: 'consume', columns: dup.columns, rows: dup.rows },
  ],
  edges: [{ from: 'r', to: 'dup', label: 'row_number() > 1' }],
})

// §6 — LAG and LEAD.
const S6 = session('analyse/06-lag')
const mo = result(S6, '06-lag.sql')
const lag = sql('analyse/06-lag', {
    model: 'lag() reads the previous row',
  lit: ['lag(card_spend)', 'card_spend - lag'], says: [mo.rows[1][3]],
  side: [
    { type: 'item', id: 'fn', title: 'lag(card_spend) OVER (ORDER BY month)', sub: 'the previous row in the window’s order; the first has none: —', icon: 'clock', tone: 'ingest' },
    table('r', 'Card spending, month on month', { columns: ['month', 'spend', 'previous', 'change'], rows: mo.rows.map((r) => r.map((c) => c || '—')) }),
  ],
  edges: [{ from: 'fn', to: 'r' }],
})

// §7 — gaps and islands.
const S7 = session('analyse/07-islands')
const isl = result(S7, '07-islands.sql')
const islands = sql('analyse/07-islands', {
    model: 'Day minus row number marks a run',
  from: 'WITH days AS', lit: ['day - row_number()', 'GROUP BY island'],
  side: [
    {
      type: 'table', id: 'trick', title: 'Why day − row number finds a run', tone: 'ingest', columns: ['overdrawn day', 'row number', 'day − n'], rows: [
        ['2026-10-06', '1', '2026-10-05'], ['2026-10-07', '2', '2026-10-05'], ['2026-10-08', '3', '2026-10-05'],
      ],
    },
    table('r', 'Runs of days Tom ended overdrawn', isl, 'consume'),
  ],
  edges: [{ from: 'trick', to: 'r', label: 'GROUP BY day − n' }],
})

// §8 — ROLLUP, GROUPING SETS, FILTER.
const S8 = session('analyse/08-rollup')
const ru = result(S8, '08-rollup.sql')
const rollup = sql('analyse/08-rollup', {
    model: 'ROLLUP adds the subtotals',
  lit: ['FILTER', 'GROUP BY ROLLUP'], says: [ru.rows.at(-1)![2]],
  side: [
    {
      type: 'table', id: 'how', title: 'ROLLUP (branch, kind) groups by', tone: 'ingest', columns: ['grouping', 'level'], rows: [
        ['(branch, kind)', '0: each cell'], ['(branch)', '1: a branch subtotal'], { id: 'all', cells: ['()', '3: the grand total'], tone: 'store' },
      ],
    },
    table('r', 'Balances, with subtotals', { columns: ['branch', 'kind', 'balance', 'open', 'level'], rows: ru.rows.map((r) => r.map((c) => c || '(all)')) }),
  ],
  edges: [{ from: 'how', to: 'r' }],
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
