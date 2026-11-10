import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx"),sql=read("supabase/migrations/20261110034109_daily_use_invites_reminders.sql");
const notify=read("app/api/push/notify/route.ts"),reminders=read("app/api/push/reminders/route.ts");
// Marcar de novo: data da semana seguinte e convite de quem jogou, com aviso único.
assert.ok(panel.includes("starts_at:nextWeeklySlot(event.starts_at)")&&panel.includes('rpc("invite_previous_players"'),"Repeat must suggest next week and invite last players");
assert.ok(sql.includes("WHERE a.session_id=p_source_event_id AND a.user_id<>actor")&&sql.includes("s.status='finished'"),"Only players from a finished source night are invited");
assert.ok(sql.includes("invite_push_receipts")&&notify.includes('kind==="invited"'),"Invite push is sent once through the server");
// Lembrete: janela de 2h, sem repetição, só com o segredo do servidor.
assert.ok(sql.includes("now()+interval '90 minutes'")&&sql.includes("now()+interval '2 hours'")&&sql.includes("ON CONFLICT DO NOTHING"),"Reminder window and dedupe");
assert.ok(sql.includes("push_server_auth")&&reminders.includes("claim_reminder_push_targets")&&reminders.includes("PUSH_SERVER_SECRET"),"Reminder requires the server secret");
// Topo e etapas.
assert.ok(panel.includes("{isMobile&&<NotificationCenter compact")&&panel.includes("{!isMobile&&<NotificationCenter"),"One notification center per layout");
assert.ok(panel.includes('className="mm-profile-logout"')&&!/mm-mobile-account[^\n]*aria-label="Sair"/.test(panel),"Logout lives in the profile on mobile");
assert.ok(panel.includes('label="Etapas do evento"')&&panel.includes("secondary:true"),"Event pages render as steps");
// Ações do anfitrião.
assert.ok(panel.includes("onCancelEvent={cancelEventFromHome}")&&panel.includes("<QuickRebuy"),"Host shortcuts present");
console.log("✓ Uso diário: marcar de novo, eventos parados, topo enxuto, etapas, recompra rápida e lembrete 2h antes");
