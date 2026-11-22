# Airsoft Geo — Fase 5.2

## Mapa y GPS
La pantalla Mapa GPS ocupa casi toda la altura útil de móvil. Los controles superiores independientes «Compartir GPS» y «Permitir que me encuentren» permanecen visibles. No se activa el descubrimiento público al consultar Cercanos.

Opciones: filtros de participantes, Calles / Satélite, centrar GPS, seguir la posición, pantalla completa donde el navegador lo admita, bases y objetivos autorizados por RLS, y elección de un punto temporal tocando el mapa.

El objetivo seleccionado muestra distancia y rumbo cuando hay ubicación reciente. La línea discontinua es **una orientación en línea recta**, no un sendero. «Cómo llegar» abre voluntariamente Google Maps con modo a pie y solo envía el destino seleccionado; las rutas de caminos dependen del servicio externo, cobertura y condiciones del terreno. Los puntos manuales no se guardan en Supabase.

## Cronómetro
La hora de inicio se registra al iniciar una actividad, y el organizador puede pausar/reanudar desde diferentes dispositivos. Se conservan horas y pausas en PostgreSQL. El cronómetro no finaliza automáticamente la actividad al agotarse el tiempo; la finalización es manual. Para actividades antiguas ya en curso el organizador puede iniciar el contador desde ahora sin inventar historia. El contador visible depende del reloj del dispositivo.

La migración aditiva de la Fase 5.2 agrega columnas a public.activities, un trigger protegido y una función RPC f52_timer_action. La edición directa de columnas de temporización desde el cliente está bloqueada. La actividad continúa utilizando sus permisos y reglas V3.

## Protección al perder Internet
Se sondea la disponibilidad del sitio mientras está visible. En desconexión: advertencia global, avisos rápidos y cambios de actividad bloqueados; no se afirman envíos que no estén confirmados. No se hacen reintentos automáticos de alertas SOS; el usuario debe enviarlas cuando regrese Internet.

Si se desactiva GPS sin conexión, el teléfono deja de transmitir inmediatamente, pero el borrado remoto queda pendiente y no se promete eliminación hasta confirmarlo. Los demás dejan de mostrar ubicaciones que no tengan una marca temporal reciente. Al recuperar Internet se consulta el estado y se reintenta el borrado. La web no garantiza GPS funcionando con la pantalla bloqueada.

## Validación desde dos o más celulares

1. Verifica V5.1: GPS, equipos, chats, multimedia, avisos rápidos, roles, banderas, eliminación virtual y push.
2. Comprueba que Mapa GPS ocupa casi toda la pantalla, con Compartir GPS y Permitir que me encuentren arriba.
3. Cambia entre Mi equipo, Cercanos y Ambos; verifica calles, satélite, seguirme y pantalla completa.
4. Selecciona objetivo de actividad y destino manual. Comprueba distancia, rumbo, línea recta y apertura externa de navegación peatonal.
5. Inicia actividad nueva, pausa el cronómetro, recarga la web y reanuda. Comprueba permisos entre organizador y participante.
6. Desactiva Internet; no debe aparecer «aviso enviado» sin confirmación.
7. Recupera conexión y comprueba la actualización de información; desactiva compartir GPS sin Internet y verifica el borrado posterior.
8. Prueba tanto en vertical como en horizontal y con precisión GPS variable.

## Consideraciones
No se transmiten posiciones de compañeros a Google Maps. Una ruta peatonal externa no garantiza acceso por caminos autorizados o seguros y no debe usarse como única referencia en campo. Los controles SOS internos no sustituyen servicios de emergencia.

## Respaldos
Los respaldos cifrados de PostgreSQL y Storage todavía requieren configurar los cuatro secretos de GitHub Actions y validar una restauración real en un proyecto separado. La migración 5.2 no altera ese pendiente.
