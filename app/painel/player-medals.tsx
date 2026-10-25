"use client";
import {useEffect,useState} from "react";
import type {CSSProperties} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import {PlayerAvatar} from "./v09-features";
import UiIcon from "./ui-icon";
import "./player-medals.css";

type Tier={name:string;threshold:number};
type Medal={
 id:string;symbol:string;title:string;summary:string;description:string;
 group:"Desempenho"|"Participação"|"Liga"|"Organização";
 levels:Tier[];color:string;unit:string;
};
const bronze=(a:number,b:number,c:number,d?:number):Tier[]=>[
 {name:"Bronze",threshold:a},{name:"Prata",threshold:b},{name:"Ouro",threshold:c},
 ...(d?[{name:"Diamante",threshold:d}]:[])
];
export const MEDALS:Medal[]=[
 {id:"first",symbol:"🏅",title:"Primeira Vitória",summary:"Venceu sua primeira noite",
  description:"Vença um evento encerrado com saldo líquido positivo.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#e4b966",unit:"vitórias"},
 {id:"collector",symbol:"🏆",title:"Colecionador",summary:"Vitórias no mesmo jogo",
  description:"Acumule 5, 15, 30 ou 50 vitórias na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#efbf69",unit:"vitórias"},
 {id:"podium",symbol:"🥉",title:"Frequentador do Pódio",summary:"Entre os três melhores",
  description:"Alcance o Top 3 em eventos com pelo menos quatro competidores, na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#c89671",unit:"pódios"},
 {id:"shark",symbol:"🦈",title:"Tubarão",summary:"Alto aproveitamento",
  description:"Bronze: pelo menos 60% de vitórias em 10 eventos. Prata: 70% em 20. Ouro: 75% em 40, sempre na mesma modalidade.",group:"Desempenho",levels:bronze(10,20,40),color:"#78bce8",unit:"eventos qualificados"},
 {id:"positive",symbol:"💰",title:"Saldo Positivo",summary:"Mais noites no positivo",
  description:"Encerre 10, 25, 50 ou 100 eventos com saldo positivo em fichas.",group:"Desempenho",levels:bronze(10,25,50,100),color:"#77c89f",unit:"noites positivas"},
 {id:"record",symbol:"💎",title:"Recordista Pessoal",summary:"Superou a própria marca",
  description:"A partir da terceira participação, supere seu recorde pessoal positivo de saldo líquido em uma noite.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#9badff",unit:"recordes"},
 {id:"veteran",symbol:"🎲",title:"Veterano",summary:"Muitas noites na história",
  description:"Participe de 10, 30, 75 ou 150 eventos com resultados conferidos.",group:"Participação",levels:bronze(10,30,75,150),color:"#bd9cf0",unit:"eventos"},
 {id:"loyal",symbol:"🤝",title:"Fiel à Liga",summary:"Presença na mesma Liga",
  description:"Participe de 10, 25 ou 50 eventos de uma mesma Liga.",group:"Liga",levels:bronze(10,25,50),color:"#88bdc8",unit:"eventos na Liga"},
 {id:"poker",symbol:"♠",title:"Especialista em Poker",summary:"Noites na mesa de Poker",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Poker.",group:"Participação",levels:bronze(10,25,50,100),color:"#7bb7ff",unit:"eventos de Poker"},
 {id:"blackjack",symbol:"♦",title:"Especialista em Blackjack",summary:"Noites na mesa de Blackjack",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Blackjack.",group:"Participação",levels:bronze(10,25,50,100),color:"#ff8490",unit:"eventos de Blackjack"},
 {id:"versatile",symbol:"🃏",title:"Jogador Versátil",summary:"Domina duas modalidades",
  description:"Participe de 5, 15 ou 30 eventos em cada modalidade e mantenha saldo acumulado positivo nas duas.",group:"Participação",levels:bronze(5,15,30),color:"#aca1ef",unit:"noites em cada jogo"},
 {id:"champ",symbol:"👑",title:"Campeão da Liga",summary:"Conquistou uma Liga",
  description:"Vença a classificação final de Poker ou Blackjack de uma Liga encerrada, com saldo positivo.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#f3ca74",unit:"títulos"},
 {id:"multi",symbol:"🏆",title:"Multicampeão",summary:"Coleciona títulos de Liga",
  description:"Vença em duas, três ou cinco Ligas distintas já encerradas.",group:"Liga",levels:bronze(2,3,5),color:"#dfb56d",unit:"Ligas campeãs"},
 {id:"pioneer",symbol:"💠",title:"Pioneiro",summary:"Estava no começo da Liga",
  description:"Participe do primeiro evento válido e concluído de uma Liga.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#8dbde8",unit:"primeiros eventos"},
 {id:"host",symbol:"🎩",title:"Anfitrião Experiente",summary:"Fez a noite acontecer",
  description:"Organize 5, 15, 30 ou 60 eventos concluídos com pelo menos dois jogadores.",group:"Organização",levels:bronze(5,15,30,60),color:"#c7a4ec",unit:"eventos organizados"}
];
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
 async function save(nextFeatured:string|null,nextPins:string[],nextVisible:boolean){
  const db=getSupabase();if(!db)return;
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
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar a vitrine.");}
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
