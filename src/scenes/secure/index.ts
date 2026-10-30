import type { SceneModel } from '@graphlearning/graphl-flow'
import { lineOf } from '../ide'
import { grab, result } from '../psql'
import { sql } from '../section'
import { session } from '../spine'

// Course 10 — secure it, and go live. Roles are cluster-wide: spine.py drops syndica_% roles before a
// replay. §1 runs as the superuser (the red =# prompt); the rest as dbteam, testing each role with
// SET ROLE. §5–§6 close the course.

type Tone = 'store' | 'consume' | 'ingest'
const table = (id: string, title: string, r: { columns: string[]; rows: string[][] }, tone: Tone = 'store') =>
  ({ type: 'table' as const, id, title, tone, columns: r.columns, rows: r.rows })

// §1 — roles, GRANT, REVOKE.
const S1 = session('secure/01-roles')
const m = result(S1, 'roles/matrix.sql')
const roles = sql('secure/01-roles', {
  file: 'roles/01-roles.sql', lit: ['GRANT USAGE', 'GRANT SELECT ON ALL TABLES'], says: ['psql -q -U postgres'],
  side: [
    table('m', 'The permission matrix, from has_table_privilege()', { columns: ['role', 'table', 'SELECT', 'INSERT', 'UPDATE'], rows: m.rows.map((r) => [r[0].replace('syndica_', ''), r[1].replace('core.', ''), ...r.slice(2).map((v) => (v === 't' ? 'yes' : '—'))]) }),
    {
      type: 'table', id: 'terms', title: 'The words', tone: 'ingest', columns: ['term', 'means'], rows: [
        ['authentication', 'who you are: pg_hba.conf decides (described)'], ['authorisation', 'what you may do: GRANT and REVOKE'], ['a role', 'a user, or a group of privileges'],
      ],
    },
    { type: 'note', id: 'n', text: 'The matrix is asked of the server, never typed: has_table_privilege() answers for each role and table — the same check every query faces.' },
  ],
})

// §2 — least privilege, and an append-only ledger.
const S2 = session('secure/02-least')
const least = sql('secure/02-least', {
  lit: ['REVOKE UPDATE, DELETE, TRUNCATE ON core.postings', 'SECURITY DEFINER'], says: ['permission denied for table postings'],
  side: [
    {
      type: 'group', id: 'doors', title: "The app's one door", icon: 'lock', tone: 'store', dir: 'row', children: [
        { type: 'item', id: 'app', title: 'syndica_app', icon: 'server' },
        { type: 'item', id: 'fn', title: 'core.transfer()', sub: 'SECURITY DEFINER: runs as its owner', icon: 'workflow', tone: 'store' },
        { type: 'item', id: 'tbl', title: 'the ledger', sub: 'no direct grants at all', icon: 'database' },
      ],
    },
    {
      type: 'table', id: 'tried', title: 'Tried, and refused', tone: 'consume', columns: ['as', 'tried', 'result'], rows: [
        ['dbteam (the owner)', 'UPDATE a posting', 'permission denied'],
        ['syndica_app', 'INSERT a posting', 'permission denied'],
        { id: 'ok', cells: ['syndica_app', 'read core.account_balance', grab(S2, /^ (\d+\.\d+)$/m)], tone: 'store' },
      ],
    },
    { type: 'note', id: 'n', text: 'Even the owner gave up UPDATE and DELETE on postings: history cannot be edited by accident. UPDATE stays on transactions — a posting’s foreign key locks its transaction row, and that lock needs it.' },
  ],
  edges: [{ from: 'app', to: 'fn', label: 'EXECUTE' }, { from: 'fn', to: 'tbl', label: 'as owner' }],
})

// §3 — masking views and row-level security.
const S3 = session('secure/03-rls')
const rls = sql('secure/03-rls', {
  lit: ['ENABLE ROW LEVEL SECURITY', "USING (branch_code = 'LDS')"], says: ['permission denied for table customers'],
  side: [
    {
      type: 'table', id: 'sees', title: 'What the Leeds teller sees', tone: 'store', columns: ['asked', 'got'], rows: [
        ['every account', `${grab(S3, /^ +(\d+) \| LDS$/m)} rows, all branch LDS`],
        ['customers, directly', 'permission denied'],
        ['customer_directory', 'names, phones masked'],
      ],
    },
    table('dir', 'The directory, as the teller reads it', result(S3, 'customer_directory')),
    {
      type: 'table', id: 'how', title: 'Two tools', tone: 'ingest', columns: ['tool', 'restricts'], rows: [
        ['a view', 'COLUMNS: which, and how shown'], { id: 'rls', cells: ['a row policy (PG)', 'ROWS: which ones each role sees'], tone: 'store' },
      ],
    },
  ],
})

