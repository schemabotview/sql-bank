#!/usr/bin/env node
// Combine every recorded section into the single YouTube film (COURSE-PLAN §"Packaging"): one
// video, all 10 courses, no break in the middle.
//
// The segments under scripts/segments/ are all produced by one encoder path (same SPS/PPS, 30fps
// CFR, 90k timescale, AAC 44.1k mono), so the concat is a stream copy — no re-encode, no quality
// loss. Chapter offsets are accumulated from each segment's PROBED duration, never from wav
// arithmetic, so they cannot drift away from the film they index.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { loadRegistry } from './registry.mjs'

const run = promisify(execFile)
const repoDir = process.cwd()
const dataDir = join(repoDir, 'scripts')
const FFMPEG = process.env.FFMPEG ?? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ?? 'ffmpeg'

const TITLE = 'Learn SQL by building a bank database: full course, beginner to professional'
const pad2 = (n) => String(n).padStart(2, '0')
const stamp = (sec) => {
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${h}:${pad2(m)}:${pad2(s % 60)}`
}

const readJson = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
const concept = readJson('concept.json')
const { _comment, ...PUBLISH_TITLES } = readJson('titles.json')

async function probe(f) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v',
    '-show_entries', 'stream=duration', '-of', 'default=nw=1:nk=1', f])
  return parseFloat(stdout.trim())
}

const reg = await loadRegistry()
const courses = Object.values(reg.COURSES)
const outDir = join(dataDir, 'out')
mkdirSync(outDir, { recursive: true })

// Walk the syllabus in order, pairing each section with the segment the recorder named for it.
const items = []
for (const course of courses) {
  course.sections.forEach((section, i) => {
    const seg = join(dataDir, 'segments', course.id, `${pad2(i + 1)}-${section.id}.mp4`)
    if (!existsSync(seg)) throw new Error(`missing segment: ${seg} — record ${course.id} first`)
    items.push({ course, section, seg, first: i === 0 })
  })
}

console.log(`Film: ${items.length} sections across ${courses.length} courses`)

let t = 0
const chapters = []
for (const it of items) {
  chapters.push({
    start: t,
    title: it.first ? `▸ ${it.course.title} — ${it.section.title}` : it.section.title,
  })
  t += await probe(it.seg)
}

// The description is derived from the segments, not from the film, so it can be rewritten after a
// title or chapter edit without paying for the concat and the loudness pass again.
const DESC_ONLY = process.argv.includes('--desc-only')

const listFile = join(dataDir, '.tmp', 'film-concat.txt')
mkdirSync(join(dataDir, '.tmp'), { recursive: true })
writeFileSync(listFile, items.map((i) => `file '${i.seg.replace(/'/g, "'\\''")}'`).join('\n') + '\n')

const out = join(outDir, 'film.mp4')
const raw = join(dataDir, '.tmp', 'film-raw.mp4')

async function buildFilm() {
  console.log(`Merging → ${stamp(t)}`)
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-c', 'copy', '-movflags', '+faststart', raw], { maxBuffer: 1 << 26 })

  // Chatterbox lands every wav close to -18 LUFS, so nothing per-section is needed — but that is
  // ~4dB under YouTube's -14 target (which only attenuates, never boosts) and the wavs peak just
  // over 0 dBTP, which clips through AAC. One LINEAR pass fixes both: a constant gain, so the
  // narration's own dynamics are untouched. Two-pass, because single-pass loudnorm is dynamic.
  console.log('Measuring loudness …')
  const { stderr: m } = await run(FFMPEG, ['-i', raw, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
    '-f', 'null', '-'], { maxBuffer: 1 << 26 })
  const meas = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1))
  console.log(`  in ${meas.input_i} LUFS, tp ${meas.input_tp} dBTP → -14 LUFS, tp -1 dBTP`)
  const norm = `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${meas.input_i}:measured_TP=${meas.input_tp}`
    + `:measured_LRA=${meas.input_lra}:measured_thresh=${meas.input_thresh}:offset=${meas.target_offset}:linear=true`
  console.log('Normalising audio (video copied) …')
  await run(FFMPEG, ['-y', '-i', raw, '-c:v', 'copy', '-af', norm,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    '-movflags', '+faststart', out], { maxBuffer: 1 << 26 })
}

if (DESC_ONLY) console.log('--desc-only: leaving scripts/out/film.mp4 alone, rewriting the description')
else await buildFilm()

// The description. The chapter list is the spine of it; the series block below is the same shape
// @graphlearning/shell's gen-descriptions writes for a single course, so the film's page and the
// per-course pages read as one channel.
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫']
const RULE = '━━━━━━━━━━━━━━━━'
const link = (id) => `${concept.site}${concept.appPath}/#/${id}`
const desc = [
  TITLE,
  RULE,
  `${items.length} sections, ${courses.length} courses, ${stamp(t)}. One database, built from empty to`,
  'secured: schema and keys, queries and joins, window functions, transactions and locks, indexes',
  'and plans, roles and row-level security.',
  '',
  `Every statement is really run on PostgreSQL 18.6 — every banner, result, error and query plan`,
  'you see is real output, replayed from one continuous database, never typed by hand.',
  RULE,
  '⏱ CHAPTERS',
  ...chapters.map((c) => `${stamp(c.start)} ${c.title}`),
  RULE,
  `▶ ${concept.concept.toUpperCase()} — THE COURSES`,
  ...courses.map((c, i) =>
    `${CIRCLED[i] ?? '•'} ${PUBLISH_TITLES[c.id] ?? c.title} → ${link(c.id)}`),
  RULE,
  `🔗 Watch interactively on GraphL → ${concept.site}${concept.appPath}/`,
  `🌐 More concepts → ${concept.site}`,
  RULE,
  concept.hashtags,
].join('\n') + '\n'
writeFileSync(join(outDir, 'film.txt'), desc)

const real = existsSync(out) ? await probe(out) : t
if (!DESC_ONLY) console.log(`\n✅ scripts/out/film.mp4  ${stamp(real)}`)
console.log(`✅ scripts/out/film.txt  ${chapters.length} chapters, ${stamp(t)}`)
if (Math.abs(real - t) > 0.5) console.warn(`⚠ film ${real.toFixed(2)}s vs chapters ${t.toFixed(2)}s`)
