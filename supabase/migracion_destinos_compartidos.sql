-- AIRSOFT GEO · Destinos compartidos de equipo.
-- APLICADA EN SUPABASE (migración team_shared_destinations_rls_realtime).
-- Archivo de referencia para reconstruir un entorno nuevo. NO volver a aplicar
-- sobre el proyecto ya migrado, porque las políticas y la publicación ya existen.
-- Adición aislada: no modifica equipos, rutas, GPS, radio ni actividades.

CREATE TABLE IF NOT EXISTS public.team_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT team_destinations_expiration CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '7 days'
  )
);
CREATE INDEX IF NOT EXISTS team_destinations_recent
 ON public.team_destinations(team_id,created_at DESC);

ALTER TABLE public.team_destinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_destinations FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.team_destinations TO authenticated;

CREATE POLICY team_destinations_read
 ON public.team_destinations FOR SELECT TO authenticated
 USING (public.my_team(team_id));

CREATE POLICY team_destinations_create
 ON public.team_destinations FOR INSERT TO authenticated
 WITH CHECK (
  creator_id=(select auth.uid()) AND public.my_team(team_id)
  AND created_at BETWEEN now()-interval '2 minutes' AND now()+interval '2 minutes'
  AND expires_at <= now()+interval '7 days'
 );

CREATE POLICY team_destinations_remove
 ON public.team_destinations FOR DELETE TO authenticated
 USING (
  public.my_team(team_id) AND
  (creator_id=(select auth.uid()) OR public.f5_can_team(team_id,'members'))
 );

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_destinations;
