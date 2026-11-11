import type { Code, Edge, Group, SceneModel, SceneNode, Tree, TreeEntry } from '@graphlearning/graphl-flow'

// The frames every section is built from — two templates, each with its own fixed geometry:
//
//   IDE (frame v2)   explorer (EXPLORER_W) | editor (WORK_W) over the psql console | side pane
//                    (SIDE_W), TITLED with the section's mental model
//   timeline (v1)    session A (TIMELINE_W) | session B (TIMELINE_W) | side pane (TIMELINE_W)
//
// IDE frame v2 is graphl-flow 0.11's shared grid — 1344 × 756 at a 1% margin — in
// spark-ecommerce-analytics' layout (2026-11-11, the explorer restored): compact explorer 175 | a
// 715 work column of 72 columns | side pane 434, so every IDE frame lands on ONE fit and the explorer
// and the side pane never move. The runner records psql at 80 columns; the console here is 72, so a
// result row wider than 72 is cut where a 72-column terminal would wrap it (`wrapConsole`), and a
// typed statement is left whole for graphl-flow's console to wrap at its `cols`. `sessionShow` and
// `sessionHighlight` name the transcript's own rows and are carried onto the wrapped ones.
// The editor and the console share ROWS rows: the console takes exactly its rows (folded with
// `sessionShow`/autoShow to fit), the editor the rest.
//
// The timeline frame keeps v1's template and its own fit: two 60-column sessions (the runner's width)
// side by side need 1154px, and their transcripts run to 33 rows; neither fits the 1344 × 756 grid
// without re-recording every timeline. It is checked as its own kind (check-render).

const ROW = 24 // a code or console row
const CHROME = 51 // a code pane's tab bar, body padding and borders
const GAP = 10 // graphl-flow's GAP between siblings
export const FULL_W = 1344
export const FRAME_H = Math.round(FULL_W / (16 / 9))
export const SIDE_W = 434
export const WORK_W = 715
export const EXPLORER_W = FULL_W - (WORK_W + GAP + SIDE_W) - GAP
/** The console's columns (and the editor's soft-wrap point, beside its gutter). */
export const EDITOR_COLS = 72
/** The editor's soft-wrap point: 71 columns fit 715px beside the line-number gutter. */
const EDITOR_WRAP = 71
/** Rows the editor and the console share: (FRAME_H − GAP − two panes' chrome) / ROW. */
export const ROWS = Math.floor((FRAME_H - GAP - 2 * CHROME) / ROW)
/** The most a console shows (autoShow folds a longer session to this); the editor keeps the rest. */
export const TERMINAL_ROWS = 20
export const MIN_TERMINAL = 6
/** The fewest rows an editor gets: a file's head and its highlighted statement. */
const MIN_EDITOR = 6
/** The most an editor shows: what is left beside the shortest console. */
export const EDITOR_ROWS = ROWS - MIN_TERMINAL
const paneH = (rows: number) => rows * ROW + CHROME

// v1's template, kept for the timeline frame alone.
const V1_W = 280 + 787 + 649 + 2 * GAP
const V1_H = Math.round(V1_W / (16 / 9))
/** The timeline frame: three equal columns. A session pane is TIMELINE_COLS wide (scripts/spine.py). */
export const TIMELINE_W = Math.floor((V1_W - 2 * GAP) / 3)
export const TIMELINE_COLS = 60
export const TIMELINE_ROWS = Math.floor((V1_H - CHROME) / ROW)

/** The project folder, as the shell prompt shows it. */
export const PROJECT = 'syndica-db'
const PROMPT_TITLE = `dbteam@syndica: ~/${PROJECT}`

export const trim = (text: string) => text.replace(/\n+$/, '')

/**
 * Spine text as a code node's `code`. graphl-flow's dedent drops the first line break as a template
 * literal's; spine text has none, so one is supplied — or a transcript that STARTS with blank rows (a
 * timeline pane padded to the other session's first moment) would lose one and shift up.
 */
const verbatim = (text: string) => '\n' + trim(text)

export interface Editor {
  /** The tab label — the file's path in syndica-db/. */
  file: string
  /** The file's text, from the spine (src/spine.gen.ts). */
  code: string
  /** Hand-picked ranges, used only when the highlighted lines do not fit the editor's window. */
  show?: [number, number][]
  highlight?: number[]
  lang?: Code['lang']
}

