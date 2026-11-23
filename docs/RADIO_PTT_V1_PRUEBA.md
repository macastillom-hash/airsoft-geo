# Airsoft Geo — Radio PTT, prueba WebRTC entre dos dispositivos

**Estado:** prototipo aislado en rama de desarrollo. No está desplegado en producción. El módulo NO requiere una API de voz de pago; Supabase Realtime se utiliza solo para señalización y presencia, sujeto a sus cuotas del plan.

## Qué funciona en el código
- Nueva sección Radio PTT tras iniciar sesión.
- Sala privada por equipo; solo integrantes autorizados mediante políticas RLS.
- Dos sesiones de navegador conectadas al mismo equipo pueden establecer una conexión P2P WebRTC.
- Botón de pulsar para hablar y soltar para silenciar; también barra espaciadora o tecla V.
- Audio remoto por el reproductor HTML; si se bloquea la reproducción automática, pulsar **Activar audio**.
- Cuando el usuario sale, se cierra la conexión y se liberan las pistas del micrófono.
- No se guardan grabaciones ni se toca GPS, mapas, actividades o cámara.

## Preparación de Supabase (no se ha aplicado en producción)
1. Antes de desplegar una rama de pruebas, revisar `supabase/radio_ptt_v1.sql` en el SQL Editor y ejecutarlo en entorno autorizado de pruebas.
2. En **Realtime Settings**, deshabilitar **Allow public access** para exigir autorización de canales privados.
3. Confirmar que `realtime.messages` sigue con RLS y existen dos políticas `radio_ptt_team_%`.
4. No incluir en el frontend claves secretas ni service_role. Las políticas consultan la función `public.my_team(uuid)` existente.

## Prueba funcional con dos celulares
1. Abrir la versión de pruebas bajo HTTPS en dos celulares con cuentas distintas, ambos integrantes del mismo equipo.
2. En cada equipo abrir **Radio PTT** y escoger el mismo equipo.
3. Pulsar **Entrar a la radio**, conceder permiso del micrófono y comprobar presencia de ambos.
4. Si el estado indica **Audio conectado**, mantener presionado PTT en A; B escucha. Soltar y verificar silencio. Invertir.
5. Usar **Activar audio** si el navegador bloquea autoplay; usar audífonos 3,5 mm en una segunda prueba.
6. Desconectar un teléfono, verificar liberación del micrófono y reconectar manualmente.
7. Mientras se transmite, validar por separado GPS, mapas, cámara y batería.

## Restricciones pendientes
- **Máximo dos participantes** en esta prueba; no es un canal de voz masivo.
- **Sin TURN propio**: STUN público no garantiza llamadas entre diferentes operadoras o redes NAT restrictivas. STUN Google no es servicio con disponibilidad garantizada para producción. Se necesita evaluar alternativa autohospedada.
- **La pantalla apagada no está resuelta**: Android puede suspender el navegador. Se necesita un cliente Android nativo con Foreground Service de micrófono, permisos y pruebas por versión.
- **Botón físico de manos libres 3,5 mm**: solo se diagnostica el evento multimedia; el PTT físico real exigirá captura nativa de teclas, sujeto al hardware.
- **Sin garantía de costo cero indefinido**: cuotas de Supabase, uso de Internet móvil, TURN y alojamiento pueden causar costos. Nunca activar servicios facturables sin aprobación.
- No hay pruebas E2E entre dos celulares realizadas por esta entrega.

## Criterios para habilitar producción
- Compilación y controles existentes pasan en CI.
- Dos cuentas reales completan llamada bidireccional desde distintos móviles.
- Pruebas de privacidad y RLS contra usuarios ajenos al equipo.
- Pruebas de redes diferentes (Wi-Fi / 4G).
- Control de reconexiones y escalabilidad definido.
