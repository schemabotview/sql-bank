#!/usr/bin/env python3
"""Replay the spine against ONE continuous database and compare every transcript with what psql prints.

The course is the DB team building Syndica Bank's database, `syndica`, step by step. Every step runs
against the database exactly as the steps before it left it — no rebuilds, no migrations. Each step
folder is:

  spine/<course>/<NN-step>/
    step.json        options (below)
    files/<path>     files this step ADDS to syndica-db/ (e.g. files/build/03-foreign-keys.sql)
    session.txt      the terminal pane: the real transcript, from an 80-column pty
    timeline.txt     a two-session step instead (see below) -> session-a.txt + session-b.txt

  python3 scripts/spine.py              replay every step from a fresh database (exit 1 on a diff)
  python3 scripts/spine.py --write      replay and re-capture every transcript
  python3 scripts/spine.py build        start from the checkpoint the course before `build` left
  python3 scripts/spine.py build --write

INPUT is read from the transcript itself: every row that starts with a prompt (the shell's
`dbteam@syndica:~/syndica-db$ `, or psql's `syndica=> `, `syndica(> `, `syndica-*> ` …) is a line
the team typed; the text after the prompt is sent. To author a step, write the prompt rows you want
typed (any prompt text) and run --write: the runner fills in the real output and the real prompts.
A session that does not start with a shell row starts psql silently (`psql -d syndica`), so the
pane shows only the SQL.

CONTINUOUS STATE — the rules the runner enforces:
  * a step never ends inside a transaction (its final prompt carries no `*` or `!`);
  * files are only ADDED: a step may not add a path an earlier step added;
  * a typed line may not wrap (its row would lose its prompt, and the input with it);
  * transcripts are written only from the pinned major version (PG_MAJOR) — set
    SPINE_ANY_PG=1 to replay against another version for infra work; --write still refuses.

CHECKPOINTS: after a course's last step, the database is copied to `syndica_after_<course>`
(CREATE DATABASE … TEMPLATE). Starting at a course restores the previous checkpoint and replays from
there. Roles are cluster-wide, so a run first drops every `syndica_%` role (the course's own roles,
from `secure`); `dbteam` is the base role and stays.

TIMELINES (step.json {"timeline": true}): timeline.txt holds the moments in order, one per row,
each prefixed with its session: `A syndica=> BEGIN;`. Sessions A and B are two psql processes. A
statement that does not return within BLOCK_S is confirmed to be WAITING ON A LOCK
(pg_stat_activity) and the timeline moves on; its output lands in the moment that released it. After
each moment the shorter pane is padded with blank rows, so a row is one moment in both panes.
Timeline panes are TIMELINE_COLS wide.

step.json (all optional):
  {"timeline": true}      a two-session step (above)
  {"volatile": true}      compared with digits masked (pids, xmin, ctid): text and shape still checked
  {"cols": 80}            the pty width (default 80; timelines TIMELINE_COLS)
"""
import json
import os
import pty
import re
import select
import shutil
import struct
import subprocess
import sys
import termios
import fcntl
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPINE = ROOT / 'spine'
GEN = ROOT / 'src' / 'spine.gen.ts'
PG_MAJOR = 18
DB = 'syndica'
TEAM = 'dbteam'  # OS user and database role the DB team works as
HOME = Path('/home') / TEAM
WORK = HOME / 'syndica-db'
PS1 = r'\u@syndica:\w\$ '
COLS = 80
TIMELINE_COLS = 60
BLOCK_S = 3.0  # deadlock_timeout is 1s: by 3s a deadlock is resolved and a real wait is a wait
COURSES = ['start', 'design', 'build', 'query', 'combine', 'analyse', 'change', 'concurrency', 'perform', 'secure']

