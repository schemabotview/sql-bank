#!/usr/bin/env node
// The YouTube thumbnail for the single full-course film (scripts/out/film.mp4).
//
// Not the shell's `graphl-thumb`: that template is a PER-COURSE poster (58% scene + panel), and a
// cropped 16:9 video frame turns to mush at the ~168px the mobile feed actually renders. A film
// cover needs poster grammar — few elements, enormous type, one focal object.
//
// The terminal card is REAL: the two tables are read from the design course's own schema scene and
// the join condition from the query file the course really wrote, so the thumbnail cannot promise a
// database the course does not build. --source join | types cut their cards out of spine sessions.
//
// Default is `diagram`: the course's own ER pane, captured from the running app. At the ~168px the
// feed renders, no card TEXT survives in ANY variant — what survives is shape and colour, and four
// tables joined by drawn edges read as a schema where a block of SQL turns to mush. Checked by
// downscaling to 168px and 360px and looking, not by eye at full size.
//
//   diagram  the real build-foreign-keys side pane (default)
//   schema   two tables and their joined key, built here from the design-review scene
//   join     the query file beside the rows it really returned
//   types    the float that is not 0.3 — the biggest single focal object of the four

import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, isAbsolute } from 'node:path'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const repoDir = process.cwd()
const FFMPEG = process.env.FFMPEG ?? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ?? 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const SCALE = 2
const W = 1280 * SCALE
const H = 720 * SCALE

// ── the real output ─────────────────────────────────────────────────────────────────────────────
const JOIN = join(repoDir, 'spine', 'combine', '01-inner')
const DIAGRAM_SLUG = 'build-foreign-keys'
const DIAGRAM_NODE = 'links'
const TYPES = join(repoDir, 'spine', 'design', '06-types', 'session.txt')

/** Split a psql result block into header cells, the rule, and body rows. */
function parseTable(lines, at) {
  const header = lines[at].trim().split(/\s*\|\s*/)
  const rows = []
  for (let i = at + 2; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim() || /^\(\d+ rows?\)/.test(l.trim())) break
    rows.push(l.trim().split(/\s*\|\s*/))
  }
  const count = lines.slice(at).find((l) => /^\(\d+ rows?\)/.test(l.trim()))?.trim() ?? ''
  return { header, rows, count }
}

/**
 * §5.1: the first join. The card pairs the query the course really wrote
 * (files/queries/combine/01-join.sql) with the rows the server really returned (session.txt) —
 * the same editor-beside-console grammar the scenes use.
 */
function realJoin() {
  const sql = readFileSync(join(JOIN, 'files', 'queries', 'combine', '01-join.sql'), 'utf8')
    .split('\n').map((l) => l.trimEnd()).filter((l) => l && !l.startsWith('--'))
  if (!sql.length) throw new Error('no SQL left in 01-join.sql after dropping comments')

  const lines = readFileSync(join(JOIN, 'session.txt'), 'utf8').split('\n').map((l) => l.trimEnd())
  const at = lines.findIndex((l) => /^\s*account_no\s*\|/.test(l))
  if (at < 0) throw new Error('no account_no result table in combine/01-inner/session.txt')
  const { header, rows, count } = parseTable(lines, at)
  if (header.length !== 3 || !rows.length) throw new Error(`unexpected join result: ${header.join('|')}`)
  return { sql, header, rows, count, foot: 'one row per account' }
}

/**
 * §2.6: why money is numeric(14,2). The float that is not 0.3 is the most recognisable surprise a
 * SQL screen can show, and it is this course's own lesson — the ledger is numeric(14,2) because of
 * exactly this line. Both numbers are the server's.
 */
