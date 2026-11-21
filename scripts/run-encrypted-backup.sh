#!/usr/bin/env bash
# Copia de PostgreSQL 17 y Storage privada; el ÚNICO archivo de salida contiene cifrado age.
set -Eeuo pipefail
umask 077
for required in SUPABASE_DB_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY BACKUP_AGE_RECIPIENT; do
 if [[ -z "$(printenv "$required" || true)" ]]; then
  echo "Falta secreto de entorno obligatorio: $required" >&2
  exit 2
 fi
done
if [[ "$BACKUP_AGE_RECIPIENT" != age1* ]]; then
 echo "BACKUP_AGE_RECIPIENT debe ser una clave pública age válida." >&2
 exit 2
fi
for cmd in docker node age tar sha256sum; do
 command -v "$cmd" >/dev/null || { echo "Falta herramienta: $cmd" >&2; exit 2; }
done
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_DIR/.backup-output"
mkdir -p "$OUT_DIR"
WORK_DIR="$(mktemp -d)"
TAR_FILE="$(mktemp)"
clean(){
 rm -rf "$WORK_DIR"
 rm -f "$TAR_FILE"
}
trap clean EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$OUT_DIR/airsoft-geo-$STAMP.tar.gz.age"
if [[ -e "$TARGET" ]]; then echo "El respaldo ya existe" >&2; exit 1; fi
echo "Exportando PostgreSQL con cliente 17..."
docker run --rm --pull=missing \
 --env SUPABASE_DB_URL --env PGSSLMODE=require \
 -v "$WORK_DIR:/out" postgres:17-alpine \
 sh -ec 'pg_dump --format=custom --no-owner --no-acl --dbname="$SUPABASE_DB_URL" --file=/out/postgres.dump && pg_restore --list /out/postgres.dump >/dev/null'
echo "Exportando archivos privados de Supabase Storage..."
node "$REPO_DIR/scripts/backup-storage.mjs" "$WORK_DIR"
echo "Comprobando integridad de los datos exportados..."
node "$REPO_DIR/scripts/verify-backup.mjs" "$WORK_DIR" >/dev/null
tar -C "$WORK_DIR" -czf "$TAR_FILE" .
echo "Cifrando copia con age..."
age -r "$BACKUP_AGE_RECIPIENT" -o "$TARGET" "$TAR_FILE"
(cd "$(dirname "$TARGET")" && sha256sum "$(basename "$TARGET")" > "$(basename "$TARGET").sha256")
test -s "$TARGET"
echo "Respaldo cifrado y verificable preparado."
echo "Archivo: $(basename "$TARGET")"
echo "SHA256: $(cut -d' ' -f1 "$TARGET.sha256")"
