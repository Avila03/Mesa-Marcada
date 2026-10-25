"use client";
import {useEffect,useState} from "react";
import type {CSSProperties} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import {PlayerAvatar} from "./v09-features";
import FrameArtwork from "./frame-artwork";
import type {FrameId,FrameVariant} from "./frame-catalog";
import {FRAMES,FOUNDER_FRAME} from "./frame-catalog";
import {notifyFrameUpdated} from "./frame-avatar";
import "./player-frames.css";

type Progress=Record<string,number>;
type RecordEquipped={frame_id:FrameId|null;variant:FrameVariant};
const VARIANTS:{id:FrameVariant;label:string;hex:string}[]=[
 {id:"original",label:"Safira",hex:"#258bff"},
 {id:"ciano",label:"Ciano",hex:"#55e4f7"},
 {id:"noturno",label:"Noturno",hex:"#7768ff"}
];
function FrameSample({id,variant,name,photoUrl,large=false}:{
 id:FrameId|null;variant:FrameVariant;name:string;photoUrl?:string;large?:boolean
}){
 return <div className={"mm-frame-sample "+(large?"mm-frame-large":"")}>
   <div className="mm-frame-sample-photo"><PlayerAvatar photoUrl={photoUrl} name={name}/></div>
   {id&&<FrameArtwork id={id} variant={variant} className="mm-frame-artwork"/>}
  </div>;
}
export default function PlayerFrames({playerId,userId,name,photoUrl}:{
 playerId:string;userId:string;name:string;photoUrl?:string;
}){
 const mine=playerId===userId;
 const [progress,setProgress]=useState<Progress>({});
 const [granted,setGranted]=useState<string[]>([]);
 const [equipped,setEquipped]=useState<RecordEquipped>({frame_id:null,variant:"original"});
 const [selected,setSelected]=useState<FrameId|null>(null);
 const [variant,setVariant]=useState<FrameVariant>("original");
 const [filter,setFilter]=useState("Todas");
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [feedback,setFeedback]=useState("");
 useEffect(()=>{
  let mounted=true;
  const db=getSupabase();
  setLoading(true);setError("");setProgress({});setGranted([]);
  if(!db){setError("Não foi possível conectar ao banco.");setLoading(false);return;}
  void (async()=>{
   const [result,gift,choice]=await Promise.all([
    db.rpc("get_player_frame_progress",{p_user_id:playerId}),
    db.from("player_frame_grants").select("frame_id").eq("user_id",playerId),
    db.from("profile_frame_showcase").select("frame_id,variant").eq("user_id",playerId).maybeSingle()
   ]);
   if(!mounted)return;
   if(result.error||gift.error||choice.error){
    setError(result.error?.message||gift.error?.message||choice.error?.message||"Falha ao consultar molduras.");
    setLoading(false);return;
   }
   const values:Progress={};for(const f of FRAMES)
    values[f.id]=Math.max(0,Number((result.data||{})[f.id])||0);
   const gifts=(gift.data||[]).map((r:{frame_id:string})=>r.frame_id);
   const active=(choice.data?.frame_id||null) as FrameId|null;
   const currentVariant=(choice.data?.variant||"original") as FrameVariant;
   setProgress(values);setGranted(gifts);
   setEquipped({frame_id:active,variant:currentVariant});
   setSelected(active);setVariant(active==="safira"?currentVariant:"original");
   setLoading(false);
  })();
  return()=>{mounted=false};
 },[playerId]);
 const unlocked=(id:FrameId)=>id==="fundador"
  ?granted.includes("fundador")
  :granted.includes(id)||progress[id]>=(FRAMES.find(f=>f.id===id)?.goal||Infinity);
 const count=FRAMES.filter(f=>unlocked(f.id)).length;
 const current=selected==="fundador"?FOUNDER_FRAME:FRAMES.find(f=>f.id===selected)||null;
 const owned=selected===null||unlocked(selected);
 const isEquipped=equipped.frame_id===selected&&
  (selected===null||equipped.variant===(selected==="safira"?variant:"original"));
 async function equip(frameId:FrameId|null,newVariant:FrameVariant="original"){
  if(!mine||busy||frameId&&!unlocked(frameId))return;
  const db=getSupabase();if(!db)return;
  setBusy(true);setError("");setFeedback("");
  const nextVariant=frameId==="safira"?newVariant:"original";
  const {error:saveError}=await db.from("profile_frame_showcase").upsert({
   user_id:userId,frame_id:frameId,variant:nextVariant,updated_at:new Date().toISOString()
  },{onConflict:"user_id"});
  if(saveError)setError(saveError.message);
  else {
   setEquipped({frame_id:frameId,variant:nextVariant});
   notifyFrameUpdated(userId);
   setFeedback(frameId?"Moldura equipada com sucesso.":"Moldura removida do perfil.");
  }
  setBusy(false);
 }
 if(loading)return <section className="mm-frames-shell"><p className="mm-frames-note">Carregando as cinco molduras de prestígio…</p></section>;
 if(error&&!Object.keys(progress).length)return <section className="mm-frames-shell"><p className="mm-frames-error">{error}</p></section>;
 return <section className="mm-frames-shell" aria-label={"Molduras de prestígio de "+name}>
  <div className="mm-frames-header">
   <div><span className="mm-frames-eyebrow">MESA MARCADA · ATELIÊ</span>
    <h2>Molduras de Prestígio</h2><p>Cinco molduras conquistáveis e a exclusiva Eixo Fundação, concedida apenas a fundadores.</p></div>
   <strong className="mm-frames-unlocked">{count} / 5 <small>desbloqueadas</small></strong>
  </div>
  <div className="mm-frames-filters" aria-label="Filtrar molduras por raridade">
   {["Todas","Raras","Épicas","Lendárias","Exclusivas"].map(label=>
    <button type="button" key={label} aria-pressed={filter===label}
     className={filter===label?"selected":""} onClick={()=>setFilter(label)}>{label}</button>)}
  </div>
  <div className="mm-frames-content">
   <div className="mm-frames-grid">
    <button type="button" aria-pressed={selected===null}
     className={"mm-frame-tile mm-frame-none "+(selected===null?"selected ":"")+"unlocked"}
     style={{"--frame-accent":"#7399bb"} as CSSProperties}
     onClick={()=>{setSelected(null);setVariant("original");setError("");}}>
     {equipped.frame_id===null&&<span className="mm-frame-equipped-label">Equipada</span>}
     <FrameSample id={null} variant="original" name={name} photoUrl={photoUrl}/>
     <strong>Sem moldura</strong><span className="mm-frame-rarity">Padrão</span>
     <small className="mm-frame-status">Sempre disponível</small>
    </button>
    {(filter==="Todas"||filter==="Exclusivas")&&
     <button type="button" aria-pressed={selected==="fundador"}
      className={"mm-frame-tile mm-frame-founder "+(selected==="fundador"?"selected ":"")+(unlocked("fundador")?"unlocked":"locked")}
      style={{"--frame-accent":"#258bff"} as CSSProperties}
      onClick={()=>{setSelected("fundador");setVariant("original");setError("");}}>
      {equipped.frame_id==="fundador"&&<span className="mm-frame-equipped-label">Equipada</span>}
      <FrameSample id="fundador" variant="original" name={name} photoUrl={photoUrl}/>
      <strong>Eixo Fundação</strong><span className="mm-frame-rarity">EXCLUSIVA</span>
      <small className="mm-frame-status">{unlocked("fundador")?"✓ Fundador reconhecido":"Concessão manual"}</small>
     </button>}
    {FRAMES.filter(f=>filter==="Todas"||(filter==="Raras"&&f.rarity==="Rara")||
     (filter==="Épicas"&&f.rarity==="Épica")||(filter==="Lendárias"&&f.rarity==="Lendária"))
     .map(frame=><button key={frame.id} type="button" aria-pressed={selected===frame.id}
      className={"mm-frame-tile "+(selected===frame.id?"selected ":"")+(unlocked(frame.id)?"unlocked":"locked")}
      style={{"--frame-accent":frame.accent} as CSSProperties}
      onClick={()=>{setSelected(frame.id);setVariant(frame.id==="safira"&&equipped.frame_id==="safira"?equipped.variant:"original");setError("");}}>
      {equipped.frame_id===frame.id&&<span className="mm-frame-equipped-label">Equipada</span>}
      <FrameSample id={frame.id} variant={frame.id==="safira"&&selected===frame.id?variant:"original"}
       name={name} photoUrl={photoUrl}/>
      <strong>{frame.name}</strong><span className="mm-frame-rarity">{frame.rarity}</span>
      <small className="mm-frame-status">{unlocked(frame.id)?"✓ Desbloqueada":"Bloqueada"}</small>
     </button>)}
   </div>
   <aside className="mm-frames-inspector">
    <div className="mm-frames-inspector-art"><FrameSample id={selected} variant={variant}
      name={name} photoUrl={photoUrl} large/></div>
    <h3>{current?.name||"Sem moldura"}</h3>
    <span className="mm-frame-inspector-rarity">{current?.rarity||"Padrão"}</span>
    <p className="mm-frames-title">{current?.title||"Sua foto original, sem decoração."}</p>
    {current?<><div className="mm-frame-rule"><strong>{current.id==="fundador"?"RECONHECIMENTO EXCLUSIVO":"COMO CONQUISTAR"}</strong>
      <p>{current.requirement}</p></div>
     {current.id!=="fundador"&&<><div className="mm-frame-progress-header"><strong>Progresso</strong>
      <span>{Math.min(progress[current.id]||0,current.goal)} / {current.goal}</span></div>
     <div className="mm-frame-progress" role="progressbar" aria-label={"Progresso "+current.name}
      aria-valuenow={Math.min(progress[current.id]||0,current.goal)} aria-valuemin={0} aria-valuemax={current.goal}>
      <div style={{width:Math.min(100,100*(progress[current.id]||0)/current.goal)+"%"}}/>
     </div></>}
     {current.id==="fundador"?<p className="mm-frames-manual">
       {unlocked("fundador")?"Reconhecido como fundador. Este selo não é conquistável por progresso.":
       "Esta moldura só pode ser concedida manualmente pelo administrador principal."}
      </p>:granted.includes(current.id)&&<p className="mm-frames-manual">
       Concessão permanente da administração: desbloqueada independentemente do progresso.</p>}
     {current.variations&&<div className="mm-frames-variants"><strong>VARIAÇÕES DE COR</strong>
      <div>{VARIANTS.map(t=><button type="button" key={t.id} aria-label={"Acabamento "+t.label}
       aria-pressed={variant===t.id} className={variant===t.id?"active":""}
       disabled={!mine} onClick={()=>setVariant(t.id)}>
       <span style={{"--tone":t.hex} as CSSProperties}/><small>{t.label}</small>
      </button>)}</div>
     </div>}</>:
     <p className="mm-frames-note">Exibe somente a foto do perfil. Você pode voltar a usar qualquer moldura desbloqueada quando quiser.</p>}
    {mine&&<div className="mm-frames-actions">
     <button className="btn gold" type="button" disabled={busy||!owned||isEquipped}
      onClick={()=>void equip(selected,variant)}>
      {busy?"Salvando…":!owned?"Moldura bloqueada":isEquipped?
       selected===null?"Sem moldura selecionada":"Moldura equipada":
       selected===null?"Usar sem moldura":"Equipar moldura"}
     </button>
    </div>}
   </aside>
  </div>
  {feedback&&<p role="status" className="mm-frames-success">{feedback}</p>}
  {error&&<p role="alert" className="mm-frames-error">{error}</p>}
 </section>;
}
