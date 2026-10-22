import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const db=read("supabase/migrations/20261022170000_league_premium_emblems.sql");
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
 "create_league_premium","p_emblem:emblem","get_league_catalog_premium",
 "update_league_emblem","CrestMark","CrestCustomizer",
 "createStep","Personalizar brasão","Editar brasão","Salvar brasão"
])assert.ok(hub.includes(s),"Missing integrated league UI: "+s);
assert.ok(editor.includes('normalizeCrest'),"Crest validator missing");
assert.ok(editor.includes('useId'),"Unique SVG IDs required for multiple visible crests");
for(const s of ['"joker"','"two-jokers"','"roulette"','"poker-table"','"shield"','"circle"','"hex"','"card"'])
 assert.ok(editor.includes(s),"Missing shape or symbol: "+s);
assert.ok(css.includes("mm-league-modal-wide"),"Responsive embedded editor missing");
assert.ok(read("app/painel/mobile-first.tsx").includes("get_league_catalog_premium"),"Event editor catalog out of date");
assert.ok(read("app/brasoes/demo/page.tsx").includes("CrestEditor"),"Demo route must remain available");
assert.ok(!db.includes("DISABLE ROW LEVEL SECURITY"),"Do not bypass RLS");
console.log("✓ Brasões Premium: schema validation, owner authorization, creation wizard, display and editing");
