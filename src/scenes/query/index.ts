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
  lit: ['SELECT DISTINCT', 'ORDER BY'], says: [grab(S1, /^( +\d+)$/m)],
  side: [
    {
      type: 'group', id: 'g', title: 'Same table, two grains', icon: 'layers', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'g1', title: `${grab(S1, /^ +(\d+)$/m)} rows`, sub: 'SELECT … FROM core.accounts: one row per account', icon: 'table' },
        { type: 'item', id: 'g2', title: `${result(S1, '01-grain.sql').rows.length} rows`, sub: 'SELECT DISTINCT branch, kind: one row per combination', icon: 'filter', tone: 'store' },
      ],
    },
    table('r', 'Branch × kind, as returned', result(S1, '01-grain.sql')),
    { type: 'note', id: 'n', text: 'Before reading an answer, say what ONE row of it means. Most wrong reports are right numbers at the wrong grain.' },
  ],
  edges: [{ from: 'g1', to: 'g2', label: 'DISTINCT' }],
})

// §2 — WHERE, IN, BETWEEN, LIKE.
const S2 = session('query/03-in-between-like')
const between = result(S2, 'BETWEEN')
const half = result(S2, '03-ranges.sql')
const missed = half.rows.filter((r) => !between.rows.some((b) => b[0] === r[0]))
const ranges = sql('query/03-in-between-like', {
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
    {
      type: 'table', id: 'ops', title: 'The other shorthands', tone: 'ingest', columns: ['condition', 'means'], rows: [
        ["kind IN ('card', 'fee')", "kind = 'card' OR kind = 'fee'"],
        ["reference LIKE 'CAFE%'", 'starts with CAFE; % is any text'],
        ['found', `${grab(S2, /^ +(\d+)\n\(1 row\)\s*$/m)} café transactions`],
      ],
    },
  ],
  edges: [{ from: 'w1', to: 'w2' }],
})

// §3 — NULL and three-valued logic.
const S3 = session('query/04-null')
const nulls = result(S3, '04-null.sql')
const nullLogic = sql('query/04-null', {
  lit: 'phone IS NULL', says: ['phone = NULL'],
  side: [
    table('r', `${nulls.rows.length} customers with no phone`, nulls),
    {
      type: 'table', id: 'tv', title: 'Comparing with NULL is UNKNOWN, never true', tone: 'consume', columns: ['test', 'result', 'row kept?'], rows: [
        ["phone = '+44 7700 900111'", 'true / false / unknown', 'only if true'],
        { id: 'eq', cells: ['phone = NULL', 'always unknown', `never: ${grab(S3, /^ +(\d+)\n\(1 row\)/m)} rows`], tone: 'consume' },
        { id: 'is', cells: ['phone IS NULL', 'true or false', `${nulls.rows.length} rows`], tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'ne', title: '<> drops the NULLs too', tone: 'ingest', columns: ['customers', 'count'], rows: [
        ['all', '14'], ["phone <> Olivia's", result(S3, "phone <> '+44").rows[0][0]], ['missing', `Olivia + ${nulls.rows.length} with no phone`],
      ],
    },
  ],
})

// §4 — expressions, casts, functions.
const S4 = session('query/05-expressions')
const e4 = result(S4, '7 / 2')
const expressions = sql('query/05-expressions', {
  lit: ["'******'", 'date_trunc'], says: [e4.rows[0][0] + ' |'],
  side: [
    {
      type: 'table', id: 'ints', title: 'Arithmetic follows the types', tone: 'consume', columns: ['expression', 'gives', 'because'], rows: [
        { id: 'id', cells: ['7 / 2', e4.rows[0][0], 'integer ÷ integer drops the fraction'], tone: 'consume' },
        ['7 / 2.0', e4.rows[0][1].replace(/0+$/, '0'), 'one numeric side: exact'],
        ['round(2.675, 2)', e4.rows[0][2], 'numeric rounds half away from zero'],
        ["'42'::int + 1", e4.rows[0][3], ':: casts text to a number'],
      ],
    },
    table('r', 'Overdrafts, computed per row', { columns: ['account', 'masked', 'monthly cost'], rows: result(S4, '05-expressions.sql').rows.map((r) => [r[0], r[1], r[3]]) }),
    { type: 'note', id: 'n', text: 'Every column of a SELECT can be an expression. right() masks, date_trunc() rounds a date down to its month, round() fixes money to pence.' },
  ],
})

// §5 — CASE.
const S5 = session('query/06-case')
const c5 = result(S5, '06-case.sql')
const wrong = result(S5, 'CASE WHEN overdraft_limit < 250')
const caseScene = sql('query/06-case', {
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
    { type: 'note', id: 'n', text: 'Without ORDER BY there is no order. Order by something UNIQUE — posting_id — or ties can swap between pages.' },
  ],
  edges: [{ from: 'p1', to: 'p2', label: 'continue' }],
})

// §7 — aggregates, GROUP BY, HAVING.
const S7 = session('query/08-aggregates')
const bal = result(S7, '08-balances.sql')
const cnt = result(S7, 'count(phone)')
const aggregates = sql('query/08-aggregates', {
  lit: ['count(*)', 'GROUP BY'], says: ['1016 |'],
  side: [
    table('r', `Balances of ${bal.rows.length} customer accounts`, bal),
    {
      type: 'table', id: 'counts', title: 'count(*) counts rows; count(col) counts values', tone: 'ingest', columns: ['count(*)', 'count(phone)'], rows: [cnt.rows[0]],
    },
    { type: 'note', id: 'n', text: 'One row per GROUP: postings were grouped by account, then summed. An account with no postings has no group, so it is not in the answer at all.' },
  ],
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
