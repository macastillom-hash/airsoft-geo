# Airsoft Geo / Operación Sombra — Fase 2

**Objetivo:** agregar notificaciones y vibración cuando la aplicación está abierta, chat privado, mensajes de voz grabados en el celular y administración básica de equipos, **sin borrar la Fase 1**.

## Resumen de cambios

- Notificaciones persistentes en Supabase, creadas por triggers seguros: mensaje de equipo, mensaje privado y alerta administrativa. El emisor no recibe notificación de su propio mensaje.
- Centro de notificaciones con indicador de pendientes y opciones para marcar como leídas.
- Preferencias por dispositivo: vibración, sonido opcional, avisos del navegador en una pestaña en segundo plano.
- Grabación de voz (máximo 60 s) en chat de equipo y chat privado; pide permiso al micrófono solo al tocar el botón.
- Chat privado entre dos personas del mismo equipo, con imágenes, video, audios y PDF. Bucket de archivos privado.
- El creador del equipo puede cambiar su nombre, retirar participantes (excepto a sí mismo) y emitir alertas al grupo.
- Manifest y service worker mínimos para instalación web y avisos de la sesión activa.
- Se conservan el GPS, el mapa, la búsqueda de cercanos, el registro, los equipos y el chat V1.

## Orden correcto de instalación (importante)

### 1. Respaldo

1. Conserva una copia del ZIP V1 y del repositorio GitHub antes de modificarlo.
2. Si lo deseas, exporta las tablas desde Supabase. **No borres las 5 tablas actuales.**

### 2. Migración de base de datos (PRIMERO)

1. Entra a Supabase → tu proyecto → **SQL Editor** → **New Query**.
2. Abre `supabase/migracion_fase2.sql`, copia todo el contenido y ejecútalo **una vez**.
3. Debe salir `Success`. La migración es aditiva y contiene `IF NOT EXISTS`/recreación controlada de políticas para permitir reintentos.
4. Comprueba en Table Editor que ahora tengas **8 tablas públicas**: las cinco anteriores (`profiles`, `teams`, `team_members`, `positions`, `messages`) más `direct_messages`, `team_alerts` y `app_notifications`.
5. Confirma que Realtime esté habilitado para `app_notifications` y `direct_messages`.

Consulta opcional de verificación:

```sql
SELECT tablename, rowsecurity AS rls_habilitado
FROM pg_tables
WHERE schemaname='public'
AND tablename IN ('profiles','teams','team_members','positions','messages','direct_messages','team_alerts','app_notifications')
ORDER BY tablename;
```

**No vuelvas a ejecutar `supabase/schema.sql`: es el esquema inicial y sus instrucciones `CREATE TABLE` no están diseñadas para repetirse.**

### 3. Actualizar GitHub

1. Abre tu repositorio `macastillom-hash/airsoft-geo`.
2. Copia **el contenido** de esta carpeta a la raíz del repositorio, manteniendo exactamente las subcarpetas `src`, `public`, `supabase` y los archivos `package.json`, `index.html`, etc.
3. Haz `Commit` en la rama `main`. Si ya has modificado código después de V1, compara esos cambios antes de sobrescribirlos.
4. Render debería detectar el nuevo commit automáticamente; si no, usa **Manual Deploy → Deploy latest commit**.
5. Conserva las variables existentes `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; **no hace falta modificarlas**.
6. Render debe mostrar `Your site is live`. Comprueba que se publicaron los archivos `/notification-sw.js` y `/manifest.webmanifest`.

### 4. Probar en dos celulares (Android recomendado para vibración)

1. Entra con dos cuentas diferentes en `https://airsoft-geo.onrender.com/`.
2. Comprueba que los equipos, mapa GPS, usuarios cercanos y mensajes de equipo V1 siguen funcionando.
3. En **Mi perfil → Alertas y vibración**, activa Vibrar y pulsa **Probar vibración**. En navegadores sin soporte, se mostrará una explicación, sin errores.
4. Desde el celular A, envía un mensaje en el chat de equipo. En el celular B, verifica la nueva notificación y la vibración **mientras Airsoft Geo esté abierto**.
5. Abre **Notificaciones** en B, comprueba que aparezca el aviso y márcalo como leído.
6. En **Mensajes → Mensajes privados**, selecciona un integrante. Envía texto, foto y nota de voz. Verifica en el segundo dispositivo que solo esa cuenta pueda abrir la conversación privada.
7. Pulsa **Grabar audio** y luego **Detener**; el audio queda adjunto y debes pulsar **Enviar** para compartirlo. Si el navegador bloquea micrófono, se mostrará un aviso.
8. El propietario de un equipo puede entrar en **Equipos**, editar su nombre y **Enviar una alerta al equipo**. Confirma que B la reciba. Antes de probar **Retirar participante**, utiliza una cuenta de pruebas.
9. Prueba con el GPS activo y detenlo; la configuración de notificaciones no debe iniciar la compartición del GPS.
10. Cierra sesión y vuelve a ingresar; los mensajes, archivos y notificaciones persistirán en Supabase.

