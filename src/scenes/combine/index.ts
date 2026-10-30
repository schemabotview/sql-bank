import type { SceneModel } from '@graphlearning/graphl-flow'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 5 — combine tables. Read-only except §8, which creates the view core.account_balance that
// later courses use. Every count and row on a side pane is read from the replay.

const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: 'store' | 'consume' | 'ingest' = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })
const one = (s: string, cmd: string) => result(s, cmd).rows[0][0]

// §1 — joins, grain, inner join.
const S1 = session('combine/01-inner')
const inner = sql('combine/01-inner', {
  lit: 'JOIN ref.branches', says: ['Manchester'],
  side: [
    {
      type: 'group', id: 'match', title: 'Each account finds its branch', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
        { type: 'table', id: 'a', title: 'core.accounts', columns: ['account_no', 'branch_code'], rows: [{ id: 'r1', cells: ['SY40000013', 'MAN'] }, { id: 'r2', cells: ['SY40000011', 'LDS'] }, { id: 'r3', cells: ['SY40000012', 'BRS'] }] },
        { type: 'table', id: 'b', title: 'ref.branches', columns: ['code', 'city'], rows: [{ id: 'man', cells: ['MAN', 'Manchester'] }, { id: 'lds', cells: ['LDS', 'Leeds'] }, { id: 'brs', cells: ['BRS', 'Bristol'] }] },
      ],
    },
    table('r', 'Manchester accounts, as returned', result(S1, '01-join.sql')),
    {
      type: 'table', id: 'grain', title: 'The grain survived the join', tone: 'ingest', columns: ['rows', 'count'], rows: [
        ['accounts', '16 (query, §1)'], ['accounts JOIN branches', one(S1, 'JOIN ref.branches b')],
      ],
    },
  ],
  edges: [{ from: 'a.r1', to: 'b.man' }, { from: 'a.r2', to: 'b.lds' }, { from: 'a.r3', to: 'b.brs' }],
})

// §2 — outer joins and predicate placement.
const S2 = session('combine/02-outer')
const none = result(S2, '02-no-account.sql')
const outer = sql('combine/02-outer', {
  lit: ['LEFT JOIN core', 'IS NULL'],
  side: [
    table('r', `${none.rows.length} customers with no account`, none, 'consume'),
    {
      type: 'table', id: 'place', title: 'The same filter, in two places', tone: 'consume', columns: ['account_id > 1015 in', 'rows', 'so'], rows: [
        { id: 'on', cells: ['ON', one(S2, 'AND h.account_id > 1015'), 'every customer kept'], tone: 'store' },
        { id: 'wh', cells: ['WHERE', one(S2, 'WHERE h.account_id > 1015'), 'NULL > 1015 is unknown: an inner join again'], tone: 'consume' },
      ],
    },
    { type: 'note', id: 'n', text: 'Amelia Hughes holds nothing: the account opened for her in build never got a holder row. An outer join is how data problems like this are found.' },
  ],
})

// §3 — self-joins.
const S3 = session('combine/03-self')
const tr = result(S3, '03-transfers.sql')
const self = sql('combine/03-self', {
  lit: ['JOIN core.postings AS out', 'JOIN core.postings AS inn'],
  side: [
    {
      type: 'group', id: 'legs', title: 'One table, two roles', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
        { type: 'table', id: 'out', title: 'postings AS out', columns: ['txn', 'amount'], rows: [{ id: 'o', cells: [tr.rows[0][0], `-${tr.rows[0][4]}`] }] },
        { type: 'table', id: 'inn', title: 'postings AS inn', columns: ['txn', 'amount'], rows: [{ id: 'i', cells: [tr.rows[0][0], tr.rows[0][4]] }] },
      ],
    },
    table('r', `${tr.rows.length} transfers, from → to`, { columns: ['txn', 'reference', 'from', 'to', 'amount'], rows: tr.rows }),
    { type: 'note', id: 'n', text: 'Read the first three: 1011 → 1012 → 1019 → 1011. The money went round in a circle — the analyse stage follows it.' },
  ],
  edges: [{ from: 'out.o', to: 'inn.i', label: 'same txn' }],
})

// §4 — duplicate amplification.
const S4 = session('combine/04-amplify')
const viaA = one(S4, 'via_accounts'), viaC = one(S4, 'via_customers')
const amplify = sql('combine/04-amplify', {
  lit: ['JOIN core.account_holders', 'JOIN core.postings'], says: [viaA, viaC],
  side: [
    table('r', 'Per customer: both include the joint account', result(S4, '04-per-customer.sql'), 'consume'),
    {
      type: 'table', id: 'totals', title: 'Total money held, two ways', tone: 'consume', columns: ['summed through', 'total'], rows: [
        { id: 'a', cells: ['accounts', viaA], tone: 'store' },
        { id: 'c', cells: ['customers', viaC], tone: 'consume' },
        ['difference', (Number(viaC) - Number(viaA)).toFixed(2) + ': account 1013, counted twice'],
      ],
    },
    {
      type: 'group', id: 'fan', title: 'Why: one account, two holders', icon: 'users', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'acc', title: 'SY40000013', sub: 'its postings', icon: 'card' },
        {
          type: 'group', id: 'who', bare: true, children: [
            { type: 'item', id: 'ch', title: 'Chloe Price', icon: 'user' },
            { type: 'item', id: 'ma', title: 'Marcus Reid', icon: 'user' },
          ],
        },
      ],
    },
  ],
  edges: [{ from: 'acc', to: 'ch' }, { from: 'acc', to: 'ma' }],
})

