# Airsoft Geo V5.3 — navegación interna y vista 3D

## Nueva experiencia GPS

- **Cómo llegar aquí** calcula una ruta peatonal y la dibuja dentro de Airsoft Geo. No abre Google Maps.
- **Seguir mi GPS** acompaña tu ubicación en el mapa de Airsoft Geo, sin activar automáticamente compartir GPS.
- **3D** carga MapLibre GL JS de forma opcional, con cámara inclinada, giro y edificios extruidos donde hay información cartográfica. Conserva los marcadores de personas y objetivos autorizados.
- **Calles y Satélite** continúan disponibles como opciones 2D.
- El mapa 2D se recupera ante incompatibilidad con WebGL o problemas de la vista 3D. No se realizan modificaciones en las tablas de Supabase.

## Ruta e indicaciones

Cuando el usuario pulsa voluntariamente **Cómo llegar aquí**, el navegador envía su posición reciente y destino seleccionado a una API de demostración Valhalla/OpenStreetMap. Este proveedor externo recibe esas **dos** coordenadas; el navegador no envía coordenadas de compañeros.

Si el servicio encuentra una ruta, muestra una línea azul, distancia caminando, duración aproximada y pasos. La línea naranja punteada significa solamente **rumbo directo**, no un camino accesible. Si el servicio falla, no se inventa una ruta; se conserva el modo de orientación directa y un mensaje de error. Los cálculos requieren Internet y ubicación GPS reciente.

Los datos de OpenStreetMap y el servidor gratuito no garantizan cobertura de senderos, permisos de paso, seguridad del terreno, continuidad ni disponibilidad. No usar como único medio de orientación o auxilio en campo.

## 3D

El mapa 3D usa teselas públicas OpenFreeMap con MapLibre y se activa solo cuando el usuario lo solicita. Se muestran edificios extruidos donde están cartografiados; en zonas rurales puede verse una perspectiva inclinada sin edificios. No equivale a fotografías en 3D, Street View ni a un modelo completo del relieve.

El mapa 2D sigue siendo la opción predeterminada para compatibilidad y menor consumo de batería y datos.

## Pruebas recomendadas

1. Iniciar sesión y abrir Mapa GPS, sin pantalla blanca.
2. Elegir destino tocando el mapa o seleccionando una zona de actividad.
3. Pulsar Seguir mi GPS, que no debe abrir otra aplicación.
4. Pulsar Cómo llegar aquí y comprobar que permanece en Airsoft Geo mostrando una ruta peatonal (o error explícito si no está disponible).
5. Cambiar Calles, Satélite y 3D; inclinar/girar en 3D; comprobar marcadores del equipo y privacidad.
6. Confirmar que navegador sin WebGL vuelve a 2D.
7. Cortar Internet y comprobar las advertencias existentes; no deben afirmarse rutas calculadas si fallan.
8. Confirmar funcionalidades V1-V5.2: GPS, avisos rápidos, perfiles, fotografías, roles, chat, multimedia, cronómetro, actividades y push.
9. Probar al menos dos celulares y diferentes tamaños/orientaciones de pantalla.

## Técnicas

- src/routeService.js: solicita Valhalla y valida polilíneas con precisión 1e6.
- src/Map3D.jsx: vista MapLibre opcional y reversible.
- src/UnifiedMap.jsx: ruta y destino compartidos entre mapas, controles existentes y fallback.
- src/MapNavigation.jsx: navegación interna y selección 3D.
- tests/fase53-sanity.mjs: pruebas de privacidad, ruta e integración.
- Sin migración SQL en V5.3.

Para navegación empresarial y mayor confiabilidad sería necesario alojar Valhalla propio o contratar un servicio con SLA. El terreno 3D real y las rutas sin Internet son mejoras futuras que requieren datos y almacenamiento adicionales.
