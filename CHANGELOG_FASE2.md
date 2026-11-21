# Cambios V2

- [x] Chat privado entre integrantes de un mismo equipo, con mensajes y multimedia.
- [x] Grabación de notas de voz de hasta 60 segundos.
- [x] Centro de notificaciones con estado leído/no leído.
- [x] Avisos por mensajes de equipo, mensajes privados y alertas administrativas.
- [x] Vibración mediante la API del navegador donde esté disponible; prueba y preferencias por dispositivo.
- [x] Sonido opcional sujeto a restricciones del navegador.
- [x] Avisos del sistema en pestaña en segundo plano cuando la sesión siga activa.
- [x] Recuperación de notificaciones al regresar a una pestaña suspendida.
- [x] Creación de alertas de equipo por el propietario.
- [x] Renombrar equipo y retirar miembros por el propietario.
- [x] Esquema SQL adicional (sin reescribir datos V1).
- [ ] Web Push real con app cerrada (futura fase).
- [ ] Pruebas de extremo a extremo con Supabase/Render y celulares reales (pendientes de ejecución del usuario).

**Limitaciones verificadas:** la instalación de dependencias en el entorno actual agotó el tiempo disponible; no se verificó el build completo. Se ejecutaron verificaciones de sintaxis para archivos JS no JSX y pruebas de lógica de preferencias/vibración simulada.