// §5 — subqueries.
const S5 = session('combine/05-subqueries')
const subqueries = sql('combine/05-subqueries', {
  lit: ['CROSS JOIN LATERAL', ') AS last'],
  side: [
    {
      type: 'table', id: 'kinds', title: 'Three places a query can go', tone: 'ingest', columns: ['kind', 'returns', 'sits in'], rows: [
        ['scalar', 'one value', 'WHERE'],
        ['derived table', 'a table', 'FROM … AS b'],
        { id: 'lat', cells: ['LATERAL', 'a table per row', 'FROM, using a.*'], tone: 'store' },
      ],
    },
    table('top', 'Balances above the average credit (top 3)', result(S5, 'SELECT account_id, balance')),
    table('r', 'The two latest postings, per account', result(S5, '05-latest.sql')),
  ],
})

// §6 — EXISTS, and the NOT IN NULL trap.
const S6 = session('combine/06-exists')
const counts = result(S6, 'count(reverses)').rows[0]
const exists = sql('combine/06-exists', {
  lit: ['WHERE NOT EXISTS', 'r.reverses = t.txn_id'], says: ['NOT IN'],
  side: [
    {
      type: 'table', id: 'cmp', title: 'Transactions never reversed', tone: 'consume', columns: ['asked with', 'answer'], rows: [
        { id: 'in', cells: ['NOT IN (SELECT reverses …)', one(S6, 'NOT IN')], tone: 'consume' },
        { id: 'ex', cells: ['NOT EXISTS (…)', one(S6, '06-never-reversed.sql')], tone: 'store' },
      ],
    },
    {
      type: 'group', id: 'why', title: 'Why NOT IN said zero', icon: 'search', tone: 'consume', children: [
        { type: 'item', id: 'w1', title: `reverses holds ${Number(counts[0]) - Number(counts[1])} NULLs`, sub: `${counts[1]} of ${counts[0]} transactions are reversals` },
        { type: 'item', id: 'w2', title: 'x NOT IN (5028, NULL, …)', sub: 'means x <> 5028 AND x <> NULL AND …' },
        { type: 'item', id: 'w3', title: 'x <> NULL is unknown', sub: 'so the whole test is never true: no rows', tone: 'consume' },
      ],
    },
    { type: 'note', id: 'n6', text: 'NOT EXISTS only asks whether a matching row is there. A NULL never matches, so it cannot empty the answer.' },
  ],
  edges: [{ from: 'w1', to: 'w2' }, { from: 'w2', to: 'w3' }],
})

// §7 — UNION, INTERSECT, EXCEPT.
const S7 = session('combine/07-sets')
const sets = sql('combine/07-sets', {
  lit: 'EXCEPT',
  side: [
    {
      type: 'group', id: 'venn', title: 'Savings EXCEPT current', icon: 'layers', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'sv', title: 'hold savings', sub: '103 Chloe, 107 Sofia', icon: 'users' },
        { type: 'item', id: 'res', title: `left: ${one(S7, '07-savers.sql')}`, sub: 'Sofia — Chloe also holds a current account', icon: 'user', tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'u', title: 'Holders, stacked on themselves', tone: 'ingest', columns: ['operator', 'rows', 'duplicates'], rows: [
        ['UNION', one(S7, 'UNION SELECT'), 'removed'], ['UNION ALL', one(S7, 'UNION ALL'), 'kept'],
      ],
    },
    { type: 'table', id: 'ops', title: 'The three operators', tone: 'store', columns: ['operator', 'keeps'], rows: [['A UNION B', 'rows in either'], ['A INTERSECT B', 'rows in both'], ['A EXCEPT B', 'rows in A, not in B']] },
    { type: 'note', id: 'n7', text: 'Both sides must return the same number of columns, of compatible types. UNION ALL also skips the work of finding duplicates.' },
  ],
  edges: [{ from: 'sv', to: 'res', label: 'minus current' }],
})

// §8 — views.
const S8 = session('combine/08-view')
const view = sql('combine/08-view', {
  lit: ['CREATE VIEW', 'GROUP BY'], says: ['ERROR:'],
  side: [
    {
      type: 'group', id: 'what', title: 'A view is a named query', icon: 'layers', tone: 'store', dir: 'row', children: [
        { type: 'item', id: 'q', title: 'SELECT … FROM core.account_balance', sub: 'what Finance writes' },
        { type: 'item', id: 'v', title: 'the stored query', sub: 'accounts LEFT JOIN postings, summed', icon: 'database' },
      ],
    },
    table('r', 'The three largest current balances', result(S8, 'FROM core.account_balance')),
    {
      type: 'table', id: 'upd', title: 'Can it be updated?', tone: 'consume', columns: ['tried', 'answer'], rows: [
        ['SET balance = 0', grab(S8, /^DETAIL:\s+(Views containing GROUP BY)/m) + ': not updatable'],
      ],
    },
    { type: 'note', id: 'n8', text: 'The view stores the QUERY. Every read runs it again, so a balance is still derived — and can never drift.' },
  ],
  edges: [{ from: 'q', to: 'v', label: 'expands to' }],
})

export const combineScenes: Record<string, SceneModel> = {
  'combine-inner': inner,
  'combine-outer': outer,
  'combine-self': self,
  'combine-amplify': amplify,
  'combine-subqueries': subqueries,
  'combine-exists': exists,
  'combine-sets': sets,
  'combine-view': view,
}
