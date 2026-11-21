<#
Airsoft Geo V4 - Copia íntegra PostgreSQL en archivo .backup.
Requisitos: pg_dump compatible con PostgreSQL 17, conexión a Supabase y
variable de entorno SUPABASE_DB_URL configurada localmente, NO en GitHub.
Ejemplo de ejecución manual desde PowerShell:
  $env:SUPABASE_DB_URL = Read-Host "URI de PostgreSQL (no la publiques)"
  .\scripts\backup_postgres.ps1 -OutputDir "D:\RespaldosAirsoft"
No guarda la contraseña en el código ni envía respaldos a terceros.
Importante: Supabase Storage conserva archivos multimedia aparte.
#>
param(
 [string]$OutputDir = "$env:USERPROFILE\Documents\AirsoftGeoBackups",
 [int]$KeepLast = 14
)
$ErrorActionPreference = "Stop"
if (-not $env:SUPABASE_DB_URL) {
 throw "Falta SUPABASE_DB_URL. Configúrala localmente con la URI de conexión de Supabase. No uses un archivo .env publicado."
}
if ($env:SUPABASE_DB_URL -notmatch '^postgres(ql)?://') {
 throw "SUPABASE_DB_URL debe comenzar por postgres:// o postgresql://."
}
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
 throw "No se encontró pg_dump. Instala las herramientas cliente PostgreSQL 17 y agrega su carpeta bin al PATH."
}
if ($KeepLast -lt 2) { throw "KeepLast debe ser 2 o mayor." }
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$folder=(Resolve-Path $OutputDir).Path
$name="airsoft_geo_pg_$(Get-Date -Format 'yyyyMMdd_HHmmss').backup"
$target=Join-Path $folder $name
try {
 & pg_dump --format=custom --no-owner --no-privileges --dbname="$env:SUPABASE_DB_URL" --file="$target"
 if ($LASTEXITCODE -ne 0 -or -not (Test-Path $target) -or (Get-Item $target).Length -eq 0) {
  throw "pg_dump terminó con error. No se ha creado un respaldo válido."
 }
 $checksum=(Get-FileHash -Algorithm SHA256 -Path $target).Hash
 $manifest=[ordered]@{
  product="Airsoft Geo";database="PostgreSQL";created_at=(Get-Date).ToString("o");
  filename=$name;bytes=(Get-Item $target).Length;sha256=$checksum;
  note="No contiene los bytes de archivos de Storage. Respaldarlos por separado."
 }
 $manifest|ConvertTo-Json|Out-File "$target.json" -Encoding utf8
 Write-Output "Copia de PostgreSQL realizada: $target"
 Write-Output "Tamaño: $($manifest.bytes) bytes. SHA256: $checksum"
 # Purgar únicamente copias anteriores reconocidas, después de confirmar éxito.
 $older=Get-ChildItem -Path $folder -Filter 'airsoft_geo_pg_*.backup' |
  Sort-Object LastWriteTime -Descending | Select-Object -Skip $KeepLast
 foreach($old in $older){
  Remove-Item -LiteralPath $old.FullName -Force
  if(Test-Path "$($old.FullName).json"){Remove-Item -LiteralPath "$($old.FullName).json" -Force}
 }
} catch {
 if (Test-Path $target){ Remove-Item -LiteralPath $target -Force }
 throw
}
