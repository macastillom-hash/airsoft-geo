# Airsoft Geo V5.4.1 — repetir indicación y suspender voz

Esta mejora es compatible con la V5.4 ya publicada. No altera rutas, coordenadas GPS, permisos, cronómetro, equipos, chats, alertas ni credenciales.

- Al activar voluntariamente «Escuchar indicaciones» aparece «Repetir indicación», que vuelve a narrar el próximo giro o la instrucción actual solo si el usuario pulsa el botón.
- Cuando se oculta la pestaña o se cambia a otra aplicación se cancela la narración en curso. No se promete voz continua con la pantalla bloqueada.
- La narración utiliza la síntesis del navegador, sin solicitar acceso al micrófono. Requiere una voz compatible con español en el dispositivo.
- Se mantienen el control de calidad GPS, la visualización 2D/3D, los avisos rápidos y el recálculo de rutas optativo de V5.4.

## Prueba rápida

1. Entrar en Mapa GPS, seleccionar un destino y calcular una ruta con GPS reciente.
2. Ver la instrucción de giro y «Escuchar indicaciones». Activarla y luego pulsar «Repetir indicación».
3. Cambiar de pestaña o poner la aplicación en segundo plano; no debe seguir pronunciando una instrucción en curso.
4. Silenciar y volver al mapa; confirmar que chats, alertas y demás módulos siguen funcionando.

No hay migraciones Supabase ni integraciones de pago. Se requiere validación desde Android real para confirmar la voz del sistema operativo.