export interface IdeFrame {
  /** The side pane's title: the section's mental model, in a few words. */
  model: string
  /** syndica-db/ as every file added up to the step (spine.ts `tree`): the compact explorer. */
  tree?: TreeEntry[]
  /** The SQL file the step adds or reads. A step with no file shows the last one written. */
  editor: Editor
  /** The step's session.txt — a real psql transcript, shown as it is. */
  session: string
  /** Lines of the console to tint (1-based), found by text with `lineOf`. */
  sessionHighlight?: number[]
  /** Fold the console to these line ranges (a banner, a long result) — never retype it shorter. */
  sessionShow?: [number, number][]
  /** The mental model: ONE diagram (edges or a plot), at most one table outside it (check-content). */
  side: SceneNode[]
  /** Edges between nodes INSIDE the side pane. An edge between panes would widen a gap and move them. */
  edges?: Edge[]
}

// Fixed ids: a section's `focus` can name `editor.L12`, `terminal.L3`, or any id in the side pane.
// The workbench's id is `ide-bench` (v1's was `workbench`).
export const IDE_IDS = { explorer: 'explorer', editor: 'editor', terminal: 'terminal', side: 'side' } as const
export const TIMELINE_IDS = { a: 'session-a', b: 'session-b', side: 'side' } as const

/**
 * A console fold for a session longer than TERMINAL_ROWS: each result's `(n rows)` line and the blank
 * after it fold to ONE row (saving one), from the top, only as many as needed; if that is not enough,
 * a result's column header and its ---- rule fold too, from the last result up. Nothing is retyped;
 * a session that still does not fit is check-content's to report.
 */
