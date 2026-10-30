import type { TreeEntry } from '@graphlearning/graphl-flow'
import { STEPS, type Step } from '../spine.gen'

// Scenes read the spine through here, never by importing transcript files one by one: src/spine.gen.ts
// (written by scripts/spine.py --write) holds every step in course order, so the explorer can be
// DERIVED — syndica-db/ is exactly the files every step up to this one added.

/** A step by its key, `<course>/<NN-step>`. A missing step throws (check-render reports it). */
export function step(key: string): Step {
  const s = STEPS[key]
  if (!s) throw new Error(`spine.ts: no step ${key} — run scripts/spine.py --write`)
  return s
}

/** The step's single transcript. */
export const session = (key: string): string => {
  const s = step(key).session
  if (s === undefined) throw new Error(`spine.ts: ${key} has no session.txt (a timeline step has session-a/-b)`)
  return s
}

/** A file in syndica-db/ as the spine holds it, from whichever step added it, up to `key`. */
export function file(key: string, path: string): string {
  for (const k of upTo(key)) if (path in STEPS[k].files) return STEPS[k].files[path]
  throw new Error(`spine.ts: no step up to ${key} added ${path}`)
}

function upTo(key: string): string[] {
  const keys = Object.keys(STEPS)
  const i = keys.indexOf(key)
  if (i < 0) throw new Error(`spine.ts: no step ${key}`)
  return keys.slice(0, i + 1)
}

/**
 * The explorer at `key`: every file added up to it, folders first then files, alphabetical. Files the
 * step itself added are `new`; `active` is the file open in the editor.
 */
export function tree(key: string, active?: string): TreeEntry[] {
  const added = new Set(Object.keys(step(key).files))
  const root: TreeEntry[] = []
  for (const k of upTo(key))
    for (const path of Object.keys(STEPS[k].files)) {
      const parts = path.split('/')
      let level = root
      parts.forEach((name, i) => {
        const leaf = i === parts.length - 1
        let entry = level.find((e) => e.name === name)
        if (!entry) {
          entry = leaf ? { name } : { name, children: [] }
          level.push(entry)
        }
        if (leaf) entry.state = path === active ? 'active' : added.has(path) ? 'new' : undefined
        else level = entry.children!
      })
    }
  const sort = (es: TreeEntry[]): TreeEntry[] =>
    es.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name)).map((e) => (e.children ? { ...e, children: sort(e.children) } : e))
  return sort(root)
}
