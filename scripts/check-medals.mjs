import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const frontend=read("app/painel/player-medals.tsx");
const catalog=read("app/painel/medal-catalog.ts");
const styles=read("app/painel/player-medals.css");
const page=read("app/painel/mobile-first.tsx");
const migration=read("supabase/migrations/20261025185339_medals_profile_showcase.sql");
const ids=["first","collector","podium","shark","positive","record","veteran","loyal","poker","blackjack","versatile","champ","multi","pioneer","host"];
for(const id of ids){
 assert.ok(catalog.includes('id:"'+id+'"'),"Missing medal "+id);
 assert.ok(migration.includes("('"+id+"'")||migration.includes("'"+id+"',"),"Missing SQL progress "+id);
}
assert.equal((catalog.match(/id:"(first|collector|podium|shark|positive|record|veteran|loyal|poker|blackjack|versatile|champ|multi|pioneer|host)"/g)||[]).length,15,
 "Must define exactly 15 distinct medals");
assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY")&&migration.includes("medal_showcase_update"),"Showcase needs owner RLS");
assert.ok(migration.includes("app_private.is_event_hidden")&&migration.includes("session_finance_approvals"),"No incomplete or hidden games");
assert.ok(migration.includes("REVOKE ALL ON FUNCTION public.get_player_medal_progress"),"Public award function must require login");
for(const key of ["pinned_ids","featured_id","visible","get_player_medal_progress",
 "onClick={()=>setSelected(m.id)}","setExpanded","mm-medals-avatar-icon","setPinned","setVisible"])
 assert.ok(frontend.includes(key),"Missing visual/interaction "+key);
assert.ok(page.includes("const PlayerMedals=dynamic")&&page.includes("<PlayerMedals key="),"Profile preview must be mounted lazily");
assert.ok(styles.includes("@media(max-width:600px)"),"Mobile responsive medal gallery missing");
console.log("✓ 15 verified medals; locked previews; RLS showcase; profile customization");
