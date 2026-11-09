import type { SceneModel } from '@graphlearning/graphl-flow'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 7 — change data safely. Every step here changes `syndica` for good, on purpose: each file is
// an Operations ticket. Values on the side panes are read from the replay.

type Tone = 'store' | 'consume' | 'ingest'
const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: Tone = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })

// §1 — affected rows first, then UPDATE.
const S1 = session('change/01-update')
const before = result(S1, 'kyc_status = \'pending\';')
const after = result(S1, '01-kyc.sql')
const update = sql('change/01-update', {
    model: 'Predict, change, compare, commit',
  lit: ['UPDATE core.customers', 'RETURNING'], says: ['UPDATE 2', '=*> COMMIT'],
  side: [
    {
      type: 'group', id: 'flow', title: 'The safe shape of a change', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'f1', title: 'SELECT with the same WHERE', sub: `predict: ${before.rows.length} rows` },
        { type: 'item', id: 'f2', title: 'BEGIN, then UPDATE … RETURNING', sub: `the server: ${grab(S1, /^(UPDATE \d+)$/m)}` },
        { type: 'item', id: 'f3', title: 'counts agree: COMMIT', sub: 'disagree: ROLLBACK, and nothing happened', tone: 'store' },
      ],
    },
    table('r', 'What changed, as RETURNING printed it', after),
  ],
  edges: [{ from: 'f1', to: 'f2' }, { from: 'f2', to: 'f3' }],
})

// §2 — DELETE versus closing.
const S2 = session('change/02-delete')
const del = sql('change/02-delete', {
    model: 'Delete what nothing points at; close the rest',
  lit: ['DELETE FROM core.customers', 'RETURNING'], says: ['DELETE 1', 'ERROR:'],
  side: [
    {
      type: 'group', id: 'rule', title: 'Delete or close?', icon: 'filter', tone: 'ingest', children: [
        { type: 'item', id: 'p6', title: 'customer 6: nothing points at it', sub: 'DELETE: it is gone', icon: 'user', tone: 'store' },
        { type: 'item', id: 'a18', title: 'account 1018: holders, postings', sub: 'DELETE refused: it stays, closed', icon: 'card', tone: 'consume' },
      ],
    },
    table('closed', 'Ben’s account: closed, not deleted', result(S2, 'WHERE account_id = 1018;')),
  ],
  edges: [{ from: 'a18', to: 'closed' }],
})

// §3 — INSERT … SELECT.
const S3 = session('change/03-insert-select')
const ins = sql('change/03-insert-select', {
    model: 'INSERT … SELECT: look the ids up',
  lit: ['SELECT a.account_id, c.customer_id', "c.email = 'amelia"], says: ['INSERT 0 1'],
  side: [
    {
      type: 'group', id: 'look', title: 'What Ops knows → what the table needs', icon: 'search', tone: 'ingest', dir: 'row', children: [
        { type: 'table', id: 'k', title: 'the ticket', columns: ['field'], rows: [{ id: 'no', cells: ['SY40000001'] }, { id: 'em', cells: ['amelia.hughes@…'] }] },
        { type: 'table', id: 'ids', title: 'account_holders', columns: ['column'], rows: [{ id: 'a', cells: [`account_id ${result(S3, '03-holder.sql').rows[0][0]}`] }, { id: 'c', cells: [`customer_id ${result(S3, '03-holder.sql').rows[0][1]}`] }] },
      ],
    },
    table('left', 'Customers with no account, now', result(S3, '02-no-account.sql')),
    {
      type: 'table', id: 'two', title: 'Two ways to insert', tone: 'ingest', columns: ['form', 'inserts'], rows: [
        ['INSERT … VALUES (…)', 'the rows typed out'], { id: 'sel', cells: ['INSERT … SELECT …', 'what the query returns'], tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'look', to: 'left', label: 'then' }, { from: 'k.no', to: 'ids.a' }, { from: 'k.em', to: 'ids.c' }],
})

// §4 — upsert versus MERGE.
const S4 = session('change/04-merge')
const mg = result(S4, '04-branches.sql')
const merge = sql('change/04-merge', {
    model: 'MERGE applies a whole feed',
  lit: ['MERGE INTO', 'RETURNING merge_action()'], says: ['MERGE 2', 'INSERT 0 3'],
  side: [
    table('r', 'MERGE says what it did, row by row (PG 17+)', mg),
    {
      type: 'table', id: 'cmp', title: 'Same feed, two statements', tone: 'consume', columns: ['statement', 'reported', 'really'], rows: [
        { id: 'm', cells: ['MERGE', grab(S4, /^(MERGE \d+)$/m), '1 update, 1 insert'], tone: 'store' },
        { id: 'u', cells: ['ON CONFLICT', grab(S4, /^(INSERT 0 3)$/m), '3 rows rewritten'], tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 'r', to: 'cmp', label: 'versus ON CONFLICT' }],
})

// §5 — reversals.
const S5 = session('change/05-reversal')
const legs = result(S5, '05-refund.sql')
const pair = result(S5, 'IN (txn_id, reverses)')
const reversal = sql('change/05-reversal', {
    model: 'A mistake is reversed, never edited',
  lit: ['WITH r AS (', '-p.amount'], says: [grab(S5, /^ +(\d+\.\d+)\n\(1 row\)\s*$/m)],
  side: [
    {
      type: 'group', id: 'pair', title: 'Fee and refund: both stay in the ledger', icon: 'log', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'fee', title: `${pair.rows[0][0]}: ${pair.rows[0][1]}`, sub: 'Tom −15.00, fee income +15.00', tone: 'consume' },
        { type: 'item', id: 'rev', title: `${pair.rows[1][0]}: ${pair.rows[1][1]}`, sub: `reverses ${pair.rows[1][2]}: every leg flipped`, tone: 'store' },
      ],
    },
    table('legs', 'The refund’s postings, from RETURNING', legs),
    {
      type: 'table', id: 'bal', title: "Tom's balance", tone: 'store', columns: ['before', 'after'], rows: [['289.50 (analyse)', grab(S5, /^ +(\d+\.\d+)\n\(1 row\)\s*$/m)]],
    },
  ],
  edges: [{ from: 'pair', to: 'legs' }, { from: 'fee', to: 'rev', label: 'undone by' }],
})

// §6 — triggers and the audit log.
const S6 = session('change/06-audit')
const log = result(S6, 'FROM audit.customer_changes')
const audit = sql('change/06-audit', {
    model: 'A trigger writes the audit row',
  from: 'CREATE FUNCTION', lit: ['INSERT INTO audit', 'FOR EACH ROW'], says: ['UPDATE 1', log.rows[0][1]],
  side: [
    {
      type: 'group', id: 'chain', title: 'One statement, two writes', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 't1', title: 'UPDATE core.customers', sub: 'Chloe’s new email, typed once' },
        { type: 'item', id: 't2', title: 'trigger customers_audit', sub: 'fires AFTER UPDATE, FOR EACH ROW', icon: 'zap' },
        { type: 'item', id: 't3', title: 'INSERT INTO audit.customer_changes', sub: 'old row, new row, who', tone: 'store' },
      ],
    },
    table('r', 'The audit trail, as recorded', { columns: ['customer', 'was', 'now'], rows: log.rows.map((r) => r.slice(0, 3)) }),
  ],
  edges: [{ from: 't1', to: 't2' }, { from: 't2', to: 't3' }],
})

export const changeScenes: Record<string, SceneModel> = {
  'change-update': update,
  'change-delete': del,
  'change-insert-select': ins,
  'change-merge': merge,
  'change-reversal': reversal,
  'change-audit': audit,
}
