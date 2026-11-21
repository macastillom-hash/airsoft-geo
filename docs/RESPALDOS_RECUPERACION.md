# Airsoft Geo — Respaldos, verificación y recuperación segura

## Estado y alcance

Este paquete no modifica GPS, chat, actividades, usuarios ni datos de producción. El objetivo es conservar **PostgreSQL** y los **objetos privados de Supabase Storage**. No se deben subir copias sin cifrar a GitHub.

Proyecto: `lfkyznzwvgrsnmaukigi`. Contenedores obligatorios: `team-media` y `direct-media`.

La tarea programada está **preparada pero NO operativa** hasta que se configuren los secretos en GitHub y se compruebe una ejecución satisfactoria. Los respaldos de PostgreSQL y Storage no son instantáneos entre sí; durante la copia pueden producirse cambios.

## 1. Generar la clave de cifrado fuera de GitHub

Instala `age` desde su proyecto oficial: https://github.com/FiloSottile/age/releases

En un equipo propio con la herramienta instalada:

```bash
age-keygen -o airsoft-private-age.txt
age-keygen -y airsoft-private-age.txt
```

La segunda orden imprime un **destinatario público** que empieza por `age1`. Conserva el archivo `airsoft-private-age.txt` en un lugar privado **fuera del repositorio**, preferiblemente con una segunda copia offline. Quien tenga esta clave privada puede descifrar los respaldos. Si se pierde, **las copias cifradas no podrán recuperarse**.

## 2. Configurar cuatro secretos de GitHub Actions

En https://github.com/macastillom-hash/airsoft-geo abre **Settings → Secrets and variables → Actions → New repository secret**.

| Nombre del secreto | Valor esperado |
| --- | --- |
| `SUPABASE_URL` | `https://lfkyznzwvgrsnmaukigi.supabase.co` |
| `SUPABASE_DB_URL` | URI PostgreSQL de **Session Pooler**, desde Connect en Supabase; debe usar TLS, usuario/clave reales y puerto de sesión (habitualmente 5432) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servidor de Supabase; no es la pública `anon` |
| `BACKUP_AGE_RECIPIENT` | Clave pública `age1...` obtenida con `age-keygen -y` |

**Nunca pegues** la contraseña de PostgreSQL, la clave de servidor o la clave privada age en el chat, el código, los issues ni los logs de Actions.

## 3. Ejecución diaria automática

Archivo: `.github/workflows/encrypted-backup.yml`. Está programado para las **03:15 a. m. de Colombia**, equivalente a **08:15 UTC**, además de permitir ejecución manual.

En **Actions → Encrypted Airsoft Geo backups → Run workflow**, realiza la primera ejecución. Debe completar:

1. Exportar PostgreSQL 17 como archivo de respaldo en formato personalizado.
2. Validar que `pg_restore --list` pueda leer el dump.
3. Enumerar y descargar ambos buckets privados con sus credenciales de servidor.
4. Calcular SHA-256 de cada objeto y del archivo de PostgreSQL.
5. Comprobar integridad y comprimir los datos.
6. Cifrar todo con la clave pública `age`.
7. Subir **solamente** el archivo `.tar.gz.age` y su `.sha256` como artifact de GitHub, con una retención de **30 días**.

Si faltan los secretos, el trabajo fallará: eso **no cuenta como respaldo realizado**. Los artifacts del repositorio público deben considerarse accesibles por terceros; la privacidad depende del cifrado y de que la clave privada permanezca secreta. Descarga periódicamente las copias cifradas a otra ubicación segura para evitar depender de la retención de 30 días.

## 4. Comprobar un respaldo descargado

Guarda juntos el artifact `.tar.gz.age`, el `.sha256`, y tu archivo privado de identidad age en un equipo confiable. Desde Linux/WSL con Node 22, Docker y age:

```bash
bash scripts/inspect-encrypted-backup.sh copia.tar.gz.age /ruta/segura/airsoft-private-age.txt
```

Este procedimiento verifica la huella SHA-256 del archivo cifrado (si está presente), lo descifra **solo en una carpeta temporal**, verifica los hashes de archivos Storage y comprueba que el dump es legible por PostgreSQL 17. No toca ninguna base de datos.

## 5. Prueba de restauración

### PostgreSQL: prueba sintética automatizada

`tests/staging-restore-smoke.sh` arranca un servidor PostgreSQL 17 aislado en Docker, crea datos sintéticos, hace `pg_dump`, restaura con `pg_restore` y verifica registros. Se ejecuta en CI. **Esto no equivale a haber restaurado un respaldo real de Supabase**.

### Restauración con datos reales: requerirá proyecto de ensayo

Para demostrar recuperación real debe crearse o utilizarse un **proyecto Supabase separado** con credenciales diferentes de las de producción. Planifica primero la restauración de PostgreSQL incluyendo compatibilidad de extensiones, esquema `auth`, identidades y metadatos `storage`. No hagas un `pg_restore --clean` contra la aplicación principal.

Para restaurar los medios de una copia descifrada en un **proyecto distinto** ya preparado:

```bash
export STAGING_SUPABASE_URL='https://OTRO_PROYECTO.supabase.co'
export STAGING_SUPABASE_SERVICE_ROLE_KEY='CLAVE_DEL_PROYECTO_DE_PRUEBA'
export I_CONFIRM_STAGING_RESTORE='YES'
node scripts/restore-storage-staging.mjs /ruta/copia-descifrada
```

El script rechaza explícitamente el identificador de producción, verifica SHA-256 y sube los archivos con `upsert:false` para no sobrescribir copias previas. Debe ejecutarse sobre buckets privados limpios, reconciliando sus metadatos con la restauración de PostgreSQL. Esta restauración a un proyecto real **aún no se ha ejecutado**.

## 6. Interpretación del resultado

- **Automatización creada**: hay workflow programado.
- **Automatización activa**: existen los cuatro secretos y Actions ejecutó un respaldo sin errores.
- **Respaldo verificable**: se descargó y descifró, y el verificador pasó.
- **Recuperación comprobada**: la restauración de la copia real funcionó en un proyecto separado y se pudo iniciar sesión, acceder a datos y abrir los adjuntos.

No afirmar que el sistema tiene recuperación garantizada hasta completar estos cuatro hitos.

## 7. Seguridad y mantenimiento

- Copias con datos personales, audios y GPS: almacenamiento privado y cifrado obligatorios.
- Ninguna clave de servidor ni de descifrado debe estar en código fuente o frontend.
- No compartir las copias descifradas mediante enlaces públicos.
- Revisa periódicamente el estado de los workflows, credenciales y cuotas de almacenamiento.
- Revisa también los avisos pendientes del Security Advisor de Supabase.
- La restauración de datos puede sobrescribir cuentas e identidades; nunca ensayarla sobre producción.

Documentación oficial:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage
- https://docs.github.com/en/actions
