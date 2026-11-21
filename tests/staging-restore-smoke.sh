#!/usr/bin/env bash
# Prueba REAL de pg_dump + pg_restore, usando exclusivamente datos sintéticos.
# NO requiere credenciales ni puede conectarse a Supabase.
set -Eeuo pipefail
NAME="airsoft-smoke-$$"
WORK="$(mktemp -d)"
cleanup(){
 docker rm -f "$NAME" >/dev/null 2>&1 || true
 rm -rf "$WORK"
}
trap cleanup EXIT
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=synthetic-test-only postgres:17-alpine >/dev/null
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
 if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$NAME" pg_isready -U postgres >/dev/null
docker exec "$NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
 "CREATE TABLE recovery_fixture(id int primary key,team text NOT NULL); INSERT INTO recovery_fixture VALUES (1,'alpha'),(2,'bravo');" >/dev/null
docker exec "$NAME" pg_dump -U postgres -d postgres --format=custom --no-owner --no-acl --table=public.recovery_fixture > "$WORK/sample.dump"
test -s "$WORK/sample.dump"
docker exec "$NAME" createdb -U postgres recovery_staging
docker exec -i "$NAME" pg_restore -U postgres --no-owner --no-acl -d recovery_staging < "$WORK/sample.dump"
COUNT="$(docker exec "$NAME" psql -U postgres -d recovery_staging -tAc 'SELECT count(*) FROM public.recovery_fixture')"
ALPHA="$(docker exec "$NAME" psql -U postgres -d recovery_staging -tAc "SELECT team FROM public.recovery_fixture WHERE id=1")"
[[ "$COUNT" == 2 && "$ALPHA" == "alpha" ]] || { echo "La restauración de prueba no coincide" >&2; exit 1; }
echo "PostgreSQL 17: dump y restauración en base temporal verificados."
