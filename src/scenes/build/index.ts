import type { SceneModel } from '@graphlearning/graphl-flow'
import { view } from '../fold'
import { ideFrame, lineOf, linesFrom } from '../ide'
import { grab, outcomes, output, result } from '../psql'
import { file, session } from '../spine'

// Course 3 — build it, and make it refuse bad data. Every step changes `syndica` for good: tables,
// keys and rules are added by files in syndica-db/build/, run with \i, and the opening book is
// loaded in §6. Constraints arrive as ALTERs on tables that already hold rows, so each one is
// checked against real data the moment it is added.

// §1 — CREATE TABLE, defaults, identity.
const K1 = 'build/01-customers', F1 = 'build/01-customers.sql'
const S1 = session(K1)
const r1 = result(S1, 'RETURNING customer_id')
const customers = ideFrame({
  model: 'Some columns the database fills', editor: { file: F1, code: file(K1, F1), highlight: [lineOf(file(K1, F1), 'IDENTITY'), lineOf(file(K1, F1), 'DEFAULT')] },
  session: S1, sessionHighlight: [lineOf(S1, 'RETURNING'), ...linesFrom(S1, 'ERROR:', 'HINT:')],
  side: [
    {
      type: 'table', id: 'cols', title: 'core.customers: who fills each column', tone: 'ingest', columns: ['column', 'filled by'], rows: [
        { id: 'id', cells: ['customer_id', 'the database: identity'], tone: 'store' },
        ['full_name, email, phone', 'the INSERT'],
        { id: 'kyc', cells: ['kyc_status', "the default: 'pending'"], tone: 'store' },
        ['joined_on', 'the INSERT'],
      ],
    },
    { type: 'table', id: 'ret', title: 'RETURNING: what the database filled in', tone: 'store', columns: r1.columns, rows: r1.rows },
    {
      type: 'group', id: 'always', title: 'GENERATED ALWAYS', icon: 'lock', tone: 'consume', children: [
        { type: 'item', id: 'try', title: 'INSERT … customer_id = 7', sub: 'a number chosen by hand' },
        { type: 'item', id: 'no', title: 'refused', sub: grab(S1, /^ERROR:\s+(.*)$/m), tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 'cols', to: 'ret', label: 'RETURNING' }, { from: 'try', to: 'no' }],
})

// §2 — primary, unique and composite keys.
const K2 = 'build/02-keys', F2 = 'build/02-keys.sql'
const S2 = session(K2)
const keys = ideFrame({
  model: 'A key: one name per row, every row', editor: { file: F2, code: file(K2, F2), highlight: [lineOf(file(K2, F2), 'ref.branches ADD PRIMARY KEY')] },
  session: S2, sessionHighlight: [lineOf(S2, 'is duplicated'), lineOf(S2, 'already exists')],
  side: [
    {
      type: 'group', id: 'story', title: 'Leeds, registered twice', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'k1', title: 'INSERT LDS again', sub: `no key, so accepted: ${output(S2, "VALUES ('LDS'")[0]}` },
        { type: 'item', id: 'k2', title: 'ADD PRIMARY KEY (code)', sub: `refused: ${grab(S2, /^DETAIL:\s+(Key .* duplicated\.)$/m)}`, tone: 'consume' },
        { type: 'item', id: 'k3', title: 'DELETE the copy, add the key', sub: `${output(S2, 'DELETE FROM')[0]}, then the keys file` },
        { type: 'item', id: 'k4', title: 'INSERT LDS again', sub: `refused: ${grab(S2, /^DETAIL:\s+(Key .* already exists\.)$/m)}`, tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'now', title: 'Keys now in syndica', tone: 'store', columns: ['table', 'key', 'kind'], rows: [
        ['ref.branches', 'code', 'PRIMARY KEY'],
        ['core.customers', 'customer_id', 'PRIMARY KEY'],
        ['core.customers', 'email', 'UNIQUE'],
      ],
    },
  ],
  edges: [{ from: 'k1', to: 'k2' }, { from: 'k2', to: 'k3' }, { from: 'k3', to: 'k4' }],
})

// §3 — foreign keys.
const K3 = 'build/03-accounts', F3 = 'build/03-accounts.sql'
const S3 = session(K3)
const fk: SceneModel = ideFrame({
  model: 'A foreign key: only what exists', editor: { file: F3, code: file(K3, F3), show: [[lineOf(file(K3, F3), 'REFERENCES ref.branches'), lineOf(file(K3, F3), 'REFERENCES ref.branches')], [lineOf(file(K3, F3), 'CREATE TABLE core.account_holders'), lineOf(file(K3, F3), 'PRIMARY KEY (account_id, customer_id)')]], highlight: [lineOf(file(K3, F3), 'REFERENCES ref.branches'), lineOf(file(K3, F3), 'PRIMARY KEY (account_id, customer_id)')] },
  session: S3, sessionHighlight: [lineOf(S3, 'is not present'), lineOf(S3, 'is referenced from')],
  side: [
    {
      type: 'group', id: 'links', title: 'What may point at what', icon: 'workflow', tone: 'store', dir: 'row', children: [
        { type: 'table', id: 'holders', title: 'account_holders', columns: ['column'], rows: [{ id: 'acc', cells: ['account_id'] }, { id: 'cus', cells: ['customer_id'] }] },
        {
          type: 'group', id: 'targets', bare: true, children: [
            { type: 'table', id: 'accounts', title: 'accounts', columns: ['column'], rows: [{ id: 'id', cells: ['account_id'] }, { id: 'br', cells: ['branch_code'] }] },
            { type: 'table', id: 'customers', title: 'customers', columns: ['column'], rows: [{ id: 'id', cells: ['customer_id'] }] },
          ],
        },
        { type: 'table', id: 'branches', title: 'branches', columns: ['column'], rows: [{ id: 'code', cells: ['code'] }] },
      ],
    },
    {
      type: 'table', id: 'refused', title: 'Both directions are guarded', tone: 'consume', columns: ['tried', 'refused: the key'], rows: [
        ['an account at YRK', grab(S3, /^DETAIL:\s+Key \(branch_code\)=\(YRK\) (is not present) .*\.$/m)],
        ['DELETE Leeds', grab(S3, /^DETAIL:\s+Key \(code\)=\(LDS\) (is referenced) .*\.$/m)],
      ],
    },
  ],
  edges: [
    { from: 'holders.acc', to: 'accounts.id' },
    { from: 'holders.cus', to: 'customers.id' },
    { from: 'accounts.br', to: 'branches.code' },
  ],
})

// §4 — CHECK, NOT NULL, and what NULL means.
const K4 = 'build/04-rules', F4 = 'build/04-rules.sql'
const S4 = session(K4)
const rules = ideFrame({
  model: 'CHECK refuses only what is false', editor: { file: F4, code: file(K4, F4), ...view(file(K4, F4), 'ALTER TABLE core.accounts', undefined, 0), highlight: [lineOf(file(K4, F4), 'closed_on >= opened_on')] },
  session: S4, sessionHighlight: [lineOf(S4, 'violates check')],
  side: [
    {
      type: 'table', id: 'meanings', title: 'NULL means "no value" — read it per column', tone: 'ingest', columns: ['column', 'NULL here means'], rows: [
        { id: 'closed', cells: ['closed_on', 'still open'], tone: 'store' },
        ['phone', 'not given'],
        ['full_name', 'forbidden: NOT NULL'],
      ],
    },
    {
      type: 'group', id: 'test', title: 'CHECK (closed_on >= opened_on)', icon: 'filter', tone: 'consume', children: [
        { type: 'item', id: 't-true', title: 'closed_on 2026-10-01: true', sub: 'accepted', icon: 'check', tone: 'store' },
        { type: 'item', id: 't-null', title: 'closed_on NULL: unknown', sub: 'accepted: only false is refused', icon: 'clock' },
        { type: 'item', id: 't-false', title: 'closed_on 2026-08-31: false', sub: 'refused', icon: 'bell', tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 't-true', to: 't-null' }, { from: 't-null', to: 't-false' }],
})

// §5 — predict: accepted or refused. Verdicts are read from the run, in file order.
const K5 = 'build/05-predict', F5 = 'build/05-predict.sql'
const S5 = session(K5)
const runs = outcomes(output(S5, 'build/05-predict.sql'))
if (runs.length !== 6) throw new Error(`build/05: expected 6 outcomes, read ${runs.length}`)
const records = ['a customer with no phone', 'a customer with no name', 'Amelia again, same email', 'an account in dollars', 'closed before it opened', 'Priya Shah, a second email']
const ruleOf = (t: string) => t.includes('not-null') ? 'NOT NULL' : t.includes('unique') ? 'UNIQUE (email)' : t.includes('currency') ? 'CHECK (currency)' : t.includes('check') ? 'CHECK (dates)' : '—'
const predict = ideFrame({
  model: 'Constraints guard each row, not each person', editor: { file: F5, code: file(K5, F5), ...view(file(K5, F5), '-- 1', undefined, 2) },
  session: S5,
  side: [
    {
      type: 'table', id: 'verdicts', title: 'Six records, six verdicts', tone: 'ingest', columns: ['#', 'record', 'rule', 'verdict'],
      rows: runs.map((r, i) => ({ id: `v${i + 1}`, cells: [String(i + 1), records[i], r.ok ? '—' : ruleOf(r.text), r.ok ? 'accepted' : 'refused'], tone: r.ok ? 'store' as const : 'consume' as const })),
    },
    {
      type: 'group', id: 'limits', title: 'What no rule caught', icon: 'search', tone: 'consume', children: [
        { type: 'item', id: 'priya', title: 'Priya Shah, twice', sub: 'priya.shah@ in the opening book, p.shah@ here: two emails, so UNIQUE is satisfied' },
        { type: 'item', id: 'later', title: 'Found and merged in Change', sub: 'constraints guard each row; spotting the same person needs a query' },
      ],
    },
  ],
  edges: [{ from: 'priya', to: 'later' }],
})

// §6 — opening the bank: the ledger, then the opening book, parents first.
const K6 = 'build/06-opening', F6 = 'build/06-open.sql'
const S6 = session(K6)
const copies = output(S6, 'build/06-open.sql').filter((l) => l.startsWith('COPY')).map((l) => l.split(' ')[1])
const loads = ['customers', 'accounts', 'account_holders', 'transactions', 'postings']
const opening = ideFrame({
  model: 'Load a row only after what it points at', editor: { file: F6, code: file(K6, F6), highlight: linesFrom(file(K6, F6), '\\copy core.customers', '\\copy core.postings') },
  session: S6, sessionHighlight: [lineOf(S6, 'is not present')],
  side: [
    {
      type: 'group', id: 'order', title: 'Load order: a row only after what it points at', icon: 'workflow', tone: 'store', children: [
        ...loads.map((t, i) => ({ type: 'item' as const, id: `l-${t}`, title: `${i + 1}  ${t}`, sub: `COPY ${copies[i]}` })),
        { type: 'item', id: 'l-done', title: 'identities moved on', sub: '4 × ALTER … RESTART', tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'tried', title: 'Postings first? Refused', tone: 'consume', columns: ['tried', 'result'], rows: [
        ['\\copy core.postings', grab(S6, /^DETAIL:\s+Key \(txn_id\)=\((\d+)\) is not present/m) + ': no such transaction yet'],
      ],
    },
  ],
  edges: [
    { from: 'l-customers', to: 'l-accounts' }, { from: 'l-accounts', to: 'l-account_holders' },
    { from: 'l-account_holders', to: 'l-transactions' }, { from: 'l-transactions', to: 'l-postings' }, { from: 'l-postings', to: 'l-done' },
  ],
})

// §7 — read the catalogue.
const K7 = 'build/07-catalogue', F7 = 'build/06-ledger.sql'
const S7 = session(K7)
const dt = result(S7, '\\dt core.*')
const cols = result(S7, 'SELECT column_name')
const catalogue = ideFrame({
  model: 'The schema describes itself', editor: { file: F7, code: file(K7, F7), ...view(file(K7, F7), 'CREATE TABLE core.postings', undefined, 0), highlight: linesFrom(file(K7, F7), 'posting_id', 'amount') },
  session: S7, sessionShow: [[1, 9], [12, 21]],
  side: [
    {
      type: 'group', id: 'how', title: 'Written once, read by anyone', icon: 'database', tone: 'ingest', dir: 'row', children: [
        { type: 'item', id: 'ddl', title: 'CREATE TABLE', sub: 'the team writes' },
        { type: 'item', id: 'cat', title: 'the catalogue', sub: 'the server keeps', icon: 'database' },
        { type: 'item', id: 'read', title: '\\dt, information_schema', sub: 'anyone reads', icon: 'search' },
      ],
    },
    { type: 'table', id: 'cols', title: 'core.postings, from information_schema', tone: 'store', columns: cols.columns, rows: cols.rows },
    { type: 'table', id: 'tables', title: `${dt.rows.length} tables in core`, tone: 'store', columns: ['table', 'owner'], rows: dt.rows.map((r) => [r[1], r[3]]) },
  ],
  edges: [{ from: 'ddl', to: 'cat' }, { from: 'cat', to: 'read' }, { from: 'how', to: 'cols' }],
})

export const buildScenes: Record<string, SceneModel> = {
  'build-customers': customers,
  'build-keys': keys,
  'build-foreign-keys': fk,
  'build-rules': rules,
  'build-predict': predict,
  'build-opening': opening,
  'build-catalogue': catalogue,
}
