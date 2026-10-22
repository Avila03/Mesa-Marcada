import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const db=read("supabase/migrations/20261022221000_reschedule_reconfirmation.sql");
const realtime=read("supabase/migrations/20261022222000_reconfirm_notifications_realtime.sql");
const app=read("app/painel/mobile-first.tsx");
const home=read("app/painel/dashboard-v16.tsx");
const leagues=read("app/painel/league-hub.tsx");
const center=read("app/painel/notification-center.tsx");
const reconfirm=read("app/painel/event-reconfirmation.tsx");
const finalizeCss=read("app/(app)/ligas/[id]/league-finalization-controls.css");
for(const p of ["ENABLE ROW LEVEL SECURITY","respond_event_reconfirmation","auth.uid()",
 "reconfirm_attendees_on_reschedule","ON CONFLICT(event_id,user_id) DO UPDATE",
 "status='pending'","status='confirmed'","status='declined'","session_attendance",
 "GRANT SELECT ON public.event_reconfirmations"])assert.ok(db.includes(p),"Missing reconfirmation protection: "+p);
assert.ok(!db.includes("DELETE FROM public.session_table_seats"),"Reschedule must preserve seats");
assert.ok(realtime.includes("ALTER PUBLICATION supabase_realtime"),"Realtime notifications missing");
for(const p of ["event_reconfirmations","league_notifications","event_change_notices",
 "read_league_notification","NotificationCenter","recipient_id", "user_id", "onOpenEvent"])
 assert.ok((center+app).includes(p),"Notification center missing: "+p);
assert.ok(app.includes("EventReconfirmation"),"Reconfirmation UI not accessible");
assert.ok(reconfirm.includes("Confirmar nova data")&&reconfirm.includes("Não poderei ir"),"Responses missing");
assert.ok(home.includes("myUpcoming[0]||upcoming[0]"),"Home must prioritize own next event");
assert.ok(home.includes("pendingReconfirmEventId"),"Home reconfirmation warning missing");
assert.ok(leagues.includes('leagueFilter==="finished"')&&leagues.includes("filteredOwn"),"Archived league filter missing");
assert.ok(leagues.includes("showAllEvents"),"Full league event history missing");
assert.ok(!leagues.includes('href="/brasoes/demo"'),"Demo shortcut must not clutter Leagues");
assert.ok(finalizeCss.includes("position:relative"),"League finish cannot obscure mobile navigation");
assert.ok(app.includes('(page==="inicio"||page==="eventos")&&!modal'),"Contextual mobile FAB missing");
console.log("✓ Melhorias 3–7: homepage, reconfirmação, central, Ligas e mobile");
