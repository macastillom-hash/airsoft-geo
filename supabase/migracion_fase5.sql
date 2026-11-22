-- Airsoft Geo V5 — perfiles, roles y señales rápidas en el mapa.
-- Aditiva: ninguna tabla de V1–V4 se elimina ni se reconstruye.
BEGIN;

-- Perfil ampliado. Las fotografías son privadas, visibles solo para compañeros.
ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '' CHECK(char_length(display_name)<=80),
 ADD COLUMN IF NOT EXISTS about_me text NOT NULL DEFAULT '' CHECK(char_length(about_me)<=240),
 ADD COLUMN IF NOT EXISTS avatar_path text;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('profile-avatars','profile-avatars',false,3145728,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=3145728,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE POLICY f5_avatar_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='profile-avatars' AND EXISTS(
   SELECT 1 FROM public.profiles pr
   WHERE pr.avatar_path=name AND (pr.id=(SELECT auth.uid()) OR public.is_teammate(pr.id))
 ));
CREATE POLICY f5_avatar_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='profile-avatars' AND split_part(name,'/',1)=(SELECT auth.uid())::text
 AND (lower(storage.extension(name)) IN ('jpeg','jpg','png','webp')));
CREATE POLICY f5_avatar_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='profile-avatars' AND split_part(name,'/',1)=(SELECT auth.uid())::text);

-- Permite editar texto e imagen de perfil propio (política existente profiles_update).
-- Roles operativos personalizados por equipo (no dan permisos administrativos).
CREATE TABLE public.team_roles(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 2 AND 36),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=180),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(team_id,id),
 UNIQUE(team_id,name)
);
CREATE INDEX idx_f5_team_roles_team ON public.team_roles(team_id);
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_roles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.team_roles TO authenticated;
CREATE POLICY f5_roles_view ON public.team_roles FOR SELECT TO authenticated
 USING(public.my_team(team_id));
CREATE POLICY f5_roles_add ON public.team_roles FOR INSERT TO authenticated
 WITH CHECK(public.is_team_owner(team_id) AND created_by=(SELECT auth.uid()));
CREATE POLICY f5_roles_edit ON public.team_roles FOR UPDATE TO authenticated
 USING(public.is_team_owner(team_id)) WITH CHECK(public.is_team_owner(team_id));
CREATE POLICY f5_roles_delete ON public.team_roles FOR DELETE TO authenticated
 USING(public.is_team_owner(team_id));

-- Roles administrativos: owner siempre se deriva de teams.owner_id (nunca se asigna por cliente).
ALTER TABLE public.team_members
 ADD COLUMN IF NOT EXISTS administrative_role text NOT NULL DEFAULT 'participant'
   CHECK(administrative_role IN ('admin','coordinator','participant')),
 ADD COLUMN IF NOT EXISTS operational_role_id uuid;
ALTER TABLE public.team_members
 ADD CONSTRAINT f5_member_role_same_team FOREIGN KEY(team_id,operational_role_id)
 REFERENCES public.team_roles(team_id,id) ON DELETE SET NULL;

ALTER TABLE public.activity_participants
 ADD COLUMN IF NOT EXISTS operational_role_id uuid;
ALTER TABLE public.activity_participants
 ADD CONSTRAINT f5_participant_role_same_team FOREIGN KEY(team_id,operational_role_id)
 REFERENCES public.team_roles(team_id,id) ON DELETE SET NULL;

-- Los propietarios definen y asignan roles. No se concede UPDATE directo sobre team_members.
CREATE OR REPLACE FUNCTION public.f5_assign_team_roles(
 p_team uuid,p_member uuid,p_administrative text,p_operational uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f5$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.is_team_owner(p_team) THEN
   RAISE EXCEPTION 'Solo el propietario puede asignar roles';
 END IF;
 IF p_administrative NOT IN ('admin','coordinator','participant') OR p_administrative IS NULL THEN
  RAISE EXCEPTION 'Rol administrativo no permitido';
 END IF;
 IF EXISTS(SELECT 1 FROM public.teams WHERE id=p_team AND owner_id=p_member) AND p_administrative<>'participant' THEN
  RAISE EXCEPTION 'El propietario mantiene permisos exclusivos';
 END IF;
 IF p_operational IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.team_roles WHERE id=p_operational AND team_id=p_team) THEN
  RAISE EXCEPTION 'El rol operativo no pertenece al equipo';
 END IF;
 UPDATE public.team_members SET administrative_role=p_administrative,operational_role_id=p_operational
 WHERE team_id=p_team AND user_id=p_member;
 IF NOT FOUND THEN RAISE EXCEPTION 'El usuario no pertenece a este equipo'; END IF;
