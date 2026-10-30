import type { Code, Edge, Group, SceneModel, SceneNode, Tree, TreeEntry } from '@graphlearning/graphl-flow'
import { SCENE_ASPECT } from '@graphlearning/shell'

// The frames every section is built from — ported from python-expense-tracker's ide.ts, with the
// terminal as a REAL psql console (graphl-flow `console: true`: prompts are drawn, nothing is marked).
// ONE fixed template per frame, so every pane sits at the same pixels in every section:
//
//   IDE       explorer (EXPLORER_W) | editor (EDITOR_W × EDITOR_H)  | side pane (SIDE_W)
//                                   | psql console under it
//   timeline  session A (TIMELINE_W) | session B (TIMELINE_W) | side pane (TIMELINE_W)
//
// Every column is a FIXED width (`w`), so content wider than its column overflows (check-render fails
// it) instead of moving the frame; heights are floors (minH), with check-content holding each pane to
// the rows it fits. graphl-flow's fit is a pure function of the natural box: equal boxes, equal zoom.
//
// Sizes (graphl-flow, 15px/1.6 Plex Mono, 9.0px advance, 24px rows), as python-expense-tracker measured:
//   EDITOR_W  80 columns × 9.0px + 49px gutter + 16px right padding + 2px borders = 787
//   EDITOR_H  EDITOR_ROWS × 24px + CHROME (tab bar, body padding, borders)
// The frame's height follows from SCENE_ASPECT (16:9, the shell's), so the template fills the frame.

const ROW = 24 // a code or console row
const CHROME = 51 // a code pane's tab bar, body padding and borders
const GAP = 10 // graphl-flow's GAP between siblings
export const EXPLORER_W = 280
export const EDITOR_COLS = 80
export const EDITOR_W = 787
// 16, not python-expense-tracker's 23: SQL files are short and psql transcripts long, so the editor
// gives rows to the console (20). One template still — every frame keeps one fit.
export const EDITOR_ROWS = 16
export const EDITOR_H = EDITOR_ROWS * ROW + CHROME
export const SIDE_W = 649
export const FRAME_W = EXPLORER_W + EDITOR_W + SIDE_W + 2 * GAP
export const FRAME_H = Math.round(FRAME_W / SCENE_ASPECT)
export const TERMINAL_H = FRAME_H - GAP - EDITOR_H
export const TERMINAL_ROWS = Math.floor((TERMINAL_H - CHROME) / ROW)
/** The timeline frame: three equal columns. A session pane is TIMELINE_COLS wide (scripts/spine.py). */
export const TIMELINE_W = Math.floor((FRAME_W - 2 * GAP) / 3)
export const TIMELINE_COLS = 60
export const TIMELINE_ROWS = Math.floor((FRAME_H - CHROME) / ROW)

/** The project folder, as the explorer heads it and the shell prompt shows it. */
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
  show?: [number, number][]
  highlight?: number[]
  lang?: Code['lang']
}

export interface IdeFrame {
  tree: TreeEntry[]
  /** The SQL file the step adds or reads. A step with no file shows the last one written. */
  editor: Editor
  /** The step's session.txt — a real psql transcript, shown as it is. */
  session: string
  /** Lines of the console to tint (1-based), found by text with `lineOf`. */
  sessionHighlight?: number[]
  /** Fold the console to these line ranges (a banner, a long result) — never retype it shorter. */
  sessionShow?: [number, number][]
  /** The side pane: a diagram (check-content fails a side pane with no edge, plot or table). */
  side: SceneNode[]
  /** Edges between nodes INSIDE the side pane. An edge between panes would widen a gap and move them. */
  edges?: Edge[]
}

// Fixed ids: a section's `focus` can name `editor.L12`, `terminal.L3`, or any id in the side pane.
export const IDE_IDS = { explorer: 'explorer', editor: 'editor', terminal: 'terminal', side: 'side' } as const
export const TIMELINE_IDS = { a: 'session-a', b: 'session-b', side: 'side' } as const

export function ideFrame({ tree, editor, session, sessionHighlight, sessionShow, side, edges = [] }: IdeFrame): SceneModel {
  const explorer: Tree = { type: 'tree', id: IDE_IDS.explorer, title: PROJECT, entries: tree, fill: true, w: EXPLORER_W }
  const code: Code = {
    type: 'code', id: IDE_IDS.editor, filename: editor.file, lang: editor.lang ?? 'sql', code: verbatim(editor.code),
    show: editor.show, highlight: editor.highlight, tone: 'ingest', fill: true, w: EDITOR_W, minH: EDITOR_H,
  }
  const term: Code = {
    type: 'code', id: IDE_IDS.terminal, console: true, cols: EDITOR_COLS, filename: PROMPT_TITLE, code: verbatim(session),
    highlight: sessionHighlight, show: sessionShow, fill: true, w: EDITOR_W, minH: TERMINAL_H,
  }
  // spread: the pane's cards are spaced down its full height, so a diagram fills the column instead
  // of sitting at the top of an empty one (check-render's SIDE_FILL).
  const pane: Group = { type: 'group', id: IDE_IDS.side, bare: true, spread: true, w: SIDE_W, minH: FRAME_H, children: side }
  return {
    dir: 'row',
    nodes: [explorer, { type: 'group', id: 'workbench', bare: true, children: [code, term] }, pane],
    edges,
  }
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
    fill: true, w: TIMELINE_W, minH: FRAME_H,
  })
  return {
    dir: 'row',
    nodes: [
      pane(TIMELINE_IDS.a, 'session A', a, highlightA),
      pane(TIMELINE_IDS.b, 'session B', b, highlightB),
      { type: 'group', id: TIMELINE_IDS.side, bare: true, spread: true, w: TIMELINE_W, minH: FRAME_H, children: side },
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
