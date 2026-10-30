import type { SceneModel } from '@graphlearning/graphl-flow'
import { ideFrame, lineOf, linesFrom } from '../ide'
import { result } from '../psql'
import { file, session, tree } from '../spine'

// Course 2 — design the bank. Decisions on paper: nothing here changes `syndica` except §4's sandbox,
// which is created and dropped on screen. §5 and §6 are concept frames with their lab output inside.

// §1 — from requirements to entities.
const entities: SceneModel = {
  title: 'From requirements to entities',
  sub: 'The nouns in the brief become tables; the verbs become relationships',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'brief', title: "Product's brief", icon: 'file', tone: 'neutral', children: [
        {
          type: 'note', id: 'text',
          text: 'Customers open accounts at a branch. An account may be held jointly by two customers. Every deposit, card payment, transfer, fee and interest payment moves money between accounts, and each must be traceable for years.',
        },
        {
          type: 'table', id: 'nouns', title: 'Nouns, and what the team decided', columns: ['noun', 'decision'], rows: [
            { id: 'customer', cells: ['customer', 'entity'], tone: 'store' },
            { id: 'account', cells: ['account', 'entity'], tone: 'store' },
            { id: 'branch', cells: ['branch', 'entity'], tone: 'store' },
            { id: 'movement', cells: ['deposit, payment, fee…', 'one entity: a transaction'], tone: 'store' },
            { id: 'balance', cells: ['balance', 'NOT stored: derived from movements'], tone: 'consume' },
          ],
        },
      ],
    },
    {
      type: 'group', id: 'ents', title: 'Entities and their attributes', icon: 'table', tone: 'store', dir: 'grid', cols: 2, children: [
        { type: 'item', id: 'e-customer', title: 'Customer', icon: 'user', bullets: ['name, email, phone', 'identity checked?'] },
        { type: 'item', id: 'e-account', title: 'Account', icon: 'card', bullets: ['number, kind, currency', 'overdraft limit, opened, closed'] },
        { type: 'item', id: 'e-branch', title: 'Branch', icon: 'building', bullets: ['code, city', 'opened on'] },
        { type: 'item', id: 'e-txn', title: 'Transaction', icon: 'workflow', bullets: ['kind, reference', 'booked at an instant'] },
      ],
    },
  ],
  edges: [
    { from: 'nouns.customer', to: 'e-customer' },
    { from: 'nouns.branch', to: 'e-branch' },
  ],
}

// §2 — relationships: joint accounts.
const tbl = (id: string, title: string, rows: string[][]) =>
  ({ type: 'table' as const, id, title, columns: ['column', 'key'], rows: rows.map(([c, k]) => ({ id: c, cells: [c, k] })) })
const relationships: SceneModel = {
  title: 'Relationships: joint accounts',
  sub: 'One-to-many is a column; many-to-many needs a table of its own',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'model', title: 'The design', icon: 'workflow', tone: 'store', dir: 'row', children: [
        tbl('customers', 'customers', [['customer_id', 'PK'], ['full_name', ''], ['email', '']]),
        tbl('holders', 'account_holders', [['customer_id', 'FK → customers'], ['account_id', 'FK → accounts']]),
        {
          type: 'group', id: 'right', bare: true, children: [
            tbl('accounts', 'accounts', [['account_id', 'PK'], ['account_no', ''], ['branch_code', 'FK → branches']]),
            tbl('branches', 'branches', [['code', 'PK'], ['city', '']]),
          ],
        },
      ],
    },
    {
      type: 'group', id: 'card', title: 'Reading a relationship', icon: 'search', tone: 'ingest', children: [
        {
          type: 'table', id: 'kinds', title: 'Cardinality', columns: ['between', 'is', 'stored as'], rows: [
            ['branch → accounts', '1 to many', 'a column in accounts'],
            ['transaction → postings', '1 to many', 'a column in postings'],
            { id: 'nm', cells: ['customers ↔ accounts', 'many to many', 'a table: account_holders'], tone: 'store' },
          ],
        },
        {
          type: 'table', id: 'joint', title: 'Account SY40000013, held jointly', columns: ['account', 'customer'], rows: [
            ['SY40000013', 'Chloe Price'], ['SY40000013', 'Marcus Reid'], ['SY40000014', 'Chloe Price'],
          ],
        },
        { type: 'note', id: 'n2', text: 'One row per holder per account. Chloe appears twice, the account twice — and nothing about either is repeated.' },
      ],
    },
  ],
  edges: [
    { from: 'holders.customer_id', to: 'customers.customer_id' },
    { from: 'holders.account_id', to: 'accounts.account_id' },
    { from: 'accounts', to: 'branches' },
  ],
}

