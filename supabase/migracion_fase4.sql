-- Airsoft Geo V4. Migración aditiva sin borrar tablas, usuarios ni posiciones anteriores.
-- Registro de auditoría para propietarios; push opt-in por dispositivo; funciones protegidas.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.f4_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 action text NOT NULL CHECK (char_length(action) BETWEEN 3 AND 50),
 detail text NOT NULL DEFAULT '' CHECK (char_length(detail)<=240),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX f4_audit_team_time ON public.f4_admin_audit(team_id,created_at DESC);
ALTER TABLE public.f4_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.f4_admin_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.f4_admin_audit TO authenticated;
CREATE POLICY f4_audit_owner_read ON public.f4_admin_audit FOR SELECT TO authenticated
 USING(public.is_team_owner(team_id));

CREATE OR REPLACE FUNCTION public.f4_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $audit$
BEGIN
 IF TG_TABLE_NAME='teams' AND TG_OP='UPDATE' THEN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
   INSERT INTO public.f4_admin_audit(team_id,actor_id,action,detail)
   VALUES(NEW.id,(SELECT auth.uid()),'team_renamed','Nombre del equipo actualizado');
  END IF;
 ELSIF TG_TABLE_NAME='team_members' AND TG_OP='DELETE' THEN
  INSERT INTO public.f4_admin_audit(team_id,actor_id,action,detail)
  VALUES(OLD.team_id,(SELECT auth.uid()),'member_removed','Integrante retirado del equipo');
 ELSIF TG_TABLE_NAME='activities' AND TG_OP='UPDATE' THEN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.f4_admin_audit(team_id,actor_id,action,detail)
   SELECT at.team_id,(SELECT auth.uid()),'activity_status',
    'Actividad: '||left(NEW.title,80)||' · '||NEW.status
   FROM public.activity_teams at WHERE at.activity_id=NEW.id;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 -- La auditoría nunca debe bloquear cambios funcionales de V1-V3.
 RAISE WARNING 'f4 audit insert skipped';
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $audit$;
CREATE TRIGGER f4_audit_team_rename AFTER UPDATE OF name ON public.teams
 FOR EACH ROW EXECUTE FUNCTION public.f4_log_changes();
CREATE TRIGGER f4_audit_member_removal AFTER DELETE ON public.team_members
 FOR EACH ROW EXECUTE FUNCTION public.f4_log_changes();
CREATE TRIGGER f4_audit_activity_status AFTER UPDATE OF status ON public.activities
 FOR EACH ROW EXECUTE FUNCTION public.f4_log_changes();
REVOKE ALL ON FUNCTION public.f4_log_changes() FROM PUBLIC,anon,authenticated;

-- Cada dispositivo se suscribe explícitamente. No contiene posiciones GPS.
CREATE TABLE public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE CHECK(char_length(endpoint) BETWEEN 50 AND 2048 AND endpoint LIKE 'https://%'),
 p256dh text NOT NULL CHECK(char_length(p256dh) BETWEEN 40 AND 300),
 auth_key text NOT NULL CHECK(char_length(auth_key) BETWEEN 8 AND 300),
 user_agent text NOT NULL DEFAULT '' CHECK(char_length(user_agent)<=240),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.push_subscriptions TO authenticated;
GRANT UPDATE (p256dh,auth_key,user_agent,last_seen_at) ON public.push_subscriptions TO authenticated;
CREATE POLICY push_subscription_read ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscription_create ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscription_update ON public.push_subscriptions FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscription_delete ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

