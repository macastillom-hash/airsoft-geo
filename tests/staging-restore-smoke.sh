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
# La imagen oficial habilita temporalmente PostgreSQL durante la inicialización.
# Esperamos la FINALIZACIÓN de init antes de probar conexión; pg_isready solo puede dar falsos positivos.
READY=0
for i in $(seq 1 45); do
 if docker logs "$NAME" 2>&1 | grep -F "PostgreSQL init process complete" >/dev/null; then
  if docker exec "$NAME" psql -U postgres -d postgres -tAc 'SELECT 1' 2>/dev/null | grep -x '1' >/dev/null; then
   READY=1
   break
  fi
 fi
 sleep 1
done
if [[ "$READY" -ne 1 ]]; then
 echo "PostgreSQL de ensayo no finalizó la inicialización" >&2
 docker logs --tail 35 "$NAME" >&2
 exit 2
fi
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