END $f5$;
REVOKE ALL ON FUNCTION public.f5_assign_team_roles(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f5_assign_team_roles(uuid,uuid,text,uuid) TO authenticated;

-- Roles específicos por actividad: organizador autoriza las asignaciones.
CREATE OR REPLACE FUNCTION public.f5_assign_activity_role(p_activity uuid,p_member uuid,p_operational uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f5$
DECLARE v_team uuid;
BEGIN
 IF NOT public.f3_is_organizer(p_activity) THEN
   RAISE EXCEPTION 'Solo el organizador asigna roles de actividad';
 END IF;
 SELECT team_id INTO v_team FROM public.activity_participants
 WHERE activity_id=p_activity AND user_id=p_member;
 IF v_team IS NULL THEN RAISE EXCEPTION 'Participante no inscrito'; END IF;
 IF p_operational IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.team_roles WHERE team_id=v_team AND id=p_operational
 ) THEN RAISE EXCEPTION 'El rol debe pertenecer al equipo'; END IF;
 UPDATE public.activity_participants SET operational_role_id=p_operational
 WHERE activity_id=p_activity AND user_id=p_member;
END $f5$;
REVOKE ALL ON FUNCTION public.f5_assign_activity_role(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f5_assign_activity_role(uuid,uuid,uuid) TO authenticated;

-- Capacidades delegadas delimitadas: administrador gestiona participantes y alertas
-- oficiales; coordinador solo avisos oficiales; participante emite avisos rápidos.
CREATE OR REPLACE FUNCTION public.f5_can_team(p_team uuid,p_capability text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f5$
 SELECT COALESCE((SELECT
  t.owner_id=(SELECT auth.uid()) OR (
   m.user_id=(SELECT auth.uid()) AND
   (CASE WHEN p_capability='members' THEN m.administrative_role='admin'
         WHEN p_capability='alerts' THEN m.administrative_role IN ('admin','coordinator')
         ELSE false END))
 FROM public.teams t LEFT JOIN public.team_members m
  ON m.team_id=t.id AND m.user_id=(SELECT auth.uid())
 WHERE t.id=p_team),false);
$f5$;
REVOKE ALL ON FUNCTION public.f5_can_team(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f5_can_team(uuid,text) TO authenticated;

CREATE POLICY f5_admin_remove_member ON public.team_members FOR DELETE TO authenticated
 USING(public.f5_can_team(team_id,'members')
 AND user_id<>(SELECT auth.uid())
 AND administrative_role<>'admin'
 AND NOT EXISTS(SELECT 1 FROM public.teams t WHERE t.id=team_id AND t.owner_id=user_id));
CREATE POLICY f5_delegate_official_alert ON public.team_alerts FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND public.f5_can_team(team_id,'alerts'));

-- Alerta emitida solo desde la posición propia y solo al equipo elegido.
-- "Rival izquierda/derecha" = observación manual, NO coordenada del rival.
CREATE TABLE public.team_signals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN (
 'rival_left','rival_right','rival_near','need_help','medical','in_position','withdrawing','eliminated')),
 latitude double precision,
 longitude double precision,
 accuracy_m double precision,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '3 minutes'),
 CHECK ((latitude IS NULL AND longitude IS NULL AND accuracy_m IS NULL) OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND accuracy_m>=0))
);
CREATE INDEX idx_f5_signals_team_time ON public.team_signals(team_id,expires_at DESC);
CREATE INDEX idx_f5_signals_sender ON public.team_signals(sender_id);
ALTER TABLE public.team_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_signals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.team_signals TO authenticated;
CREATE POLICY f5_signal_read ON public.team_signals FOR SELECT TO authenticated USING(public.my_team(team_id));

