-- Operación Sombra V1. Ejecutar UNA VEZ en Supabase SQL Editor.
-- Precisión de coordenadas: solo para equipos autorizados; descubrimiento público aproximado.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 alias text not null check(char_length(alias) between 3 and 40),
 discoverable boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 3 and 60),
 invite_code text unique not null default upper(substr(encode(gen_random_bytes(12),'hex'),1,10)),
 owner_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.team_members (
 team_id uuid not null references public.teams(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(team_id,user_id)
);
create table public.positions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision check(accuracy_m >= 0),
 updated_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.teams(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 content text,
 file_path text,
 file_name text,
 mime_type text,
 created_at timestamptz not null default now(),
 constraint msg_has_content check((content is not null and char_length(trim(content)) between 1 and 2000) or file_path is not null),
 constraint msg_file_fields check((file_path is null and file_name is null and mime_type is null) or (file_path is not null and file_name is not null and mime_type is not null))
);
create index on public.messages(team_id,created_at desc);
create index on public.team_members(user_id);
create index on public.positions(updated_at);

create or replace function public.my_team(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.team_members m where m.team_id=t and m.user_id=(select auth.uid()));
$$;
revoke all on function public.my_team(uuid) from public;
grant execute on function public.my_team(uuid) to authenticated;

create or replace function public.is_teammate(other_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.team_members mine join public.team_members theirs on theirs.team_id=mine.team_id
 where mine.user_id=(select auth.uid()) and theirs.user_id=other_user);
$$;
revoke all on function public.is_teammate(uuid) from public;
grant execute on function public.is_teammate(uuid) to authenticated;

create or replace function public.new_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,alias) values(new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'alias'),40),''),'Agente-'||left(new.id::text,8)));
 return new;
end $$;
create trigger after_auth_signup after insert on auth.users for each row execute procedure public.new_user_profile();

create or replace function public.add_team_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.team_members(team_id,user_id) values(new.id,new.owner_id);
 return new;
end $$;
create trigger after_team_create after insert on public.teams for each row execute procedure public.add_team_owner();

create or replace function public.join_team(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select id into target_id from public.teams where invite_code=upper(trim(code));
 if target_id is null then raise exception 'Código de equipo incorrecto'; end if;
 insert into public.team_members(team_id,user_id) values(target_id,auth.uid()) on conflict do nothing;
 return target_id;
end $$;
revoke all on function public.join_team(text) from public;
grant execute on function public.join_team(text) to authenticated;

-- Devuelve coordenadas redondeadas a ~110 m y distancias aproximadas; solo personas visibles,
-- activas hace menos de 60 segundos y a <=1000 metros. No expone coordenadas exactas públicas.
create or replace function public.nearby_people(my_lat double precision,my_lng double precision)
returns table(user_id uuid,alias text,latitude double precision,longitude double precision,distance_m integer)
language sql stable security definer set search_path = '' as $$
 with nearby as (
 select p.user_id, pr.alias, p.latitude, p.longitude,
 (6371000 * 2 * asin(least(1.0,sqrt(
 power(sin(radians(p.latitude-my_lat)/2),2) +
 cos(radians(my_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-my_lng)/2),2)
 )))) as meters
 from public.positions p join public.profiles pr on pr.id=p.user_id
 where pr.discoverable=true and p.user_id<>auth.uid() and p.updated_at>now()-interval '60 seconds'
 and my_lat between -90 and 90 and my_lng between -180 and 180
 )
 select n.user_id,n.alias,round(n.latitude::numeric,3)::double precision,round(n.longitude::numeric,3)::double precision,
 (round(n.meters/100.0)*100)::integer from nearby n where n.meters<=1000 order by n.meters asc limit 40;
$$;
revoke all on function public.nearby_people(double precision,double precision) from public;
grant execute on function public.nearby_people(double precision,double precision) to authenticated;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.positions enable row level security;
alter table public.messages enable row level security;

create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_teammate(id));
create policy profiles_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy teams_read on public.teams for select to authenticated using(public.my_team(id));
create policy teams_create on public.teams for insert to authenticated with check(owner_id=(select auth.uid()));
create policy team_members_read on public.team_members for select to authenticated using(public.my_team(team_id));
create policy positions_read on public.positions for select to authenticated using(user_id=(select auth.uid()) or public.is_teammate(user_id));
create policy positions_insert on public.positions for insert to authenticated with check(user_id=(select auth.uid()));
create policy positions_update on public.positions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy positions_delete on public.positions for delete to authenticated using(user_id=(select auth.uid()));
create policy messages_read on public.messages for select to authenticated using(public.my_team(team_id));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=(select auth.uid()) and public.my_team(team_id));

-- Carpeta por equipo. Bucket privado: sin URL pública de archivos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('team-media','team-media',false,10485760,
 array['image/jpeg','image/png','image/webp','audio/webm','audio/mpeg','audio/mp4','audio/ogg','video/mp4','video/webm','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy team_media_read on storage.objects for select to authenticated using (
 bucket_id='team-media' and public.my_team((split_part(name,'/',1))::uuid)
);
create policy team_media_insert on storage.objects for insert to authenticated with check (
 bucket_id='team-media' and public.my_team((split_part(name,'/',1))::uuid)
 and split_part(name,'/',2)=auth.uid()::text
);

-- Habilitar cambios en vivo para mensajes y posiciones; RLS sigue aplicando.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.positions;
