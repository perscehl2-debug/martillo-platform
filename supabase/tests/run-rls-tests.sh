#!/usr/bin/env bash
# Levanta un Postgres temporal, aplica el stub de Supabase + la migración de
# siniestros y ejecuta las pruebas de RLS. Requiere PostgreSQL >= 15 instalado.
set -euo pipefail
cd "$(dirname "$0")"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PG_BIN/initdb" ] || { echo "No se encontró PostgreSQL (definir PG_BIN)"; exit 1; }

DIR="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = 0 ]; then chown -R postgres "$DIR"; RUN_AS=(runuser -u postgres --); fi
cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null

PSQL=("${RUN_AS[@]}" "$PG_BIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null)
"${PSQL[@]}" -f supabase_stub.sql
"${PSQL[@]}" -f ../migrations/002_siniestros.sql
"${PSQL[@]}" -f rls_siniestros.sql
echo "✓ Pruebas RLS de siniestros OK"