export function autoShow(session: string, limit = TERMINAL_ROWS): [number, number][] | undefined {
  const rows = trim(session).split('\n')
  const over = rows.length - limit
  if (over <= 0) return undefined
  // first resort: `(n rows)` + blank, from the top; then a result's header + rule, from the bottom
  const folds: number[] = []
  for (let i = 0; i + 1 < rows.length && folds.length < over; i++)
    if (/^\(\d+ rows?\)$/.test(rows[i]) && rows[i + 1] === '') folds.push(i + 1) // 1-based
  for (let i = rows.length - 2; i > 0 && folds.length < over; i--)
    if (/^-+(\+-+)*$/.test(rows[i + 1]) && !folds.some((f) => Math.abs(f - (i + 1)) < 2)) folds.push(i + 1)
  // last resort (frame v2's shorter console): the middle of a long typed statement — its continuation
  // rows (`syndica->`, `syndica(>`) between the first and the last — folds to one row, from the top
  const runs: [number, number][] = []
  const cont = (i: number) => /^\w+[-('"]>/.test(rows[i] ?? '')
  for (let i = 0; i < rows.length && folds.length + runs.reduce((n, [a, b]) => n + b - a, 0) < over; i++) {
    if (!cont(i)) continue
    let j = i
    while (cont(j + 1)) j++
    // keep the first and last continuation rows; fold [i+1, j-1] when it is at least 2 rows
    if (j - 1 - (i + 1) >= 1 && !folds.some((f) => f >= i && f <= j + 1)) runs.push([i + 2, j]) // 1-based, inclusive
    i = j
  }
  const hidden = new Set<number>()
  for (const f of folds) { hidden.add(f); hidden.add(f + 1) }
  for (const [a, b] of runs) for (let k = a; k <= b; k++) hidden.add(k)
  const show: [number, number][] = []
  let start = 0
  for (let k = 1; k <= rows.length + 1; k++) {
    const shown = k <= rows.length && !hidden.has(k)
    if (shown && !start) start = k
    if (!shown && start) { show.push([start, k - 1]); start = 0 }
  }
  return show
}

/** Rows one editor line takes, as CSS `pre-wrap` wraps it: at a space (an indent alone may end a
 *  row), a hard cut only inside a longer word. */
function wrappedRows(line: string, width = EDITOR_WRAP): number {
  let rows = 1, rest = line
  while (rest.length > width) {
    const space = rest.lastIndexOf(' ', width)
    rest = rest.slice(space >= 0 ? space + 1 : width)
    rows++
  }
  return rows
}
const rowsOf = (lines: string[], a: number, b: number) => lines.slice(a - 1, b).reduce((n, l) => n + wrappedRows(l), 0)

/** Rows a set of shown ranges takes: each line (wrapped), plus one fold row per skipped run. */
function rowsShown(lines: string[], ranges: [number, number][]): number {
  let rows = 0, next = 1
  for (const [a, b] of ranges) { if (a > next) rows++; rows += rowsOf(lines, a, b); next = b + 1 }
  return rows + (next <= lines.length ? 1 : 0)
}

/** A window of the file around lines first..last that fits `room` rows, folds included. */
function windowFor(lines: string[], first: number, last: number, room: number): [number, number][] | undefined {
  if (rowsOf(lines, 1, lines.length) <= room) return undefined
  const fits = (a: number, b: number) => rowsOf(lines, a, b) + (a > 1 ? 1 : 0) + (b < lines.length ? 1 : 0) <= room
  if (!fits(first, last)) return undefined
  let a = first, b = last
  for (let grew = true; grew;) {
    grew = false
    if (a > 1 && fits(a - 1, b)) { a--; grew = true }
    if (b < lines.length && fits(a, b + 1)) { b++; grew = true }
  }
  return [[a, b]]
}

/** Hand-picked ranges grown, one line at a time, until the editor is full; THROWS if they do not fit. */
function grow(lines: string[], ranges: [number, number][], room: number): [number, number][] {
  const merge = (rs: [number, number][]) => rs.reduce<[number, number][]>((out, [a, b]) => {
    const last = out[out.length - 1]
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b); else out.push([a, b])
    return out
  }, [])
  let r = merge(ranges.map(([a, b]) => [a, b] as [number, number]).sort((x, y) => x[0] - y[0]))
  if (rowsShown(lines, r) > room) throw new Error(`ide.ts: the shown ranges ${JSON.stringify(r)} take ${rowsShown(lines, r)} rows, the editor has ${room}`)
  for (let grew = true; grew;) {
    grew = false
    for (let i = 0; i < r.length && !grew; i++) for (const side of [1, 0] as const) {
      const t = r.map(([a, b]) => [a, b] as [number, number])
      if (side === 1 && t[i][1] < lines.length) t[i][1]++
      else if (side === 0 && t[i][0] > 1) t[i][0]--
      else continue
      const m = merge(t)
      if (rowsShown(lines, m) <= room) { r = m; grew = true; break }
    }
  }
  return r
}

/** A psql prompt row (`syndica=> `, `syndica-> `, `syndica=*> `, `syndica'> `, `$ `): typed, so the
 *  console wraps it itself at its `cols`. */
const PROMPT = /^(\$ |\w+[=\-'"(]\*?[>#])/

/**
 * The runner's 80-column transcript on the 72-column console: an output row wider than EDITOR_COLS is
 * cut where a 72-column terminal would wrap it, each piece a row; a typed row stays whole (graphl-flow
 * wraps it). `span[i]` is the [first, last] console row of transcript row i + 1, so a fold or a tint
 * found on the transcript lands on the same lines.
 */
export function wrapConsole(session: string): { text: string; span: [number, number][] } {
  const out: string[] = []
  const span: [number, number][] = []
  for (const row of trim(session).split('\n')) {
    const first = out.length + 1
    if (PROMPT.test(row) || row.length <= EDITOR_COLS) out.push(row)
    else out.push(...(row.match(new RegExp(`.{1,${EDITOR_COLS}}`, 'g')) ?? ['']))
    span.push([first, out.length])
  }
  return { text: out.join('\n'), span }
}

/** Rows a console draws: its lines (a typed one wraps at EDITOR_COLS), or its `show` ranges with each
 *  skipped run folded to one row. */
function consoleRows(text: string, show?: [number, number][]): number {
  const lines = trim(text).split('\n')
  const tall = (a: number, b: number) => lines.slice(a - 1, b).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / EDITOR_COLS)), 0)
  if (!show) return tall(1, lines.length)
  let rows = 0, next = 1
  for (const [a, b] of show) { if (a > next) rows++; rows += tall(a, b); next = b + 1 }
  return rows + (next <= lines.length ? 1 : 0)
}

