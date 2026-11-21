import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8');
const app = read('src/App.jsx'), ui = read('src/Activities.jsx'), sql = read('supabase/migracion_fase3.sql');
for (const token of ["import Activities from './Activities'","tab==='activities'?<Activities","tab==='teams'?<TeamManager"]) assert.ok(app.includes(token), token);
for (const token of ['f3_create_activity','f3_join_activity_team','f3_flag_action','f3_organizer_action','f3_respawn']) {
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.' + token), token);
  assert.ok(ui.includes("'" + token + "'"), token);
}
for (const table of ['activities','activity_teams','activity_participants','activity_zones','activity_eliminations','activity_flags','activity_events']) {
 assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.'+table), table);
 assert.ok(sql.includes('ALTER TABLE public.'+table+' ENABLE ROW LEVEL SECURITY'), table+' RLS');
}
assert.ok(!sql.includes('DROP TABLE public.profiles'));
assert.ok(!sql.includes('DROP TABLE public.messages'));
console.log('V3 sanity: OK');
