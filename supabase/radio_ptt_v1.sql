-- RADIO PTT V1 — aplicar manualmente en Supabase SQL Editor cuando se pruebe la rama.
-- NO modifica tablas GPS, cámaras, mensajería ni la lógica existente.
-- Realtime Broadcast/Presence privados: acceso limitado por membresía del equipo.
-- La función public.my_team(uuid) ya existe en supabase/schema.sql.
-- Supabase ya tiene RLS habilitado en realtime.messages; NO alterarlo.
-- El nombre del tema debe coincidir exactamente con airsoft-radio:<uuid>.
-- Validar que en Supabase Realtime Settings se deshabilite "Allow public access".

drop policy if exists "radio_ptt_team_receive" on realtime.messages;
drop policy if exists "radio_ptt_team_send" on realtime.messages;

create policy "radio_ptt_team_receive"
on realtime.messages for select to authenticated
using (
 case
  when realtime.topic() ~ '^airsoft-radio:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then public.my_team(split_part(realtime.topic(),':',2)::uuid)
  else false
 end
);

create policy "radio_ptt_team_send"
on realtime.messages for insert to authenticated
with check (
 case
  when realtime.topic() ~ '^airsoft-radio:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then public.my_team(split_part(realtime.topic(),':',2)::uuid)
  else false
 end
);

-- Comprobaciones de lectura (sin revelar IDs de usuarios ni claves):
-- SELECT policyname,cmd FROM pg_policies WHERE schemaname='realtime' AND tablename='messages'
-- AND policyname LIKE 'radio_ptt_%' ORDER BY policyname;
-- SELECT relrowsecurity FROM pg_class WHERE oid='realtime.messages'::regclass;
