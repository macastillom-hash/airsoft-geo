# Airsoft Geo V5.3.1 — corrección del mapa 3D y flechas de navegación

## Diagnóstico de la pantalla vacía

En la captura aportada por el usuario, se observan los controles MapLibre y la atribución cartográfica pero **no hay imagen de calles ni terreno**. Esto permite afirmar que se inicializó el contenedor del mapa, pero no que se cargaron los mosaicos cartográficos. **No se puede concluir que el celular no sea compatible con 3D** a partir de la captura.

La V5.3 dependía del estilo vectorial remoto OpenFreeMap para toda la base 3D. Si no llegaban los mosaicos, solo se mostraba el fondo liso.

## Cambios

- El modo 3D carga **imagen satelital Esri como base** (teselas ráster), con cámara inclinada de MapLibre y modelos de edificios opcionales desde OpenFreeMap.
- Si las teselas satelitales no llegan, transcurridos aproximadamente 9 segundos se intenta una base de calles de OpenStreetMap; si tampoco llega tras otros 10 segundos se vuelve al mapa 2D, con aviso visible.
- Se muestra el indicador **«Cargando imagen satelital»** mientras se intenta obtener la base cartográfica. No se muestra una vista plana sin ninguna explicación.
- Las capas de edificios son opcionales y su error **no bloquea el fondo satelital**. En zonas rurales no puede prometerse geometría de edificios ni relieve del terreno.
- Sobre las rutas **calculadas** aparecen flechas azules de orientación en 2D y 3D; el indicador superior informa dirección y distancia restante. Si el GPS informa rumbo durante el movimiento, la indicación puede ser relativa al frente del usuario. Si el rumbo no está disponible, se indica dirección respecto al norte, **no se inventan giros**.
- Al alejarse de la ruta, el indicador muestra advertencia y solicita recalcular expresamente. No se realizan consultas automáticas en segundo plano.
- Se conservan los accesos rápidos, privacidad GPS, chat, actividad, cronómetro, zonas y notificaciones. **No hay cambios de tablas, RLS ni credenciales**.

## Comparación con Google Maps 3D

La API oficial de Google permite mapas fotorealistas 3D y representaciones de rutas, pero su integración en un sitio web requiere Google Maps Platform, API Key con restricciones adecuadas, habilitación de servicios y, para uso normal, un proyecto con facturación activada. Una clave de demostración para prototipos no debe confundirse con un servicio de producción ilimitado. V5.3.1 mantiene **una opción sin Google ni cobros por API**. No promete ser igual al 3D fotorealista de Google: el satélite se inclina y los edificios aparecen solo donde están cartografiados.

## Pruebas en Android

1. Abrir Mapa GPS y seleccionar 3D. Confirmar que se ve imagen satelital, no un fondo monocromático. Esperar la carga del proveedor si la conexión es lenta.
2. Si el proveedor no responde, comprobar que se intenta una base alternativa y luego se restaura 2D, sin pantalla blanca.
3. Cambiar a Calles, Satélite y regresar a 3D.
4. Seleccionar un destino y pulsar **Cómo llegar aquí**. La ruta debe permanecer dentro de Airsoft Geo.
5. Comprobar flechas de ruta, distancia restante y aviso si la orientación no es fiable. Recalcular si se aleja del recorrido.
6. Tocar los marcadores del equipo y mantener los accesos rápidos y controles de privacidad.
7. Verificar de nuevo que las funciones V2–V5.3 continúan: chat, multimedia, roles, equipos, actividades, cronómetro y push.
8. Probar con Wi-Fi y datos móviles: los servicios gratuitos externos pueden funcionar en una red y estar inaccesibles en otra.

## Pendientes

- Rutas offline, modelo digital de terreno verdadero y Google Maps fotorealista 3D requieren infraestructura, licencias/datos o cuentas adicionales.
- Faltan pruebas físicas en el celular del usuario. El navegador simulado no reproduce todos los problemas de GPU, proveedor de Internet o ahorro de energía.