/* PORTING */ export function ideFrame(f: IdeFrame): SceneModel { try { return build(f) } catch (e) { console.error('FRAME ' + f.editor.file + ' ' + (e as Error).message); return { nodes: [] } } }
function build({ model, tree = [], editor, session: transcript, sessionHighlight, sessionShow, side, edges = [] }: IdeFrame): SceneModel {
  const { text: session, span: rowsOfLine } = wrapConsole(transcript)
  const carry = ([a, b]: [number, number]): [number, number] => [rowsOfLine[a - 1][0], rowsOfLine[b - 1][1]]
  sessionShow = sessionShow?.map(carry)
  sessionHighlight = sessionHighlight?.flatMap((n) => { const [a, b] = rowsOfLine[n - 1]; return Array.from({ length: b - a + 1 }, (_, i) => a + i) })
  const code = trim(editor.code)
  const lines = code.split('\n')
  const hl = editor.highlight ?? []
  // The editor keeps room for its highlighted lines (and a fold row each side); the console takes the
  // rest, up to TERMINAL_ROWS, and a longer session is folded by autoShow to fit — never retyped.
  const [lo, hi] = [Math.min(...hl), Math.max(...hl)]
  const span = hl.length ? Math.min(rowsOf(lines, 1, lines.length), rowsOf(lines, lo, hi) + (lo > 1 ? 1 : 0) + (hi < lines.length ? 1 : 0)) : 0
  const need = hl.length && editor.show ? Math.min(span, rowsShown(lines, editor.show)) : span
  const limit = Math.min(TERMINAL_ROWS, ROWS - Math.max(need, MIN_EDITOR))
  // autoShow counts transcript lines; a typed statement the console wraps takes more, so fold deeper
  // until the rows drawn fit.
  for (let fold = limit; !sessionShow || consoleRows(session, sessionShow) > limit; fold--) {
    if (sessionShow && fold < MIN_TERMINAL) break
    const s = autoShow(session, fold)
    if (!s) { if (consoleRows(session) <= limit) break; continue }
    sessionShow = s
    if (consoleRows(session, s) <= limit) break
  }
  // Last resort: the middle of the longest output run folds to one row (its first and last rows
  // kept), as many rows as the console is over — a result is never retyped, only shown in part.
  for (let left = consoleRows(session, sessionShow) - limit; left > 0; left = consoleRows(session, sessionShow) - limit) {
    const next = foldLongest(session, sessionShow, Math.min(left, 3))
    if (!next || consoleRows(session, next) >= consoleRows(session, sessionShow)) break
    sessionShow = next
  }
  const termRows = Math.max(MIN_TERMINAL, consoleRows(session, sessionShow))
  if (termRows > limit) throw new Error(`ide.ts "${model}": the console shows ${termRows} rows, it has ${limit} beside the editor — fold with sessionShow`)
  const editorRows = ROWS - termRows
  // A window around the highlight when it fits; the hand-picked `show` only when it does not (or when
  // nothing is highlighted), grown to fill the editor. A `show` that does not fit THROWS.
  let show: [number, number][] | undefined
  if (rowsOf(lines, 1, lines.length) > editorRows) {
    // Nothing highlighted: the window starts where the hand-picked `show` does (the region the
    // section is about), and runs as far as the editor holds.
    const at = editor.show?.[0][0] ?? 1
    show = hl.length ? windowFor(lines, Math.min(...hl), Math.max(...hl), editorRows) : windowFor(lines, at, at, editorRows)
    if (!show) {
      if (!editor.show && hl.length) throw new Error(`ide.ts "${model}": lines ${Math.min(...hl)}–${Math.max(...hl)} do not fit ${editorRows} rows — give the editor a show`)
      try { show = grow(lines, editor.show ?? [[1, 1]], editorRows) } catch (e) { throw new Error(`"${model}": ${(e as Error).message}`) }
    }
  }
  const ed: Code = {
    type: 'code', id: IDE_IDS.editor, filename: editor.file, lang: editor.lang ?? 'sql', code: verbatim(code), wrap: true,
    highlight: hl, tone: 'ingest', fill: true, w: WORK_W, minH: paneH(editorRows), ...(show && { show }),
  }
  const term: Code = {
    type: 'code', id: IDE_IDS.terminal, console: true, cols: EDITOR_COLS, filename: PROMPT_TITLE, code: verbatim(session),
    highlight: sessionHighlight, show: sessionShow, fill: true, w: WORK_W, minH: FRAME_H - GAP - paneH(editorRows),
  }
  // spread: the pane's blocks are spaced down its full height (check-render: filled ≥ 1/2).
  const pane: Group = { type: 'group', id: IDE_IDS.side, title: model, tone: 'ingest', spread: true, w: SIDE_W, minH: FRAME_H, children: side }
  const explorer: Tree = { type: 'tree', id: IDE_IDS.explorer, title: PROJECT, entries: compact(tree), compact: true, fill: true, w: EXPLORER_W, minH: FRAME_H }
  return { dir: 'row', padding: 0.01, nodes: [explorer, { type: 'group', id: 'ide-bench', bare: true, children: [ed, term] }, pane], edges }
}

