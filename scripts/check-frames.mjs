import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const catalog=read("app/painel/frame-catalog.ts");
const artwork=read("app/painel/frame-artwork.tsx");
const gallery=read("app/painel/player-frames.tsx");
const avatar=read("app/painel/frame-avatar.tsx");
const page=read("app/painel/mobile-first.tsx");
const seat=read("app/painel/seating-table.tsx");
const features=read("app/painel/v09-features.tsx");
const preview=read("app/painel/player-profile-preview.tsx");
const sql=read("supabase/migrations/20261025205000_five_prestige_frames.sql");
const ids=["safira","dupla-coroa","rei-sequencia","high-roller","conclave"];
for(const id of ids){
 assert.ok(catalog.includes('id:"'+id+'"'),"Missing awarded frame "+id);
 assert.ok(artwork.includes('id==="'+id+'"'),"Missing unique artwork "+id);
 assert.ok(sql.includes("'"+id+"'"),"Missing DB catalog entry "+id);
}
assert.equal((catalog.match(/id:"(?:safira|dupla-coroa|rei-sequencia|high-roller|conclave)"/g)||[]).length,5);
assert.ok(!catalog.includes("Fênix Escarlate")&&!catalog.includes("Magnata Rubi"),"Do not ship extra frames.");
for(const detail of ["<Crown","<Wing","<Leaves","<Diamond","<ChipStack","<Card"])
 assert.ok(artwork.includes(detail),"Ornate artwork missing "+detail);
for(const token of ["profile_frame_showcase","player_frame_grants","ENABLE ROW LEVEL SECURITY",
 "public.has_player_frame","public.get_player_frame_progress","p.display_name='Bruno Avila'",
 "'safira'),('dupla-coroa'),('rei-sequencia'),('high-roller'),('conclave'"])
 assert.ok(sql.includes(token),"Database rule/grants missing: "+token);
assert.ok(sql.includes("REVOKE ALL ON public.player_frame_grants"),"Clients must not forge frames.");
for(const token of ["get_player_frame_progress","player_frame_grants","notifyFrameUpdated",
 "Equipar moldura","Remover moldura","VARIAÇÕES DE COR","Concessão permanente"])
 assert.ok(gallery.includes(token),"Gallery behavior missing "+token);
assert.ok(page.includes("const PlayerFrames=dynamic")&&page.includes('<PlayerFrames key={"frames-"'),"Profile gallery must load on demand.");
assert.ok(seat.includes("<FrameAvatar playerId={occupant.user_id}"),"Occupied chairs should wear frames.");
assert.ok(features.includes('<FrameAvatar playerId={playerId}'),"Participant chips should wear frames.");
assert.ok(preview.includes('<FrameAvatar playerId={playerId}'),"Hover cards should wear frames.");
assert.ok(avatar.includes("cached=new Map")&&avatar.includes("mm-frame-updated"),"Avatar should cache and refresh equipped frames.");
console.log("✓ Exatamente 5 artes únicas, 5 desbloqueios administrativos, regras automáticas e perfis ornamentados.");
