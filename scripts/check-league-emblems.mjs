import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const db=read("supabase/migrations/20261022124957_league_premium_emblems.sql");
const hub=read("app/painel/league-hub.tsx");
const editor=read("app/brasoes/demo/crest-editor.tsx");
const css=read("app/painel/league-hub.css");
for(const s of [
 "ALTER TABLE public.leagues","emblem jsonb NOT NULL DEFAULT",
 "app_private.valid_league_emblem","p_emblem->>'initials' ~ '^[A-Z0-9]{1,4}$'",
 "CREATE OR REPLACE FUNCTION public.create_league_premium",
 "CREATE OR REPLACE FUNCTION public.update_league_emblem",
 "IF NOT app_private.is_league_owner(p_league_id)",
 "CREATE OR REPLACE FUNCTION public.get_league_catalog_premium",
 "l.emblem","auth.uid()","REVOKE ALL ON FUNCTION",
 "TO authenticated"
])assert.ok(db.includes(s),"Missing Premium DB security: "+s);
for(const s of [
 "create_league_premium","p_emblem:emblem","get_league_catalog_final",
 "update_league_emblem","CrestMark","CrestCustomizer",
 "createStep","Personalizar brasão","Editar brasão","Salvar brasão"
])assert.ok(hub.includes(s),"Missing integrated league UI: "+s);
assert.ok(editor.includes('normalizeCrest'),"Crest validator missing");
assert.ok(editor.includes('useId'),"Unique SVG IDs required for multiple visible crests");
for(const s of ['"joker"','"two-jokers"','"roulette"','"poker-table"','"shield"','"circle"','"hex"','"card"'])
 assert.ok(editor.includes(s),"Missing shape or symbol: "+s);
assert.ok(css.includes("mm-league-modal-wide"),"Responsive embedded editor missing");
assert.ok(read("app/painel/mobile-first.tsx").includes("get_league_catalog_final"),"Event editor catalog out of date");
assert.ok(read("app/brasoes/demo/page.tsx").includes("CrestEditor"),"Demo route must remain available");
assert.ok(!db.includes("DISABLE ROW LEVEL SECURITY"),"Do not bypass RLS");
console.log("✓ Brasões Premium: schema validation, owner authorization, creation wizard, display and editing");


// Regression: all three finished crest styles are selectable, render differently,
// and remain compatible with existing saved crests that lack a finish field.
const finishes=read("supabase/migrations/20261022132021_league_crest_finishes.sql");
for(const name of ["minimal","classic","premium"]){
 assert.ok(editor.includes('id:"'+name+'"'),"Finish selector missing: "+name);
 assert.ok(finishes.includes("'"+name+"'"),"DB finish allowlist missing: "+name);
}
for(const feature of [
 "finish:CrestFinish","finish:FINISHES.some",
 "finish={crest.finish}","finish={value.finish}","finish={item.id}",
 "<FinishSelector","value={value.finish}","value={finish}",
 "const premium=finish==="+'"'+"premium"+'"'+',classic=finish==='+'"classic"',
 "premium&&<path","classic&&<g","mm-crest-finish-"
])assert.ok(editor.includes(feature),"Real finish behavior missing: "+feature);
assert.ok(finishes.includes("WHERE NOT (emblem ? 'finish')"),"Existing leagues must be backfilled");
const finishCss=read("app/brasoes/demo/crest-demo.css");
assert.ok(finishCss.includes("mm-crest-finish-minimal .mm-crest-display>svg{filter:none}"),"Minimal style must be glow-free");
assert.ok(finishCss.includes("mm-crest-finish-classic"),"Classic style missing");
assert.ok(finishCss.includes("mm-crest-option-premium"),"Premium preview missing");
console.log("✓ Três acabamentos: visual real, seleção, persistência e compatibilidade");
