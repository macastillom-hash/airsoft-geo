-- AIRSOFT GEO / OPERACION SOMBRA — FASE 2 (MIGRACION ADITIVA)
-- Ejecutar una vez, desde SQL Editor de Supabase, sobre la V1 existente.
-- No elimina cuentas, equipos, posiciones, mensajes ni archivos.
BEGIN;

-- Permisos administrativos limitados al propietario de cada equipo.
CREATE OR REPLACE FUNCTION public.is_team_owner(t uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.teams WHERE id=t AND owner_id=(SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.is_team_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_owner(uuid) TO authenticated;

GRANT UPDATE (name) ON public.teams TO authenticated;
DROP POLICY IF EXISTS teams_update_owner ON public.teams;
CREATE POLICY teams_update_owner ON public.teams FOR UPDATE TO authenticated
 USING(public.is_team_owner(id)) WITH CHECK(public.is_team_owner(id));
GRANT DELETE ON public.team_members TO authenticated;
DROP POLICY IF EXISTS team_members_remove_by_owner ON public.team_members;
CREATE POLICY team_members_remove_by_owner ON public.team_members FOR DELETE TO authenticated
 USING(public.is_team_owner(team_id) AND user_id <> (SELECT auth.uid()));

-- Mensajes personales solamente entre miembros de un equipo compartido.
CREATE TABLE IF NOT EXISTS public.direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 content text,
 file_path text,
 file_name text,
 mime_type text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT direct_different_users CHECK(sender_id<>recipient_id),
 CONSTRAINT direct_has_content CHECK((content IS NOT NULL AND char_length(trim(content)) BETWEEN 1 AND 2000) OR file_path IS NOT NULL),
 CONSTRAINT direct_file_fields CHECK((file_path IS NULL AND file_name IS NULL AND mime_type IS NULL) OR (file_path IS NOT NULL AND file_name IS NOT NULL AND mime_type IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_recipient_time ON public.direct_messages(sender_id,recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_sender_time ON public.direct_messages(recipient_id,sender_id,created_at DESC);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
DROP POLICY IF EXISTS direct_messages_read ON public.direct_messages;
CREATE POLICY direct_messages_read ON public.direct_messages FOR SELECT TO authenticated
 USING(sender_id=(SELECT auth.uid()) OR recipient_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS direct_messages_write ON public.direct_messages;
CREATE POLICY direct_messages_write ON public.direct_messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND public.is_teammate(recipient_id));

-- Avisos que solo el propietario de un equipo puede emitir.
CREATE TABLE IF NOT EXISTS public.team_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 severity text NOT NULL DEFAULT 'normal' CHECK(severity IN ('normal','important')),
 content text NOT NULL CHECK(char_length(trim(content)) BETWEEN 3 AND 240),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_alerts_team_time ON public.team_alerts(team_id,created_at DESC);
ALTER TABLE public.team_alerts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.team_alerts TO authenticated;
DROP POLICY IF EXISTS team_alerts_read ON public.team_alerts;
CREATE POLICY team_alerts_read ON public.team_alerts FOR SELECT TO authenticated USING(public.my_team(team_id));
DROP POLICY IF EXISTS team_alerts_owner_insert ON public.team_alerts;
CREATE POLICY team_alerts_owner_insert ON public.team_alerts FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND public.is_team_owner(team_id));

-- Centro privado de notificaciones. Los usuarios no pueden crear avisos para terceros.
CREATE TABLE IF NOT EXISTS public.app_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
 category text NOT NULL CHECK(category IN ('team_message','direct_message','team_alert')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 140),
 detail text NOT NULL DEFAULT '' CHECK(char_length(detail)<=300),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_time ON public.app_notifications(user_id,created_at DESC);
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE (read_at) ON public.app_notifications TO authenticated;
DROP POLICY IF EXISTS app_notifications_read ON public.app_notifications;
CREATE POLICY app_notifications_read ON public.app_notifications FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS app_notifications_mark_read ON public.app_notifications;
CREATE POLICY app_notifications_mark_read ON public.app_notifications FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));

-- Aviso generado en el servidor al enviar mensajes. No notifica al emisor.
CREATE OR REPLACE FUNCTION public.f2_notify_team_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.app_notifications(user_id,actor_id,team_id,category,title,detail)
 SELECT m.user_id,NEW.sender_id,NEW.team_id,'team_message',
        'Nuevo mensaje en tu equipo',
        CASE WHEN NEW.file_path IS NOT NULL THEN 'Un compañero compartió un archivo o mensaje.' ELSE 'Un compañero envió un mensaje.' END
 FROM public.team_members m
 WHERE m.team_id=NEW.team_id AND m.user_id<>NEW.sender_id;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_f2_notify_team_message ON public.messages;
CREATE TRIGGER trg_f2_notify_team_message AFTER INSERT ON public.messages
 FOR EACH ROW EXECUTE FUNCTION public.f2_notify_team_message();

CREATE OR REPLACE FUNCTION public.f2_notify_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.app_notifications(user_id,actor_id,category,title,detail)
 VALUES(NEW.recipient_id,NEW.sender_id,'direct_message','Nuevo mensaje privado',
 CASE WHEN NEW.file_path IS NOT NULL THEN 'Recibiste un archivo o mensaje privado.' ELSE 'Recibiste un mensaje privado.' END);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_f2_notify_direct_message ON public.direct_messages;
CREATE TRIGGER trg_f2_notify_direct_message AFTER INSERT ON public.direct_messages
 FOR EACH ROW EXECUTE FUNCTION public.f2_notify_direct_message();

CREATE OR REPLACE FUNCTION public.f2_notify_team_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.app_notifications(user_id,actor_id,team_id,category,title,detail)
 SELECT m.user_id,NEW.sender_id,NEW.team_id,'team_alert',
 CASE WHEN NEW.severity='important' THEN 'Alerta importante de tu equipo' ELSE 'Aviso de tu equipo' END,
 NEW.content
 FROM public.team_members m
 WHERE m.team_id=NEW.team_id AND m.user_id<>NEW.sender_id;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_f2_notify_team_alert ON public.team_alerts;
CREATE TRIGGER trg_f2_notify_team_alert AFTER INSERT ON public.team_alerts
 FOR EACH ROW EXECUTE FUNCTION public.f2_notify_team_alert();

-- Bucket privado para mensajes directos: sender_uuid/recipient_uuid/archivo.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('direct-media','direct-media',false,10485760,
 ARRAY['image/jpeg','image/png','image/webp','audio/webm','audio/mpeg','audio/mp4','audio/ogg','video/mp4','video/webm','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS direct_media_read_f2 ON storage.objects;
CREATE POLICY direct_media_read_f2 ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='direct-media' AND
 (split_part(name,'/',1)=auth.uid()::text OR split_part(name,'/',2)=auth.uid()::text)
);
DROP POLICY IF EXISTS direct_media_insert_f2 ON storage.objects;
CREATE POLICY direct_media_insert_f2 ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='direct-media' AND split_part(name,'/',1)=auth.uid()::text AND
 CASE WHEN split_part(name,'/',2) ~* '^[a-f0-9-]{36}$'
  THEN public.is_teammate(split_part(name,'/',2)::uuid) ELSE false END
);
DROP POLICY IF EXISTS direct_media_delete_f2 ON storage.objects;
CREATE POLICY direct_media_delete_f2 ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='direct-media' AND split_part(name,'/',1)=auth.uid()::text
);
-- Permite borrar archivos huérfanos propios si falló el envío del mensaje de equipo.
DROP POLICY IF EXISTS team_media_delete_own_f2 ON storage.objects;
CREATE POLICY team_media_delete_own_f2 ON storage.objects FOR DELETE TO authenticated USING (
 bucket_id='team-media' AND split_part(name,'/',2)=auth.uid()::text
);

-- Activar Realtime para las tablas nuevas, sin repetir si el SQL se ejecuta otra vez.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='app_notifications') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='direct_messages') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
 END IF;
END; $$;
COMMIT;
