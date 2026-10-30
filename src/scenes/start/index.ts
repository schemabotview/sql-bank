import type { SceneModel } from '@graphlearning/graphl-flow'
import { ideFrame, lineOf, linesFrom } from '../ide'
import { grab, output, result } from '../psql'
import { file, session, tree } from '../spine'

// Course 1 — why a database, and first contact. §1–§3 are concept frames; from §4 the IDE frame,
// every console a replayed psql transcript and every value in a side pane read out of it.

// §1 — why a bank can't run on spreadsheets. The lost update is told as a timeline; the numbers are
// the story's, not a transcript (no database exists yet).
const spreadsheets: SceneModel = {
  title: "Why a bank can't run on spreadsheets",
  sub: 'Two tellers, one balance file',
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'today', title: 'Today: balances.xlsx on a shared drive', icon: 'file', tone: 'consume', children: [
        {
          type: 'group', id: 'tellers', bare: true, dir: 'row', children: [
            { type: 'item', id: 'ta', title: 'Teller A', sub: 'Leeds', icon: 'user' },
            { type: 'item', id: 'tb', title: 'Teller B', sub: 'Leeds', icon: 'user' },
          ],
        },
        { type: 'item', id: 'sheet', title: 'balances.xlsx', sub: 'Olivia Bennett: £500', icon: 'table', tone: 'consume' },
        {
          type: 'table', id: 'lost', title: 'The lost update', columns: ['time', 'teller', 'does', 'file says'], rows: [
            ['09:00', 'A', 'opens the file', '£500'],
            ['09:01', 'B', 'opens the file', '£500'],
            ['09:02', 'A', 'pays out £200, saves', '£300'],
            { id: 'bsave', cells: ['09:03', 'B', 'pays out £50, saves', '£450'], tone: 'consume' },
            { id: 'truth', cells: ['', '', 'what Olivia really has', '£250'], tone: 'store' },
          ],
        },
      ],
    },
    {
      type: 'group', id: 'missing', title: 'What the file cannot do', icon: 'zap', tone: 'neutral', children: [
        { type: 'item', id: 'm1', title: 'Share', sub: 'two people, one file: the last save wins', icon: 'users' },
        { type: 'item', id: 'm2', title: 'Refuse', sub: '"five hundred" in a number column is accepted', icon: 'shield' },
        { type: 'item', id: 'm3', title: 'Remember', sub: 'who changed a balance, and why, is gone', icon: 'clock' },
        { type: 'item', id: 'm4', title: 'Protect', sub: 'whoever can open it can read every customer', icon: 'lock' },
      ],
    },
    {
      type: 'group', id: 'db', title: 'What a database gives the bank', icon: 'database', tone: 'store', children: [
        { type: 'item', id: 'd1', title: 'Transactions', sub: 'two tellers, both withdrawals counted', icon: 'workflow' },
        { type: 'item', id: 'd2', title: 'Constraints', sub: 'bad data refused at the door', icon: 'check' },
        { type: 'item', id: 'd3', title: 'A ledger', sub: 'every movement kept, nothing overwritten', icon: 'log' },
        { type: 'item', id: 'd4', title: 'Access control', sub: 'each role sees what it needs', icon: 'key' },
      ],
    },
  ],
  edges: [
    { from: 'ta', to: 'sheet' }, { from: 'tb', to: 'sheet' },
    { from: 'm1', to: 'd1' }, { from: 'm2', to: 'd2' }, { from: 'm3', to: 'd3' }, { from: 'm4', to: 'd4' },
  ],
}

