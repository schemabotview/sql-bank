import type { SceneModel } from '@graphlearning/graphl-flow'
import { lineOf, timelineFrame } from '../ide'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session, step } from '../spine'

// Course 8 — transactions and concurrency. §3–§6 are TIMELINE frames: two real psql sessions, replayed
// with a lock wait confirmed through pg_stat_activity, row-aligned so a row is one moment. Their
// changes persist on purpose (Hassan's overdraft limit, Chloe's withdrawal).

const pane = (key: string) => {
  const s = step(key)
  return { a: s['session-a']!, b: s['session-b']! }
}
const at = (text: string, t: string) => lineOf(text, t)
// How to read a timeline frame — the last card of every timeline's side pane.
const howToRead = (id: string) => ({ type: 'note' as const, id, text: 'Read across: each row is one moment in both sessions. A blank row means that session was idle — or waiting.' })

// §1 — invariants, ACID, BEGIN / COMMIT / savepoints.
const S1 = session('concurrency/01-transactions')
const tx = sql('concurrency/01-transactions', {
  from: 'CREATE FUNCTION core.withdraw', lit: ['WITH t AS', 'RETURNING txn_id'], says: ['=!> ROLLBACK TO'],
  side: [
    {
      type: 'table', id: 'acid', title: 'What a transaction promises', tone: 'ingest', columns: ['letter', 'means', 'here'], rows: [
        ['Atomic', 'all of it, or none', 'both postings, or neither'],
        ['Consistent', 'rules hold after', 'keys, checks, FKs'],
        ['Isolated', 'others see before or after', 'next sections'],
        ['Durable', 'COMMIT survives a crash', 'written to the WAL first'],
      ],
    },
    {
      type: 'group', id: 'sp', title: 'A savepoint: undo part, keep the rest', icon: 'workflow', tone: 'store', children: [
        { type: 'item', id: 's1', title: `withdraw £50 from 1012: txn ${grab(S1, /^ +(\d{4})$/m)}`, sub: 'inside BEGIN — not yet permanent' },
        { type: 'item', id: 's2', title: 'SAVEPOINT, then account 9999', sub: 'refused: prompt turns =!>, transaction failed', tone: 'consume' },
        { type: 'item', id: 's3', title: 'ROLLBACK TO SAVEPOINT, COMMIT', sub: 'the £50 stands; the failed part never happened', tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 's1', to: 's2' }, { from: 's2', to: 's3' }],
})

// §2 — ◆ MVCC.
const S2 = session('concurrency/02-mvcc')
const v0 = result(S2, 'WHERE customer_id = 3;').rows[0]
const v1 = (() => { const r = S2.split('\n'); const i = r.findIndex((l) => l.startsWith('syndica=*> SELECT')); return result(r.slice(i).join('\n'), 'SELECT xmin').rows[0] })()
const v2 = (() => { const r = S2.split('\n'); const i = r.findIndex((l) => l.startsWith('syndica=*> ROLLBACK')); return result(r.slice(i).join('\n'), 'SELECT xmin').rows[0] })()
const mvcc: SceneModel = {
  title: 'MVCC: every change writes a new version',
  sub: 'PostgreSQL never overwrites a row in place — readers and writers do not block each other',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'versions', title: "Grace Lin's row, on disk", icon: 'disk', tone: 'ingest', children: [
        {
          type: 'table', id: 'heap', title: 'two versions of one row', columns: ['ctid', 'xmin', 'xmax', 'phone'], rows: [
            { id: 'old', cells: [v2[2], v2[0], v2[1], 'NULL'] },
            { id: 'new', cells: [v1[2], v1[0], v1[1], v1[3]], tone: 'consume' },
          ],
        },
        {
          type: 'table', id: 'cols', title: 'The hidden columns', columns: ['column', 'means'], rows: [
            ['xmin', 'the transaction that wrote this version'],
            ['xmax', 'the one that replaced or deleted it (0: none)'],
            ['ctid', 'where the version sits: (page, slot)'],
          ],
        },
        {
          type: 'table', id: 'see', title: 'Who sees which version', tone: 'store', columns: ['reader', 'sees'], rows: [
            [`txn ${v1[0]}, before ROLLBACK`, `its own new version ${v1[2]}`],
            ['everyone else, meanwhile', `the old version ${v0[2]}`],
            [`after ROLLBACK (${v1[0]} aborted)`, `the old version ${v2[2]} again`],
          ],
        },
        { type: 'note', id: 'n', text: `The update did not change ${v0[2]}: it wrote ${v1[2]}. The dead version stays until VACUUM reclaims it — that is why VACUUM exists.` },
      ],
    },
    {
      type: 'group', id: 'lab', title: 'The versions, for real', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S2, highlight: [lineOf(S2, `| ${v1[2]} |`)] },
      ],
    },
  ],
}