function realTypes() {
  const lines = readFileSync(TYPES, 'utf8').split('\n').map((l) => l.trimEnd())
  const at = lines.findIndex((l) => /^\s*float8\s*\|\s*numeric/.test(l))
  if (at < 0) throw new Error('no float8|numeric result table in design/06-types/session.txt')
  const { header, rows } = parseTable(lines, at)
  const [bad, good] = rows[0] ?? []
  if (!/^0\.30{5,}/.test(bad ?? '')) throw new Error(`no float surprise in the session: "${bad}"`)
  if (good !== '0.3') throw new Error(`no exact numeric 0.3 in the session: "${good}"`)

  const sql = lines.slice(0, at).filter((l) => /^syndica[=-]>/.test(l))
    .map((l) => l.replace(/^syndica[=-]>\s?/, '').trimEnd())
  if (!sql.length) throw new Error('no typed SQL above the float8 table')
  return { sql, header, bad, good, foot: 'why money is numeric(14,2)' }
}

/**
 * The two tables the join actually joins, read from the design course's own schema scene
 * (design-review) through the registry the checks use — so the cover shows the course's columns
 * and types, not a retyped guess: change the scene and the thumbnail follows.
 *
 * The join condition comes from the real query file, and the FK/PK it names are the columns
 * highlighted, so the picture and the SQL beneath it cannot disagree.
 */
async function realSchema() {
  const { loadRegistry, nodesOf } = await import(pathToFileURL(join(repoDir, 'scripts', 'registry.mjs')).href)
  const reg = await loadRegistry()
  const scene = reg.SCENES['design-review']
  if (!scene) throw new Error('no design-review scene — has src/scenes/design changed?')
  const pick = (id) => {
    const hit = nodesOf(scene).find(({ node }) => node.id === id && node.type === 'table')
    if (!hit) throw new Error(`no table "${id}" in design-review`)
    return { name: hit.node.title, cols: hit.node.rows.map((r) => r.cells) }
  }

  // ON b.code = a.branch_code  →  the pair of columns the arrow connects.
  const sql = readFileSync(join(JOIN, 'files', 'queries', 'combine', '01-join.sql'), 'utf8')
  const on = sql.match(/\bON\s+(\S+)\s*=\s*(\S+)/i)
  if (!on) throw new Error('no ON clause in 01-join.sql')
  const colOf = (ref) => ref.split('.').pop()
  const [right, left] = [colOf(on[1]), colOf(on[2])]   // b.code = a.branch_code

  const from = pick('accounts')
  const to = pick('branches')
  if (!from.cols.some(([c]) => c === left)) throw new Error(`${from.name} has no column ${left}`)
  if (!to.cols.some(([c]) => c === right)) throw new Error(`${to.name} has no column ${right}`)

  // How many rows that join really returned, from the session — not a number anyone typed.
  const { rows } = realJoin()
  return { from, to, left, right, on: on[0].replace(/\s+/g, ' '), rows: rows.length }
}

/**
 * The course's OWN ER diagram, captured from the running app rather than rebuilt here: the side
 * pane of build-foreign-keys ("What may point at what"), tables and drawn edges and all.
 *
 * Re-implementing those edges in this file would be a second source of truth that silently drifts
 * from the scenes; a screenshot of the real pane cannot. Captured at a 4K viewport, where the pane
 * is ~1320px wide — comfortably more than the ~733px it occupies in the delivered 1280x720 cover,
 * so it lands as a downscale, never an upscale.
 */
async function realDiagram(puppeteer) {
  const { createServer } = await import(pathToFileURL(createRequire(join(repoDir, 'package.json')).resolve('vite')).href)
  const server = await createServer({ server: { host: '127.0.0.1', port: 5192, strictPort: true }, logLevel: 'silent' })
  await server.listen()
  const browser = await puppeteer.launch({ headless: true,
    defaultViewport: { width: 3840, height: 2160, deviceScaleFactor: 1 } })
  try {
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:5192/?capture=1#/${DIAGRAM_SLUG}`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.gf-scene[data-fit="ready"]', { timeout: 20000 })
    await page.evaluate(() => document.fonts?.ready)
    // Freeze every SVG at t=0 so the capture is reproducible, exactly as scripts/shots.mjs does.
    await page.evaluate(() => document.querySelectorAll('svg').forEach((s) => { s.pauseAnimations?.(); s.setCurrentTime?.(0) }))
    const el = await page.$(`[data-id="${DIAGRAM_NODE}"]`)
    if (!el) throw new Error(`no node "${DIAGRAM_NODE}" in ${DIAGRAM_SLUG} — has src/scenes/build changed?`)
    const box = await el.boundingBox()
    const png = join(tmpdir(), `thumb-pane-${Date.now()}.png`)
    await el.screenshot({ path: png })
    return { png, w: Math.round(box.width), h: Math.round(box.height) }
  } finally {
    await browser.close()
    await server.close()
  }
}