// §2 — what the DB team will build: the project map, one stage per course, each opened by a request.
// A serpentine (1–5 left to right, 6–10 back) so every arrow crosses one gap.
type Who = 'store' | 'neutral'
const stage = (id: string, n: number, title: string, from: string, ask: string, icon: string, tone: Who = 'neutral') => ({
  type: 'group' as const, id, badge: n, title, tone, children: [{ type: 'item' as const, id: `${id}-ask`, title: from, sub: `"${ask}"`, icon }],
})
const project: SceneModel = {
  title: 'What the DB team will build',
  sub: "Syndica Bank's core database, from an empty server to go-live — one database throughout",
  nodes: [
    {
      type: 'group', id: 'map', bare: true, dir: 'grid', cols: 5, children: [
        stage('s1', 1, 'First contact', 'Head of Engineering', 'why not spreadsheets?', 'user', 'store'),
        stage('s2', 2, 'Design', 'Product', 'customers hold accounts, some jointly', 'users', 'store'),
        stage('s3', 3, 'Build', 'Product', 'the database must refuse bad data', 'shield', 'store'),
        stage('s4', 4, 'Query', 'Finance', 'balances per branch', 'chart'),
        stage('s5', 5, 'Combine', 'Finance', 'which customers hold which accounts', 'table'),
        stage('s10', 10, 'Secure', 'Audit', 'tellers can see every branch', 'lock'),
        stage('s9', 9, 'Perform', 'SRE', 'the statement page takes 4 seconds', 'gauge'),
        stage('s8', 8, 'Concurrency', 'Incident report', 'a customer withdrew £500 twice', 'zap'),
        stage('s7', 7, 'Change', 'Operations', 'interest, closures, the card file', 'settings'),
        stage('s6', 6, 'Analyse', 'Finance', 'statements, trends, cohorts', 'activity'),
      ],
    },
    { type: 'note', id: 'legend', text: 'Green: this part of the course. Every stage after it works on the same database, which keeps everything the team has done.' },
  ],
  edges: [
    { from: 's1', to: 's2' }, { from: 's2', to: 's3' }, { from: 's3', to: 's4' }, { from: 's4', to: 's5' },
    { from: 's5', to: 's6' }, { from: 's6', to: 's7' }, { from: 's7', to: 's8' }, { from: 's8', to: 's9' }, { from: 's9', to: 's10' },
  ],
}

// §3 — ◆ a server, a database, a client. The console is the real replay of start/03.
const S3 = session('start/03-connect')
const server: SceneModel = {
  title: 'A server, a database, a client',
  sub: `PostgreSQL ${grab(S3, /^ (\d+\.\d+)$/m)}: clients send SQL, the server answers`,
  dir: 'row',
  nodes: [
    {
      type: 'group', id: 'clients', title: 'Clients', sub: 'programs that send SQL', icon: 'users', tone: 'ingest', children: [
        { type: 'item', id: 'app', title: 'Teller app', sub: 'in every branch', icon: 'laptop' },
        { type: 'item', id: 'atm', title: 'ATM network', sub: 'cash machines', icon: 'card' },
        { type: 'item', id: 'psql', title: 'psql', sub: "the DB team's client, in a terminal", icon: 'terminal' },
      ],
    },
    {
      type: 'group', id: 'srv', title: 'The server', sub: 'one program that owns the data', icon: 'postgresql', tone: 'store', children: [
        { type: 'item', id: 'pg', title: 'PostgreSQL', sub: 'checks, plans and runs every statement', icon: 'server' },
        {
          type: 'table', id: 'dbs', title: 'Databases on this server', columns: ['database', 'what it holds'], rows: [
            { id: 'syndica', cells: ['syndica', "the bank's data — this course"], tone: 'store' },
            ['postgres', "the server's own default"],
          ],
        },
        { type: 'item', id: 'disk', title: 'Data files', sub: 'only the server reads and writes them', icon: 'disk' },
      ],
    },
    {
      type: 'group', id: 'proof', title: 'Connecting, for real', icon: 'terminal', tone: 'neutral', children: [
        { type: 'code', id: 'con', console: true, cols: 80, filename: 'dbteam@syndica: ~/syndica-db', code: '\n' + S3, highlight: [lineOf(S3, ' dbteam ')] },
        { type: 'note', id: 'n', text: 'psql is only a client. The answers — who you are, which database, which version — come from the server.' },
      ],
    },
  ],
  edges: [
    { from: 'app', to: 'pg', label: 'SQL' }, { from: 'atm', to: 'pg' }, { from: 'psql', to: 'pg' },
    { from: 'pg', to: 'dbs' }, { from: 'dbs', to: 'disk' },
  ],
}

