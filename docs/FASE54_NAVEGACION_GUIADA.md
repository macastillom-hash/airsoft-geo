# Airsoft Geo V5.4 — navegación guiada dentro del mapa

## Qué cambia

- El usuario elige un objetivo y solicita una ruta peatonal con el botón existente **«Cómo llegar aquí»**. Esa consulta voluntaria al servicio público Valhalla transmite exclusivamente las coordenadas del usuario y del destino, no las de otros participantes.
- Cuando hay una ruta calculada, aparece **«Iniciar navegación guiada»**. El seguimiento del propio GPS permanece dentro de Airsoft Geo. Se puede detener la guía sin cancelar la actividad ni cambiar permisos de GPS.
- Los datos oficiales de cada maniobra (`type`, `begin_shape_index`, `instruction`, `verbal_pre_transition_instruction`) se conservan en la respuesta de Valhalla. Al desplazarse, el mapa identifica la maniobra siguiente, muestra su distancia y la ruta restante, con tiempo estimado.
- **Voz opcional:** activada explícitamente por el usuario, generada localmente mediante la API de síntesis de voz del navegador. Desactivada por defecto; solo anuncia una maniobra en la ventana de aproximación o giro. No se envía información de navegación a un servicio adicional de IA.
- **Desvío de ruta:** se advierte al usuario, sin recalcular automáticamente ni efectuar nuevas solicitudes externas. «Recalcular ruta» requiere pulsación explícita.
- **GPS no actualizado:** la navegación se pausa visualmente si la última ubicación tiene más de 30 segundos. La aplicación no asume precisión GPS, rumbo o navegación en segundo plano.
- **Vista 3D de seguimiento:** con navegación activa y seguimiento GPS, se acerca la cámara y se inclina para facilitar el recorrido. Solo se gira con el rumbo que devuelve el GPS cuando detecta movimiento; no se inventa el ángulo desde el teléfono.
- Se conservan el modo 2D, la vista satelital, la recuperación ante fallos del proveedor, accesos rápidos, perfiles, actividades, cronómetro y roles.

## Condiciones de privacidad y seguridad

El modo guía no activa por sí mismo «Compartir GPS» ni «Permitir que me encuentren». Las rutas se calculan solo al pulsar el botón correspondiente; un desvío no ejecuta solicitudes en segundo plano. La voz se activa exclusivamente desde un control propio y puede no estar disponible en algunos navegadores o cuando el teléfono está bloqueado.

Una indicación de giro representa el recorrido **propuesto por cartografía OpenStreetMap**. No confirma que el sendero esté habilitado, abierto o libre de obstáculos. Las indicaciones no sustituyen la señalización real ni los protocolos de seguridad de una actividad organizada.

No se incorpora Google Maps Platform porque requiere credenciales y, para producción normal, facturación; la V5.4 sigue usando componentes gratuitos y los proveedores públicos existentes sin SLA garantizado.

## Pruebas con Android real

1. Confirmar que Mapa GPS abre, muestra satélite, 2D/3D y la privacidad continúa independiente.
2. Elegir un punto y pulsar **Cómo llegar aquí**. Comprobar que solo aparece una ruta real cuando el servicio responde.
3. Pulsar **Iniciar navegación guiada**. Mostrar la próxima maniobra y metros que faltan, sin abrir otra aplicación.
4. Activar voz manualmente. Verificar instrucciones audibles cerca de una maniobra, y silencio cuando la pantalla esté en segundo plano o el GPS no sea reciente.
5. Probar el seguimiento del mapa 3D y volver a 2D. El panel de navegación debe conservarse.
6. Simular desvío de ruta; confirmar que recalcular es manual.
7. Finalizar guía sin desactivar la actividad o compartir GPS y verificar el comportamiento si falla Internet.
8. Repetir pruebas básicas de GPS, equipo, chat, multimedia, alertas rápidas, cronómetro, notificaciones y roles.

## Validaciones automáticas

`tests/fase54-sanity.mjs` verifica parseo de maniobras y cálculo de distancia, ETA, umbral de avisos de voz, compatibilidad y control de navegación. `tests/browser-mobile-smoke.mjs` monta el React real en Chrome móvil simulado, con GPS y ruta Valhalla simulados, y comprueba giros y alternancia entre 2D y 3D.

No existe migración SQL para esta fase. La plataforma sigue usando las tablas y permisos de V5.3.1.