SHELL_PROMPT = re.compile(r'^dbteam@syndica:\S*\$(?: (.*))?$')
PSQL_PROMPT = re.compile(r'^([A-Za-z_][\w$]*)([=\-(\'"])([*!?]?)([>#])(?: (.*))?$')
ANY_PROMPT_TAIL = re.compile(rb'(dbteam@syndica:\S*\$ |\n[A-Za-z_][\w$]*[=\-(\'"][*!?]?[>#] )$')
ANSI = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b[()][AB012]|\x1b[=>]')


def prompt_of(row):
    """(kind, typed text) for a prompt row, else None. kind is 'shell' or 'psql'."""
    m = SHELL_PROMPT.match(row)
    if m:
        return 'shell', m.group(1) or ''
    m = PSQL_PROMPT.match(row)
    if m:
        return 'psql', m.group(5) or ''
    return None


def die(msg):
    print(f'✗ {msg}', file=sys.stderr)
    sys.exit(1)


# --- the server -----------------------------------------------------------------------------------

def admin(sql, db='postgres', check=True):
    """Run SQL as the superuser (peer-mapped), quietly; return stdout."""
    r = subprocess.run(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-d', db, '-c', sql],
                       capture_output=True, text=True)
    if check and r.returncode:
        die(f'admin SQL failed: {sql}\n{r.stderr}')
    return r.stdout.strip()


def server_major():
    v = admin('SHOW server_version_num')
    return int(v) // 10000


def drop_course_roles():
    for role in admin("SELECT rolname FROM pg_roles WHERE rolname LIKE 'syndica\\_%'").split():
        admin(f'DROP OWNED BY "{role}" CASCADE', db=DB, check=False)
        admin(f'DROP ROLE "{role}"')


