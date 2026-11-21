#!/usr/bin/env bash
# Verifica una copia .age sin conectarse a producción ni restaurar datos.
set -Eeuo pipefail
umask 077
if [[ $# -ne 2 ]]; then
 echo "Uso: bash scripts/inspect-encrypted-backup.sh copia.tar.gz.age identidad-privada-age.txt" >&2
 exit 2
fi
ARCHIVE="$(realpath "$1")"
IDENTITY="$(realpath "$2")"
for cmd in age tar docker node sha256sum; do
 command -v "$cmd" >/dev/null || { echo "Falta: $cmd" >&2; exit 2; }
done
[[ -f "$ARCHIVE" && -f "$IDENTITY" ]] || { echo "Archivo o identidad no disponible" >&2; exit 2; }
WORK="$(mktemp -d)"
cleanup(){ rm -rf "$WORK"; }
trap cleanup EXIT
if [[ -f "$ARCHIVE.sha256" ]]; then
 (cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE").sha256")
fi
age --decrypt -i "$IDENTITY" -o "$WORK/backup.tar.gz" "$ARCHIVE"
# Archivos de la copia siempre usan rutas relativas generadas por nuestra herramienta.
if tar -tzf "$WORK/backup.tar.gz" | grep -E '(^/|(^|/)\.\.(/|$))'; then
 echo "Archivo tar rechazado por rutas inseguras" >&2; exit 2
fi
mkdir -p "$WORK/extracted"
tar -xzf "$WORK/backup.tar.gz" -C "$WORK/extracted" --no-same-owner
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
node "$REPO_DIR/scripts/verify-backup.mjs" "$WORK/extracted"
docker run --rm --pull=missing -v "$WORK/extracted:/out:ro" postgres:17-alpine \
 sh -ec 'pg_restore --list /out/postgres.dump >/dev/null'
echo "Inspección completada. No se modificó ninguna base de datos."
