// Read values out of a psql transcript, so a side pane shows what PostgreSQL printed — never a
// retyped copy. Everything here throws on a miss: check-render reports it as a page error naming
// the scene, which is how a changed transcript surfaces instead of a stale number.

const rowsOf = (session: string) => session.replace(/\n+$/, '').split('\n')

/** The index of the first prompt row (from `from`) whose typed text contains `command`. */
function commandRow(rows: string[], command: string, from = 0): number {
  for (let i = from; i < rows.length; i++)
    if (/^[A-Za-z_][\w$]*[=\-('"][*!?]?[>#] /.test(rows[i]) && rows[i].includes(command)) return i
  throw new Error(`psql.ts: no prompt row typing ${JSON.stringify(command)}`)
}

/**
 * The aligned result table printed after the statement containing `command`: its column names and
 * its rows, cells trimmed. Skips the statement's continuation rows and an optional title row.
 */
export function result(session: string, command: string): { columns: string[]; rows: string[][] } {
  const rows = rowsOf(session)
  let i = commandRow(rows, command) + 1
  while (i < rows.length && /^[A-Za-z_][\w$]*[\-('"][*!?]?[>#] /.test(rows[i])) i++
  // header, then the ----+---- rule; a title row (\dt's "List of tables") may come first
  while (i + 1 < rows.length && !/^-+(\+-+)*$/.test(rows[i + 1])) i++
  if (i + 1 >= rows.length) throw new Error(`psql.ts: no result table after ${JSON.stringify(command)}`)
  const split = (r: string) => r.split('|').map((c) => c.trim())
  const columns = split(rows[i])
  const out: string[][] = []
  for (let j = i + 2; j < rows.length && !/^\(\d+ rows?\)$/.test(rows[j]); j++) out.push(split(rows[j]))
  return { columns, rows: out }
}

/** The output rows printed after the statement containing `command`, up to the next prompt. */
export function output(session: string, command: string): string[] {
  const rows = rowsOf(session)
  let i = commandRow(rows, command) + 1
  while (i < rows.length && /^[A-Za-z_][\w$]*[\-('"][*!?]?[>#] /.test(rows[i])) i++
  const out: string[] = []
  for (; i < rows.length && !/^[A-Za-z_][\w$]*[=\-('"][*!?]?[>#]( |$)/.test(rows[i]) && !/^\w+@\w+:/.test(rows[i]); i++) out.push(rows[i])
  return out
}

/** The first capture group of `re` in the session. */
export function grab(session: string, re: RegExp): string {
  const m = session.match(re)
  if (!m) throw new Error(`psql.ts: ${re} found nothing in the session`)
  return m[1]
}

/**
 * The outcome of each statement in a psql run, in order: `ok` (a command tag such as INSERT 0 1) or
 * the error's message. A message wrapped at the terminal's width is joined back.
 */
export function outcomes(lines: string[]): { ok: boolean; text: string }[] {
  const out: { ok: boolean; text: string }[] = []
  for (const line of lines) {
    if (/^(INSERT|UPDATE|DELETE|COPY|CREATE|ALTER|DROP)\b/.test(line)) out.push({ ok: true, text: line })
    else if (/ERROR: /.test(line)) out.push({ ok: false, text: line.replace(/^.*ERROR:\s+/, '') })
    else if (out.length && !out[out.length - 1].ok && !/^(DETAIL|HINT|LINE|CONTEXT):/.test(line)) out[out.length - 1].text += line
  }
  return out
}
