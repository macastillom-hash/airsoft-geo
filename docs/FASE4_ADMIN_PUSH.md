# Airsoft Geo V4 — administración, reportes, respaldo y Web Push

## Qué conserva
V1-V3 completas: autenticación, equipos, GPS voluntario, chat multimedia, alertas y vibración, actividades, zonas y modalidades virtuales. Todas las funciones existentes conservan sus tablas y rutas.

## Administración
El enlace **Administración** aparece solamente si el usuario es propietario de algún equipo. Supabase restringe el acceso a informes y auditoría también en el servidor. Incluye:
- resumen de integrantes, actividades, mensajes y alertas (los contadores de mensajes/alertas tienen tope de 500);
- reporte filtrable de actividades, inscripciones, marcador y eventos;
- exportación CSV de integrantes y actividades;
- exportación JSON informativa del equipo, sin mensajes privados, adjuntos, claves ni GPS;
- impresión o guardar como PDF desde el navegador;
- bitácora de cambios de nombre del equipo, retiro de integrantes y cambios de estado de actividades a partir de V4.

Los datos CSV/JSON no constituyen un respaldo recuperable completo de Postgres. No hay importación automática de ese JSON.

## Respaldo completo en Supabase Free
Supabase Free no incluye backups automáticos administrados. Para una restauración real debes exportar Postgres con Supabase CLI o pg_dump y guardar una copia segura fuera del proveedor. Debes respaldar adicionalmente los objetos del Storage privado. Nunca subir los backups con datos personales a un repositorio público. Documentación: https://supabase.com/docs/guides/platform/backups

## Push con app cerrada
1. Migración V4: \`supabase/migracion_fase4.sql\` añade \`f4_admin_audit\`, \`push_subscriptions\`, políticas RLS y un trigger de entrega asíncrona mediante pg_net.
2. La función \`supabase/functions/airsoft-push/index.ts\` debe desplegarse como Edge Function **sin validación JWT de Gateway**, pues usa una firma HMAC generada por PostgreSQL, validada por la función. **NO** expone métodos de envío arbitrarios.
3. Las claves VAPID privadas y la clave de firma se guardan en **Supabase Vault**, nunca en la web ni GitHub. La clave pública se entrega únicamente a usuarios autenticados.
4. El propietario de cada dispositivo debe activar la opción en **Mi perfil**. Puede desactivarla después.
5. Las notificaciones requieren HTTPS, navegador con Push API, permiso concedido y conexión a servicios de notificación.
6. En iPhone: iOS 16.4+ y aplicación web instalada en la pantalla de inicio.
7. Cada usuario puede solicitar una prueba push como máximo una vez por minuto. Es necesario bloquear la pantalla para comprobar su recepción. El sistema no garantiza vibración ni entrega inmediata cuando el teléfono está bloqueado; depende del dispositivo.

Por privacidad, el contenido enviado como push es el título y un detalle genérico del aviso. No se envían ubicaciones GPS ni cuerpos del chat.

## Seguridad
- Ninguna nueva tabla permite acceso de \`anon\` ni consultas globales de terceros.
- Los servicios de push utilizan credenciales privilegiadas únicamente del lado del servidor.
- Los disparadores de auditoría y push no cancelan los mensajes ni las actividades si el subsistema falla.
- Las copias JSON/CSV se generan únicamente con información accesible al propietario según RLS.
- No compartir claves de Supabase ni claves privadas VAPID en capturas o archivos públicos.

## Validación posterior a la implementación
1. Desde dos dispositivos probar nuevamente GPS, chat, imágenes, audio, vibración y grupos.
2. En Administración, visualizar solo los equipos propios; comprobar que otro usuario no accede.
3. Exportar CSV/JSON y guardar PDF. Verificar que no contienen ubicación ni mensajes privados.
4. Cambiar nombre de equipo / estado de actividad y verificar bitácora.
5. Activar push en Android Chrome; comprobar permiso, suscripción y recepción de una prueba con pantalla bloqueada.
6. Desactivar push y verificar que el dispositivo deja de recibir pruebas.
7. En iOS PWA instalada en inicio, comprobar permiso y notificación; el resultado puede variar.
8. Revisar Supabase Advisors, logs de Edge Functions y Render.