// ── the page ────────────────────────────────────────────────────────────────────────────────────
const fontFace = (fam, weight, file) => {
  const b64 = readFileSync(join(repoDir, 'node_modules', '@fontsource', fam, 'files', file)).toString('base64')
  return `@font-face{font-family:'${fam === 'ibm-plex-mono' ? 'IBM Plex Mono' : 'IBM Plex Sans'}';`
    + `font-weight:${weight};font-style:normal;font-display:block;`
    + `src:url(data:font/woff2;base64,${b64}) format('woff2')}`
}

// The scene engine's tone palette (@graphlearning/graphl-flow), its dark row — the card is dark in
// every theme. Using these instead of invented colours paints the cover like the scenes.
const TONE = {
  store:   { accent: '#37b877' },
  ingest:  { accent: '#4f8ff7' },
  consume: { accent: '#f0656f' },
  serve:   { accent: '#c98bff' },
}

// --brand (src/theme.css) is the teal the app already uses; the accents below are its poster
// weights, not invented brand colours.
const THEMES = {
  dark:  { badgeInk: '#08130f', bg: '#0b1020', card: '#111a2b', ink: '#ffffff', accent: '#45e3bd', rule: 'rgba(255,255,255,.14)',
           glow: 'radial-gradient(120% 120% at 8% 10%, #13283a 0%, #0b1020 60%)' },
  teal:  { badgeInk: '#06120f', bg: '#0f141a', card: '#13202b', ink: '#ffffff', accent: '#45e3bd', rule: 'rgba(255,255,255,.12)',
           glow: 'radial-gradient(130% 110% at 85% 15%, #1b4a46 0%, #0f141a 62%)' },
  light: { badgeInk: '#ffffff', bg: '#f4f6fa', card: '#111a2b', ink: '#0d1220', accent: '#1f7d6a', rule: 'rgba(0,0,0,.12)',
           glow: 'radial-gradient(120% 120% at 10% 8%, #ffffff 0%, #e5efec 70%)' },
}

/**
 * The repo's own mark — NOT the PostgreSQL elephant. "PostgreSQL" and Slonik are trademarks of the
 * PostgreSQL Community Association of Canada, and a monetised channel is a commercial use. The
 * course is about databases and SQL, not about PostgreSQL's branding, so the cover uses a generic
 * database glyph (lucide, ISC — the app's own icon set) or the psql prompt, both of which are ours
 * to use and say the same thing.
 */