// §3 — the incident: a lost update.
const P3 = pane('concurrency/03-lost-update')
const final3 = grab(P3.a, /^ +(\d+\.\d+)\n\(1 row\)\s*$/m)
const lost = timelineFrame({
  ...P3, highlightA: [at(P3.a, 'SET overdraft_limit = 100'), at(P3.a, final3)], highlightB: [at(P3.b, 'SET overdraft_limit = 100'), at(P3.b, 'UPDATE 1')],
  side: [
    {
      type: 'group', id: 'story', title: 'Two officers, one raise each', icon: 'users', tone: 'consume', children: [
        { type: 'item', id: 'r1', title: 'both read the limit: 0.00', sub: 'each plans 0 + 100' },
        { type: 'item', id: 'r2', title: 'A writes 100', sub: 'B’s UPDATE waits for A’s row lock' },
        { type: 'item', id: 'r3', title: 'A commits; B writes 100 too', sub: 'B overwrote A with a stale plan' },
        { type: 'item', id: 'r4', title: `limit ${final3}, not 200.00`, sub: 'one raise lost — no error anywhere', tone: 'consume' },
      ],
    },
    {
      type: 'table', id: 'fix', title: 'Two fixes', tone: 'store', columns: ['fix', 'how'], rows: [
        ['compute in the database', 'SET limit = limit + 100'], ['lock what you read', 'SELECT … FOR UPDATE (§5)'],
      ],
    },
    howToRead('read-r1'),
  ],
  edges: [{ from: 'r1', to: 'r2' }, { from: 'r2', to: 'r3' }, { from: 'r3', to: 'r4' }],
})

// §4 — isolation levels and write skew.
const P4 = pane('concurrency/04-isolation')
const bal4 = grab(P4.a, /^ (\d+\.\d+)$/m)
const iso = timelineFrame({
  ...P4, highlightA: [at(P4.a, 'withdraw(1013'), at(P4.a, '=*> COMMIT')], highlightB: [at(P4.b, 'withdraw(1013'), at(P4.b, 'could not serialize')],
  side: [
    {
      type: 'group', id: 'skew', title: 'Write skew on a joint account', icon: 'users', tone: 'ingest', children: [
        { type: 'item', id: 'k1', title: `both see ${bal4}, limit 250`, sub: 'Chloe at one ATM, Marcus at another' },
        { type: 'item', id: 'k2', title: 'each withdraws 1300: fine alone', sub: 'together: 2600 > 2553.45 — beyond the overdraft' },
        { type: 'item', id: 'k3', title: 'SERIALIZABLE refuses B at COMMIT', sub: `SQLSTATE 40001 — A stands: ${(Number(bal4) - 1300).toFixed(2)} left`, tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'levels', title: 'What each level prevents (PG)', tone: 'ingest', columns: ['level', 'lost update', 'write skew'], rows: [
        ['READ COMMITTED (default)', 'no', 'no'], ['REPEATABLE READ', 'yes', 'no'], { id: 'ser', cells: ['SERIALIZABLE', 'yes', 'yes'], tone: 'store' },
      ],
    },
    howToRead('read-k1'),
  ],
  edges: [{ from: 'k1', to: 'k2' }, { from: 'k2', to: 'k3' }],
})

// §5 — locks and blocking.
const P5 = pane('concurrency/05-locks')
const locks = timelineFrame({
  ...P5, highlightA: [at(P5.a, 'FOR UPDATE')], highlightB: [at(P5.b, 'FOR UPDATE'), at(P5.b, '300.00')],
  side: [
    {
      type: 'group', id: 'wait', title: 'Who waits for whom', icon: 'lock', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'ha', title: 'session A', sub: 'holds row 1012', icon: 'lock', tone: 'store' },
        { type: 'item', id: 'hb', title: 'session B', sub: 'waits for row 1012', icon: 'clock' },
      ],
    },
    {
      type: 'table', id: 'seq', title: 'The raise, done right twice', tone: 'store', columns: ['moment', 'limit'], rows: [
        ['A reads, locked', '100.00'], ['B’s read waits; A adds 100, commits', '200.00'], ['B gets the row: reads', grab(P5.b, /^ +(200\.00)$/m)], ['B adds 100, commits', grab(P5.b, /^ +(300\.00)$/m)],
      ],
    },
    { type: 'note', id: 'n', text: 'FOR UPDATE locks the rows a SELECT returns until COMMIT. B did not fail — it waited, then read the NEW value. Waiting is the price; pg_locks shows who holds what.' },
    howToRead('read-hb'),
  ],
  edges: [{ from: 'hb', to: 'ha', label: 'waits for' }],
})

