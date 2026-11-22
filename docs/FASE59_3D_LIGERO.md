# Airsoft Geo V5.9 — Modo 3D ligero para Android

## Motivo de la corrección
En algunos celulares el mapa opcional 3D se bloqueaba o quedaba cargando. El motor anterior utilizaba el estilo completo Liberty, un segundo origen de teselas vectoriales para edificios, antialiasing y una vista inicial muy inclinada. El usuario confirmó que la orientación en vivo con cámara sí funciona.

## Qué cambia
- El 2D sigue siendo el mapa predeterminado; se preservan login, GPS, equipos, alertas, ruta peatonal, cámara y privacidad.
- Se utiliza un único conjunto de teselas vectoriales gratuitas OpenFreeMap, con solo seis capas básicas: fondo, suelo, agua, borde de caminos, caminos y edificios.
- El modo ligero prioriza edificios tridimensionales y rutas sobre textos de calles. Para nombres y detalle de calles debe utilizarse el mapa 2D.
- Se reduce inclinación inicial a 48°, antialiasing desactivado, límite de resolución interna a 1.25x y canvas a 1280 px, sin copias del mundo y caché limitado.
- Las flechas de ruta 3D quedan limitadas a 16 y no se recrean con cada actualización GPS.
- Se libera el contexto WebGL utilizado para comprobar compatibilidad.
- El usuario puede activar/desactivar extrusiones de edificios, inclinación, relieve y satélite.
- Si la cartografía 3D no carga en 10 segundos, produce errores repetidos o provoca un bloqueo de varios segundos, vuelve automáticamente a calles 2D. No se envían diagnósticos personales a terceros.

## Pruebas requeridas
1. Abrir Airsoft Geo y confirmar 2D inicial normal.
2. Entrar a «3D»; debe aparecer «V5.9 · 3D ligero».
3. Girar, ampliar y reducir sin que la aplicación se quede sin respuesta.
4. Probar «Edificios» para desactivar y recuperar las extrusiones si hay lentitud.
5. Probar destino y ruta dentro del 3D. Si se vuelve al 2D por falta de recursos, la cámara en vivo debe seguir funcionando.
6. Probar brevemente «Relieve» y «Ver satélite», que dependen de redes y servicios externos gratuitos.
7. En móviles reales, comprobar consumo de datos, fluidez y comportamiento con mala conexión. Las pruebas de Chromium automatizadas no miden rendimiento real de GPU Android.

## Criterios de publicación
No tocar configuración de facturación ni crear nuevos servicios. Validar regresiones, build y smoke móvil automatizado en GitHub antes de integrar la rama a producción.

## Restricciones
Una representación tridimensional real consume GPU y memoria. Este modo mejora la eficiencia, pero no garantiza 3D a máxima calidad en todos los dispositivos. El 2D y la cámara en vivo siguen independientes.
