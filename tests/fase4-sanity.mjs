import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=source('src/App.jsx'),admin=source('src/AdminPanel.jsx'),push=source('src/PushSettings.jsx'),
 sw=source('public/notification-sw.js'),sql=source('supabase/migracion_fase4.sql');
for(const token of ["AdminPanel","tab==='admin'?<AdminPanel","NotificationSettings userId={user.id}"]){
 assert.ok(app.includes(token),'Missing App integration: '+token);
}
for(const token of ['activities','activity_participants','team_members','activity_events','f4_admin_audit']){
 assert.ok(admin.includes(token),'Missing admin query: '+token);
}
for(const token of ['airsoft-geo-team-export-v4','text/csv','window.print()']){
 assert.ok(admin.includes(token),'Missing report/export: '+token);
}
for(const token of ['pushManager.subscribe','pushManager.getSubscription','f4_test_push','push_subscriptions']){
 assert.ok(push.includes(token),'Missing push control: '+token);
}
assert.ok(sw.includes("addEventListener('push'"));
for(const table of ['public.f4_admin_audit','public.push_subscriptions']){
 assert.ok(sql.includes('CREATE TABLE '+table),'Missing new table: '+table);
 assert.ok(sql.includes('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY'),'Missing RLS: '+table);
}
for(const token of ['f4_queue_push_notification','f4_push_server_config','f4_vapid_public_key','f4_test_push']){
 assert.ok(sql.includes('FUNCTION public.'+token),'Missing function '+token);
}
assert.ok(sql.includes('vault.decrypted_secrets'));
assert.ok(!sql.includes('DROP TABLE public.'));
assert.ok(!admin.includes('latitude'),'Admin reports must not export precise GPS');
console.log('Fase 4: verificaciones de integración superadas.');