// §6 — deadlocks.
const P6 = pane('concurrency/06-deadlock')
const dead = timelineFrame({
  ...P6, highlightA: [at(P6.a, 'account_id = 1012 FOR UPDATE')], highlightB: [at(P6.b, 'account_id = 1011 FOR UPDATE'), at(P6.b, 'deadlock detected')],
  side: [
    {
      type: 'group', id: 'cycle', title: 'Opposite transfers, opposite order', icon: 'workflow', tone: 'consume', dir: 'row', children: [
        { type: 'item', id: 'da', title: 'A: 1011 → 1012', sub: 'holds 1011, wants 1012', icon: 'user' },
        { type: 'item', id: 'db', title: 'B: 1012 → 1011', sub: 'holds 1012, wants 1011', icon: 'user' },
      ],
    },
    {
      type: 'table', id: 'how', title: 'What the server did', tone: 'ingest', columns: ['after', 'it'], rows: [
        ['deadlock_timeout (1s)', 'checked the waits for a cycle'], { id: 'v', cells: ['found one', 'aborted B: ERROR deadlock detected'], tone: 'consume' }, ['A', 'got 1012, committed'],
      ],
    },
    { type: 'note', id: 'n', text: 'The fix is an ORDER: every transfer locks the lower account id first. Then two transfers queue on the same first lock and can never hold each other’s.' },
    howToRead('read-da'),
  ],
  edges: [{ from: 'da', to: 'db', label: 'waits for', bidirectional: true }],
})

// §7 — worked case: a transfer that is always correct.
const S7 = session('concurrency/07-transfer')
const transfer = sql('concurrency/07-transfer', {
  from: 'DECLARE', lit: ['ORDER BY account_id FOR UPDATE', 'RAISE EXCEPTION'], says: ['duplicate key', 'insufficient funds'],
  side: [
    {
      type: 'table', id: 'guards', title: 'Every guard, and what it stops', tone: 'store', columns: ['guard', 'stops'], rows: [
        ['lock both rows, lowest id first', 'lost updates, deadlocks'],
        ['check balance AFTER locking', 'overdrawing past the limit'],
        ['request_id UNIQUE', 'the same request twice'],
        ['one function, one transaction', 'half a transfer'],
      ],
    },
    {
      type: 'table', id: 'runs', title: 'Three calls', tone: 'ingest', columns: ['call', 'result'], rows: [
        ['req-7781: 1011 → 1012, 25.00', `txn ${grab(S7, /^ +(\d{4})$/m)}`],
        { id: 'again', cells: ['req-7781 again (a retry)', 'refused: request already done'], tone: 'consume' },
        { id: 'poor', cells: ['req-7782: 1016 → 1011, 1000.00', `refused: ${grab(S7, /insufficient funds: (\S+ available)/)}`], tone: 'consume' },
      ],
    },
    { type: 'note', id: 'n', text: 'A client that sees 40001 or a lost connection RETRIES with the same request id: the transfer happens once, however many times it is sent.' },
  ],
})

export const concurrencyScenes: Record<string, SceneModel> = {
  'concurrency-transactions': tx,
  'concurrency-mvcc': mvcc,
  'concurrency-lost-update': lost,
  'concurrency-isolation': iso,
  'concurrency-locks': locks,
  'concurrency-deadlock': dead,
  'concurrency-transfer': transfer,
}
