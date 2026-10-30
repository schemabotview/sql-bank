import type { Edge, SceneModel, SceneNode } from '@graphlearning/graphl-flow'
import { view } from './fold'
import { EDITOR_ROWS, ideFrame, lastLine, lineOf, linesFrom } from './ide'
import { file, session, step, tree } from './spine'

// One IDE section in one call — the shape every query-style section shares: the step's SQL file in
// the editor (the one it added, or the newest before it), its replayed session in the console, and
// a side pane. Highlights are found by TEXT, never typed as line numbers.

export interface Section {
  /** The editor's file; default: the single file the step added. */
  file?: string
  /** Editor lines to tint: a text, or [first, last] texts for a run. */
  lit?: string | [string, string]
  /** Fold a long file to the region starting at the line containing this text. */
  from?: string
  /** Console lines to tint, each found by text. */
  says?: string[]
  side: SceneNode[]
  edges?: Edge[]
}

const lines = (code: string, at: string | [string, string]) => (typeof at === 'string' ? [lineOf(code, at)] : linesFrom(code, at[0], at[1]))

export function sql(key: string, o: Section): SceneModel {
  const path = o.file ?? only(key)
  const code = file(key, path)
  const s = session(key)
  const fold = o.from ? view(code, o.from, undefined, 0) : lastLine(code) > EDITOR_ROWS ? view(code, 'SELECT', undefined, 2) : {}
  return ideFrame({
    tree: tree(key, path),
    editor: { file: path, code, ...fold, highlight: o.lit ? lines(code, o.lit) : undefined },
    session: s,
    sessionHighlight: o.says?.map((t) => lineOf(s, t)),
    side: o.side,
    edges: o.edges,
  })
}

function only(key: string): string {
  const added = Object.keys(step(key).files)
  if (added.length !== 1) throw new Error(`section.ts: ${key} added ${added.length} files — name the editor's file`)
  return added[0]
}