CREATE OR REPLACE FUNCTION public.f5_send_quick_signal(p_team uuid,p_kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f5$
DECLARE v_id uuid;v_user uuid:=(SELECT auth.uid());
DECLARE v_lat double precision;v_lng double precision;v_acc double precision;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=p_team AND user_id=v_user) THEN
  RAISE EXCEPTION 'Debes pertenecer al equipo';
 END IF;
 IF p_kind IS NULL OR p_kind NOT IN (
  'rival_left','rival_right','rival_near','need_help','medical','in_position','withdrawing','eliminated') THEN
  RAISE EXCEPTION 'Tipo de aviso no permitido';
 END IF;
 -- Serialización de avisos por participante/equipo. Reduce abuso desde varios dispositivos.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_team::text),pg_catalog.hashtext(v_user::text));
 IF EXISTS(SELECT 1 FROM public.team_signals
  WHERE team_id=p_team AND sender_id=v_user AND created_at>now()-interval '5 seconds') THEN
  RAISE EXCEPTION 'Espera cinco segundos antes de enviar otra señal';
 END IF;
 -- Solo usa una posición del servidor si el participante ACTIVÓ compartir GPS;
 -- no acepta coordenadas arbitrarias del cliente.
 SELECT p.latitude,p.longitude,p.accuracy_m INTO v_lat,v_lng,v_acc
 FROM public.positions p WHERE p.user_id=v_user AND p.updated_at>now()-interval '25 seconds'
 AND p.accuracy_m<=100;
 INSERT INTO public.team_signals(team_id,sender_id,kind,latitude,longitude,accuracy_m,expires_at)
 VALUES(p_team,v_user,p_kind,v_lat,v_lng,v_acc,
 CASE WHEN p_kind IN ('medical','need_help') THEN now()+interval '8 minutes'
 ELSE now()+interval '3 minutes' END)
 RETURNING id INTO v_id;
 RETURN v_id;
END $f5$;
REVOKE ALL ON FUNCTION public.f5_send_quick_signal(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f5_send_quick_signal(uuid,text) TO authenticated;

-- Al retirar el consentimiento GPS, borrar coordenadas de avisos anteriores activos.
CREATE OR REPLACE FUNCTION public.f5_clear_signal_coordinates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f5$
BEGIN
 UPDATE public.team_signals SET latitude=NULL,longitude=NULL,accuracy_m=NULL
 WHERE sender_id=OLD.user_id AND expires_at>now();
 RETURN OLD;
END $f5$;
CREATE TRIGGER f5_remove_signal_locations AFTER DELETE ON public.positions
 FOR EACH ROW EXECUTE FUNCTION public.f5_clear_signal_coordinates();
REVOKE ALL ON FUNCTION public.f5_clear_signal_coordinates() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.f5_notify_quick_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f5$
DECLARE v_title text;
BEGIN
 v_title:= CASE NEW.kind
 WHEN 'rival_left' THEN 'Rival observado a la izquierda'
 WHEN 'rival_right' THEN 'Rival observado a la derecha'
 WHEN 'rival_near' THEN 'Rival observado cerca'
 WHEN 'need_help' THEN 'Un compañero solicita apoyo'
 WHEN 'medical' THEN 'Aviso de atención médica'
 WHEN 'in_position' THEN 'Compañero en posición'
 WHEN 'withdrawing' THEN 'Compañero anuncia retirada'
 WHEN 'eliminated' THEN 'Compañero reporta eliminación'
 ELSE 'Aviso del equipo' END;
 INSERT INTO public.app_notifications(user_id,actor_id,team_id,category,title,detail)
 SELECT m.user_id,NEW.sender_id,NEW.team_id,'team_alert',v_title,
  'Aviso rápido del equipo. Abre el mapa de Airsoft Geo para consultar detalles.'
 FROM public.team_members m WHERE m.team_id=NEW.team_id AND m.user_id<>NEW.sender_id;
 RETURN NEW;
END $f5$;
CREATE TRIGGER f5_signal_notify AFTER INSERT ON public.team_signals
 FOR EACH ROW EXECUTE FUNCTION public.f5_notify_quick_signal();
REVOKE ALL ON FUNCTION public.f5_notify_quick_signal() FROM PUBLIC,anon,authenticated;

DO $migration$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='team_signals') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.team_signals;
 END IF;
END $migration$;
COMMIT;