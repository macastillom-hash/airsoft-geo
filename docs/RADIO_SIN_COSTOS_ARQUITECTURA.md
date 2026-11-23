# Airsoft Geo — Plan de voz sin facturación

## Decisión técnica
1. **Fase A:** WebRTC P2P para **2 participantes** con STUN y Supabase Realtime usado exclusivamente como señalización/presencia; tráfico de audio no pasa por Supabase. Sin infraestructura nueva. Si el par ICE resulta directo, no se necesita TURN para esa conexión.
2. **Fase B:** probar Android con pantalla bloqueada y manos libres 3,5 mm. Requiere una aplicación nativa y permiso explícito, no se soluciona solo con WebRTC web.
3. **Fase C:** grupos mediante **LiveKit autohospedado** con TURN integrado, no con una malla P2P de N conexiones por participante; con muchos usuarios, la subida y CPU del celular saturarían. SFU acepta una pista publicada y distribuye una copia a cada escucha.
4. **Fase D:** pruebas 2 → 5 → 10 → 20 → 50 usuarios, con mediciones reales antes de autorizar más. No son capacidades garantizadas.

## TURN no es opcional en todas las redes
- Con NAT compatible, audio P2P puede funcionar sin TURN; mostrar «Directa (sin TURN)» en la sección Radio PTT.
- Si las redes celulares / CGNAT / firewalls impiden establecer rutas directas, la llamada no se puede garantizar sin TURN o un SFU accesible por red.
- **No usar TURN público abierto:** no hay garantías de disponibilidad, privacidad, rendimiento ni posibilidad de consumo abusivo.
- El STUN público `stun.l.google.com:19302` que se utiliza en la prueba no constituye un servicio garantizado para producción.
- **No usar Cloudflare Quick Tunnel como sustituto de TURN/UDP:** Cloudflare Tunnel de sitio web no proporciona automáticamente un punto de entrada genérico TURN para navegadores.
- **No instalar TURN en Render Static Site o Supabase Edge Function:** no son servidores UDP persistentes controlables.

## Opción realmente sin nuevas cuotas comerciales
Utilizar un ordenador Linux propio, disponible durante la actividad, con IP pública enrutable (o dominio dinámico) y **redirección de puertos UDP/TCP del router**, siempre que el proveedor de Internet lo permita. La electricidad, el acceso a Internet y la infraestructura física existentes siguen teniendo costo operativo. Si la conexión está bajo CGNAT, sin IP pública enrutable o sin puertos abiertos, no podemos prometer TURN público desde ese equipo.

**Para dos móviles:** coturn, con credenciales efímeras emitidas por un backend confiable, y puertos UDP para TURN/relé. Nunca incluir la clave secreta TURN (shared secret) o contraseñas administrativas en VITE_*, JavaScript cliente o GitHub.

**Para más de dos móviles:** LiveKit autohospedado ya cuenta con TURN integrado y es la opción preferida; requiere CPU, ancho de banda simétrico, IP alcanzable, puertos WebRTC, TLS válido y servicios que permanezcan ejecutándose. Evaluar Ubuntu/Docker solo tras confirmar esas condiciones.

## Costos y límites realistas
Supabase Free: el plan incluye un máximo anunciado de 200 conexiones Realtime concurrentes y 2 millones de mensajes al mes (sujeto a condiciones vigentes). **200 no significa 200 usuarios de voz**, porque GPS, chat y los otros módulos pueden abrir otras conexiones. En modalidad Free una cuota superada puede limitar/suspender funcionalidades; no asumir capacidad ilimitada.

No activar recursos de infraestructura con pago por uso ni facilitar información de pago. No implementar tokens de servicios TURN facturables sin consentimiento explícito.

## Prueba sugerida
1. Dos teléfonos, el mismo equipo y dos cuentas diferentes, pantalla encendida.
2. En ambos: botón «Entrar a la radio», luego «Activar audio» si fuera necesario.
3. Voz bidireccional; comprobar que la pulsación/soltar mutea correctamente.
4. Registrar «Ruta de conexión» (Directa / TURN) y RTT. La latencia reportada es de red, no de audio extremo a extremo.
5. Repetir: mismo Wi-Fi; Wi-Fi distinto; uno Wi-Fi y otro 4G; ambos 4G.
6. Si falla solo con 4G, registrar «failed» ICE, NAT y versión de Android. No habilitar de forma automática un TURN de pago.
7. Verificar GPS y cámara por separado en la misma sesión.

## Verificaciones externas
- https://docs.livekit.io/transport/self-hosting/deployment/
- https://docs.livekit.io/transport/self-hosting/ports-firewall/
- https://github.com/coturn/coturn
- https://supabase.com/docs/guides/realtime/limits
- https://supabase.com/docs/guides/realtime/pricing

## Pendientes
- No se ha provisionado servidor TURN ni LiveKit. Sin infraestructura pública compatible, no existe garantía de conectividad en todas las redes.
- No se ha realizado benchmark multiusuario.
- No se ha construido APK Android para pantalla apagada.
- No se ha aplicado migración SQL de la rama en Supabase ni desplegado versión de pruebas.
