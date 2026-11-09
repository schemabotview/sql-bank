import type { SceneModel } from '@graphlearning/graphl-flow'
import { lineOf } from '../ide'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 4 — ask one table questions. Read-only: nothing here changes `syndica`. Finance's questions,
// each a file in queries/query/, run with \i; every value in a side pane is read from the replay.

const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: 'store' | 'consume' | 'ingest' = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })

// §1 — SELECT, DISTINCT, result grain.
const S1 = session('query/01-grain')
const grain = sql('query/01-grain', {
    model: 'Say what one row means',
  lit: ['SELECT DISTINCT', 'ORDER BY'], says: [grab(S1, /^( +\d+)$/m)],
  side: [
    {
      type: 'group', id: 'g', title: 'Same table, two grains', icon: 'layers', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'g1', title: `${grab(S1, /^ +(\d+)$/m)} rows`, sub: 'SELECT … FROM core.accounts: one row per account', icon: 'table' },
        { type: 'item', id: 'g2', title: `${result(S1, '01-grain.sql').rows.length} rows`, sub: 'SELECT DISTINCT branch, kind: one row per combination', icon: 'filter', tone: 'store' },
      ],
    },
    table('r', 'Branch × kind, as returned', result(S1, '01-grain.sql')),
  ],
  edges: [{ from: 'g1', to: 'g2', label: 'DISTINCT' }],
})