export interface TimelineFrame {
  /** session-a.txt and session-b.txt: real transcripts, row-aligned by the runner (a row is a moment). */
  a: string
  b: string
  highlightA?: number[]
  highlightB?: number[]
  side: SceneNode[]
  edges?: Edge[]
}

export function timelineFrame({ a, b, highlightA, highlightB, side, edges = [] }: TimelineFrame): SceneModel {
  const pane = (id: string, title: string, text: string, highlight?: number[]): Code => ({
    type: 'code', id, console: true, cols: TIMELINE_COLS, filename: title, code: verbatim(text), highlight,
    fill: true, w: TIMELINE_W, minH: V1_H,
  })
  return {
    dir: 'row',
    nodes: [
      pane(TIMELINE_IDS.a, 'session A', a, highlightA),
      pane(TIMELINE_IDS.b, 'session B', b, highlightB),
      { type: 'group', id: TIMELINE_IDS.side, bare: true, spread: true, w: TIMELINE_W, minH: V1_H, children: side },
    ],
    edges,
  }
}

/**
 * The 1-based number of the first line of `code` containing `text`, searching from line `from`.
 * Highlights and folds are found by TEXT, never typed as numbers — in a continuous spine every
 * transcript moves when an earlier step changes. A missing text throws (check-render reports it).
 */
export function lineOf(code: string, text: string, from = 1): number {
  const lines = code.split('\n')
  for (let i = from - 1; i < lines.length; i++) if (lines[i].includes(text)) return i + 1
  throw new Error(`ide.ts: no line containing ${JSON.stringify(text)} from line ${from}`)
}

/** Every line number from the line containing `first` through the next line containing `last`. */
export function linesFrom(code: string, first: string, last = first): number[] {
  const a = lineOf(code, first), b = lineOf(code, last, a)
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/** The last line number of `code` (ignoring a trailing newline). */
export const lastLine = (code: string) => trim(code).split('\n').length

/** The compact explorer (175px): a name too long for its level is cut in the middle, its extension
 *  kept (the editor's tab has the whole path); ~19 characters fit at the top level, about one and a
 *  half fewer a level down. A note (v1's aside) is dropped. */
function compact(entries: TreeEntry[], depth = 0): TreeEntry[] {
  const fit = (name: string) => {
    const room = 19 - Math.ceil(depth * 1.5)
    if (name.length <= room) return name
    const dot = name.lastIndexOf('.'), ext = dot > 0 ? name.slice(dot) : ''
    return name.slice(0, room - ext.length - 1) + '…' + ext
  }
  return entries.map(({ note: _note, children, ...e }) => ({ ...e, name: fit(e.name), ...(children && { children: compact(children, depth + 1) }) }))
}

/** Fold `over` + 1 rows out of the middle of the longest run of output rows still shown (one fold row
 *  replaces them), keeping the run's first and last rows. */
function foldLongest(text: string, show: [number, number][] | undefined, over: number): [number, number][] | undefined {
  const lines = trim(text).split('\n')
  const shown = new Set<number>()
  for (const [a, b] of show ?? [[1, lines.length]]) for (let k = a; k <= b; k++) shown.add(k)
  let best: [number, number] | undefined
  for (let k = 1; k <= lines.length; k++) {
    if (!shown.has(k) || PROMPT.test(lines[k - 1])) continue
    let j = k
    while (j + 1 <= lines.length && shown.has(j + 1) && !PROMPT.test(lines[j])) j++
    if (!best || j - k > best[1] - best[0]) best = [k, j]
    k = j
  }
  if (!best || best[1] - best[0] + 1 < 4) return show
  over = Math.min(over, best[1] - best[0] - 2)
  const mid = Math.max(best[0] + 1, Math.floor((best[0] + best[1]) / 2) - Math.floor(over / 2))
  for (let k = mid; k <= mid + over; k++) shown.delete(k)
  const out: [number, number][] = []
  let start = 0
  for (let k = 1; k <= lines.length + 1; k++) {
    const on = shown.has(k)
    if (on && !start) start = k
    if (!on && start) { out.push([start, k - 1]); start = 0 }
  }
  return out
}