// §4 — the first table.
const K4 = 'start/04-first-table'
const F4 = 'start/04-branches.sql'
const S4 = session(K4)
const r4 = result(S4, 'start/04-branches.sql')
const firstTable = ideFrame({
  tree: tree(K4, F4), editor: { file: F4, code: file(K4, F4), highlight: linesFrom(file(K4, F4), 'CREATE TABLE', ');') },
  session: S4,
  side: [
    {
      type: 'group', id: 'steps', title: 'Four statements, in order', icon: 'workflow', tone: 'ingest', children: [
        { type: 'item', id: 'st1', title: 'CREATE SCHEMA ref', sub: 'a namespace for reference data' },
        { type: 'item', id: 'st2', title: 'CREATE TABLE ref.branches', sub: 'three columns, each with a type — no rows' },
        { type: 'item', id: 'st3', title: 'INSERT … VALUES', sub: output(S4, 'start/04-branches.sql').find((l) => l.startsWith('INSERT'))! },
        { type: 'item', id: 'st4', title: 'SELECT * FROM ref.branches', sub: 'reads every row back', tone: 'store' },
      ],
    },
    { type: 'table', id: 'rows', title: 'ref.branches, as the server returned it', tone: 'store', columns: r4.columns, rows: r4.rows },
    { type: 'note', id: 'n4', text: 'A table is a promise about shape: every row has the same columns, each value of the column’s type.' },
  ],
  edges: [{ from: 'st1', to: 'st2' }, { from: 'st2', to: 'st3' }, { from: 'st3', to: 'st4' }],
})

// §5 — anatomy of a statement.
const K5 = 'start/05-anatomy'
const F5 = 'start/05-anatomy.sql'
const S5 = session(K5)
const r5 = result(S5, 'start/05-anatomy.sql')
const anatomy = ideFrame({
  tree: tree(K5, F5), editor: { file: F5, code: file(K5, F5), highlight: linesFrom(file(K5, F5), 'SELECT code', "'2015-01-01'") },
  session: S5, sessionHighlight: [lineOf(S5, 'ERROR:')],
  side: [
    {
      type: 'table', id: 'tokens', title: 'The statement, token by token', tone: 'ingest', columns: ['token', 'kind'], rows: [
        ['SELECT  FROM  WHERE', 'keywords: the grammar'],
        ['code  city  opened_on', 'identifiers: columns'],
        ['ref.branches', 'identifier: schema.table'],
        ['<', 'operator'],
        ["'2015-01-01'", 'literal: a value, in quotes'],
        [';', 'ends the statement'],
        ['-- …', 'comment: ignored'],
      ],
    },
    { type: 'table', id: 'r5', title: 'Branches opened before 2015', tone: 'store', columns: r5.columns, rows: r5.rows },
    {
      type: 'table', id: 'case', title: 'Names fold to lower case — unless quoted', tone: 'consume', columns: ['you write', 'the server reads'], rows: [
        ['city, CITY, City', 'city'],
        { id: 'quoted', cells: ['"City"', '"City": no such column'], tone: 'consume' },
      ],
    },
  ],
})

