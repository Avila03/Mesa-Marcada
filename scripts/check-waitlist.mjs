import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261110121047_event_waitlist.sql");
const panel=read("app/painel/mobile-first.tsx"),list=read("app/painel/waitlist-panel.tsx");
const notify=read("app/api/push/notify/route.ts"),reminders=read("app/api/push/reminders/route.ts"),center=read("app/painel/notification-center.tsx");
// Fila só por funções: leitura para quem vê o evento, sem escrita direta.
assert.ok(sql.includes("GRANT SELECT ON public.session_waitlist TO authenticated")&&!/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*session_waitlist/i.test(sql),"Waitlist writes go through RPCs");
assert.ok(sql.includes("app_private.may_view_event(session_id)")&&sql.includes("NOT app_private.may_view_event(p_event_id)"),"Waitlist respects event visibility");
// Promoção: ao sair, ao aumentar a mesa; nunca depois do início.
assert.ok(sql.includes("AFTER DELETE ON public.session_attendance")&&sql.includes("AFTER UPDATE OF max_participants"),"Queue advances on leave and on capacity increase");
assert.ok(/promote_waitlist[\s\S]*session_live_state/.test(sql),"Queue freezes once the match is live");
assert.ok(sql.includes("ORDER BY (n=0),n"),"Croupier chair goes last");
// Aviso: central + push único pelo servidor.
assert.ok(sql.includes("'vaga da lista de espera'")&&center.includes('WAITLIST_FIELD="vaga da lista de espera"'),"Promotion shows in the notification center");
assert.ok(sql.includes("push_server_auth")&&sql.includes("SET sent_at=now()")&&notify.includes('kind==="waitlist"')&&reminders.includes("claim_waitlist_push_targets"),"Promotion push is delivered once by the server");
// Interface.
assert.ok(panel.includes("<WaitlistPanel")&&panel.includes('if(seatNo===null)void sendEventPush(selected.id,"waitlist")'),"Panel and immediate push wired in");
assert.ok(list.includes('"join_event_waitlist"')&&list.includes('"leave_event_waitlist"')&&list.includes("profiles(display_name)"),"Join, leave and real names");
console.log("✓ Lista de espera: fila protegida, promoção automática, crupiê por último, aviso único e painel na preparação");
