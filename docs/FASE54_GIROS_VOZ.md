# Airsoft Geo V5.4 — Giro a giro y guía por voz dentro de la aplicación

## Alcance

La nueva guía usa el trazado y las maniobras devueltos por Valhalla/OpenStreetMap al pulsar «Cómo llegar aquí». **No abre Google Maps**. No añade tablas, permisos, credenciales ni nuevos servicios con facturación.

- **Próxima maniobra**: texto de la instrucción suministrada por Valhalla, tipo de maniobra y metros aproximados hasta el giro. Se calcula proyectando la posición GPS del usuario sobre el segmento más próximo de la polilínea y comparándolo con \`begin_shape_index\`.
- **Flecha**: sigue siendo orientativa; solo se presenta en relación con el frente cuando el navegador suministra un rumbo GPS válido. Si no lo suministra, la flecha está referida al norte. No se usa la brújula del teléfono sin un permiso explícito adicional.
- **Voz opcional**: botón «Activar voz»/«Voz activa», botón «Repetir» y silencio. La primera narración necesita una pulsación del usuario; los recordatorios posteriores se limitan a la aproximación a 85 m y 20 m de la siguiente maniobra, llegada y desvío. Se evita repetir el mismo aviso en la misma ruta y se limita la frecuencia entre avisos.
- **Corrección de recorrido**: si se desvía significativamente se muestra «Recalcular». La aplicación no envía coordenadas a otro servicio hasta que la persona pulsa voluntariamente ese botón.
- **Protección**: con GPS de más de 30 segundos, la guía se suspende; sin Internet no aparecen avisos automáticos de voz. Las acciones SOS, comunicaciones, consentimientos GPS y roles siguen independientes de la navegación.
- **Mapas**: la misma guía funciona al alternar Calles, Satélite y 3D. Los controles de privacidad y de avisos rápidos siguen visibles.

## Limitaciones operativas

Los proveedores cartográficos públicos no garantizan cobertura de senderos, permisos de paso, seguridad ni disponibilidad constante. La precisión GPS y el rumbo pueden variar bruscamente con poca cobertura, edificios, vegetación o cuando el usuario está quieto. Nunca asumir que una indicación calculada equivale a una ruta segura o permitida.

La narración usa la síntesis de voz disponible en el navegador; Android puede requerir que haya una voz en español instalada, que el teléfono no esté en silencio y que la pestaña continúe activa. No se garantiza narración con la pantalla bloqueada. La aplicación no solicita acceso al micrófono ni graba audio para guiar.

No se integra Google Maps 3D fotorrealista ni Navigation SDK en esta fase. Esas opciones requerirían revisar cuotas, licencias, credenciales restringidas y facturación de Google Maps Platform antes de configurarlas en producción.

## Pruebas móviles de aceptación

1. Iniciar sesión; comprobar que el mapa abre y que siguen funcionando V1–V5.3.1.
2. Elegir un objetivo y pulsar «Cómo llegar aquí» con GPS reciente. Ver «Próxima indicación» y la distancia hasta el giro si Valhalla devuelve maniobras válidas.
3. Activar «Voz» y pulsar «Repetir»; probar silenciar. Confirmar que no pide micrófono y que el navegador puede leer una instrucción.
4. Caminar por una zona segura y pública: comprobar avance por posición GPS, próxima maniobra, distancia y flechas, sin cambios artificiales por temporizador.
5. Simular o probar un desvío: debe mostrar una advertencia y el botón «Recalcular»; no debe recalcular automáticamente.
6. Cambiar entre Calles, Satélite y 3D sin perder la ruta ni salir de Airsoft Geo.
7. Desactivar conexión y comprobar que no confirma recalculaciones. Ocultar o bloquear la página: no se garantiza GPS ni voz en segundo plano.
8. Verificar mensajes, archivos, audios, push, actividades, cronómetro, roles y avisos SOS sin regresiones.

## Archivos

- \`src/routeService.js\`: conserva \`maneuvers\` con índices, tipos y narración del proveedor.
- \`src/navigationGuide.js\`: estima el progreso de la persona sobre el trayecto.
- \`src/turnNavigation.js\`: calcula próxima maniobra, distancia hasta giro y avisos de voz.
- \`src/RouteGuideHud.jsx\`: presenta navegación y voz voluntaria.
- \`tests/fase54-sanity.mjs\` y \`tests/browser-mobile-smoke.mjs\`: unitarias e integración en Chrome móvil simulado.

**V5.4 no necesita migración SQL.** Los respaldos automáticos reales siguen pendientes de los secretos de GitHub Actions, sin alteración en esta fase.