// §3 — keys: natural and surrogate.
const keys: SceneModel = {
  title: 'Keys: natural and surrogate',
  sub: 'Every row needs a name that never changes and is never shared',
  dir: 'row',
  nodes: [
    {
      type: 'table', id: 'candidates', title: 'Candidate keys for an account', tone: 'ingest', columns: ['candidate', 'unique?', 'stable?', 'verdict'], rows: [
        { id: 'num', cells: ['account number SY40000013', 'yes', 'reissued after fraud', 'UNIQUE, not the key'], tone: 'neutral' },
        { id: 'sort', cells: ['branch + opening date', 'no: two a day', '—', 'rejected'], tone: 'consume' },
        { id: 'id', cells: ['account_id 1013', 'yes', 'never changes', 'PRIMARY KEY'], tone: 'store' },
      ],
    },
    {
      type: 'group', id: 'both', title: 'The bank keeps both', icon: 'key', tone: 'store', children: [
        { type: 'item', id: 'natural', title: 'Natural key: account_no', sub: 'what humans read, print and type — kept UNIQUE', icon: 'card' },
        { type: 'item', id: 'surrogate', title: 'Surrogate key: account_id', sub: 'a number the database hands out; means nothing, so it never needs to change', icon: 'key', tone: 'store' },
        { type: 'item', id: 'refs', title: 'Every reference uses account_id', sub: 'a reissued card changes one row, not a million postings', icon: 'workflow' },
        {
          type: 'table', id: 'customer', title: 'Same test for customers', columns: ['candidate', 'verdict'], rows: [
            ['full name', 'two Priya Shahs: not unique'], ['email', 'changes: UNIQUE only'], { id: 'cid', cells: ['customer_id', 'PRIMARY KEY'], tone: 'store' },
          ],
        },
      ],
    },
  ],
  edges: [{ from: 'natural', to: 'surrogate', label: 'looked up once' }, { from: 'surrogate', to: 'refs' }],
}

// §4 — normalisation: the legacy sheet in `sandbox`, an update anomaly, dropped on screen.
const K4 = 'design/04-normalise'
const F4 = 'design/04-sheet.sql'
const S4 = session(K4)
const r4 = result(S4, 'SELECT account_no, holder, email')
const normalise = ideFrame({
  tree: tree(K4, F4), editor: { file: F4, code: file(K4, F4), highlight: linesFrom(file(K4, F4), "('SY40000013', 'Chloe", "('SY40000014', 'Chloe") },
  session: S4, sessionHighlight: linesFrom(S4, 'SY40000013 | Chloe', 'SY40000014 | Chloe'),
  side: [
    { type: 'table', id: 'now', title: "Chloe's email, after one UPDATE", tone: 'consume', columns: r4.columns, rows: r4.rows },
    {
      type: 'table', id: 'anomalies', title: 'What repetition costs', tone: 'consume', columns: ['anomaly', 'in this sheet'], rows: [
        ['update', 'change one copy, the other disagrees'],
        ['insert', 'no account yet: nowhere to put a customer'],
        ['delete', 'close the last account: the customer is gone'],
      ],
    },
    {
      type: 'group', id: 'split', title: 'Each fact stored once', icon: 'table', tone: 'store', dir: 'row', children: [
        { type: 'table', id: 'h', title: 'account_holders', columns: ['customer', 'account'], rows: [{ id: 'h1', cells: ['Chloe', 'SY40000013'] }, { id: 'h2', cells: ['Marcus', 'SY40000013'] }, { id: 'h3', cells: ['Chloe', 'SY40000014'] }] },
        { type: 'table', id: 'c', title: 'customers', columns: ['name', 'email: once'], rows: [{ id: 'chloe', cells: ['Chloe Price', 'chloe@example.org'] }, { id: 'marcus', cells: ['Marcus Reid', 'marcus.reid@…'] }] },
      ],
    },
  ],
  edges: [{ from: 'h', to: 'c', label: 'points at' }],
})