// §2 — WHERE, IN, BETWEEN, LIKE.
const S2 = session('query/03-in-between-like')
const between = result(S2, 'BETWEEN')
const half = result(S2, '03-ranges.sql')
const missed = half.rows.filter((r) => !between.rows.some((b) => b[0] === r[0]))
const ranges = sql('query/03-in-between-like', {
    model: 'BETWEEN\'s end is midnight',
  lit: "booked_at >= '2026-10-02'", says: ['BETWEEN', ...missed.map((r) => `${r[0]} |`)],
  side: [
    {
      type: 'table', id: 'cmp', title: 'Two ways to ask for 2–3 October', tone: 'consume', columns: ['condition', 'rows'], rows: [
        { id: 'b', cells: ["BETWEEN '2026-10-02' AND '2026-10-03'", String(between.rows.length)], tone: 'consume' },
        { id: 'h', cells: [">= '2026-10-02' AND < '2026-10-04'", String(half.rows.length)], tone: 'store' },
      ],
    },
    {
      type: 'group', id: 'why', title: 'Why BETWEEN missed one', icon: 'clock', tone: 'consume', children: [
        { type: 'item', id: 'w1', title: "'2026-10-03' means midnight", sub: 'a timestamptz literal with no time is 00:00 on the 3rd' },
        { type: 'item', id: 'w2', title: `txn ${missed[0][0]}: ${missed[0][2]}`, sub: `booked ${missed[0][3]} — after midnight, so outside`, tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 'w1', to: 'w2' }],
})

// §3 — NULL and three-valued logic.
const S3 = session('query/04-null')
const nulls = result(S3, '04-null.sql')
const nullLogic = sql('query/04-null', {
    model: 'NULL compares to nothing',
  lit: 'phone IS NULL', says: ['phone = NULL'],
  side: [
    table('r', `${nulls.rows.length} customers with no phone`, nulls),
    {
      type: 'group', id: 'cmp', title: 'Comparing with NULL is unknown, never true', icon: 'filter', tone: 'consume', children: [
        { type: 'item', id: 'eq', title: 'WHERE phone = NULL', sub: 'always unknown', icon: 'code' },
        { type: 'item', id: 'eqr', title: `${grab(S3, /^ +(\d+)\n\(1 row\)/m)} rows`, sub: 'a row is kept only if true', icon: 'bell', tone: 'consume' },
        { type: 'item', id: 'is', title: 'WHERE phone IS NULL', sub: 'true or false', icon: 'code' },
        { type: 'item', id: 'isr', title: `${nulls.rows.length} rows`, sub: 'the customers with no phone', icon: 'check', tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'eq', to: 'eqr' }, { from: 'is', to: 'isr' }],
})

// §4 — expressions, casts, functions.
const S4 = session('query/05-expressions')
const e4 = result(S4, '7 / 2')
const expressions = sql('query/05-expressions', {
    model: 'An expression per column; the types decide',
  lit: ["'******'", 'date_trunc'], says: [e4.rows[0][0] + ' |'],
  side: [
    {
      type: 'group', id: 'types', title: 'Arithmetic follows the types', icon: 'cpu', tone: 'consume', children: [
        { type: 'item', id: 'i1', title: '7 / 2', sub: 'integer ÷ integer', icon: 'code' },
        { type: 'item', id: 'i1r', title: e4.rows[0][0], sub: 'the fraction dropped', icon: 'bell', tone: 'consume' },
        { type: 'item', id: 'i2', title: '7 / 2.0', sub: 'one numeric side', icon: 'code' },
        { type: 'item', id: 'i2r', title: e4.rows[0][1].replace(/0+$/, '0'), sub: 'exact', icon: 'check', tone: 'store' },
      ],
    },
    table('r', 'Overdrafts, computed per row', { columns: ['account', 'masked', 'monthly cost'], rows: result(S4, '05-expressions.sql').rows.map((r) => [r[0], r[1], r[3]]) }),
  ],
  edges: [{ from: 'i1', to: 'i1r' }, { from: 'i2', to: 'i2r' }],
})

// §5 — CASE.
const S5 = session('query/06-case')
const c5 = result(S5, '06-case.sql')
const wrong = result(S5, 'CASE WHEN overdraft_limit < 250')
const caseScene = sql('query/06-case', {
    model: 'CASE: the first true branch wins',
  lit: ['  CASE', 'END AS tier'], says: [wrong.rows[0].join(' | ')],
  side: [
    table('r', 'Tiers, branches in the right order', c5),
    {
      type: 'group', id: 'order', title: 'Same branches, swapped', icon: 'workflow', tone: 'consume', children: [
        { type: 'item', id: 'o1', title: 'WHEN overdraft_limit < 250 → small', sub: 'tested first: 0 is less than 250, so it matches' },
        { type: 'item', id: 'o2', title: 'WHEN overdraft_limit = 0 → none', sub: 'never reached for 0' },
        { type: 'item', id: 'o3', title: `${wrong.rows[0][0]}: ${wrong.rows[0][1]}`, sub: 'no error — the first true branch won', tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 'o1', to: 'o2' }, { from: 'o2', to: 'o3' }],
})

// §6 — deterministic ordering and paging.
const S6 = session('query/07-paging')
const p1 = result(S6, 'LIMIT 3;')
const p2 = result(S6, '07-page.sql')
const paging = sql('query/07-paging', {
    model: 'Page by a unique key, not by OFFSET',
  lit: ['posting_id > 9041', 'LIMIT 3'],
  side: [
    {
      type: 'group', id: 'pages', title: "Tom's statement, 3 lines a page", icon: 'file', tone: 'ingest', dir: 'row', children: [
        table('p1', 'page 1', { columns: ['posting_id', 'amount'], rows: p1.rows.map((r) => [r[0], r[2]]) }, 'ingest'),
        table('p2', `page 2: after ${p1.rows.at(-1)![0]}`, { columns: ['posting_id', 'amount'], rows: p2.rows.map((r) => [r[0], r[2]]) }),
      ],
    },
    {
      type: 'table', id: 'how', title: 'Two ways to ask for page 2', tone: 'neutral', columns: ['', 'OFFSET 3', 'keyset'], rows: [
        ['asks for', 'skip 3 rows', 'posting_id > 9041'],
        ['work', 'reads page 1 again', 'starts at page 2'],
        ['a new row', 'shifts every page', 'moves nothing seen'],
      ],
    },
  ],
  edges: [{ from: 'p1', to: 'p2', label: 'continue' }],
})

// §7 — aggregates, GROUP BY, HAVING.
const S7 = session('query/08-aggregates')
const bal = result(S7, '08-balances.sql')
const aggregates = sql('query/08-aggregates', {
    model: 'GROUP BY: one row per group',
  lit: ['count(*)', 'GROUP BY'], says: ['1016 |'],
  side: [
    {
      type: 'group', id: 'flow', title: 'From postings to balances', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'f-rows', title: 'core.postings', sub: 'one row per posting', icon: 'table' },
        { type: 'item', id: 'f-group', title: 'GROUP BY account_id', sub: 'one group per account with postings', icon: 'layers' },
        { type: 'item', id: 'f-sum', title: 'sum(amount)', sub: 'one row per group: no postings, no row', icon: 'check', tone: 'store' },
      ],
    },
    table('r', `Balances of ${bal.rows.length} customer accounts: the first 5`, { columns: bal.columns, rows: bal.rows.slice(0, 5) }),
  ],
  edges: [{ from: 'f-rows', to: 'f-group' }, { from: 'f-group', to: 'f-sum' }],
})

// §8 — ◆ logical processing order.
const S8 = session('query/09-order')
const having = result(S8, 'HAVING')
const order: SceneModel = {
  title: 'The order a query is evaluated in',
  sub: 'Written SELECT first; evaluated FROM first — which is why WHERE cannot see a sum',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'steps', title: 'Logical order', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'f', title: '1  FROM core.postings', sub: 'every row of the table' },
        { type: 'item', id: 'w', title: '2  WHERE', sub: 'keeps or drops each ROW — no groups exist yet' },
        { type: 'item', id: 'g', title: '3  GROUP BY account_id', sub: 'rows become groups' },
        { type: 'item', id: 'h', title: '4  HAVING sum(amount) < 0', sub: 'keeps or drops each GROUP', tone: 'store' },
        { type: 'item', id: 's', title: '5  SELECT', sub: 'computes the output columns, names aliases' },
        { type: 'item', id: 'o', title: '6  ORDER BY, then LIMIT', sub: 'sorts the result, then cuts it' },
      ],
    },
    {
      type: 'group', id: 'lab', title: 'WHERE versus HAVING, for real', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S8, highlight: [lineOf(S8, 'ERROR:'), lineOf(S8, having.rows[0][1])] },
        {
          type: 'table', id: 'cmp', title: 'Which accounts are "negative"?', tone: 'consume', columns: ['query', 'answers'], rows: [
            ['HAVING sum(amount) < 0', `${having.rows.map((r) => r[0]).join(', ')}: their BALANCE is below zero`],
            { id: 'bug', cells: ['WHERE amount < 0, then sum', 'sums only the debits: every account looks negative'], tone: 'consume' },
          ],
        },
        { type: 'note', id: 'n', text: `${having.rows[0][0]} is external clearing: money that came in from outside the bank, ${having.rows[0][1]}. The physical plan may differ; the RESULT always follows this order.` },
      ],
    },
  ],
  edges: [{ from: 'f', to: 'w' }, { from: 'w', to: 'g' }, { from: 'g', to: 'h' }, { from: 'h', to: 's' }, { from: 's', to: 'o' }],
}

export const queryScenes: Record<string, SceneModel> = {
  'query-grain': grain,
  'query-where': ranges,
  'query-null': nullLogic,
  'query-expressions': expressions,
  'query-case': caseScene,
  'query-paging': paging,
  'query-aggregates': aggregates,
  'query-order': order,
}
