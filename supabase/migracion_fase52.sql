-- Airsoft Geo V5.2 — cronómetro fiable por servidor.
-- Migración aditiva: sin cambios destructivos en las tablas, permisos ni flujos V1-V5.1.
BEGIN;
ALTER TABLE public.activities
 ADD COLUMN actual_started_at timestamptz,
 ADD COLUMN timer_paused_at timestamptz,
 ADD COLUMN timer_paused_seconds integer NOT NULL DEFAULT 0
   CHECK(timer_paused_seconds>=0 AND timer_paused_seconds<=172800),
 ADD COLUMN timer_stopped_at timestamptz;
ALTER TABLE public.activities ADD CONSTRAINT f52_activity_timer_consistency
 CHECK(timer_paused_at IS NULL OR (status='active' AND actual_started_at IS NOT NULL));

-- El cliente conserva edición únicamente de campos V3 ya permitidos.
-- El cronómetro lo modifica exclusivamente la función protegida en el servidor.
REVOKE UPDATE ON public.activities FROM authenticated;
GRANT UPDATE (title,description,mode,status,starts_at,duration_minutes,respawn_seconds,updated_at)
 ON public.activities TO authenticated;

-- Al iniciar una actividad futura, el servidor registra la hora real.
-- No se inventan horas para actividades anteriores a V5.2.
CREATE OR REPLACE FUNCTION public.f52_activity_timer_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f52$
BEGIN
 IF OLD.status IS DISTINCT FROM NEW.status THEN
  IF NEW.status='active' AND OLD.status<>'active' THEN
   NEW.actual_started_at=clock_timestamp();
   NEW.timer_paused_at=NULL;
   NEW.timer_paused_seconds=0;
   NEW.timer_stopped_at=NULL;
  ELSIF OLD.status='active' AND NEW.status IN ('finished','cancelled') THEN
   IF OLD.timer_paused_at IS NOT NULL THEN
    NEW.timer_paused_seconds=OLD.timer_paused_seconds+
     greatest(0,floor(extract(epoch from clock_timestamp()-OLD.timer_paused_at))::integer);
   END IF;
   NEW.timer_paused_at=NULL;
   NEW.timer_stopped_at=clock_timestamp();
  END IF;
 END IF;
 RETURN NEW;
END $f52$;

CREATE TRIGGER f52_timer_activity_transition
 BEFORE UPDATE OF status ON public.activities
 FOR EACH ROW EXECUTE FUNCTION public.f52_activity_timer_transition();
REVOKE ALL ON FUNCTION public.f52_activity_timer_transition() FROM PUBLIC,anon,authenticated;

-- El cronómetro se pausa y reanuda exclusivamente desde la cuenta del organizador.
-- La fila se bloquea para evitar dobles pulsaciones simultáneas.
CREATE OR REPLACE FUNCTION public.f52_timer_action(p_activity uuid,p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f52$
DECLARE v public.activities%ROWTYPE;v_now timestamptz:=clock_timestamp();
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.f3_is_organizer(p_activity) THEN
  RAISE EXCEPTION 'Solo el organizador puede controlar el cronómetro';
 END IF;
 SELECT * INTO v FROM public.activities WHERE id=p_activity FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Actividad no encontrada'; END IF;
 IF v.status<>'active' THEN RAISE EXCEPTION 'La actividad no está en curso'; END IF;
 IF p_action='initialize' THEN
  IF v.actual_started_at IS NOT NULL THEN RAISE EXCEPTION 'El cronómetro ya está inicializado'; END IF;
  UPDATE public.activities SET actual_started_at=v_now,timer_paused_at=NULL,
    timer_paused_seconds=0,timer_stopped_at=NULL WHERE id=v.id;
  RETURN 'Cronómetro iniciado para esta actividad existente';
 END IF;
 IF v.actual_started_at IS NULL THEN
  RAISE EXCEPTION 'Primero inicializa el cronómetro de esta actividad anterior';
 END IF;
 IF p_action='pause' THEN
  IF v.timer_paused_at IS NOT NULL THEN RAISE EXCEPTION 'El cronómetro ya está pausado'; END IF;
  UPDATE public.activities SET timer_paused_at=v_now WHERE id=v.id;
  RETURN 'Cronómetro pausado';
 ELSIF p_action='resume' THEN
  IF v.timer_paused_at IS NULL THEN RAISE EXCEPTION 'El cronómetro no está pausado'; END IF;
  UPDATE public.activities SET
    timer_paused_seconds=least(172800,v.timer_paused_seconds+
      greatest(0,floor(extract(epoch from v_now-v.timer_paused_at))::integer)),
    timer_paused_at=NULL WHERE id=v.id;
  RETURN 'Cronómetro reanudado';
 END IF;
 RAISE EXCEPTION 'Acción de cronómetro no permitida';
END $f52$;
REVOKE ALL ON FUNCTION public.f52_timer_action(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f52_timer_action(uuid,text) TO authenticated;

-- Permitir suscribir cambios de activities para actualizar cronómetro en otros teléfonos.
DO $publication$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='activities') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
 END IF;
END $publication$;
COMMIT;