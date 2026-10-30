#!/usr/bin/env bash
# Install the course's pinned PostgreSQL and the DB team's login — usable as the cloud environment's
# setup script (run as root, Linux x86-64). Idempotent.
#
# PostgreSQL comes from conda-forge, installed with micromamba into PG_PREFIX: it pins the exact
# minor (apt's PGDG repo only pins the major), needs no distro repo, and conda.anaconda.org is
# reachable from the cloud environment where apt.postgresql.org is not.
#
#   PG_VERSION   exact version (default 18.6 — scripts/spine.py refuses any major but 18)
#   PG_PREFIX    install prefix (default /opt/pg18); its binaries are linked into /usr/local/bin
#   PGDATA       data directory (default /var/lib/postgresql/18/main)
#
# What it leaves: a running server on the unix socket in /tmp (no TCP); an OS user and a
# NON-superuser role, both `dbteam` (the team works without superuser rights; a step that needs them
# types `psql -U postgres`); peer authentication mapped so OS user dbteam may log in as dbteam or
# postgres, and root's runner may act as postgres. Any Debian cluster on the same port is stopped.
set -euo pipefail
PG_VERSION="${PG_VERSION:-18.6}"
PG_PREFIX="${PG_PREFIX:-/opt/pg18}"
PGDATA="${PGDATA:-/var/lib/postgresql/18/main}"
MAMBA_VERSION=2.9.0
MAMBA=/opt/micromamba/bin/micromamba

# --- the binaries ---------------------------------------------------------------------------------
if [[ "$("$PG_PREFIX/bin/postgres" --version 2>/dev/null)" != *" $PG_VERSION" ]]; then
  if [[ ! -x "$MAMBA" ]]; then
    mkdir -p /opt/micromamba
    curl -fsSL "https://conda.anaconda.org/conda-forge/linux-64/micromamba-${MAMBA_VERSION}-0.tar.bz2" \
      | tar xj -C /opt/micromamba bin/micromamba
  fi
  rm -rf "$PG_PREFIX"
  "$MAMBA" create -y -q -r /opt/micromamba/root -p "$PG_PREFIX" -c conda-forge --override-channels "postgresql=${PG_VERSION}" >/dev/null
fi
for b in psql pg_ctl initdb postgres pg_dump pg_restore createdb dropdb; do ln -sf "$PG_PREFIX/bin/$b" "/usr/local/bin/$b"; done

# --- the cluster ----------------------------------------------------------------------------------
id postgres >/dev/null 2>&1 || useradd -r -m -d /var/lib/postgresql -s /bin/bash postgres
id dbteam >/dev/null 2>&1 || useradd -m -s /bin/bash dbteam
command -v pg_lsclusters >/dev/null && pg_lsclusters -h | awk '$3 == 5432 && $4 == "online" {print $1, $2}' \
  | while read -r v c; do pg_ctlcluster "$v" "$c" stop; done

if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  mkdir -p "$PGDATA" && chown -R postgres:postgres "$(dirname "$PGDATA")" && chmod 700 "$PGDATA"
  runuser -u postgres -- "$PG_PREFIX/bin/initdb" -D "$PGDATA" -U postgres --encoding=UTF8 --locale=C.UTF-8 \
    --auth-local=peer --auth-host=scram-sha-256 >/dev/null
  printf "unix_socket_directories = '/tmp'\nlisten_addresses = ''\n" >> "$PGDATA/postgresql.conf"
  # Peer auth through one map: dbteam -> dbteam | postgres, postgres -> postgres.
  sed -i -E 's/^(local[[:space:]]+all[[:space:]]+all[[:space:]]+peer)$/\1 map=team/' "$PGDATA/pg_hba.conf"
  printf 'team  dbteam    dbteam\nteam  dbteam    postgres\nteam  postgres  postgres\n' >> "$PGDATA/pg_ident.conf"
fi

runuser -u postgres -- "$PG_PREFIX/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 \
  || runuser -u postgres -- "$PG_PREFIX/bin/pg_ctl" -D "$PGDATA" -l "$(dirname "$PGDATA")/server.log" -w start >/dev/null
runuser -u postgres -- "$PG_PREFIX/bin/psql" -X -q -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dbteam') THEN CREATE ROLE dbteam LOGIN CREATEDB; END IF;
END \$\$"
runuser -u postgres -- "$PG_PREFIX/bin/psql" -X -At -c 'SELECT version()'
echo "✓ PostgreSQL ${PG_VERSION} ready; the DB team logs in as dbteam"