// §6 — psql itself.
const K6 = 'start/06-psql'
const S6 = session(K6)
const psql = ideFrame({
  tree: tree(K6), editor: { file: F4, code: file(K6, F4), highlight: linesFrom(file(K6, F4), 'CREATE TABLE', ');') },
  session: S6, sessionHighlight: [lineOf(S6, '=*> INSERT'), lineOf(S6, '=*> ROLLBACK')],
  side: [
    {
      type: 'group', id: 'who', title: 'Who answers what you type', icon: 'workflow', tone: 'ingest', dir: 'row', children: [
        {
          type: 'table', id: 'client', title: 'psql answers', columns: ['you type'], rows: [
            { id: 'd', cells: ['\\d ref.branches'] }, { id: 'q', cells: ['\\q  \\i  \\x'] },
          ],
        },
        {
          type: 'table', id: 'server', title: 'the server answers', tone: 'store', columns: ['what arrives'], rows: [
            { id: 'cat', cells: ['catalogue queries'] }, { id: 'sql', cells: ['SQL: BEGIN, INSERT…'] },
          ],
        },
      ],
    },
    {
      type: 'table', id: 'prompts', title: 'The prompt tells you the state', tone: 'neutral', columns: ['prompt', 'means'], rows: [
        ['syndica=>', 'ready for a new statement'],
        ['syndica->', 'the statement goes on'],
        ["syndica(>  syndica'>", 'inside brackets / a quote'],
        { id: 'tx', cells: ['syndica=*>', 'inside a transaction'], tone: 'store' },
        { id: 'fail', cells: ['syndica=!>', 'the transaction failed'], tone: 'consume' },
        ['syndica=#', 'a superuser'],
      ],
    },
    {
      type: 'group', id: 'tx', title: 'BEGIN … ROLLBACK', icon: 'workflow', tone: 'store', dir: 'row', children: [
        { type: 'item', id: 'b', title: 'BEGIN', sub: 'the star appears' },
        { type: 'item', id: 'i', title: 'INSERT York', sub: output(S6, "'YRK'")[0] },
        { type: 'item', id: 'r', title: 'ROLLBACK', sub: 'undone: York never existed', tone: 'store' },
      ],
    },
  ],
  edges: [{ from: 'client.d', to: 'server.cat', label: 'becomes' }, { from: 'b', to: 'i' }, { from: 'i', to: 'r' }],
})

// §7 — the first errors.
const K7 = 'start/07-errors'
const S7 = session(K7)
const state = grab(S7, /^(\d{5})$/m)
const errors = ideFrame({
  tree: tree(K7), editor: { file: F4, code: file(K7, F4), highlight: [lineOf(file(K7, F4), 'city ')] },
  session: S7, sessionHighlight: [lineOf(S7, "syndica'>"), ...linesFrom(S7, 'ERROR:', 'HINT:')],
  side: [
    {
      type: 'table', id: 'parts', title: 'Anatomy of an error', tone: 'consume', columns: ['part', 'tells you'], rows: [
        ['ERROR:', 'the statement was refused; nothing changed'],
        ['LINE 1:', 'the line it stopped on'],
        ['^', 'where in the line'],
        ['HINT:', "the server's best guess at the fix"],
        { id: 'code', cells: [`SQLSTATE ${state}`, 'the code a program checks'], tone: 'store' },
      ],
    },
    {
      type: 'group', id: 'quote', title: 'The quote that never closed', icon: 'search', tone: 'consume', children: [
        { type: 'item', id: 'q1', title: "code = 'LDS;", sub: 'psql waits: the prompt turns to syndica\'>' },
        { type: 'item', id: 'q2', title: "the string became 'LDS;↵'", sub: 'the closing quote came a line later' },
        { type: 'item', id: 'q3', title: result(S7, "code = 'LDS;").rows.length === 0 ? 'no branch matched: (0 rows)' : 'rows matched', sub: 'no error — a wrong answer, silently', tone: 'consume' },
      ],
    },
  ],
  edges: [{ from: 'q1', to: 'q2' }, { from: 'q2', to: 'q3' }],
})

export const startScenes: Record<string, SceneModel> = {
  'start-spreadsheets': spreadsheets,
  'start-project': project,
  'start-server': server,
  'start-first-table': firstTable,
  'start-anatomy': anatomy,
  'start-psql': psql,
  'start-errors': errors,
}
