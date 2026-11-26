-- Migración ya aplicada al proyecto Supabase Airsoft Geo.
-- No ejecutar manualmente de nuevo en este mismo proyecto.
-- Doble protección para RPC SECURITY DEFINER: los invitados no pueden provocar
-- cambios administrativos aunque intenten llamar a una función directamente.
create or replace function public.block_guest_privileged_write()
returns trigger language plpgsql security definer set search_path='' as $f$
begin
 if exists(select 1 from auth.users u where u.id=(select auth.uid()) and u.is_anonymous)
 then raise exception 'Esta acción no está disponible para invitados temporales';end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $f$;
revoke all on function public.block_guest_privileged_write() from public,anon;
-- Permisos por trigger, no se concede ejecución directa.
create trigger guest_protect_teams before insert or update or delete
 on public.teams for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activities before insert or update or delete
 on public.activities for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_zones before insert or update or delete
 on public.activity_zones for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_teams before insert or update or delete
 on public.activity_teams for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_events before insert or update or delete
 on public.activity_events for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_flags before insert or update or delete
 on public.activity_flags for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_eliminations before insert or update or delete
 on public.activity_eliminations for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_activity_participants before insert or update or delete
 on public.activity_participants for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_team_signals before insert or update or delete
 on public.team_signals for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_team_alerts before insert or update or delete
 on public.team_alerts for each row execute function public.block_guest_privileged_write();
create trigger guest_protect_team_roles before insert or update or delete
 on public.team_roles for each row execute function public.block_guest_privileged_write();

create policy guest_no_direct_messages on public.direct_messages as restrictive
 for all to authenticated
 using(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false)
 with check(coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false)=false);
