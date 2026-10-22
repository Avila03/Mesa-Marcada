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
const newSql=read("supabase/migrations/20261022020000_live_chips_inventory_settlements.sql");

for(const piece of [
  '["ao-vivo","Ao vivo"]','["compra","Compra"]','id="event-expenses"',
  'db.rpc("start_live_event"','<EventLivePanel','setLiveSubtab("encerrar")',
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

for(const term of ["v_limit:=CASE", "record_chip_final", "set_chip_payout", "chip_final_balanced", "session_chip_final_items", "session_chip_payouts"]){
 assert.ok(newSql.includes(term),"v1.8 live chip invariant missing: "+term);
}
assert.ok(!panel.includes('["fichas","Fichas"]'),"Fichas must not remain a top-level event tab");
assert.ok(panel.includes('liveSubtab==="compra"')&&panel.includes('liveSubtab==="encerrar"'),"Checkout must live inside Ao vivo");

// v1.8.2: o fechamento é um livro-caixa em reais, não uma segunda maleta.
const cashSql=read("supabase/migrations/20261022030000_cashout_brl.sql");
for(const term of ["session_chip_cashouts","record_chip_cashout","cashout_balanced","chip_settlement_brl","set_chip_payout"]){
  assert.ok(cashSql.includes(term),"Missing cash reconciliation requirement: "+term);
}
assert.ok(panel.includes('Acerto final em reais'),"Closing screen must ask for reais");
assert.ok(panel.includes('db.rpc("record_chip_cashout"'),"Closing must save final BRL amount");
assert.ok(!panel.includes('Conferência final por denominação'),"Closing must not ask for quantities per denomination");
assert.ok(panel.includes('cashBalanced')&&panel.includes('totalBoughtBRL'),"Cash totals must be reconciled before finish");

assert.ok(!panel.includes('Compras em fichas são convertidas automaticamente em reais. O acerto final acontece apenas em reais.'),
 "Redundant live chip conversion info banner must be hidden");
assert.ok(!panel.includes('Caixa conciliado: o total dos repasses é igual ao das compras.'),
 "Cash balanced success notification must not obscure settlement summary");
assert.ok(panel.includes('{!cashBalanced&&<p className="mm-message error">'),
 "Mismatched or missing cash amounts must still present an action warning");

const seatsSql=read("supabase/migrations/20261022040000_table_seats_dealer.sql");
const seatsUi=read("app/painel/seating-table.tsx");
const seatsCss=read("app/painel/seating-table.css");
const duoCss=read("app/painel/duo-theme.css");
// Segurança: reserva serializada e única; crupiê obrigatório só no Blackjack.
for(const term of ["session_table_seats","UNIQUE(session_id,seat_no)",
   "REFERENCES public.session_attendance(session_id,user_id) ON DELETE CASCADE",
   "WHERE s.id=p_event_id FOR UPDATE","v_game='blackjack'","st.seat_no=0",
   "IF EXISTS(SELECT 1 FROM public.session_live_state","CREATE POLICY seating_read_confirmed",
   "CREATE OR REPLACE FUNCTION app_private.start_live_event"]){
  assert.ok(seatsSql.includes(term),"Missing seating security rule: "+term);
}
for(const token of ["<SeatingTable","db.rpc(\"choose_table_seat\"","detailTab===\"visao\"",
   '["visao","Visão geral"]','openEvent(data.id,"visao")']){
  assert.ok(panel.includes(token),"Event seat integration missing: "+token);
}
assert.ok(seatsUi.includes("mm-seat-dealer")&&seatsUi.includes("CRUPIÊ"),"Blackjack dealer marker missing");
assert.ok(seatsUi.includes("disabled={!canChange||busy"),"Seat action must work without prior confirmation");
assert.ok(seatsCss.includes("@media(max-width:490px)"),"Seats need compact mobile sizing");
assert.ok(duoCss.includes("#258bff")&&duoCss.includes("#ff424d"),"Keep coequal Dark Cards Duo accents");
assert.ok(duoCss.includes(".mm-game-blackjack .btn.gold"),"Blackjack must use red primary action");
console.log("✓ v1.9: seating, dealer, concurrency, responsive and Dark Cards Duo");

const newFinanceSql=read("supabase/migrations/20261022050000_simplified_cashout_finish.sql");
const recap=read("app/painel/night-summary.tsx");
const expenseUi=read("app/painel/expense-splits.tsx");
const movements=read("app/painel/event-live-panel.tsx");
for(const token of ['["visao","Visão geral"]','id="event-expenses"','["compra","Compra"]',
 '["resumo","Resumo"]','["encerrar","Encerrar"]','<SeatingTable','openPolls.length',
 'showPastPolls','showCreatePoll','<NightSummary','setDetailTab("resumo-evento")']){
 assert.ok(panel.includes(token),"Expected simplified event workflow: "+token);
}
for(const gone of ['["enquetes","Enquetes"]','["assentos","Assentos"]',
 '["movimentacoes","Movimentações"]','confirm_chip_payment','set_chip_payout',
 'set_expense_settled']){
 assert.ok(!panel.includes(gone),"Old action/tab must not appear: "+gone);
}
assert.ok(newFinanceSql.includes("app_private.cashout_balanced(NEW.id)"),
 "Must enforce BRL cashout sum on finish");
assert.ok(!newFinanceSql.includes("Há compras ainda não recebidas'; END IF;") || 
 newFinanceSql.includes("ELSE"),"Old event requirements must stay legacy-only");
assert.ok(!expenseUi.includes("onSettle("),"Manual racha receipt buttons should be removed");
assert.ok(movements.includes("export function LiveMovements"),"Movement history needs reusable component");
assert.ok(recap.includes("Compras de fichas")&&recap.includes("Despesas e rachas"),
 "Night summary must show chips and splits separately");
console.log("✓ v2.0 event overview, live purchase-first, no receipts, post-finish recap");

// O cadastro de despesas agora está dentro da Visão geral, sem aba própria.
assert.ok(!panel.includes('["gastos","Despesas"]'),"Remove standalone Despesas tab");
assert.ok(panel.includes('id="event-expenses"')&&panel.includes('<ExpenseSplitsPanel'),"Show expenses in overview");
assert.ok(panel.includes('createForm={showAddExpense?<section'),"Expense create form must be collapsible");
assert.ok(panel.includes('sub==="gastos"?"visao"')||panel.includes('sub==="gastos"'),"Keep old profile expense links working");
assert.ok(panel.includes('Ver despesas e rachas →'),"Link to expenses from event summary");
console.log("✓ v2.1: assentos, enquetes e despesas dentro da Visão geral");

const seatAutoSql=read("supabase/migrations/20261022060000_seat_auto_attendance.sql");
const homeV16=read("app/painel/dashboard-v16.tsx");
for(const token of [
  "FOR UPDATE","INSERT INTO public.session_attendance(session_id,user_id)",
  "DELETE FROM public.session_attendance","NOT EXISTS(SELECT 1 FROM public.session_attendance",
  "CREATE POLICY seating_read_event","app_private.is_event_hidden(s.id)"
]){
 assert.ok(seatAutoSql.includes(token),"Atomic seat confirmation rule missing: "+token);
}
assert.ok(!panel.includes("confirmAttendance("),"Standalone confirmation API must not be used in UI");
assert.ok(!panel.includes("Confirmar minha presença"),"No confirmation buttons inside events");
assert.ok(!homeV16.includes("onConfirm"),"No confirmation action on dashboard");
assert.ok(panel.includes("Escolher assento →"),"Cards must offer seats directly");
assert.ok(seatsUi.includes("participação será confirmada automaticamente"),"Seat onboarding explanation missing");
console.log("✓ v2.2: seat selection automatically confirms attendance, no extra buttons");

// v2.3: eventos excluídos não reaparecem nas telas públicas nem em "Todos".
for(const guard of [
 "const hiddenEventIds=new Set(hiddenEvents.map(h=>h.session_id))",
 "const agendaEvents=events.filter(e=>!hiddenEventIds.has(e.id))",
 "const visibleEvents=agendaEvents.filter",
 "const upcoming=agendaEvents.filter",
 "const count=agendaEvents.filter",
 "{agendaEvents.filter(e=>roomFor(e.room_id)?.game===gameView)",
 "onOpen={id=>openEvent(id,\"visao\",true)}",
 "if(hiddenEvents.some(h=>h.session_id===id)&&!(adminAccess&&isAdmin))",
 "if(events.some(e=>e.id===id&&!hiddenEvents.some(h=>h.session_id===id)))",
 "events={agendaEvents} attendances={attendances.filter"
]) assert.ok(panel.includes(guard),"Ocultação de eventos: "+guard);
assert.ok(panel.includes("events={events} profiles={profiles}"),"Admin deve poder restaurar eventos excluídos");
console.log("✓ v2.3: excluídos somente na administração, com restauração preservada");

const routeFile=read("lib/app-routes.ts");
const realtimeHook=read("app/painel/use-club-realtime.ts");
const realtimeSql=read("supabase/migrations/20261022070000_realtime_event_sync.sql");
const appLayout=read("app/(app)/layout.tsx");
const login=read("app/login/page.tsx");
for(const expected of ["/eventos/","/ao-vivo","/resumo","/mesas/","/ranking","/perfil","/administracao"]){
 assert.ok(routeFile.includes(expected),"Missing deep link mapping: "+expected);
}
for(const pageFile of ["painel","eventos","eventos/[id]","eventos/[id]/ao-vivo",
 "eventos/[id]/resumo","mesas","mesas/[game]","ranking","perfil","administracao"]){
 assert.ok(read("app/(app)/"+pageFile+"/page.tsx").includes("RoutePlaceholder"),
  "Missing route file: "+pageFile);
}
assert.ok(appLayout.includes("<PainelPage/>"),"Club state should survive in shared layout");
for(const expected of ["popstate","window.history.pushState","clubHref(",
 "readClubRoute(","const lean=mode===\"list\"","fullDataRequested",
 "const refreshScope=useCallback","useClubRealtime(","mm-sync-pill"]){
 assert.ok(panel.includes(expected),"Routing or performance regression: "+expected);
}
for(const scope of ["catalog","presence","polls","expenses","chips","profiles"]){
 assert.ok(realtimeHook.includes(scope),"Realtime scope missing: "+scope);
}
assert.ok(realtimeHook.includes("postgres_changes"),"Websocket database subscription missing");
assert.ok(realtimeHook.includes("45000"),"Reconnect fallback missing");
assert.ok(realtimeSql.includes("ALTER PUBLICATION supabase_realtime ADD TABLE"),"Publication update missing");
assert.ok(!realtimeSql.includes("DISABLE ROW LEVEL SECURITY"),"Never disable RLS");
assert.ok(login.includes("validPostLoginRoute"),"Safe deep-link login return missing");
console.log("✓ v3.0: distinct routes, persistent layout, scoped data and realtime updates");
