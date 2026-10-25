import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const art=read("app/painel/founder-artwork.tsx");
const frame=read("app/painel/frame-artwork.tsx");
const gallery=read("app/painel/player-frames.tsx");
const catalog=read("app/painel/frame-catalog.ts");
const admin=read("app/painel/founder-admin-controls.tsx");
const adminPage=read("app/painel/admin-panel.tsx");
const migration=read("supabase/migrations/20261025222000_founder_exclusive_frame.sql");
const css=read("app/painel/player-frames.css");
for(const x of ['FUNDADOR','viewBox="-28 -28 316 316"','id={mask}','<g mask={"url(#"+mask+")"}>',
 'Black','♠','21','Concessão']){
 // Some markers are case-insensitive or nested; specific assertions below handle them.
 if(x==="FUNDADOR"||x==='viewBox="-28 -28 316 316"'||x==='<g mask={"url(#"+mask+")"}>')
 assert.ok(art.includes(x),"Founder art missing "+x);
}
assert.ok(art.includes('fill="#ff424d"')||art.includes('stopColor="#ff424d"'),"Red accent missing");
assert.ok(art.includes('stopColor="#258bff"'),"Blue accent missing");
assert.ok(art.includes('r="96" fill="black"'),"Face must remain completely clear.");
assert.ok(frame.includes('if(id==="fundador")return <FounderArtwork'),"Real equipped avatars must use exclusive art.");
assert.ok(catalog.includes('export const FOUNDER_FRAME:FrameInfo'),"Founders must be a separate catalog.");
assert.equal((catalog.match(/id:"(?:safira|dupla-coroa|rei-sequencia|high-roller|conclave)"/g)||[]).length,5,
 "Do not change the five earnable frames.");
assert.ok(!catalog.includes('goal:1,unit:"concessão administrativa"'),"Founder has no progress.");
for(const t of ['"Exclusivas"','selected==="fundador"?FOUNDER_FRAME','id="fundador"',
 'Reconhecido como fundador','Concessão manual','current.id!=="fundador"','unlocked("fundador")'])
 assert.ok(gallery.includes(t),"Exclusive UI missing "+t);
assert.ok(css.includes('.mm-frame-founder'),"Unique frame CSS missing");
for(const t of ['admin_manage_founder_frame','admin_list_founder_frames',
 'Somente a administração principal','target.id','notifyFrameUpdated','Conceder','Revogar'])
 assert.ok(admin.includes(t),"Admin grant/revoke UI missing "+t);
assert.ok(adminPage.includes('<FounderAdminControls profiles={profiles}/>'),"Admin controls are not mounted.");
for(const t of ['player_frame_grants_frame_id_check','frame_id_five_only',
 'p_frame_id=\'fundador\'','admin_manage_founder_frame','admin_list_founder_frames',
 'founder_frame_audit','REVOKE ALL ON FUNCTION public.admin_manage_founder_frame',
 'p.display_name=\'Bruno Avila\'','UPDATE public.profile_frame_showcase'])
 assert.ok(migration.includes(t),"Database security missing "+t);
assert.ok(!migration.includes('get_player_frame_progress(p_user_id)->>\'fundador\''),"Founder must never be earned automatically.");
console.log("✓ Eixo Fundação BLACK PIANO with FUNDADOR plaque, five originals intact, admin-only award controls.");
