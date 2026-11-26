-- Migración ya aplicada al proyecto Supabase Airsoft Geo.
-- No ejecutar manualmente de nuevo en este mismo proyecto.
-- El cupo se cobra al CREAR cada identidad anónima, en la misma transacción.
-- Códigos inválidos y cupos agotados no crean usuarios ni ocupan plazas.
create or replace function guest_control.before_anonymous_signup()
returns trigger language plpgsql security definer set search_path='' as $f$
declare
  v_alias text; v_code text; v_team uuid; v_used integer;
begin
  if not coalesce(new.is_anonymous,false) then return new;end if;
  v_alias:=btrim(coalesce(new.raw_user_meta_data->>'alias',''));
  v_code:=upper(btrim(coalesce(new.raw_user_meta_data->>'guest_team_code','')));
  if char_length(v_alias) not between 3 and 40 or v_alias ~ '[[:cntrl:]]'
  then raise exception 'ALIAS_INVITADO_INVALIDO';end if;
  if v_code !~ '^[A-Z0-9]{10}$'
  then raise exception 'CODIGO_INVITADO_INVALIDO';end if;
  select id into v_team from public.teams where invite_code=v_code;
  if v_team is null then raise exception 'CODIGO_EQUIPO_INVALIDO';end if;
  insert into public.guest_daily_quota(day,used)
    values((now() at time zone 'America/Bogota')::date,1)
    on conflict(day) do update set used=public.guest_daily_quota.used+1
    where public.guest_daily_quota.used<10
    returning used into v_used;
  if v_used is null then raise exception 'LIMITE_10_INVITADOS_DIARIOS';end if;
  new.raw_app_meta_data=coalesce(new.raw_app_meta_data,'{}'::jsonb)
    ||pg_catalog.jsonb_build_object('guest_team_id',v_team::text);
  return new;
end $f$;

create or replace function guest_control.after_anonymous_signup()
returns trigger language plpgsql security definer set search_path='' as $f$
declare v_team uuid;v_alias text;
begin
  if not coalesce(new.is_anonymous,false) then return new;end if;
  v_team:=(new.raw_app_meta_data->>'guest_team_id')::uuid;
  v_alias:=btrim(new.raw_user_meta_data->>'alias');
  if v_team is null then raise exception 'FALTA_EQUIPO_INVITADO';end if;
  insert into public.guest_sessions(user_id,team_id,alias)
    values(new.id,v_team,v_alias);
  insert into public.team_members(team_id,user_id)
    values(v_team,new.id) on conflict do nothing;
  return new;
end $f$;
revoke all on function guest_control.before_anonymous_signup() from public,anon,authenticated;
revoke all on function guest_control.after_anonymous_signup() from public,anon,authenticated;

create trigger guest_before_signup before insert on auth.users
 for each row execute function guest_control.before_anonymous_signup();
-- El perfil normal se crea primero en el trigger "after_auth_signup".
create trigger zzz_guest_after_signup after insert on auth.users
 for each row execute function guest_control.after_anonymous_signup();

-- Indicador público de cupos restantes para evitar intentos innecesarios.
create or replace function public.guest_slots_remaining() returns integer
language sql stable security definer set search_path='' as $f$
  select greatest(0,10-coalesce(
    (select q.used from public.guest_daily_quota q
      where q.day=(now() at time zone 'America/Bogota')::date),0));
$f$;
revoke all on function public.guest_slots_remaining() from public;
grant execute on function public.guest_slots_remaining() to anon,authenticated;
