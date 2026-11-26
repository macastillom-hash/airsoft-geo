-- Ya aplicado en el proyecto Supabase Airsoft Geo.
-- Capacidad doble: máximo 10 altas en el día calendario de Colombia
-- y nunca más de 10 invitados con acceso vigente al mismo tiempo.
create or replace function guest_control.before_anonymous_signup()
returns trigger language plpgsql security definer set search_path='' as $f$
declare v_alias text;v_code text;v_team uuid;v_used integer;
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
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('airsoft_guest_capacity_v1'));
 if (select count(*) from public.guest_sessions where expires_at>now())>=10
 then raise exception 'LIMITE_10_INVITADOS_ACTIVOS';end if;
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
create or replace function public.guest_slots_remaining() returns integer
language sql stable security definer set search_path='' as $f$
  select least(
    greatest(0,10-coalesce(
     (select q.used from public.guest_daily_quota q
      where q.day=(now() at time zone 'America/Bogota')::date),0)),
    greatest(0,10-(
     select count(*)::integer from public.guest_sessions
      where expires_at>now()
    ))
  );
$f$;
