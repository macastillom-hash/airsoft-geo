# Airsoft Geo — Fase 5.1: mapa unificado, perfiles y avisos rápidos

## Cambios principales

- Un solo módulo **Mapa GPS** con vistas **Mi equipo / Cercanos / Ambos**.
- Fotos circulares en el mapa para el usuario y compañeros con imágenes autorizadas; los usuarios cercanos no reciben acceso a fotografías privadas.
- Tarjeta al tocar tu marcador o el de un compañero: alias, rol, equipo, distancia, hora/precisión GPS y accesos de aviso. Los botones **siempre reportan desde el usuario que pulsa**.
- Rieles flotantes permanentes: Rival izquierda, derecha, cerca; Necesito apoyo, En posición y menú Más (Médico, Me retiro, Eliminado).
- Los avisos se guardan en \`team_signals\`, se notifican a compañeros por el sistema existente y crean marcadores temporales **en la posición del emisor**, nunca en una presunta posición del rival.
- Las señales médicas/de apoyo expiran a los 8 minutos; las demás a los 3 minutos. Un usuario no puede saturar el equipo con más de una señal por cada 5 segundos.
- **Mi perfil**: alias, nombre visible opcional, descripción y fotografía privada de 512px (JPG/PNG/WebP, 3MB después de compresión) en el bucket \`profile-avatars\`.
- **Roles administrativos por equipo**: propietario, administrador, coordinador y participante. Solo el propietario puede asignarlos. Administrador: avisos oficiales y retirar participantes salvo propietarios/otros administradores. Coordinador: avisos oficiales. Participante: aviso rápido. El control de organización de actividades V3 sigue reservado al organizador.
- **Roles operativos configurables** por equipo: Líder, Explorador, Apoyo, Comunicaciones, Primeros auxilios y Participante, con CRUD en Equipos. El organizador puede asignar un rol operativo diferente en cada actividad.
- **GPS mejorado**: mientras se consulta Mapa GPS o Actividades con la web visible, actualizaciones a un ritmo objetivo máximo de una cada 8 segundos, siempre que el navegador entregue ubicación reciente (no se reutilizan observaciones de más de 30 segundos). En otras secciones, aproximadamente 15 segundos. A los 25 segundos sin recibir actualización, los marcadores se consideran retrasados y dejan de mostrarse como recientes.
- Privacidad: las coordenadas de avisos se obtienen de \`positions\` únicamente si el usuario habilitó compartir GPS y tiene una muestra reciente y de precisión <=100m; nunca de valores arbitrarios suministrados en los botones. Al retirar GPS, se borran las coordenadas de los avisos vigentes. El aviso textual aún puede enviarse sin GPS.

## Reglas de privacidad y limitaciones

1. Abrir la vista Cercanos **no activa** el permiso público de descubrimiento ni la compartición GPS.
2. Para aparecer en Cercanos hacen falta dos permisos: compartir GPS y permitir descubrimiento.
3. A otros usuarios registrados no compañeros solamente se muestra posición redondeada, a través de \`nearby_people\`; fotos privadas nunca.
4. Enviar un aviso de rival izquierda/derecha es un **reporte humano** relativo a la percepción del informante; la plataforma no calcula la ubicación del rival.
5. Los avisos SOS son internos al equipo. **No sustituyen la llamada a servicios de emergencia ni garantizan una respuesta.**
6. El navegador puede suspender GPS en segundo plano; no se garantiza disponibilidad ni precisión continua en un celular bloqueado.
7. Fotografías y nombres son opcionales. No almacenes información clínica sensible en el perfil.
8. Los roles operativos no otorgan permisos administrativos.

## Compatibilidad

La migración \`supabase/migracion_fase5.sql\` es aditiva: conserva las 17 tablas de V1–V4, agrega \`team_roles\`, \`team_signals\`, columnas del perfil y roles de membresía/actividad, y crea un bucket privado. No cambia las tablas de mensajes, notificaciones, operaciones, banderas o respaldos.

**No** ejecutar nuevamente migraciones V1–V4. Se debe revisar RLS y permisos RPC antes de desplegar la interfaz.

## Pruebas funcionales sugeridas desde celulares

1. Confirmar GPS, chat, multimedia, banderas, eliminación virtual, reportes y push de V4.
2. Abrir Mapa GPS: cambiar Mi equipo, Cercanos, Ambos; verificar marcadores sin duplicados, misma precisión de privacidad y fotos.
3. Tocar el marcador propio y el de un compañero; comprobar foto, rol y aviso desde el propio usuario, no desde el otro.
4. Probar los ocho avisos flotantes; comprobar notificaciones push en el otro celular y marcadores efímeros.
5. Desactivar GPS y enviar señal: debe enviar aviso sin coordenadas, y borrar las coordenadas anteriores.
6. Confirmar que usuario ajeno al equipo no puede leer señales, fotografías ni roles.
7. Subir, cambiar y eliminar una fotografía; comprobar que no permite acceder a avatar ajeno.
8. Crear, editar, borrar roles operativos. Asignar administrador/coordinador a distintos usuarios y verificar las restricciones.
9. Asignar roles diferentes en una actividad. Comprobar que una actividad cerrada no permite cambiarlos.
10. Revisar GPS en movimiento con celular visible y bloqueado, distinguiendo ubicación en vivo de posición obsoleta.

## Respaldo

La configuración de respaldos cifrados de PostgreSQL y Storage **sigue pendiente de los cuatro secretos en GitHub Actions**. El bucket \`profile-avatars\` también debe incluirse en el respaldo a partir de V5 (ver actualización del script).

