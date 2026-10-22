import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const db=read("supabase/migrations/20261022210000_edit_events_notices.sql");
const pushDb=read("supabase/migrations/20261022211000_edit_event_push.sql");
const app=read("app/painel/mobile-first.tsx");
const notices=read("app/painel/event-change-notices.tsx");
const api=read("app/api/push/notify/route.ts");
for(const pattern of [
 "CREATE OR REPLACE FUNCTION public.edit_event_details","REVOKE ALL ON FUNCTION public.edit_event_details",
 "IF ev.organizer_id<>(SELECT auth.uid()) AND NOT app_private.is_app_admin()",
 "A partida já começou ou foi encerrada","session_live_state",
 "Limite menor que confirmações existentes","session_table_seats",
 "p_chip_price_1_brl","p_chip_price_50_brl",
 "public.event_change_notices","event_change_notices_select_own",
 "CREATE TRIGGER trg_notify_event_details_change",
])assert.ok((db+pushDb).includes(pattern),"Missing edit security: "+pattern);
for(const pattern of [
 '"editar-evento"','localDateTimeInput','openEditor','edit_event_details',
 'onSubmit={modal==="editar-evento"?editEvent:addEvent}',
 'selected.status==="scheduled"&&!selectedLive',
 'Editar evento','Salvar alterações','EventChangeNotices'
])assert.ok(app.includes(pattern),"Missing event edit user flow: "+pattern);
assert.ok(api.includes('edit:{title:'),"Push edit template is missing");
assert.ok(pushDb.includes("p_kind='edit'")&&pushDb.includes("edited_by=actor"),"Edit push must require recent authorized change");
assert.ok(notices.includes('recipient_id",userId')||notices.includes('.eq("recipient_id",userId)'),"Alerts must filter by user");
assert.ok(notices.includes('read_at')&&notices.includes('onOpenEvent'),"Alerts must be actionable");
console.log("✓ Edição de eventos: UI, banco, limites, notificações e push");
