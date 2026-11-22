# Airsoft Geo V5.7 — Operación con cuotas gratuitas

## Objetivo
Mantener el mapa 2D como vista inicial y permitir GPS, equipo, comunicación y 3D/cámara optativos sin agregar dependencias que exijan activar facturación. Este documento no garantiza uso ilimitado de los servidores públicos.

## Controles implementados
- 2D permanece predeterminado.
- Cámara local solo mediante permiso explícito; no se almacena video; se cierran tracks al salir u ocultar la vista.
- 3D y relieve bajo demanda, sin clave Google.
- Imagen de chat: compresión local a WebP (máximo 1600 px de lado mayor; 2 MiB de resultado), original de hasta 15 MiB. Una imagen de hasta 750 KiB se transmite sin recomprimir.
- Audio: 3 MiB; video: 6 MiB; PDF: 5 MiB. No se transcodifican videos; se rechazan los mayores, para evitar esperas y consumo excesivo.
- Storage de Supabase en los depósitos `team-media` y `direct-media`: límite por objeto de 6 MiB; `profile-avatars` conserva 3 MiB.
- Se omiten lecturas de posiciones al ocultar la aplicación o cuando el navegador detecta falta de red. La transmisión GPS voluntaria sigue como estaba.
- Los mensajes y archivos existentes no se borran. Los límites solo afectan nuevas cargas.

## Proveedores y restricciones externas
- OpenStreetMap: servidores de teselas sujetos a política de uso, caché de navegador y prohibición de descargas masivas. Sitio oficial: https://operations.osmfoundation.org/policies/tiles/
- OpenFreeMap: servicio público sin garantía de continuidad, sujeto a sus términos. https://openfreemap.org/tos/
- Esri World Imagery: se debe verificar la licencia específica para producción, sobre todo si aumenta el uso. La disponibilidad pública de una URL no significa permiso ilimitado.
- Valhalla público: no garantiza capacidad para producción masiva. Si hay muchos usuarios, considerar servidor propio o alternativa autorizada.
- Render: verificar el tipo de servicio, rama de despliegue, plan y consumo en el workspace correcto antes de declarar publicación comprobada.
- Supabase: las cuotas de base, almacenamiento, transferencia y Realtime se verifican en el dashboard. Límites por archivo no equivalen a un límite global mensual ni deshabilitan la facturación de una cuenta de pago.

## Verificación antes y después de publicar
1. Ejecutar pruebas de regresión de fases anteriores, V5.5, V5.6, V5.7 y compilación.
2. En Android: abrir 2D y seguir GPS; verificar GPS individual y compartido, objetivos, chat, subida de fotografía, ruta y retorno desde cámara.
3. En 3D: comprobar satélite, calles, relieve, carga lenta y paso a 2D en un celular físico.
4. Probar foto grande de 4 MiB que debe comprimirse, video de 7 MiB que debe rechazarse y PDF pequeño que debe aceptarse.
5. Verificar Storage, Realtime y tráfico semanalmente durante el piloto. No habilitar complementos de pago ni sobregiros de cuotas.
6. Mantener el commit anterior identificado para revertir si alguna función crítica falla.

## Estado de costo
Ninguna de las funciones nuevas requiere una API de pago. No es posible prometer costo monetario cero sin comprobar y mantener sin facturación los planes de Render/Supabase y respetar los términos de proveedores externos. No hay bloqueo de cuota mensual automática dentro del frontend.