-- Configuración privada. Las claves VAPID y firma se guardan cifradas en Supabase Vault,
-- no aparecen en el repositorio y nunca se envían al navegador.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC,anon,authenticated;
CREATE TABLE app_private.f4_push_config (
 singleton integer PRIMARY KEY DEFAULT 1 CHECK(singleton=1),
 vapid_public_key text NOT NULL DEFAULT '',
 vapid_private_secret_id uuid,
 signing_secret_id uuid,
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.f4_push_config FROM PUBLIC,anon,authenticated;
INSERT INTO app_private.f4_push_config(singleton) VALUES(1) ON CONFLICT(singleton) DO NOTHING;

-- Clave pública: solo un usuario autenticado puede solicitarla.
CREATE OR REPLACE FUNCTION public.f4_vapid_public_key()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f4$
 SELECT CASE WHEN c.enabled THEN c.vapid_public_key ELSE '' END
 FROM app_private.f4_push_config c WHERE c.singleton=1;
$f4$;
REVOKE ALL ON FUNCTION public.f4_vapid_public_key() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f4_vapid_public_key() TO authenticated;

-- Configuración confidencial destinada exclusivamente a Edge Functions con service_role.
CREATE OR REPLACE FUNCTION public.f4_push_server_config()
RETURNS TABLE(vapid_public_key text,vapid_private_key text,signing_secret text,enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $f4$
 SELECT c.vapid_public_key,pk.decrypted_secret,hs.decrypted_secret,c.enabled
 FROM app_private.f4_push_config c
 LEFT JOIN vault.decrypted_secrets pk ON pk.id=c.vapid_private_secret_id
 LEFT JOIN vault.decrypted_secrets hs ON hs.id=c.signing_secret_id
 WHERE c.singleton=1;
$f4$;
REVOKE ALL ON FUNCTION public.f4_push_server_config() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f4_push_server_config() TO service_role;

-- Envío de un mensaje de prueba, limitado a una vez por minuto por usuario.
CREATE OR REPLACE FUNCTION public.f4_test_push()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f4$
DECLARE v_user uuid:=(SELECT auth.uid());
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Inicia sesión'; END IF;
 IF EXISTS(SELECT 1 FROM public.app_notifications
   WHERE user_id=v_user AND title='Prueba de notificación push' AND created_at>now()-interval '1 minute') THEN
  RAISE EXCEPTION 'Puedes solicitar una nueva prueba después de un minuto';
 END IF;
 INSERT INTO public.app_notifications(user_id,actor_id,category,title,detail)
 VALUES(v_user,v_user,'team_alert','Prueba de notificación push',
 'La notificación de prueba de Airsoft Geo se envió desde el servidor.');
END $f4$;
REVOKE ALL ON FUNCTION public.f4_test_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.f4_test_push() TO authenticated;

-- Hook firmado con HMAC: si la red falla, el mensaje de chat sigue insertándose.
CREATE OR REPLACE FUNCTION public.f4_queue_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $f4$
DECLARE v_config app_private.f4_push_config%ROWTYPE; v_signing text;
BEGIN
 SELECT * INTO v_config FROM app_private.f4_push_config WHERE singleton=1;
 IF NOT FOUND OR NOT v_config.enabled THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.push_subscriptions WHERE user_id=NEW.user_id) THEN RETURN NEW; END IF;
 SELECT decrypted_secret INTO v_signing FROM vault.decrypted_secrets WHERE id=v_config.signing_secret_id;
 IF v_signing IS NULL THEN RETURN NEW; END IF;
 PERFORM net.http_post(
  url:='https://lfkyznzwvgrsnmaukigi.supabase.co/functions/v1/airsoft-push',
  body:=jsonb_build_object('notification_id',NEW.id),
  headers:=jsonb_build_object('Content-Type','application/json',
   'X-Airsoft-Signature',encode(extensions.hmac(NEW.id::text,v_signing,'sha256'),'hex')),
  timeout_milliseconds:=4000
 );
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'push hook not delivered; notification persisted';
 RETURN NEW;
END $f4$;
CREATE TRIGGER f4_notify_push AFTER INSERT ON public.app_notifications
 FOR EACH ROW EXECUTE FUNCTION public.f4_queue_push_notification();
REVOKE ALL ON FUNCTION public.f4_queue_push_notification() FROM PUBLIC,anon,authenticated;

-- Índices de soporte para FKs frecuentemente consultadas.
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_organizer ON public.activities(organizer_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_alerts_sender ON public.team_alerts(sender_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_actor ON public.app_notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_app_notifications_team ON public.app_notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_eliminations_requester ON public.activity_eliminations(requester_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor ON public.activity_events(actor_id);
COMMIT;