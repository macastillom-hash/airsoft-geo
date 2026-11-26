-- Migración ya aplicada al proyecto Supabase Airsoft Geo.
-- No ejecutar manualmente de nuevo en este mismo proyecto.
-- INVITADOS AIRSOFT · cada acceso aprobado dura 24 h, máximo 10 por día (Bogotá).
create table if not exists public.guest_sessions(
 user_id uuid primary key references auth.users(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 alias text not null check(char_length(btrim(alias)) between 3 and 40),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 constraint guest_24h check(expires_at>created_at and expires_at<=created_at+interval '24 hours')
);
create index if not exists guest_sessions_expiry on public.guest_sessions(expires_at);
alter table public.guest_sessions enable row level security;
revoke all on public.guest_sessions from public,anon,authenticated;
grant select on public.guest_sessions to authenticated;
create policy guest_own_session on public.guest_sessions for select to authenticated
 using (user_id=(select auth.uid()));

create table if not exists public.guest_daily_quota(
 day date primary key, used integer not null default 0 check(used between 0 and 10)
);
alter table public.guest_daily_quota enable row level security;
revoke all on public.guest_daily_quota from public,anon,authenticated;

create or replace function public.guest_is_active() returns boolean
language sql stable security definer set search_path='' as $f$
 select coalesce((
  select case when not u.is_anonymous then true
  else exists(select 1 from public.guest_sessions s where s.user_id=u.id
    and s.expires_at>now() and s.created_at<=now())
  end from auth.users u where u.id=(select auth.uid())
 ),false);
$f$;
revoke all on function public.guest_is_active() from public,anon;
grant execute on function public.guest_is_active() to authenticated;

-- El invitado solo accede al equipo autorizado mientras su sesión está vigente.
create or replace function public.my_team(t uuid) returns boolean
language sql stable security definer set search_path='' as $f$
 select exists(
  select 1 from public.team_members m join auth.users u on u.id=m.user_id
  where m.team_id=t and m.user_id=(select auth.uid())
    and (not u.is_anonymous or exists(
      select 1 from public.guest_sessions g where g.user_id=u.id
       and g.team_id=t and g.expires_at>now()
    ))
 );
$f$;

create or replace function public.is_teammate(other_user uuid) returns boolean
language sql stable security definer set search_path='' as $f$
 select public.guest_is_active() and exists(
 select 1 from public.team_members mine
 join public.team_members theirs on theirs.team_id=mine.team_id
 join auth.users target on target.id=theirs.user_id
 where mine.user_id=(select auth.uid()) and theirs.user_id=other_user
 and public.my_team(mine.team_id)
 and (not target.is_anonymous or exists(
  select 1 from public.guest_sessions g where g.user_id=target.id
    and g.team_id=mine.team_id and g.expires_at>now()
 ))
 );
$f$;

-- Aunque alguien modifique el rol, un invitado nunca puede administrar.
create or replace function public.f5_can_team(p_team uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $f$
 select coalesce((
 select (not u.is_anonymous) and
  (t.owner_id=(select auth.uid()) or
   (m.user_id=(select auth.uid()) and
     (case when p_capability='members' then m.administrative_role='admin'
           when p_capability='alerts' then m.administrative_role in ('admin','coordinator')
           else false end)))
 from public.teams t
 join auth.users u on u.id=(select auth.uid())
 left join public.team_members m on m.team_id=t.id and m.user_id=u.id
 where t.id=p_team
 ),false);
$f$;

-- Los usuarios permanentes conservan join_team. Los anónimos usan su único equipo temporal.
create or replace function public.join_team(code text) returns uuid
language plpgsql security definer set search_path='' as $f$
declare target_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Inicia sesión'; end if;
 if exists(select 1 from auth.users where id=(select auth.uid()) and is_anonymous) then
  raise exception 'Los invitados solo ingresan mediante el acceso temporal';
 end if;
 select id into target_id from public.teams where invite_code=upper(btrim(code));
 if target_id is null then raise exception 'Código de equipo incorrecto'; end if;
 insert into public.team_members(team_id,user_id) values(target_id,(select auth.uid()))
 on conflict do nothing;
 return target_id;
end $f$;

-- RPC atómica. El contador se incrementa solo cuando hay código válido y cupo.
create or replace function public.guest_join_team(p_code text,p_alias text)
returns uuid language plpgsql security definer set search_path='' as $f$
declare v_user uuid:=(select auth.uid());v_team uuid;v_used integer;v_existing public.guest_sessions%rowtype;
begin
 if v_user is null or not exists(
  select 1 from auth.users where id=v_user and is_anonymous and created_at<=now()
 ) then raise exception 'Debes usar la opción Entrar como invitado';end if;
 if p_alias is null or char_length(btrim(p_alias)) not between 3 and 40
  or p_alias ~ '[[:cntrl:]]' then raise exception 'El alias debe tener entre 3 y 40 caracteres';end if;
 if p_code is null or upper(btrim(p_code)) !~ '^[A-Z0-9]{10}$' then
  raise exception 'Ingresa el código de equipo de 10 caracteres'; end if;
 select * into v_existing from public.guest_sessions where user_id=v_user;
 if found then
  if v_existing.expires_at<=now() then raise exception 'La invitación temporal ha vencido';end if;
  return v_existing.team_id;
 end if;
 select id into v_team from public.teams where invite_code=upper(btrim(p_code));
 if v_team is null then raise exception 'Código de equipo incorrecto';end if;
 insert into public.guest_daily_quota(day,used)
 values((now() at time zone 'America/Bogota')::date,1)
 on conflict(day) do update set used=public.guest_daily_quota.used+1
  where public.guest_daily_quota.used<10
 returning used into v_used;
 if v_used is null then raise exception 'Se alcanzó el límite de 10 invitados de hoy';end if;
 insert into public.guest_sessions(user_id,team_id,alias)
 values(v_user,v_team,btrim(p_alias));
 insert into public.team_members(team_id,user_id)
 values(v_team,v_user) on conflict do nothing;
 update public.profiles set alias=btrim(p_alias), discoverable=false where id=v_user;
 return v_team;
end $f$;
revoke all on function public.guest_join_team(text,text) from public,anon;
grant execute on function public.guest_join_team(text,text) to authenticated;

-- Restricciones de acceso de invitado, sin modificar los permisos de usuarios permanentes.
create policy guest_no_team_create on public.teams as restrictive for insert to authenticated
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_team_update on public.teams as restrictive for update to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false)
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_activity_create on public.activities as restrictive for insert to authenticated
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_activity_update on public.activities as restrictive for update to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false)
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_only_read_destinations on public.team_destinations as restrictive for insert to authenticated
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_remove_destinations on public.team_destinations as restrictive for delete to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_active_positions on public.positions as restrictive for all to authenticated
 using((select public.guest_is_active())) with check((select public.guest_is_active()));
