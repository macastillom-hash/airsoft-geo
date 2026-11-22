# Airsoft Geo V5.4 — navegación guiada, voz opcional y recálculo controlado

## Objetivo
Mejorar la navegación **dentro de Airsoft Geo** sin abrir Google Maps, sin exigir pagos, sin perder el modo satélite/3D ni alterar las funciones ya validadas (GPS, equipos, perfiles, roles, notificaciones, chats, actividades, cronómetro y alertas rápidas).

## Próximo giro
La ruta peatonal de Valhalla/OpenStreetMap ya incluía maniobras con campos `begin_shape_index`, `instruction` y `verbal_pre_transition_instruction`. En V5.4 se aprovechan para mostrar:
- Tipo de maniobra (recto, izquierda, derecha o llegada).
- Instrucción del siguiente giro y distancia aproximada hasta ese punto del recorrido.
- Distancia restante al destino, flechas del recorrido y un aviso si se sale de la ruta.
- Si el rumbo GPS del celular no está disponible, las flechas generales **se refieren al norte**, sin fingir que se conoce el frente del usuario.

**La precisión de GPS tiene límites**: el entorno, árboles, edificios, interiores o ahorro de energía pueden alterar la ubicación. Seguir instrucciones en terreno no sustituye la observación del camino y las restricciones de acceso.

## Voz
El nuevo botón «Escuchar indicaciones» es **opcional** y se activa mediante una pulsación explícita. Utiliza la síntesis de voz disponible en el navegador, intenta hablar en español colombiano, y anuncia las próximas maniobras una vez al aproximarse (aproximadamente 95 metros y 28 metros) si el GPS es reciente y suficientemente preciso. Evita repeticiones y no transmite la voz al servidor.

Si el celular, sus voces o las políticas del navegador impiden la reproducción, continúa disponible la guía **visual**. No se garantiza que hable con la pantalla bloqueada ni que el sistema operativo permita audio en segundo plano. No debe utilizarse como único medio de navegación.

## Recálculo opcional
En «Objetivos y navegación», una casilla controla «Recálculo automático», **desactivado inicialmente** y sin persistencia entre cambios de destino.

Antes de solicitar automáticamente una nueva ruta se comprueba:
1. Autorización del usuario mediante esa casilla, Internet activo, ruta ya calculada, mapa visible y objetivo elegido.
2. Tres observaciones GPS distintas, recientes (máximo 15 segundos), con precisión no peor que 30 metros.
3. Desviación de al menos 75 metros (o tres veces el error de GPS).
4. Un intervalo mínimo de dos minutos entre consultas automáticas.

Solo después de satisfacer todos estos criterios se envía una nueva solicitud al servicio Valhalla que incluye el origen GPS del usuario y el destino. Las posiciones de compañeros **no se transmiten**. Si falla la consulta, se informa del error y se desactiva el recálculo automático hasta una decisión posterior. No se encolan solicitudes durante una desconexión.

El usuario conserva el botón «Recalcular ruta» manual. Para otro destino, la autorización de recálculo automático se reinicia a desactivada.

## Pruebas en celular
1. Abrir Airsoft Geo sin pantalla blanca. Confirmar GPS, mapas 2D, satélite y 3D; comprobar marcadores y accesos rápidos.
2. Elegir un objetivo y pulsar «Cómo llegar aquí». Revisar la línea azul y la nueva instrucción del próximo giro.
3. Caminar en un lugar seguro y público, con GPS activo y el mapa abierto, y revisar la distancia hasta el giro.
4. Activar y desactivar la voz; no debe hablar sin haberlo autorizado.
5. Activar el recálculo automático. Confirmar que no realiza consultas sin desvío y que no consulta si el GPS pierde precisión.
6. Comprobar la advertencia de ruta antigua, desvío o pérdida de Internet.
7. Confirmar que abandonar la navegación no afecta la compartición voluntaria de GPS y que los módulos anteriores siguen funcionando.

## Costos y seguridad
Sin nueva migración de Supabase y sin Google Maps Platform. Valhalla es un servicio público con límites de disponibilidad; los caminos y el tiempo de llegada no están garantizados. Para navegación intensiva o multiusuario masiva, convendría desplegar un enrutador propio o un proveedor con SLA.

## Respaldo
La configuración de respaldos automáticos cifrados continúa pendiente de los secretos en GitHub y una restauración real en ambiente independiente; esta versión no altera esa configuración.
