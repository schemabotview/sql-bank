import type { SceneModel } from '@graphlearning/graphl-flow'
import { startScenes } from './start'
import { designScenes } from './design'
import { buildScenes } from './build'
import { queryScenes } from './query'
import { combineScenes } from './combine'
import { analyseScenes } from './analyse'
import { changeScenes } from './change'
import { concurrencyScenes } from './concurrency'
import { performScenes } from './perform'

// Scene registry. Sections reference scenes by id; the id is the key here. One Record per course
// folder (mirroring src/content); a duplicate id THROWS rather than letting one shadow another.
const GROUPS: Record<string, SceneModel>[] = [startScenes, designScenes, buildScenes, queryScenes, combineScenes, analyseScenes, changeScenes, concurrencyScenes, performScenes]

export const SCENES: Record<string, SceneModel> = {}
for (const group of GROUPS)
  for (const [id, scene] of Object.entries(group)) {
    if (id in SCENES) throw new Error(`scene id "${id}" is registered twice`)
    SCENES[id] = scene
  }

export function getScene(id: string): SceneModel | undefined {
  return SCENES[id]
}
