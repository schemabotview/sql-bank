import { start } from './start'
import { design } from './design'
import { build } from './build'
import { query } from './query'
import { combine } from './combine'
import type { Course, Section } from './types'

// Course registry, in COURSE-PLAN.md order. A course is registered here only once it is authored.
export const COURSES: Record<string, Course> = {
  [start.id]: start,
  [design.id]: design,
  [build.id]: build,
  [query.id]: query,
  [combine.id]: combine,
}

export type { Course, Section }

// The slug rule (`<courseId>-<sectionId>`) is the shell's: it is part of the route contract.
export { slugOf, allSections } from '@graphlearning/shell'

export function getCourse(id: string): Course | undefined {
  return COURSES[id]
}
