# Radio PTT LiveKit — Airsoft Geo (integración en rama de pruebas)

## Estado
Código React + función de token escrito y pendiente de pruebas reales. No se ha desplegado a producción ni se han introducido secretos.

## Antes de probar
1. **LiveKit**: mantener el proyecto en plan gratuito Build y verificar las cuotas del panel. No activar planes de pago.
2. **Supabase**: abrir el proyecto que realmente utiliza Airsoft Geo, en **Edge Functions → Secrets**.
3. Crear estas variables, sin copiar valores secretos a GitHub, React ni al chat:
   - `LIVEKIT_URL`: dirección `wss://...` de LiveKit Cloud
   - `LIVEKIT_API_KEY`: API Key de LiveKit Cloud
   - `LIVEKIT_API_SECRET`: API Secret de LiveKit Cloud (privado)
4. Desplegar la función **radio-token** incluida en `supabase/functions/radio-token/index.ts` mediante Supabase Edge Functions o CLI. Dejar activada la comprobación de JWT. La función valida `getUser` contra Supabase Auth y consulta `team_members` con RLS.
5. **No ejecutar** `supabase/radio_ptt_v1.sql` para LiveKit: esas políticas son solo para el prototipo anterior basado en Supabase Realtime, no se requieren para LiveKit Cloud.
6. Desplegar un preview HTTPS de la rama de GitHub `feature/radio-ptt-v1-diagnostics` (no sustituir main).
7. En dos cuentas de Supabase diferentes del mismo equipo, abrir **Radio PTT**, elegir el mismo equipo y pulsar **Entrar a la radio**. Conceder micrófono y **Activar sonido** si el navegador lo exige.
8. Comprobar audio A→B, B→A, silencio tras soltar PTT y que salir libera el micrófono.

## Seguridad
- El JWT LiveKit expira a los 5 minutos, pero una sesión que ya esté conectada puede continuar; aún falta revocación inmediata de participantes expulsados.
- La función sólo genera tokens para integrantes del equipo autenticados; no confía en una identidad suministrada por el usuario.
- El token permite publicar micrófono, no video ni datos, y unirse solo a la sala del equipo.
- La API Secret nunca se guarda en `VITE_*` ni en el repositorio.
- El frontend no puede acceder a salas arbitrarias sin conseguir autorización del servidor.
- No se guardan grabaciones.
- La primera versión no incorpora arbitraje de canal de voz (dos usuarios pueden pulsar PTT al mismo tiempo).
- No se garantiza audio con pantalla bloqueada en navegador web. Falta aplicación Android y botón físico 3,5 mm.
- Revisar cuotas de LiveKit Free: duración de conexión de cada participante consume minutos.

## Preproducción
No fusionar PR #17 ni usar SQL/Edge Function en un proyecto Supabase equivocado. Ejecutar build y probar manualmente antes de publicar.
