import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("app/painel/mobile-first.tsx");
const realtime=read("app/painel/use-club-realtime.ts");
const league=read("app/painel/league-hub.tsx");
const pwa=read("app/painel/mobile-app-companion.tsx");
const notices=read("app/painel/notification-center.tsx");
const refresh=panel.slice(panel.indexOf('const refreshScope=useCallback'),panel.indexOf('const connection=useClubRealtime'));
for(const token of [
 '.eq("session_id",selectedId).order("created_at"',
 '.in("poll_id",pollIds)',
 '.in("purchase_id",purchaseIds)',
 'pollIds.length?await Promise.all',
 'purchaseIds.length',
])assert.ok(refresh.includes(token),"Event-specific data filtering missing: "+token);
assert.ok(!refresh.includes('db.from("session_poll_options").select("*").order("position")'),"Poll options still read globally.");
assert.ok(!refresh.includes('db.from("session_chip_purchase_items").select("*"),'),"Chip item refresh still reads globally.");
for(const token of ['import dynamic from "next/dynamic"','const LeagueHub=dynamic','const AdminPanel=dynamic',
 'const TableTutorial=dynamic','const NightSummary=dynamic','const AdvancedRankingPanel=dynamic',
 'const SeatingTable=dynamic'])assert.ok(panel.includes(token),"Code splitting missing: "+token);
for(const token of ['lastReconcile','connected','180000','45000','if(table==="session_attendance"&&!eventId)'])
 assert.ok(realtime.includes(token),"Realtime fallback deduplication missing: "+token);
assert.ok(panel.includes('<MobileAppCompanion onUpdate={()=>refreshScope("catalog")}'),"PWA must refresh catalogue only.");
assert.ok(pwa.includes('if(!visible)return')&&pwa.includes('},[visible]);'),"PWA polling must stop outside dashboard.");
assert.ok(panel.includes('window.setInterval(refresh,45000)')&&panel.includes('window.setInterval(tick,60000)'),
 "Expected slower seat/timeline fallbacks.");
assert.ok(league.includes('},90000);')&&notices.includes('window.setInterval(resync,120000)'),
 "Other background refreshes are not optimized.");
console.log("✓ Performance guardrails: chunks, filtered data, Realtime, scoped PWA and lean polling");
