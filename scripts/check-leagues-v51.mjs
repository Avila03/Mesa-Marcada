import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261022111921_leagues_v51_organizers_notices.sql");
for(const phrase of [
 "role IN ('owner','organizer','member')",
 "CREATE OR REPLACE FUNCTION app_private.can_organize_league",
 "app_private.can_organize_league(league_id)",
 "organizer_id=(SELECT auth.uid())",
 "CREATE OR REPLACE FUNCTION public.set_league_member_role",
 "IF NOT app_private.is_league_owner(p_league_id)",
 "p_role NOT IN ('organizer','member')",
 "WHERE league_id=p_league_id AND user_id=p_user_id AND role<>'owner'",
 "ALTER TABLE public.league_notifications ENABLE ROW LEVEL SECURITY",
 "recipient_id=(SELECT auth.uid())",
 "CREATE OR REPLACE FUNCTION public.read_league_notification",
 "CREATE TRIGGER trg_league_request_notice",
 "CREATE TRIGGER trg_league_role_notice",
 "CREATE TRIGGER trg_league_event_notice",
 "CREATE OR REPLACE FUNCTION public.claim_league_join_push_targets",
 "p_server_secret IS NULL OR length(p_server_secret)<40",
 "r.user_id=who AND r.status='pending'",
 "league_push_cooldowns",
 "ALTER PUBLICATION supabase_realtime ADD TABLE public.league_notifications"
]) assert.ok(sql.includes(phrase),"Missing security/feature: "+phrase);
assert.ok(!sql.includes("DISABLE ROW LEVEL SECURITY"),"RLS may never be disabled");
const hub=read("app/painel/league-hub.tsx"),home=read("app/painel/dashboard-v16.tsx");
for(const phrase of ["mm-league-overview","Próxima rodada","Pedidos pendentes",
 "attendances.filter","leader","canOrganize","set_league_member_role",
 "Promover a Organizador","Retirar cargo","LeagueFinalizationControls","/api/push/league-request"]){
 assert.ok(hub.includes(phrase),"League UI incomplete: "+phrase);
}
assert.ok(read("app/painel/mobile-first.tsx").includes("<NotificationCenter"),"Unified notifications missing from main panel");
assert.ok(read("app/painel/mobile-first.tsx").includes('item.my_role==="organizer"'),
 "Organizer should see their league in event creation");
const notifications=read("app/painel/notification-center.tsx");
for(const phrase of ["recipient_id","read_league_notification",
 "postgres_changes","join_request","join_approved","join_rejected",
 "new_event","role_changed"]){
 assert.ok(notifications.includes(phrase),"Notification delivery missing: "+phrase);
}
const push=read("app/api/push/league-request/route.ts");
assert.ok(push.includes("claim_league_join_push_targets"),"Push authorization missing");
assert.ok(push.includes("db.auth.getUser(token)"),"Push JWT validation missing");
assert.ok(!push.includes("SUPABASE_SERVICE_ROLE_KEY"),"Do not use service key");
assert.ok(read("app/ligas/convite/[token]/page.tsx").includes("/api/push/league-request"),
 "Private league invite must issue owner notification");
console.log("✓ Mesa Marcada 5.1: organizer role, inbox, owner push, preview and RLS contract");

const sw=read("public/sw.js");
assert.ok(sw.includes("ligas\\/[0-9a-f-]{36}\\/gerenciar"),
 "Push notification must link to league management in installed PWA");


// Regression for non-admin event creation with INSERT ... RETURNING.
// The sessions SELECT policy must not query sessions by id from a
// SECURITY DEFINER function; the INSERT snapshot cannot see that new row.
const sessionRls=read("supabase/migrations/20261022134635_fix_session_insert_returning_policy.sql");
const corrective=read("supabase/migrations/20261022134743_fix_sessions_select_invite_policy_recursion.sql");
for(const candidate of [sessionRls+corrective]){
 for(const check of [
  "CREATE OR REPLACE FUNCTION app_private.is_my_event_invite",
  "SECURITY DEFINER",
  "DROP POLICY IF EXISTS sessions_select_authorized",
  "CREATE POLICY sessions_select_authorized",
  "app_private.is_event_hidden(id)",
  "app_private.is_league_member(league_id)",
  "app_private.is_league_owner(league_id)",
  "app_private.is_my_event_invite(id)",
  "TO authenticated"
 ])assert.ok(candidate.includes(check),"Event insert/visibility RLS missing "+check);
 assert.ok(!candidate.includes("app_private.may_view_event(id)"),"Recursive session SELECT breaks INSERT RETURNING");
 assert.ok(!candidate.includes("DISABLE ROW LEVEL SECURITY"),"Never turn off RLS");
}
console.log("✓ Event RLS: secure INSERT RETURNING for non-admin league owners");
