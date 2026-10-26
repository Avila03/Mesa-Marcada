import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const realtime=read("app/painel/use-club-realtime.ts");
const league=read("app/painel/league-hub.tsx");
const pwa=read("app/painel/mobile-app-companion.tsx");
const notices=read("app/painel/notification-center.tsx");
const migration=read("supabase/migrations/"+ (await import("node:fs")).readdirSync(new URL("../supabase/migrations",import.meta.url)).find(f=>f.endsWith("_reliability_results_transactions.sql")));
for(const token of ['p.session_id=p_event_id','x.session_id=p_event_id','LIMIT 50','history_cursor'])
 assert.ok(migration.includes(token),"Bounded snapshot filtering missing: "+token);
for(const rpc of ['get_event_snapshot','get_club_catalog','get_my_splits_snapshot'])assert.ok(panel.includes(rpc),"Snapshot missing: "+rpc);
assert.ok(!panel.includes('db.from("session_chip_purchases").select("*"),'),"Unbounded global finance load");
for(const token of ['import dynamic from "next/dynamic"','const LeagueHub=dynamic','const AdminPanel=dynamic',
 'const TableTutorial=dynamic','const NightSummary=dynamic','const AdvancedRankingPanel=dynamic',
 'const SeatingTable=dynamic'])assert.ok(panel.includes(token),"Code splitting missing: "+token);
for(const token of ['lastReconcile','connected','180000','45000','if(table==="session_attendance"&&!eventId)'])
 assert.ok(realtime.includes(token),"Realtime fallback deduplication missing: "+token);
assert.ok(panel.includes('<MobileAppCompanion onUpdate={()=>refreshScope("catalog")}'),"PWA must refresh catalogue only.");
assert.ok(pwa.includes('if(!visible)return')&&pwa.includes('},[visible]);'),"PWA polling must stop outside dashboard.");
assert.ok(panel.includes('await loadEvent(selectedId)')&&!panel.includes('window.setInterval(tick,60000)'),
 "Timeline refresh must share the event snapshot and Realtime fallback.");
assert.ok(league.includes('},90000);')&&notices.includes('window.setInterval(resync,120000)'),
 "Other background refreshes are not optimized.");
console.log("✓ Performance guardrails: chunks, filtered data, Realtime, scoped PWA and lean polling");
