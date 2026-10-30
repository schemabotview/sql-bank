#!/usr/bin/env bash
# Install the course's pinned PostgreSQL and the DB team's login — usable as the cloud environment's
# setup script (run as root, Debian/Ubuntu). Idempotent.
#
#   PG_VERSION   major to install (default 18 — the course's; scripts/spine.py refuses others)
#   SKIP_INSTALL=1  configure an already installed cluster only
#
# What it leaves: a running cluster `<PG_VERSION>/main`; an OS user and a NON-superuser role, both
# `dbteam` (the team works without superuser rights; a step that needs them types `psql -U postgres`);
# peer authentication mapped so OS user dbteam may log in as dbteam or postgres, and root's runner may
# act as postgres. Needs network access to apt.postgresql.org (PGDG) for the install.
set -euo pipefail
PG_VERSION="${PG_VERSION:-18}"

if [[ "${SKIP_INSTALL:-}" != 1 ]]; then
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates postgresql-common >/dev/null
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
  apt-get install -y -qq "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}" >/dev/null
fi

CONF="/etc/postgresql/${PG_VERSION}/main"
[[ -d "$CONF" ]] || { echo "✗ no cluster at $CONF" >&2; exit 1; }

id dbteam >/dev/null 2>&1 || useradd -m -s /bin/bash dbteam

# Peer auth through one map: dbteam -> dbteam | postgres, postgres -> postgres.
grep -q '^team ' "$CONF/pg_ident.conf" || cat >> "$CONF/pg_ident.conf" <<'EOF'
team  dbteam    dbteam
team  dbteam    postgres
team  postgres  postgres
EOF
sed -i -E 's/^(local[[:space:]]+all[[:space:]]+(postgres|all)[[:space:]]+peer)$/\1 map=team/' "$CONF/pg_hba.conf"

pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || pg_ctlcluster "$PG_VERSION" main reload
runuser -u postgres -- psql -X -q -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dbteam') THEN CREATE ROLE dbteam LOGIN CREATEDB; END IF;
END \$\$"
runuser -u postgres -- psql -X -At -c 'SELECT version()'
echo "✓ PostgreSQL ${PG_VERSION} ready; the DB team logs in as dbteam"