// §4 — SQL injection and parameters.
const S4 = session('secure/04-injection')
const counts = [...S4.matchAll(/^ +(\d+)\n\(1 row\)/gm)].map((x) => x[1])
const injection = sql('secure/04-injection', {
  lit: ['PREPARE search(text)', 'reference = $1'], says: ["''%s''", '%L'],
  side: [
    {
      type: 'group', id: 'atk', title: 'The input', icon: 'zap', tone: 'consume', children: [
        { type: 'item', id: 'in', title: grab(S4, /^(x' OR .*)$/m), sub: 'what a user typed into the search box' },
      ],
    },
    {
      type: 'table', id: 'r', title: 'Three ways to put it into the query', tone: 'consume', columns: ['built with', 'rows', 'the input became'], rows: [
        { id: 's', cells: ["'%s' — pasted into the text", counts[0], 'SQL: OR true'], tone: 'consume' },
        { id: 'l', cells: ['%L — quoted as a literal', counts[1], 'a value'], tone: 'store' },
        { id: 'p', cells: ['$1 — a parameter', counts[2], 'a value, always'], tone: 'store' },
      ],
    },
    {
      type: 'table', id: 'ids', title: 'And for names', tone: 'ingest', columns: ['when SQL needs a', 'use'], rows: [
        ['value', 'a parameter ($1)'], ['table or column name', "format('%I', name)"],
      ],
    },
    { type: 'note', id: 'n', text: 'The quote the user typed closed the string early, so the rest of their input became SQL. A parameter is sent apart from the SQL text: it can never close anything.' },
  ],
})

// §5 — a day at Syndica Bank.
const S5 = session('secure/05-day')
const after = result(S5, 'IN (1019, 1021)')
const day: SceneModel = {
  title: 'A day at Syndica Bank',
  sub: 'One transfer, through every layer the DB team built',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'layers', title: "Aisha pays Daniel £40, from the bank's app", icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'l1', title: 'secure: syndica_app may only EXECUTE core.transfer', sub: 'its direct INSERT into postings is refused', icon: 'lock' },
        { type: 'item', id: 'l2', title: 'concurrency: both accounts locked in id order', sub: 'request_id req-9001 makes a retry harmless', icon: 'zap' },
        { type: 'item', id: 'l3', title: 'build: keys, references and checks', sub: 'no posting to an account that does not exist', icon: 'shield' },
        { type: 'item', id: 'l4', title: 'design: double entry', sub: '−40 for Aisha, +40 for Daniel: sums to zero', icon: 'log' },
        { type: 'item', id: 'l5', title: 'query and combine: balances derived', sub: 'core.account_balance, the view, read at once', icon: 'table', tone: 'store' },
      ],
    },
    {
      type: 'group', id: 'lab', title: 'The day, for real — as the app', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S5, highlight: [lineOf(S5, 'core.transfer'), lineOf(S5, 'permission denied')] },
        table('bal', 'Balances after the transfer', after),
      ],
    },
  ],
  edges: [{ from: 'l1', to: 'l2' }, { from: 'l2', to: 'l3' }, { from: 'l3', to: 'l4' }, { from: 'l4', to: 'l5' }],
}

// §6 — where next.
const next: SceneModel = {
  title: 'Where next',
  sub: 'What this course built — and what it deliberately left for later',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'built', title: 'Built, on one database', icon: 'database', tone: 'store', dir: 'grid', cols: 2, children: [
        { type: 'item', id: 'b1', title: 'a designed schema', sub: 'keys, references, rules', icon: 'table' },
        { type: 'item', id: 'b2', title: 'a double-entry ledger', sub: 'balances derived, never stored', icon: 'log' },
        { type: 'item', id: 'b3', title: 'questions, answered', sub: 'joins, windows, recursion', icon: 'search' },
        { type: 'item', id: 'b4', title: 'safe changes', sub: 'reversals, MERGE, an audit trail', icon: 'settings' },
        { type: 'item', id: 'b5', title: 'correct under concurrency', sub: 'locks, isolation, idempotency', icon: 'zap' },
        { type: 'item', id: 'b6', title: 'measured and secured', sub: 'plans, indexes, least privilege', icon: 'lock' },
      ],
    },
    {
      type: 'group', id: 'later', title: 'Left for later — each its own subject', icon: 'layers', tone: 'ingest', children: [
        { type: 'item', id: 'n1', title: 'running it in production', sub: 'migrations under load, backups and point-in-time recovery, replication, monitoring', icon: 'server' },
        { type: 'item', id: 'n2', title: 'other engines', sub: 'the SQL is portable; the (PG) parts are where MySQL, SQL Server and Oracle differ', icon: 'database' },
        { type: 'item', id: 'n3', title: 'analytics at scale', sub: 'warehouses and Spark: the same SQL ideas, on billions of rows', icon: 'chart' },
      ],
    },
  ],
  edges: [{ from: 'built', to: 'later' }],
}

export const secureScenes: Record<string, SceneModel> = {
  'secure-roles': roles,
  'secure-least': least,
  'secure-rls': rls,
  'secure-injection': injection,
  'secure-day': day,
  'secure-next': next,
}