function markSvg(t, theme, mark) {
  const ink = theme === 'light' ? t.accent : '#ffffff'
  if (mark === 'prompt') {
    // psql's own prompt: `=>`. Owned by nobody, and literally what the card beside it shows.
    return `<svg class="logo" viewBox="0 0 64 64" role="img" aria-label="SQL — GraphL"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M8 26 H34 M8 38 H34" fill="none" stroke="${ink}" stroke-width="6.6" stroke-linecap="round"/>
      <path d="M42 18 L56 32 L42 46" fill="none" stroke="${ink}" stroke-width="6.6"
        stroke-linecap="round" stroke-linejoin="round"/></svg>`
  }
  // lucide "database", read from the app's own dependency rather than redrawn.
  const src = readFileSync(join(repoDir, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', 'database.mjs'), 'utf8')
  const nodes = [...src.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map((m) => {
    const attrs = [...m[2].matchAll(/(\w+):\s*"([^"]*)"/g)]
      .filter(([, k]) => k !== 'key').map(([, k, v]) => `${k}="${v}"`).join(' ')
    return `<${m[1]} ${attrs}/>`
  }).join('')
  if (!nodes) throw new Error('no geometry in lucide "database" icon')
  return `<svg class="logo" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="SQL — GraphL"
    xmlns="http://www.w3.org/2000/svg">${nodes}</svg>`
}

function pageHtml({ join_, types, schema, diagram, theme, head1, head2, badge, mark }) {
  const t = THEMES[theme]
  const fonts = [
    fontFace('ibm-plex-sans', 700, 'ibm-plex-sans-latin-700-normal.woff2'),
    fontFace('ibm-plex-sans', 600, 'ibm-plex-sans-latin-600-normal.woff2'),
    fontFace('ibm-plex-mono', 600, 'ibm-plex-mono-latin-600-normal.woff2'),
    fontFace('ibm-plex-mono', 400, 'ibm-plex-mono-latin-400-normal.woff2'),
  ].join('')

  // One grid for the whole table, so every column lines up across rows and nothing can collide.
  const head = (join_?.header ?? []).map((h) => `<span class="th">${esc(h)}</span>`).join('')
  const cells = (join_?.rows ?? []).map((r) => r.map((c, i) =>
    `<span class="td${i === 0 ? ' key' : ''}${i === 2 ? ' city' : ''}">${esc(c)}</span>`).join('')).join('')

  const sqlHtml = (sql) => sql.map((l) => `<div class="sql">${highlight(l)}</div>`).join('')

  return `<style>
  ${fonts}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:${t.bg};background-image:${t.glow};
       font-family:'IBM Plex Sans',system-ui,sans-serif;color:${t.ink};
       display:flex;align-items:stretch;gap:${40 * SCALE}px;padding:${46 * SCALE}px ${50 * SCALE}px}

  .left{flex:0 0 auto;max-width:${520 * SCALE}px;display:flex;flex-direction:column;justify-content:center}
  .logo{width:${104 * SCALE}px;height:${104 * SCALE}px;display:block;margin-bottom:${18 * SCALE}px;
        align-self:flex-start}
  .h{font-weight:700;line-height:.85;letter-spacing:-.05em;font-size:${116 * SCALE}px;white-space:nowrap}
  .h2{color:${t.accent}}
  .badge{align-self:flex-start;margin-top:${26 * SCALE}px;padding:${11 * SCALE}px ${24 * SCALE}px;
         background:${t.accent};border-radius:${12 * SCALE}px;
         font-weight:700;font-size:${34 * SCALE}px;letter-spacing:.06em;color:${t.badgeInk}}

  .card{flex:1;min-width:0;background:${t.card};border:${1 * SCALE}px solid ${t.rule};
        border-radius:${18 * SCALE}px;padding:${26 * SCALE}px ${30 * SCALE}px ${24 * SCALE}px;
        display:flex;flex-direction:column;box-shadow:0 ${22 * SCALE}px ${64 * SCALE}px rgba(0,0,0,.5)}
  .dots{display:flex;gap:${9 * SCALE}px;margin-bottom:${16 * SCALE}px}
  .dots i{width:${13 * SCALE}px;height:${13 * SCALE}px;border-radius:50%}

  .sql{font-family:'IBM Plex Mono',monospace;font-size:${22 * SCALE}px;font-weight:600;
       color:rgba(255,255,255,.92);white-space:nowrap;line-height:1.45}
  .kw{color:${TONE.serve.accent}}
  .fn{color:${TONE.ingest.accent}}
  .st{color:${TONE.store.accent}}

  .rows{flex:1;display:grid;align-content:center;
        grid-template-columns:auto auto 1fr;
        column-gap:${22 * SCALE}px;row-gap:${15 * SCALE}px;margin-top:${14 * SCALE}px;
        font-family:'IBM Plex Mono',monospace;font-size:${28 * SCALE}px;color:#fff}
  .th{font-weight:400;font-size:${24 * SCALE}px;color:rgba(255,255,255,.45);
      letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
  .td{font-weight:600;white-space:nowrap}
  .td.key{color:#ffffff}
  .td.city{color:${TONE.store.accent}}

  .hero{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:${52 * SCALE}px;
        color:${TONE.consume.accent};letter-spacing:-.03em;white-space:nowrap;margin-top:${6 * SCALE}px}
  .herosub{font-family:'IBM Plex Mono',monospace;font-size:${26 * SCALE}px;
           color:rgba(255,255,255,.5);margin-top:${6 * SCALE}px;white-space:nowrap}
  .good{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:${52 * SCALE}px;
        color:${TONE.store.accent};letter-spacing:-.03em;white-space:nowrap;margin-top:${14 * SCALE}px}
  .spacer{flex:1}

  .pane{width:100%;height:auto;display:block;align-self:center;
        border-radius:${12 * SCALE}px}
  .card.bare{background:none;border:none;box-shadow:none;padding:0;justify-content:center}

  .er{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:center;
      gap:${2 * SCALE}px}
  .tbl{background:rgba(255,255,255,.055);border:${2 * SCALE}px solid rgba(255,255,255,.17);
       border-radius:${14 * SCALE}px;padding:${12 * SCALE}px ${22 * SCALE}px ${13 * SCALE}px}
  .tname{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:${35 * SCALE}px;
         color:#ffffff;white-space:nowrap;margin-bottom:${9 * SCALE}px}
  .cols{display:grid;grid-template-columns:auto 1fr;column-gap:${28 * SCALE}px;
        row-gap:${6 * SCALE}px;font-family:'IBM Plex Mono',monospace;font-size:${30 * SCALE}px}
  .cn{color:rgba(255,255,255,.80);white-space:nowrap}
  .ct{color:rgba(255,255,255,.38);white-space:nowrap}
  .cn.on,.ct.on{color:${t.accent};font-weight:600}
  .cn.on{text-shadow:0 0 ${18 * SCALE}px ${t.accent}55}
  .wire{display:flex;align-items:center;gap:${12 * SCALE}px;padding-left:${26 * SCALE}px;
        height:${34 * SCALE}px}
  .wire i{width:${16 * SCALE}px;height:${16 * SCALE}px;border-radius:50%;background:${t.accent};
          flex:0 0 auto}
  .wire u{flex:0 0 ${54 * SCALE}px;height:${4 * SCALE}px;background:${t.accent};opacity:.75}
  .wire span{font-family:'IBM Plex Mono',monospace;font-size:${27 * SCALE}px;color:${t.accent};
             white-space:nowrap;letter-spacing:.02em}

  .foot{margin-top:${14 * SCALE}px;white-space:nowrap;font-family:'IBM Plex Mono',monospace;
        font-size:${24 * SCALE}px;color:rgba(255,255,255,.4);letter-spacing:.04em}
</style>
<div class="left">
  ${markSvg(t, theme, mark)}
  <div class="h">${esc(head1)}</div>
  ${head2.split(/\s+/).map((w) => `<div class="h h2">${esc(w)}</div>`).join('')}
  <div class="badge">${esc(badge)}</div>
</div>
<div class="card${diagram ? ' bare' : ''}">
  ${diagram ? '' : `<div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>`}
  ${diagram
    ? `<img class="pane" src="data:image/png;base64,${diagram.b64}" alt="">`
    : schema
    ? `<div class="er">
         ${tableHtml(schema.from, schema.left)}
         <div class="wire"><i></i><u></u><span>${esc(schema.on)}</span></div>
         ${tableHtml(schema.to, schema.right)}
       </div>
       <div class="foot">two tables · one key · ${esc(schema.rows)} rows out</div>`
    : types
    ? `${sqlHtml(types.sql)}
       <div class="spacer"></div>
       <div class="hero">${esc(types.bad)}</div>
       <div class="herosub">float8 — the answer nobody wants</div>
       <div class="good">${esc(types.good)}</div>
       <div class="herosub">numeric — the answer the ledger keeps</div>
       <div class="spacer"></div>
       <div class="foot">${esc(types.foot)}</div>`
    : `${sqlHtml(join_.sql)}
       <div class="rows">${head}${cells}</div>
       <div class="foot">${esc(join_.count)} · ${esc(join_.foot)}</div>`}
</div>`
}

/** One table card: its name, then every column the scene lists, the joined one picked out. */
function tableHtml(tbl, onCol) {
  const rows = tbl.cols.map(([c, ty]) => {
    const hit = c === onCol ? ' on' : ''
    return `<span class="cn${hit}">${esc(c)}</span><span class="ct${hit}">${esc(ty ?? '')}</span>`
  }).join('')
  return `<div class="tbl"><div class="tname">${esc(tbl.name)}</div><div class="cols">${rows}</div></div>`
}

/**
 * Colour the SQL the way the scenes do: keywords, casts, string literals. Tokenised in ONE pass
 * over the raw line and escaped per token, so no rule can match inside a tag it (or an earlier
 * rule) just wrote.
 */
const TOKEN = new RegExp([
  /('[^']*')/,                                             // a string literal
  /\b(SELECT|FROM|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|WHERE|AS|AND|OR|NOT|ORDER\s+BY|GROUP\s+BY)\b/,
  /(::\w+(?:\(\d+(?:,\d+)?\))?)/,                          // a cast, numeric(14,2) and all
].map((r) => r.source).join('|'), 'gi')

function highlight(line) {
  const out = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(esc(line.slice(last, m.index)))
    out.push(`<span class="${m[1] ? 'st' : m[2] ? 'kw' : 'fn'}">${esc(m[0])}</span>`)
    last = m.index + m[0].length
  }
  out.push(esc(line.slice(last)))
  return out.join('')
}

// ── render ──────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  const opt = { theme: 'dark', out: 'output/thumbnails/film.png', source: 'diagram', mark: 'database',
                head1: 'LEARN', head2: 'SQL', badge: 'FULL COURSE' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--theme') opt.theme = argv[++i]
    else if (a === '--out') opt.out = argv[++i]
    else if (a === '--head1') opt.head1 = argv[++i]
    else if (a === '--head2') opt.head2 = argv[++i]
    else if (a === '--badge') opt.badge = argv[++i]
    else if (a === '--source') opt.source = argv[++i]
    else if (a === '--mark') opt.mark = argv[++i]
    else { console.error(`unknown argument: ${a}`); process.exit(2) }
  }
  if (!THEMES[opt.theme]) { console.error(`unknown theme: ${opt.theme} (have: ${Object.keys(THEMES).join(', ')})`); process.exit(2) }
  if (!['join', 'types', 'schema', 'diagram'].includes(opt.source)) { console.error(`unknown source: ${opt.source} (have: join, types, schema, diagram)`); process.exit(2) }
  if (!['database', 'prompt'].includes(opt.mark)) { console.error(`unknown mark: ${opt.mark} (have: database, prompt)`); process.exit(2) }

  const join_ = opt.source === 'join' ? realJoin() : null
  const types = opt.source === 'types' ? realTypes() : null
  const schema = opt.source === 'schema' ? await realSchema() : null
  let diagram = null
  if (opt.source === 'diagram') {
    // nothing to echo yet — the pane is captured below, and reports its own size.
  } else if (schema) {
    console.log('Real schema from the design-review scene:')
    for (const tbl of [schema.from, schema.to]) {
      console.log(`  ${tbl.name}`)
      for (const [c, ty] of tbl.cols) console.log(`    ${c.padEnd(18)}${ty ?? ''}`)
    }
    console.log(`  joined: ${schema.on}  (${schema.rows} rows)`)
  } else if (join_) {
    console.log('Real join from spine/combine/01-inner:')
    for (const l of join_.sql) console.log(`  ${l}`)
    console.log(`  → ${join_.header.join(' | ')}`)
    for (const r of join_.rows) console.log(`    ${r.join(' | ')}`)
  } else {
    console.log('Real types session from spine/design/06-types:')
    for (const l of types.sql) console.log(`  ${l}`)
    console.log(`  → float8 ${types.bad}  |  numeric ${types.good}`)
  }

  const requireFromRepo = createRequire(join(repoDir, 'package.json'))
  const { default: puppeteer } = await import(pathToFileURL(requireFromRepo.resolve('puppeteer')).href)

  if (opt.source === 'diagram') {
    console.log(`Capturing the real "${DIAGRAM_NODE}" pane from #/${DIAGRAM_SLUG} …`)
    const shot = await realDiagram(puppeteer)   // its own browser, closed before the cover opens
    console.log(`  pane ${shot.w}x${shot.h} at a 3840x2160 viewport`)
    diagram = { b64: readFileSync(shot.png).toString('base64') }
    rmSync(shot.png, { force: true })
  }

  const browser = await puppeteer.launch({ headless: true,
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 }, args: [`--window-size=${W},${H}`] })
  try {
    const page = await browser.newPage()
    await page.setContent(pageHtml({ join_, types, schema, diagram, ...opt }), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await sleep(250)

    const overflow = await page.evaluate(() => {
      const bad = []
      for (const sel of ['.rows', '.card', '.left', 'body']) {
        const el = document.querySelector(sel)
        if (el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
          // Name the widest descendant too — otherwise a fit is guesswork.
          const box = el.getBoundingClientRect()
          // A block with nowrap keeps its RECT inside the box and overflows its text, so compare
          // scrollWidth as well — a rect-only check silently misses exactly that case.
          const worst = [...el.querySelectorAll('*')]
            .map((d) => ({ d, over: Math.max(d.getBoundingClientRect().right - box.right,
                                             d.scrollWidth - d.clientWidth) }))
            .sort((a, b) => b.over - a.over)[0]
          bad.push(`${sel} ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`
            + (worst && worst.over > 0
               ? ` — widest: <${worst.d.className || worst.d.tagName}> "${worst.d.textContent.trim().slice(0, 40)}" +${Math.round(worst.over)}px`
               : ''))
        }
      }
      // any element whose right or bottom edge runs past the viewport is clipped
      for (const el of document.querySelectorAll('.th,.td,.sql,.h,.badge,.hero,.herosub,.good,.foot,.tname,.cn,.ct,.wire span')) {
        const r = el.getBoundingClientRect()
        if (r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1) {
          bad.push(`clipped: "${el.textContent.trim().slice(0, 22)}" right=${Math.round(r.right)} bottom=${Math.round(r.bottom)}`)
        }
      }
      return bad
    })
    if (process.env.DEBUG) {
      const dump = await page.evaluate(() => {
        const vw = window.innerWidth
        return [...document.querySelectorAll('body,.left,.card,.rows,.sql,.foot,.th,.td,.h,.badge,.hero,.herosub,.good')]
          .map((e) => {
            const r = e.getBoundingClientRect()
            return `${(e.className || e.tagName).padEnd(10)} x=${Math.round(r.x)} w=${Math.round(r.width)} right=${Math.round(r.right)}`
              + ` scrollW=${e.scrollWidth} clientW=${e.clientWidth}${r.right > vw ? '  ⚠past viewport' : ''}`
              + `  "${e.textContent.trim().slice(0, 34)}"`
          })
      })
      console.log('\n--- DEBUG layout ---\n' + dump.join('\n'))
    }
    if (overflow.length) throw new Error(`layout overflows:\n  ${overflow.join('\n  ')}`)

    const out = isAbsolute(opt.out) ? opt.out : join(repoDir, opt.out)
    mkdirSync(dirname(out), { recursive: true })
    const big = join(tmpdir(), `thumb-film-${Date.now()}.png`)
    await page.screenshot({ path: big })
    await run(FFMPEG, ['-y', '-loglevel', 'error', '-i', big, '-vf', 'scale=1280:720:flags=lanczos', out])
    rmSync(big, { force: true })
    console.log(`\n✅ ${out}  (${opt.theme}, ${opt.source})`)
  } finally {
    await browser.close()
  }
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1) })
