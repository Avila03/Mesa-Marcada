import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261022120000_leagues_v5.sql");
for(const name of ["leagues","league_members","league_requests","league_invites"]){
 assert.ok(sql.includes("CREATE TABLE public."+name),"Missing league table "+name);
 assert.ok(sql.includes("ALTER TABLE public."+name+" ENABLE ROW LEVEL SECURITY"),"Missing RLS "+name);
 assert.ok(sql.includes("REVOKE ALL ON public."),"No explicit grants control");
}
for(const rpc of ["create_league","update_league","request_league_join","decide_league_request",
  "leave_league","generate_league_invite","preview_league_invite","get_league_catalog","get_league_ranking"]){
 assert.ok(sql.includes("FUNCTION public."+rpc+"("),"League RPC missing: "+rpc);
}
assert.ok(sql.includes("app_private.is_league_owner(p_league_id)"),"Owner permission absent");
assert.ok(sql.includes("app_private.is_league_member(s.league_id)"),"League events must be member-only");
assert.ok(sql.includes("prevent_session_league_change"),"Events must not change leagues");
assert.ok(sql.includes("league_id IS NULL OR app_private.is_league_owner(league_id)"),
 "Nonowner must not attach events to other leagues");
assert.ok(sql.includes("p_token ~ '^[a-f0-9]{64}$'"),"Private invite token validation absent");
assert.ok(sql.includes("FOR SELECT TO authenticated"),"Restrict public data to authenticated");
assert.ok(!sql.includes("DISABLE ROW LEVEL SECURITY"),"Never disable RLS");
const routes=read("lib/app-routes.ts");
for(const expected of ["/ligas/","/gerenciar","result.leagueId","page===\"liga-admin\""]){
 assert.ok(routes.includes(expected),"League routes missing: "+expected);
}
const panel=read("app/painel/mobile-first.tsx");
const home=read("app/painel/dashboard-v16.tsx");
const hub=read("app/painel/league-hub.tsx");
for(const token of ["<LeagueHub","onCreateEvent={leagueId=>openCreator",
 "league_id:form.league_id||null","form.league_id?<p",
 "setSelectedLeagueId(state.leagueId)"]){
 assert.ok(panel.includes(token),"League interaction missing: "+token);
}
assert.ok(home.includes("<LeagueHomePreview"),"Show leagues on home page");
for(const token of ["Aprovar","Recusar","Gerenciar membros","get_league_ranking",
 "request_league_join","generate_league_invite","onOpenEvent(ev.id)"]){
 assert.ok(hub.includes(token),"League hub missing feature: "+token);
}
const invite=read("app/ligas/convite/[token]/page.tsx");
assert.ok(invite.includes("/login?next="),"League invitation login handoff required");
assert.ok(invite.includes("request_league_join"),"League invite must not auto-admit");
const upcoming=read("supabase/migrations/20261022121000_leagues_realtime.sql");
assert.ok(upcoming.includes("league_requests"),"Realtime approvals publication missing");
console.log("✓ Ligas v5: permissions, join approvals, isolated events, rankings and navigation");
