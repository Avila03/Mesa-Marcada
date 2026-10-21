// Regression guard for Mesa Marcada v1.7: Live Event must never merge
// chip purchase/payments with optional expense splits or expose timelines.
import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const types=read("lib/mesa-types.ts");
const component=read("app/painel/event-live-panel.tsx");
const sql=read("supabase/migrations/20261022010000_mesa_marcada_evento_ao_vivo.sql");
const styles=read("app/event-live.css");

for(const piece of [
  '["ao-vivo","Ao vivo"]','["fichas","Fichas"]','["gastos","Gastos"]',
  'db.rpc("start_live_event"','<EventLivePanel','setDetailTab("fichas")',
  'canSee={privateVisible}','const canFinish=(!selected?.live_start_required||Boolean(selectedLive))',
  'db.from("session_live_activity")','window.setInterval(tick,15000)'
]){
  assert.ok(panel.includes(piece),"Missing feature or rule in panel: "+piece);
}
assert.ok(types.includes('"ao-vivo"'),'DetailTab must support live view');
assert.ok(types.includes('live_start_required:boolean'),'Event must declare live requirement');
assert.ok(component.includes('status==="scheduled"&&!startedAt&&host'),'Only host gets start button');
assert.ok(component.includes('if(!canSee)'),'Timeline must remain hidden to unconfirmed users');
assert.ok(component.includes('Os rachas opcionais'),'Expense split independence not explained');
assert.ok(component.includes('onFinish'),'Live finish action missing');
assert.ok(sql.includes("v_event.organizer_id IS DISTINCT FROM (SELECT auth.uid())"),
  "Host-only authorization absent in database");
assert.ok(sql.includes("OLD.live_start_required"),"Finish guard absent");
assert.ok(sql.includes("app_private.can_view_session_private(session_id)"),
  "Activity and state must use server-side private-view policy");
assert.ok(sql.includes("REVOKE ALL ON public.session_live_activity FROM PUBLIC,anon,authenticated"),
  "Client must not fabricate timeline entries");
assert.ok(!sql.includes("expense_split_settlements")&&!sql.includes("expense_split_members"),
  "Optional expense splits must not block finishing chips");
assert.ok(styles.includes("@media(max-width:760px)"),"Live layout lacks mobile styling");
assert.ok(styles.includes("#258bff"),"Dark Cards electric-blue design token missing");
console.log("✓ v1.7 Event Live: manual host start, private timeline, chips-only finish and separate optional expense splits");
