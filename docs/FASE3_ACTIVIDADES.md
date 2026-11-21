# Airsoft Geo — Fase 3: actividades y coordinación

Esta versión añade una sección **Actividades** sin modificar el comportamiento de registro, GPS, equipos, chat o multimedia de V2.

## Reglas
- El propietario de un equipo puede crear una actividad en borrador, asociar su equipo y compartir un código con un segundo propietario.
- Se permiten hasta 2 equipos por actividad, cuyos miembros deben inscribirse expresamente.
- Las modalidades son coordinación, sigilo, inteligencia, eliminación virtual y captura de bandera.
- Solo el organizador programa, inicia, termina, cancela y define zonas GPS.
- **Eliminación virtual:** el participante rival debe confirmar la solicitud digital; se admite reincorporación supervisada o automática de 30/60/120 segundos.
- **Bandera virtual:** dos bases GPS y dos equipos son obligatorios; recoger y puntuar requiere ubicación compartida reciente, precisión estimada mejor que 60 metros y estar en el radio autorizado.
- Todo control de GPS es voluntario y se sigue gestionando desde la V2. Los rivales no reciben sus coordenadas a través de la sección Actividades.
- El chat y los adjuntos siguen usando las pantallas y almacenamiento privados existentes de V2.

## Migración
No ejecutar los scripts iniciales de V1/V2. **Después de respaldar la base de datos**, ejecutar solo `supabase/migracion_fase3.sql` una vez. Crea 7 tablas nuevas: `activities`, `activity_teams`, `activity_participants`, `activity_zones`, `activity_eliminations`, `activity_flags`, `activity_events`.

Antes de fusionar en `main`, verificar que la migración no modifique usuarios actuales, que todas las nuevas tablas tengan RLS, que React compile y que las pruebas V2 sigan funcionando. Para regresar a V2 basta revertir el código; **no eliminar tablas V3**.

## Pruebas manuales mínimas
1. V2: probar registro, login, equipos, GPS, desactivar GPS, chats, adjuntos, vibración y notas de voz.
2. Crear/editar actividad y unir dos propietarios de equipos por código.
3. Inscripción y retiro de participantes autorizados; otros usuarios no deben operar la actividad.
4. Crear/editar/borrar zonas GPS antes de iniciar; probar que no se puedan modificar durante actividad activa.
5. Probar solicitud, rechazo y confirmación de captura virtual, y recuperación de participante.
6. Con GPS compartido y preciso, recoger bandera rival en su base y puntuar en base propia; probar que fuera de zona se rechace.
7. Revisar historial de eventos, notificaciones y carga en móviles.

## Límites
- No existe seguimiento de ubicación en segundo plano.
- El GPS se puede falsificar en dispositivos modificados. No reemplaza confirmación presencial ni sistemas de seguridad física.
- La fecha y duración son informativas: el organizador inicia/finaliza manualmente.
- Las notificaciones push con la aplicación completamente cerrada todavía no están implementadas.