create policy guest_active_profiles on public.profiles as restrictive for select to authenticated
 using((select public.guest_is_active()));
create policy guest_no_profile_edits on public.profiles as restrictive for update to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false)
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_active_messages_read on public.messages as restrictive for select to authenticated
 using((select public.guest_is_active()));
create policy guest_active_messages_write on public.messages as restrictive for insert to authenticated
 with check((select public.guest_is_active()));
create policy guest_no_members_remove on public.team_members as restrictive for delete to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);

-- Invitados solo chat de texto, no archivos ni avatar.
create policy guest_no_storage_insert on storage.objects as restrictive for insert to authenticated
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_storage_update on storage.objects as restrictive for update to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false)
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
create policy guest_no_storage_delete on storage.objects as restrictive for delete to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);

-- Limpieza: se descartan los registros de invitados caducados y cuentas de Auth.
-- No se borra ningún usuario registrado. Los invitados no pueden crear equipos/actividades.
create schema if not exists guest_control;
revoke all on schema guest_control from public,anon,authenticated;
create or replace function guest_control.purge_expired() returns integer
language plpgsql security definer set search_path='' as $f$
declare ids uuid[];cnt integer:=0;
begin
 select array_agg(s.user_id) into ids from public.guest_sessions s
 join auth.users u on u.id=s.user_id and u.is_anonymous
 where s.expires_at<=now();
 if ids is null then return 0;end if;
 delete from public.team_signals where sender_id=any(ids);
 delete from public.activity_eliminations where requester_id=any(ids) or target_id=any(ids);
 delete from public.activity_events where actor_id=any(ids);
 delete from public.activity_flags where carrier_id=any(ids);
 -- Los invitados no tienen permisos para administrar actividades o equipos.
 delete from auth.users where id=any(ids) and is_anonymous=true;
 get diagnostics cnt=row_count;
 return cnt;
end $f$;
revoke all on function guest_control.purge_expired() from public,anon,authenticated;

select cron.schedule('airsoft-guest-purge-5m','*/5 * * * *',
 'select guest_control.purge_expired();');
