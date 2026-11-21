# OPERACIÓN SOMBRA — Primera versión web (V1)

## 1. Qué incluye realmente
- Crear cuenta, iniciar/cerrar sesión, editar alias.
- Crear un equipo y unirse con un código privado.
- Localizar el propio celular mediante GPS con permiso del navegador.
- Activar/desactivar explícitamente la compartición de ubicación con los compañeros.
- Ver compañeros de equipo activos en el mapa y estimar distancias en metros.
- Optar voluntariamente por aparecer para usuarios cercanos (radio 1 km, coordenadas públicas redondeadas a 3 decimales y distancia a centenas de metros).
- Chat por equipos: mensajes, imágenes JPG/PNG/WEBP, videos MP4/WEBM, audios MP3/OGG/WEBM/M4A y PDF (máximo 10 MB por archivo).
- Adaptación a pantalla móvil y escritorio.

## 2. Requisitos gratuitos
- Node.js 22 o superior, npm y navegador actualizado.
- Proyecto Supabase gratuito: https://supabase.com/
- Acceso HTTPS para pruebas desde celulares remotos. En localhost, GPS está permitido como excepción de desarrollo, pero `http://IP-LOCAL` generalmente no es origen seguro y puede bloquear geolocalización. Publicar en Vercel/Netlify bajo HTTPS para pruebas remotas.
- Internet para autenticación, mapas y archivos.

## 3. Base de datos y almacenamiento
1. Crea un proyecto en https://supabase.com/dashboard
2. En SQL Editor, crea una consulta nueva y pega COMPLETO `supabase/schema.sql`; ejecuta Run una sola vez.
3. En Authentication > Providers > Email, deja habilitada la autenticación por correo. Por seguridad, conserva la confirmación por email. Para pruebas, verifica los correos de prueba antes de iniciar sesión.
4. En Project Settings > API / Connect, copia la **Project URL** y la clave **publishable** o **anon** pública (no la `service_role` ni la `secret`).
5. En `operacion-sombra-v1`, copia `.env.example` a `.env` y reemplaza las variables:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publica
```

6. En Supabase Authentication > URL Configuration define tu URL del sitio y añade como redirecciones admitidas `http://localhost:5173/**` y la URL HTTPS final del despliegue. Conserva los límites de acceso de email aplicables.
7. **Nunca** publiques secretos Supabase o `service_role` en variables que comiencen con `VITE_`. Solo se usa la clave pública y se aplican reglas RLS.

## 4. Ejecutar en Windows o Linux
Abre terminal en la carpeta del proyecto:

```bash
npm install
npm run dev
```

En el mismo equipo abre `http://localhost:5173`. Regístrate, confirma el correo e inicia sesión.

## 5. Prueba completa con dos personas
1. Usuario A se registra, confirma su email, inicia sesión y crea el equipo **Alfa**.
2. Usuario A copia el código desde **Equipos**.
3. Usuario B se registra con otro correo, confirma el email y entra a **Equipos > Unirse** con el código.
4. Ambos permiten el uso del GPS en el navegador y, en **Mapa GPS**, activan **Compartir GPS**.
5. Ambos deben aparecer en el mapa del equipo; comprueba metros y el estado de señal.
6. En **Mensajes**, A envía texto, una imagen y un audio/video de prueba; B puede leerlos y reproducirlos.
7. Para **Cercanos**, A activa **Permitir que me encuentren** y mantiene el GPS compartido; B entra en **Cercanos** y activa el selector para visualizar. Deben estar a menos de 1 km para que B vea a A (fuera del mismo equipo también).
8. A desactiva compartir GPS: al actualizar, B deja de ver su posición. Si un cliente abandona sin apagar el GPS, los clientes ignoran posiciones de más de 45 s, y el buscador ignora las de más de 60 s.

## 6. Seguridad y límites conocidos
- Las coordenadas exactas solo son consultables por el dueño o compañeros de equipo autenticados; no deben compartirse códigos de equipo con desconocidos.
- Los usuarios cercanos deben **activar dos cosas**: compartir GPS y ser descubribles. La búsqueda cercana devuelve posiciones *aproximadas* (cuadrícula de alrededor de 110 m de latitud) y distancias redondeadas a 100 m. No es apta para protección frente a acoso sofisticado: el administrador debe introducir reglas adicionales de bloqueo, reporte y límites de frecuencia para una versión pública.
- La precisión depende de hardware y recepción GPS: no usar metros calculados como prueba de captura o eliminación.
- La aplicación **no garantiza seguimiento en segundo plano** ni al cerrar el navegador. Las ubicaciones caducan visualmente, pero la última fila puede permanecer en la base de datos después de un cierre forzado; integrar un trabajo programado de purga en producción.
- Las URLs multimedia firmadas caducan tras 120 segundos y el archivo solo se almacena en un bucket privado. Actualmente los mensajes se mantienen hasta que un administrador implemente políticas de retención/eliminación.
- **No incluye aún** notificaciones push, audio grabado dentro del navegador, administración de usuarios, eliminación completa de cuenta, roles administrativos, moderación, misiones, banderas ni eliminación virtual. Sí permite subir audios previamente grabados desde el dispositivo.
- Se requieren revisiones de rendimiento, abuso, cuotas, retención de archivos, protección de menores y cumplimiento de privacidad antes de abrir la plataforma a usuarios no conocidos.
- En Supabase gratuito hay límites de almacenamiento, Realtime y base de datos. Para alto tráfico de videos, considerar límites de duración, compresión y almacenamiento externo.

## 7. Publicar gratis para pruebas
1. Sube el repositorio a GitHub sin `.env` (se excluye en `.gitignore`).
2. En Vercel, importa el repositorio, framework Vite, comando `npm run build`, salida `dist`.
3. Agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Environment Variables del proyecto Vercel.
4. Publica y añade la URL HTTPS en las redirecciones de Authentication en Supabase.
5. Comprueba las políticas de utilización de servicios y la idoneidad del plan de hosting para la actividad.

## 8. Próximos módulos
- Fase 2: perfil extendido, acciones de bloquear/reportar, invitaciones/roles, capturar audio desde la web y controles de uso.
- Fase 3: salas/actividades privadas y participantes, visibilidad por partida, captura virtual y bandera GPS.
- Fase 4: notificaciones, retención y eliminación de datos, limpieza programada de ubicaciones, reportes y pruebas de carga.

## 9. Resolución de fallos
- **Pantalla «Configuración pendiente»**: revisa `.env` y reinicia `npm run dev`.
- **«Invalid API key»**: revisa Project URL y clave pública correcta.
- **Sin correo de confirmación**: verifica spam y ajustes de Authentication / SMTP, los envíos tienen límites.
- **No aparece GPS**: autoriza ubicación; usa HTTPS o localhost, revisa servicios de ubicación del sistema.
- **No aparecen usuarios**: comprueba que ambos están en el mismo equipo y eligieron compartir GPS; revisa RLS ejecutando todo `schema.sql`.
- **No aparecen cercanos**: deben estar a <=1 km, compartir GPS y tener habilitada la opción «Permitir que me encuentren».
- **No se envía un adjunto**: revisa el formato, tamaño <=10 MB y que ejecutaste las políticas del bucket privado.

### Referencias técnicas
- https://supabase.com/docs/reference/javascript/introduction
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://react-leaflet.js.org/docs/start-installation/
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API