## Qué significa “vibrar” en esta versión

- Android: `navigator.vibrate()` en navegadores compatibles, siempre que el sistema permita vibrar y el usuario haya interactuado previamente. No se garantiza vibración con la app bloqueada o cerrada.
- iPhone/iPad Safari: no ofrece compatibilidad equivalente de `navigator.vibrate()`. Se mantienen avisos en pantalla y notificaciones del sistema cuando correspondan.
- La opción **Permitir notificaciones** pide permiso al navegador, pero **no configura envíos push con la app cerrada**. Este servicio requiere generar suscripciones Push API, VAPID, backend seguro y un flujo de entrega; queda pendiente de una fase posterior.
- Con la pestaña en segundo plano, Realtime puede dejar de ejecutarse por suspensión del sistema; al regresar a la web se actualiza el listado de avisos pendientes, pero **no se vibra de forma retroactiva**.
- El audio opcional puede ser bloqueado por políticas de reproducción automática.

## Seguridad y límites

- Todos los nuevos datos usan RLS y permisos limitados al rol autenticado.
- Cada notificación solo puede leerla o marcarla como leída su destinatario. Los clientes no pueden insertar notificaciones arbitrarias.
- Solo el propietario de un equipo puede emitir avisos grupales administrativos, modificar el nombre del equipo o expulsar miembros.
- El chat privado solo admite mensajes a personas que comparten al menos un equipo y los archivos van a un bucket privado.
- Archivos multimedia: **10 MB máximo por archivo**; voz: **60 segundos máximo** por grabación.
- No transmitas coordenadas, fotografías personales o información sensible a personas no autorizadas. Las ubicaciones siguen requiriendo el permiso y la decisión explícita de compartirlas.
- Supabase y Render poseen límites gratuitos de tráfico, operaciones y almacenamiento.

## Solución de incidencias frecuentes

- `permission denied for table direct_messages / app_notifications`: la migración de Supabase no se ejecutó completamente; revisa sus resultados. No desactives RLS como solución.
- No llegan notificaciones con la web abierta: comprueba en Supabase **Database → Publications → supabase_realtime** que `app_notifications` esté publicada y que las políticas RLS estén activas.
- No vibra en iPhone: limitación del navegador, no fallo de la base de datos.
- No se puede grabar voz: revisa que el sitio esté en HTTPS y que el micrófono esté permitido.
- Pantalla en blanco tras subir el código: revisa los logs de Render y los mensajes de consola; no vuelvas a ejecutar el SQL inicial.

## Archivos añadidos

- `supabase/migracion_fase2.sql`: tablas, triggers, políticas y permisos.
- `src/notificationUtils.js`: preferencias, patrones de vibración y sonido opcional.
- `src/NotificationCenter.jsx`: notificaciones y ajustes.
- `src/VoiceRecorder.jsx`: grabación de voz y adjuntos.
- `src/DirectChat.jsx`: mensajería privada y multimedia.
- `src/TeamAdmin.jsx`: gestión de equipo y alertas.
- `public/notification-sw.js`, `public/manifest.webmanifest` e iconos.

**Estado de validación de esta entrega:** los archivos JS no-JSX se verifican por sintaxis y se incluyen comprobaciones estáticas. No se ha realizado prueba de compilación Vite de extremo a extremo ni validación contra una instancia real de Supabase en este entorno. La prueba completa debe realizarse con dos usuarios reales después de ejecutar la migración y desplegar el código.
