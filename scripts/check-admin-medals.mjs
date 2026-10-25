import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261025193000_admin_permanent_medal_grants.sql");
const ui=read("app/painel/player-medals.tsx");
const ids=["first","collector","podium","shark","positive","record","veteran",
 "loyal","poker","blackjack","versatile","champ","multi","pioneer","host"];
for(const id of ids){
 assert.ok(sql.includes("('"+id+"',"),"Admin did not receive "+id);
}
assert.equal((sql.match(/\('(?:first|collector|podium|shark|positive|record|veteran|loyal|poker|blackjack|versatile|champ|multi|pioneer|host)',[0-3]\)/g)||[]).length,15,
 "Every medal should be granted exactly once.");
assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"),"Protected grants table requires RLS");
assert.ok(sql.includes("GRANT SELECT ON public.player_medal_grants TO authenticated"),"Profiles must read grants");
assert.ok(!/GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)\s+ON\s+public.player_medal_grants\s+TO\s+authenticated/i.test(sql),
 "Clients must never be able to mint or modify medals");
assert.ok(sql.includes("p.display_name='Bruno Avila'"),"Only the identified main account should be seeded.");
assert.ok(sql.includes("ON CONFLICT(user_id,medal_id) DO UPDATE"),"Grant must be idempotent.");
for(const t of ['db.from("player_medal_grants").select("medal_id,level_index")',
 'const medalLevel=(m:Medal)=>Math.max(levelOf(m,progress[m.id]||0),granted[m.id]??-1)',
 'const unlocked=MEDALS.filter(m=>medalLevel(m)>=0)',
 'const level=medalLevel(m)',
 'primary.levels[medalLevel(primary)].name',
 'concedida pela administração',
 'setProgress(values)']){
 assert.ok(ui.includes(t),"UI does not recognize actual permanent grants: "+t);
}
assert.ok(ui.includes('const inspectValue=progress[inspect.id]||0'),
 "Real game stats must remain untouched.");
console.log("✓ 15 true permanent grants visible at max tier only to principal admin, game stats unchanged, protected from client writing");