def fresh_database(template=None):
    admin(f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{DB}' AND pid <> pg_backend_pid()")
    admin(f'DROP DATABASE IF EXISTS {DB}')
    drop_course_roles()
    if template:
        admin(f'CREATE DATABASE {DB} TEMPLATE {template}')
    else:
        # The database's settings are the runner's, not a step's: every replay reads the same clock
        # zone, date style and message language. Nothing in the course reads now().
        admin(f'CREATE DATABASE {DB} OWNER {TEAM}')
        admin(f"ALTER DATABASE {DB} SET timezone TO 'Europe/London'")
        admin(f"ALTER DATABASE {DB} SET datestyle TO 'ISO, DMY'")
        admin(f"ALTER DATABASE {DB} SET lc_messages TO 'C'")
        admin(f"ALTER DATABASE {DB} SET deadlock_timeout TO '1s'")


def checkpoint(course):
    name = f'{DB}_after_{course}'
    admin(f'DROP DATABASE IF EXISTS {name}')
    admin(f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{DB}'")
    admin(f'CREATE DATABASE {name} TEMPLATE {DB}')


# --- the steps ------------------------------------------------------------------------------------

def steps():
    out = []
    for course in COURSES:
        d = SPINE / course
        if d.is_dir():
            out += [(course, s) for s in sorted(p for p in d.iterdir() if (p / 'step.json').exists())]
    extra = sorted(p.name for p in SPINE.iterdir() if p.is_dir() and p.name not in COURSES) if SPINE.exists() else []
    if extra:
        die(f'spine/ has folders that are not courses: {extra}')
    return out


def files_of(step):
    base = step / 'files'
    return sorted(p.relative_to(base).as_posix() for p in base.rglob('*') if p.is_file()) if base.exists() else []


def reset_workdir(upto):
    """syndica-db/ as the steps before `upto` left it: the union of their files (files are only added)."""
    if WORK.exists():
        shutil.rmtree(WORK)
    WORK.mkdir(parents=True)
    seen = {}
    for course, step in upto:
        add_files(step, seen)


def add_files(step, seen):
    for rel in files_of(step):
        if rel in seen:
            die(f'{step.relative_to(SPINE)} adds {rel}, which {seen[rel]} already added — files are only added, never edited')
        seen[rel] = step.relative_to(SPINE).as_posix()
        dst = WORK / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(step / 'files' / rel, dst)
    subprocess.run(['chown', '-R', f'{TEAM}:{TEAM}', str(HOME)], check=True)


# --- a pty session --------------------------------------------------------------------------------

class Term:
    """bash as dbteam in a pseudo-terminal `cols` wide, cwd syndica-db/."""

    def __init__(self, cols, app):
        self.cols = cols
        env = {'PATH': os.environ['PATH'], 'TERM': 'dumb', 'LANG': 'C.UTF-8', 'HOME': str(HOME), 'PS1': PS1,
               'PSQLRC': '/dev/null', 'PAGER': 'cat', 'PSQL_PAGER': 'cat', 'PGAPPNAME': app, 'PGDATABASE': DB}
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            os.chdir(WORK)
            os.execvpe('runuser', ['runuser', '-u', TEAM, '--', 'bash', '--norc', '--noprofile', '--noediting', '-i'], env)
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack('HHHH', 500, cols, 0, 0))
        self.buf = b''
        self.wait_prompt(10)
        # the pane starts AT the shell prompt the first command is typed after
        self.start = self.buf.rfind(b'\n') + 1

    def read(self, timeout):
        r, _, _ = select.select([self.fd], [], [], timeout)
        if not r:
            return False
        try:
            self.buf += os.read(self.fd, 65536)
        except OSError:
            return False
        return True

    def wait_prompt(self, timeout):
        """Read until the buffer ends at a prompt; False if none came within `timeout`."""
        end = time.time() + timeout
        while time.time() < end:
            if not self.read(0.05) and ANY_PROMPT_TAIL.search(self.buf):
                # settle: a prompt with nothing after it for 50ms is the real end
                return True
        return bool(ANY_PROMPT_TAIL.search(self.buf))

    def send(self, line):
        os.write(self.fd, line.encode() + b'\n')

    def text(self, since=None):
        raw = self.buf[self.start if since is None else since:].decode('utf-8', 'replace')
        return ANSI.sub('', raw.replace('\r\n', '\n').replace('\r', ''))

    def close(self):
        try:
            os.write(self.fd, b'\\q\nexit\nexit\n')
            time.sleep(0.2)
            os.close(self.fd)
        except OSError:
            pass
        try:
            os.waitpid(self.pid, 0)
        except ChildProcessError:
            pass


def wrap(text, cols):
    """Hard-wrap every row at `cols`, as the terminal does; drop the trailing bare prompt."""
    rows = []
    for row in text.split('\n'):
        rows += [row[i:i + cols] for i in range(0, len(row), cols)] or ['']
    return rows


def finish(rows, where):
    """Trim to the transcript: end before the final bare prompt; check the transaction state there."""
    while rows and not rows[-1].strip():
        rows.pop()
    if rows and prompt_of(rows[-1]) and not prompt_of(rows[-1])[1]:
        last = rows.pop()
        m = PSQL_PROMPT.match(last)
        if m and m.group(3):
            die(f'{where} ends inside a transaction (prompt {last.strip()!r}) — a step must COMMIT or ROLLBACK on screen')
    while rows and not rows[-1].strip():
        rows.pop()
    return rows


def inputs_of(text):
    return [(k, typed) for k, typed in (prompt_of(r) for r in text.split('\n') if prompt_of(r))]


def run_session(step, opts):
    cols = opts.get('cols', COLS)
    script = inputs_of((step / 'session.txt').read_text())
    if not script:
        die(f'{step.relative_to(SPINE)}: session.txt has no prompt rows — nothing to type')
    term = Term(cols, 'spine')
    if script[0][0] == 'psql':
        term.send('psql -n -d syndica')
        term.wait_prompt(10)
        # the pane starts at the psql prompt the first statement is typed after
        term.start = term.buf.rfind(b'\n') + 1
    for kind, typed in script:
        term.send(typed)
        if not term.wait_prompt(30):
            die(f'{step.relative_to(SPINE)}: no prompt after {typed!r} within 30s')
    rows = finish(wrap(term.text(), cols), step.relative_to(SPINE))
    term.close()
    no_wrap(rows, cols, step)
    return {'session.txt': '\n'.join(rows) + '\n'}


def no_wrap(rows, cols, step):
    for r in rows:
        if len(r) == cols and prompt_of(r):
            die(f'{step.relative_to(SPINE)}: a typed line wraps at {cols} columns — shorten it: {r!r}')


def waiting(app):
    return admin(f"SELECT count(*) FROM pg_stat_activity WHERE application_name = '{app}' AND wait_event_type = 'Lock'") == '1'


def run_timeline(step, opts):
    cols = opts.get('cols', TIMELINE_COLS)
    moments = []
    for row in (step / 'timeline.txt').read_text().splitlines():
        if not row.strip():
            continue
        who, _, rest = row.partition(' ')
        p = prompt_of(rest)
        if who not in ('A', 'B') or not p:
            die(f'{step.relative_to(SPINE)}: timeline row must be `A <prompt> sql` or `B <prompt> sql`: {row!r}')
        moments.append((who, p[1]))
    terms = {w: Term(cols, f'spine-{w.lower()}') for w in 'AB'}
    for t in terms.values():
        t.send('psql -n -d syndica')
        t.wait_prompt(10)
        t.start = t.buf.rfind(b'\n') + 1
    panes = {w: [] for w in 'AB'}
    taken = {w: terms[w].start for w in 'AB'}
    blocked = set()

    def take(w):
        rows = terms[w].text(taken[w]).split('\n')
        # keep the trailing partial row (the prompt being typed after) for the next moment
        done, partial = rows[:-1], rows[-1]
        taken[w] = len(terms[w].buf) - len(partial.encode())
        return [r for row in done for r in wrap(row, cols)]

    for who, typed in moments:
        if who in blocked:
            die(f'{step.relative_to(SPINE)}: session {who} is still blocked; it cannot type {typed!r}')
        terms[who].send(typed)
        returned = terms[who].wait_prompt(BLOCK_S)
        if not returned:
            if not waiting(f'spine-{who.lower()}'):
                die(f'{step.relative_to(SPINE)}: {who} did not return after {typed!r} and is not waiting on a lock')
            blocked.add(who)
        # a blocked session the other just released returns now: its output belongs to this moment
        for w in list(blocked - {who}):
            if terms[w].wait_prompt(BLOCK_S):
                blocked.discard(w)
            elif not waiting(f'spine-{w.lower()}'):
                die(f'{step.relative_to(SPINE)}: {w} is neither returning nor waiting on a lock')
        got = {w: take(w) for w in 'AB'}
        n = max(len(got['A']), len(got['B']))
        for w in 'AB':
            panes[w] += got[w] + [''] * (n - len(got[w]))
    if blocked:
        die(f'{step.relative_to(SPINE)}: the timeline ends with {sorted(blocked)} still blocked')
    out = {}
    for w in 'AB':
        rows = panes[w] + [r for r in terms[w].text(taken[w]).split('\n')]
        terms[w].close()
        rows = finish(rows, f'{step.relative_to(SPINE)} session {w}')
        no_wrap(rows, cols, step)
        out[f'session-{w.lower()}.txt'] = '\n'.join(rows) + '\n'
    return out


# --- compare, write, index ------------------------------------------------------------------------

def masked(text, volatile):
    return re.sub(r'\d', '#', text) if volatile else text


def write_index(all_steps):
    """src/spine.gen.ts: every step's transcripts and files as `?raw` imports — what scenes read."""
    lines = ['// GENERATED by scripts/spine.py --write. Do not edit: every string here is a replayed transcript', '// or a file the step added.', '']
    entries = []
    for i, (course, step) in enumerate(all_steps):
        key = step.relative_to(SPINE).as_posix()
        fields = []
        for name in ('session.txt', 'session-a.txt', 'session-b.txt'):
            if (step / name).exists():
                v = f's{i}_{name.split(".")[0].replace("-", "_")}'
                lines.append(f"import {v} from '../spine/{key}/{name}?raw'")
                fields.append(f"{json.dumps(name.split('.')[0])}: {v}")
        fl = []
        for j, rel in enumerate(files_of(step)):
            v = f'f{i}_{j}'
            lines.append(f"import {v} from '../spine/{key}/files/{rel}?raw'")
            fl.append(f'{json.dumps(rel)}: {v}')
        fields.append('files: { ' + ', '.join(fl) + ' }')
        entries.append(f'  {json.dumps(key)}: {{ ' + ', '.join(fields) + ' },')
    lines += ['', 'export interface Step { session?: string; "session-a"?: string; "session-b"?: string; files: Record<string, string> }',
              '', '/** Every step, in course order. */', 'export const STEPS: Record<string, Step> = {'] + entries + ['}', '']
    GEN.write_text('\n'.join(lines))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    write = '--write' in sys.argv
    if len(args) > 1 or (args and args[0] not in COURSES):
        die(f'usage: spine.py [course] [--write]; courses: {", ".join(COURSES)}')
    if os.geteuid() != 0:
        die('run as root: the runner drives psql as the dbteam user and the server as postgres')
    major = server_major()
    if major != PG_MAJOR and (write or not os.environ.get('SPINE_ANY_PG')):
        die(f'the server is PostgreSQL {major}; transcripts come from {PG_MAJOR} (SPINE_ANY_PG=1 replays anyway, never --write)')
    all_steps = steps()
    start = args[0] if args else None
    if start:
        i = COURSES.index(start)
        before = [s for s in all_steps if COURSES.index(s[0]) < i]
        # the checkpoint the last course WITH steps before this one left
        prev = before[-1][0] if before else None
        todo = [s for s in all_steps if COURSES.index(s[0]) >= i]
        if prev:
            name = f'{DB}_after_{prev}'
            if admin(f"SELECT count(*) FROM pg_database WHERE datname = '{name}'") != '1':
                die(f'no checkpoint {name}: replay from the start once (spine.py) to create it')
            fresh_database(template=name)
        else:
            fresh_database()
        reset_workdir(before)
    else:
        fresh_database()
        reset_workdir([])
        todo = all_steps
    seen = {}
    for course, step in [s for s in all_steps if s not in todo]:
        for rel in files_of(step):
            seen[rel] = step.relative_to(SPINE).as_posix()
    diffs = 0
    for n, (course, step) in enumerate(todo):
        opts = json.loads((step / 'step.json').read_text() or '{}')
        add_files(step, seen)
        got = run_timeline(step, opts) if opts.get('timeline') else run_session(step, opts)
        key = step.relative_to(SPINE).as_posix()
        for name, text in got.items():
            path = step / name
            old = path.read_text() if path.exists() else ''
            if write:
                if old != text:
                    path.write_text(text)
                    print(f'  wrote {key}/{name}')
            elif masked(old, opts.get('volatile')) != masked(text, opts.get('volatile')):
                diffs += 1
                print(f'✗ {key}/{name} differs from the replay:')
                for a, b in zip(old.splitlines() + [''] * 999, text.splitlines()):
                    if a != b:
                        print(f'    spine : {a!r}\n    replay: {b!r}')
                        break
        last_of_course = n + 1 == len(todo) or todo[n + 1][0] != course
        if last_of_course:
            checkpoint(course)
        print(f'{"·" if not write else "✓"} {key}')
    if write:
        write_index(all_steps)
    if diffs:
        die(f'{diffs} transcript(s) differ — run with --write if the change is intended, then review every scene that reads them')
    print(f'✓ spine OK — {len(todo)} step(s) replayed on PostgreSQL {major}')


if __name__ == '__main__':
    main()
