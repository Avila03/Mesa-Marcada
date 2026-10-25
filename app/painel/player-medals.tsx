"use client";
import {useEffect,useState} from "react";
import type {CSSProperties} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import {PlayerAvatar} from "./v09-features";
import UiIcon from "./ui-icon";
import {MEDALS} from "./medal-catalog";
import type {Medal} from "./medal-catalog";
import "./player-medals.css";

type Progress=Record<string,number>;
type MedalGrant={medal_id:string;level_index:number};
type Showcase={user_id:string;featured_id:string|null;pinned_ids:string[];visible:boolean};

const levelOf=(m:Medal,amount:number)=>m.levels.reduce((index,level,i)=>amount>=level.threshold?i:index,-1);

export default function PlayerMedals({playerId,userId,name,photoUrl}:{
 playerId:string;userId:string;name:string;photoUrl?:string;
}){
 const own=playerId===userId;
 const [progress,setProgress]=useState<Progress>({});
 const [granted,setGranted]=useState<Progress>({});
 const [featured,setFeatured]=useState<string|null>(null);
 const [pinned,setPinned]=useState<string[]>([]);
 const [visible,setVisible]=useState(true);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [selected,setSelected]=useState("first");
 const [filter,setFilter]=useState("Todas");
 const [expanded,setExpanded]=useState(false);
 const [showPinPicker,setShowPinPicker]=useState(false);
 const [draftPins,setDraftPins]=useState<string[]>([]);

 useEffect(()=>{
  let alive=true;
  setLoading(true);setProgress({});setGranted({});setFeatured(null);setPinned([]);setError("");
  const db=getSupabase();
  if(!db){setLoading(false);setError("Conexão indisponível.");return;}
  void (async()=>{
   const [stats,settings,grants]=await Promise.all([
    db.rpc("get_player_medal_progress",{p_user_id:playerId}),
    db.from("profile_medal_showcase").select("user_id,featured_id,pinned_ids,visible")
      .eq("user_id",playerId).maybeSingle(),
    db.from("player_medal_grants").select("medal_id,level_index").eq("user_id",playerId)
   ]);
   if(!alive)return;
   if(stats.error||settings.error||grants.error){setError(stats.error?.message||settings.error?.message||grants.error?.message||"Não foi possível consultar as conquistas.");setLoading(false);return;}
   const source=(stats.data||{}) as Record<string,unknown>;
   const values:Progress={};
   for(const m of MEDALS)values[m.id]=Math.max(0,Number(source[m.id])||0);
   const row=(settings.data||null) as Showcase|null;
   const grantedLevels:Progress={};
   for(const grant of (grants.data||[]) as MedalGrant[]){
    const medal=MEDALS.find(m=>m.id===grant.medal_id);
    if(medal)grantedLevels[grant.medal_id]=Math.max(0,Math.min(grant.level_index,medal.levels.length-1));
   }
   setGranted(grantedLevels);
   setProgress(values);setFeatured(row?.featured_id||null);
   setPinned(row?.pinned_ids||[]);setVisible(row?.visible??true);
   setLoading(false);
  })();
  return()=>{alive=false};
 },[playerId]);

 const medalLevel=(m:Medal)=>Math.max(levelOf(m,progress[m.id]||0),granted[m.id]??-1);
 const unlocked=MEDALS.filter(m=>medalLevel(m)>=0);
 const earned=new Set(unlocked.map(m=>m.id));
 const chosen=(featured&&earned.has(featured)?featured:null)||unlocked[0]?.id||null;
 const primary=MEDALS.find(m=>m.id===chosen);
 const highlights=pinned.filter(id=>earned.has(id)&&id!==chosen).slice(0,3)
  .map(id=>MEDALS.find(m=>m.id===id)).filter((m):m is Medal=>Boolean(m));
 const inspect=MEDALS.find(m=>m.id===selected)||MEDALS[0];
 const inspectValue=progress[inspect.id]||0;
 const inspectLevel=medalLevel(inspect);
 const inspectGranted=granted[inspect.id]!==undefined;
 const inspectNext=inspect.levels.find(t=>inspectValue<t.threshold);
 const allowed=own||visible;
 async function save(nextFeatured:string|null,nextPins:string[],nextVisible:boolean):Promise<boolean>{
  const db=getSupabase();if(!db)return false;
  setSaving(true);setError("");setMessage("");
  try{
   const filteredPins=[...new Set(nextPins)].filter(id=>earned.has(id)&&id!==nextFeatured).slice(0,3);
   const {error:saveError}=await db.from("profile_medal_showcase").upsert({
    user_id:userId,
    featured_id:nextFeatured&&earned.has(nextFeatured)?nextFeatured:null,
    pinned_ids:filteredPins,visible:nextVisible,updated_at:new Date().toISOString()
   },{onConflict:"user_id"});
   if(saveError)throw saveError;
   setFeatured(nextFeatured);setPinned(filteredPins);setVisible(nextVisible);
   setMessage("Vitrine de conquistas atualizada.");
   return true;
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a vitrine.");return false;}
  finally{setSaving(false);}
 }
 if(loading)return <section className="mm-medals-shell"><p className="mm-medals-muted">Carregando conquistas…</p></section>;
 if(error&&!MEDALS.some(m=>m.id in progress))
  return <section className="mm-medals-shell"><p role="alert" className="mm-medals-error">{error}</p></section>;
 if(!allowed)return <section className="mm-medals-shell"><h2>Conquistas</h2>
  <p className="mm-medals-muted">Este jogador optou por não exibir suas medalhas.</p></section>;
 return <section className="mm-medals-shell" aria-label={"Conquistas de "+name}>
  <div className="mm-medals-heading">
   <div><span className="mm-medals-eyebrow">MESA MARCADA · MEDALHAS</span>
    <h2>Conquistas</h2><p>Medalhas permanentes por desempenho, participação e Ligas.</p></div>
   <span className="mm-medals-total">{unlocked.length} / 15</span>
  </div>
  <div className="mm-medals-preview">
   <div className={"mm-medals-avatar "+(primary?"earned":"")} style={primary?{"--medal-color":primary.color} as CSSProperties:undefined}>
    <PlayerAvatar photoUrl={photoUrl} name={name} large/>
    {primary&&<span className="mm-medals-avatar-icon" aria-hidden="true">{primary.symbol}</span>}
   </div>
   <div className="mm-medals-preview-info">
    <strong>{name}</strong>
    <span>{primary?primary.title+" · "+primary.levels[medalLevel(primary)].name:"Nenhuma medalha desbloqueada"}</span>
    <small>{primary?primary.summary:"Jogue suas primeiras partidas para começar sua coleção."}</small>
   </div>
  </div>
  {highlights.length>0&&<div className="mm-medals-highlights" aria-label="Medalhas em destaque">
   {highlights.map(m=><button type="button" key={m.id} onClick={()=>{setSelected(m.id);setExpanded(true);}}>
    <span>{m.symbol}</span><small>{m.title}</small></button>)}
  </div>}
  {own&&<div className="mm-medals-pin-section">
   <div className="mm-medals-pin-head">
    <div><strong>Meus três troféus em destaque</strong>
     <small>Escolha até três medalhas desbloqueadas para aparecerem no seu perfil e nas prévias.</small>
    </div>
    <button type="button" className="btn" disabled={saving} aria-expanded={showPinPicker}
     onClick={()=>{setDraftPins(pinned.filter(id=>earned.has(id)&&id!==chosen));setShowPinPicker(value=>!value);}}>
     {showPinPicker?"Fechar seleção":"Escolher meus 3 troféus"}
    </button>
   </div>
   <div className="mm-medals-pin-slots" aria-label="Troféus selecionados">
    {Array.from({length:3},(_,index)=>{
     const selectedMedal=highlights[index];
     return <div key={index} className={"mm-medals-pin-slot "+(selectedMedal?"filled":"empty")}>
      <span aria-hidden="true">{selectedMedal?selectedMedal.symbol:"＋"}</span>
      <small>{selectedMedal?selectedMedal.title:"Escolher"}</small>
     </div>;
    })}
   </div>
   {showPinPicker&&<div className="mm-medals-picker">
    <div className="mm-medals-picker-header"><strong>Selecionar troféus</strong>
     <small>{draftPins.length} de 3 selecionados</small>
    </div>
    <div className="mm-medals-picker-grid">
     {unlocked.filter(m=>m.id!==chosen).map(m=>{
      const active=draftPins.includes(m.id);
      return <button key={m.id} type="button" disabled={saving||(!active&&draftPins.length>=3)}
       className={"mm-medals-picker-choice "+(active?"chosen":"")}
       aria-pressed={active} onClick={()=>setDraftPins(previous=>previous.includes(m.id)
        ?previous.filter(id=>id!==m.id):previous.length<3?[...previous,m.id]:previous)}>
       <span aria-hidden="true">{m.symbol}</span><small>{m.title}</small>
       <span className="mm-medals-picker-check">{active?"✓":""}</span>
      </button>;
     })}
    </div>
    <div className="mm-medals-picker-footer">
     <button type="button" className="btn" onClick={()=>setShowPinPicker(false)}>Cancelar</button>
     <button type="button" className="btn gold" disabled={saving}
      onClick={()=>void save(featured,draftPins,visible).then(ok=>{if(ok)setShowPinPicker(false);})}>
      {saving?"Salvando...":"Salvar troféus"}
     </button>
    </div>
   </div>}
  </div>}
  {own&&<div className="mm-medals-privacy">
   <label><input type="checkbox" checked={visible} disabled={saving} onChange={e=>void save(featured,pinned,e.target.checked)}/>
    Exibir minhas medalhas para outros jogadores</label>
  </div>}
  <button type="button" className="btn mm-medals-expand" aria-expanded={expanded}
   onClick={()=>setExpanded(value=>!value)}>
   <UiIcon name="arrow-right" size={16}/>
   {expanded?"Recolher coleção":own?"Ver minhas 15 conquistas":"Ver coleção de conquistas"}
  </button>
  {expanded&&<>
   <div className="mm-medals-filters" aria-label="Filtrar conquistas">
    {["Todas","Desempenho","Participação","Liga","Organização"].map(item=>
     <button key={item} type="button" aria-pressed={filter===item}
      className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}
   </div>
   <div className="mm-medals-grid">
    {MEDALS.filter(m=>filter==="Todas"||m.group===filter).map(m=>{
     const level=medalLevel(m);
     return <button type="button" key={m.id} onClick={()=>setSelected(m.id)}
      className={"mm-medals-card "+(level<0?"locked ":"")+(selected===m.id?"selected":"")}
      aria-pressed={selected===m.id} style={{"--medal-color":m.color} as CSSProperties}>
      <span className="mm-medals-symbol" aria-hidden="true">{m.symbol}</span>
      <strong>{m.title}</strong><small>{level<0?"Bloqueada":m.levels[level].name}</small>
     </button>;
    })}
   </div>
   <div className="mm-medals-details">
    <div className="mm-medals-details-title"><span aria-hidden="true">{inspect.symbol}</span>
     <div><strong>{inspect.title}</strong><small>{inspect.description}</small></div></div>
    <div className="mm-medals-meter-head"><span>Progresso</span>
     <strong>{inspectValue} {inspect.unit}</strong></div>
    <div role="progressbar" aria-valuenow={Math.min(inspectValue,inspect.levels[inspect.levels.length-1].threshold)}
     aria-valuemin={0} aria-valuemax={inspect.levels[inspect.levels.length-1].threshold}
     aria-label={"Progresso em "+inspect.title} className="mm-medals-meter">
     <div style={{width:(Math.min(1,inspectValue/inspect.levels[inspect.levels.length-1].threshold)*100)+"%"}}/>
    </div>
    <small className="mm-medals-muted">{inspectGranted
     ?"Conquista permanente concedida pela administração. A estatística acima mostra apenas resultados reais."
     :inspectNext?"Próxima meta: "+inspectNext.threshold+" "+inspect.unit:"Nível máximo alcançado!"}</small>
    {own&&inspectLevel>=0&&<div className="mm-medals-choose">
     <button type="button" disabled={saving||chosen===inspect.id} className="btn"
      onClick={()=>void save(inspect.id,pinned.filter(id=>id!==inspect.id),visible)}>
      {chosen===inspect.id?"Medalha principal":"Usar no avatar"}</button>
     <button type="button" disabled={saving||chosen===inspect.id} className="btn"
      onClick={()=>void save(featured,pinned.includes(inspect.id)?pinned.filter(id=>id!==inspect.id):[...pinned,inspect.id].slice(-3),visible)}>
      {pinned.includes(inspect.id)?"Remover do destaque":"Destacar no perfil"}</button>
    </div>}
   </div>
  </>}
  {error&&<p role="alert" className="mm-medals-error">{error}</p>}
  {message&&<p role="status" className="mm-medals-success">{message}</p>}
 </section>;
}