// §5 — ◆ double-entry bookkeeping. The lab's VALUES are the two example transactions.
const S5 = session('design/05-double-entry')
const r5 = result(S5, 'SELECT * FROM (VALUES')
const sum5 = result(S5, 'SELECT sum(amount)').rows[0][0]
const doubleEntry: SceneModel = {
  title: 'Double-entry bookkeeping',
  sub: 'Money is never made or lost: it moves, and every move is written twice',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'moves', title: 'Two transactions, four postings', icon: 'workflow', tone: 'store', children: [
        {
          type: 'group', id: 't1', title: 'Transfer: Olivia pays Hassan £150', tone: 'ingest', dir: 'row', children: [
            { type: 'item', id: 'olivia', title: 'Olivia', sub: '−150.00', icon: 'user' },
            { type: 'item', id: 'hassan', title: 'Hassan', sub: '+150.00', icon: 'user' },
          ],
        },
        {
          type: 'group', id: 't2', title: 'Fee: Tom is charged £15', tone: 'consume', dir: 'row', children: [
            { type: 'item', id: 'tom', title: 'Tom', sub: '−15.00', icon: 'user' },
            { type: 'item', id: 'fees', title: 'fee income', sub: '+15.00 (the bank’s own account)', icon: 'building' },
          ],
        },
        {
          type: 'table', id: 'rules', title: 'The rules', columns: ['rule', 'so'], rows: [
            ['a transaction’s postings sum to zero', 'nothing is created from nowhere'],
            ['a balance is the sum of an account’s postings', 'never a number someone edits'],
            ['a mistake is corrected by a new transaction', 'history is never rewritten'],
          ],
        },
      ],
    },
    {
      type: 'group', id: 'lab', title: 'The same postings, in SQL', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S5, highlight: [lineOf(S5, 'sum'), lineOf(S5, sum5)] },
        { type: 'table', id: 'p', title: `${r5.rows.length} postings, sum ${sum5}`, tone: 'store', columns: r5.columns, rows: r5.rows },
      ],
    },
  ],
  edges: [{ from: 'olivia', to: 'hassan', label: '£150' }, { from: 'tom', to: 'fees', label: '£15' }],
}

// §6 — data types, and the design review.
const S6 = session('design/06-types')
const r6 = result(S6, '0.1::float8')
const col = (id: string, title: string, rows: [string, string][]) =>
  ({ type: 'table' as const, id, title, columns: ['column', 'type'], rows: rows.map(([c, t]) => ({ id: c, cells: [c, t] })) })
const review: SceneModel = {
  title: 'Data types, and the design review',
  sub: 'Version 1 of the schema, signed off — every arrow a reference by surrogate key',
  nodes: [
    {
      type: 'group', id: 'er', title: 'The schema, v1', icon: 'database', tone: 'store', dir: 'row', children: [
        col('customers', 'core.customers', [['customer_id', 'bigint'], ['full_name', 'text'], ['email', 'text'], ['joined_on', 'date']]),
        col('holders', 'core.account_holders', [['account_id', 'bigint'], ['customer_id', 'bigint']]),
        {
          type: 'group', id: 'acc-col', bare: true, children: [
            col('accounts', 'core.accounts', [['account_id', 'bigint'], ['branch_code', 'text'], ['currency', 'char(3)'], ['overdraft_limit', 'numeric(14,2)']]),
            col('branches', 'ref.branches', [['code', 'text'], ['city', 'text'], ['opened_on', 'date']]),
          ],
        },
        col('postings', 'core.postings', [['account_id', 'bigint'], ['txn_id', 'bigint'], ['posting_id', 'bigint'], ['amount', 'numeric(14,2)']]),
        col('txns', 'core.transactions', [['txn_id', 'bigint'], ['kind', 'text'], ['booked_at', 'timestamptz']]),
      ],
    },
    {
      type: 'group', id: 'types', title: 'Why these types', icon: 'search', tone: 'ingest', dir: 'row', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S6, highlight: [lineOf(S6, r6.rows[0][0])] },
        {
          type: 'table', id: 'why', title: 'The rule for each kind of value', columns: ['value', 'type', 'because'], rows: [
            { id: 'money', cells: ['money', 'numeric(14,2)', `float8 gave ${r6.rows[0][0]}`], tone: 'store' },
            ['a day', 'date', 'no time, no zone'],
            ['a moment', 'timestamptz', 'one instant, shown in any zone'],
          ],
        },
      ],
    },
  ],
  edges: [
    { from: 'holders.customer_id', to: 'customers.customer_id' },
    { from: 'holders.account_id', to: 'accounts.account_id' },
    { from: 'accounts', to: 'branches' },
    { from: 'postings.account_id', to: 'accounts.account_id' },
    { from: 'postings.txn_id', to: 'txns.txn_id' },
  ],
}

export const designScenes: Record<string, SceneModel> = {
  'design-entities': entities,
  'design-relationships': relationships,
  'design-keys': keys,
  'design-normalise': normalise,
  'design-double-entry': doubleEntry,
  'design-review': review,
}
