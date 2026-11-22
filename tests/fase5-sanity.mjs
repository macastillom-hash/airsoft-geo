import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/App.jsx'),map=read('src/UnifiedMap.jsx'),profile=read('src/ProfileEditor.jsx'),
 team=read('src/TeamAdmin.jsx'),activity=read('src/Activities.jsx'),sql=read('supabase/migracion_fase5.sql');
for(const token of ["import UnifiedMap from './UnifiedMap'","import ProfileEditor from './ProfileEditor'",
 "tab==='admin'?<AdminPanel","tab==='activities'?<Activities","tab==='teams'?<TeamManager",
 "onNearbyVisibility={setShowNearby}","onToggleSharing={toggleSharing}",
 "lastUploadedGps","observedAt","gpsPending.current"]){
 assert.ok(app.includes(token),'Missing App integration '+token);
}
assert.ok(!app.includes("['nearby','Cercanos'"),'Cercanos must not have duplicate navigation');
for(const kind of ['rival_left','rival_right','rival_near','need_help','medical',
 'in_position','withdrawing','eliminated']){
 assert.ok(map.includes("id:'"+kind+"'"),'Missing quick action '+kind);
 assert.ok(sql.includes("'"+kind+"'"),'Unknown database signal '+kind);
}
for(const token of ["supabase.rpc('f5_send_quick_signal'","supabase.from('team_signals')",
 "meProfile","PlayerCard","ProfileAvatar","privacy","onNearbyVisibility","onOpenChat"]){
 assert.ok(map.toLowerCase().includes(token.toLowerCase()),'Map feature missing '+token);
}
assert.ok(profile.includes('profile-avatars')&&profile.includes('avatar_path'));
assert.ok(profile.includes("about_me")&&profile.includes("display_name"));
assert.ok(team.includes('f5_assign_team_roles')&&team.includes("team_roles"));
assert.ok(activity.includes("f5_assign_activity_role"));
for(const token of ["public.team_roles","public.team_signals","f5_notify_quick_signal",
 "f5_clear_signal_coordinates","f5_send_quick_signal","f5_assign_team_roles",
 "f5_assign_activity_role","f5_can_team","f5_avatar_owner_path"]){
 assert.ok(sql.includes(token),'SQL feature missing '+token);
}
assert.ok(sql.includes("ALTER TABLE public.team_signals ENABLE ROW LEVEL SECURITY"));
assert.ok(sql.includes("ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY"));
assert.ok(sql.includes("VALUES('profile-avatars','profile-avatars',false"));
assert.ok(sql.includes("public.positions p WHERE p.user_id=v_user"));
assert.ok(!sql.includes("DROP TABLE public."),'V5 must be additive');
assert.ok(!sql.includes("GRANT INSERT ON public.team_signals TO authenticated"),
 'Signals must be server-authorized');
assert.ok(!map.includes("SUPABASE_SERVICE_ROLE"),'Secrets must never enter frontend');
console.log('Fase 5: integración GPS/roles/perfiles/avisos aprobada');
