"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ALL_GAMES,isChipGame} from "@/lib/games";
import {gameName} from "@/lib/mesa-types";
import ScoreRanking from "./score-ranking";
import {getSupabase} from "@/lib/supabase/browser";
import type {Attendance} from "@/lib/mesa-types";
import LeagueFinalizationControls from "@/app/(app)/ligas/[id]/league-finalization-controls";
import type {Event,Profile,Room,Game} from "@/lib/mesa-types";
import UiIcon from "./ui-icon";
import {CrestMark,CrestCustomizer,DEFAULT_CREST,normalizeCrest,type CrestConfig} from "@/app/brasoes/demo/crest-editor";
import "@/app/brasoes/demo/crest-demo.css";
import "./league-hub.css";

export type League={
 id:string;owner_id:string;name:string;description:string;rules:string;
 visibility:"public"|"private";emblem:CrestConfig;finished_at:string|null;created_at:string;member_count:number;event_count:number;
 my_role:"owner"|"organizer"|"member"|null;request_status:"pending"|"approved"|"rejected"|null;
};
type Member={league_id:string;user_id:string;role:"owner"|"organizer"|"member";joined_at:string};
type Request={league_id:string;user_id:string;status:string;created_at:string};
type LeagueRank={user_id:string;game:Game;played:number;net_chips:number};
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
const cash=(n:number)=>(Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const format=(n:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(n)||0);
const leagueName=(id:string,profiles:Profile[])=>profiles.find(p=>p.id===id)?.display_name||"Jogador";
const crestFinishLabel=(value:unknown)=>{const id=normalizeCrest(value).finish;return id==="minimal"?"Minimalista":id==="classic"?"Clássico":"Premium"};
function LeagueBadge({item}:{item:League}){
 return <span className={"mm-league-badge "+item.visibility}>
  <UiIcon name={item.visibility==="public"?"users":"settings"} size={13}/>
  {item.visibility==="public"?"Pública":"Privada"}
 </span>;
}
function LeagueCard({item,onClick}:{item:League;onClick:()=>void}){
 return <button type="button" className="mm-league-card" onClick={onClick}>
  <CrestMark value={item.emblem} className="mm-league-symbol"/>
  <span className="mm-league-card-main">
   <strong>{item.name}</strong>
   <small>{item.description||"Poker, Blackjack e encontros da galera"}</small>
   <span className="mm-league-tags"><LeagueBadge item={item}/>
    <span>{item.member_count} membros</span><span>{item.event_count} eventos</span>{item.finished_at&&<span>Finalizada</span>}
   </span>
  </span>
  <span className="mm-league-card-action">
   {item.my_role==="owner"?"Dono":item.my_role==="organizer"?"Organizador":item.my_role==="member"?"Membro":
   item.request_status==="pending"?"Pendente":"Conhecer"} <UiIcon name="arrow-right" size={16}/>
  </span>
 </button>;
}
export function LeagueHomePreview({onBrowse,onOpen}:{onBrowse:()=>void;onOpen:(id:string)=>void}){
 const [leagues,setLeagues]=useState<League[]>([]);
 const [busy,setBusy]=useState(true);
 useEffect(()=>{
  let alive=true;const db=getSupabase();
  if(!db)return;
  void Promise.resolve(db.rpc("get_league_catalog_final")).then(({data,error})=>{
   if(alive&&!error)setLeagues(((data||[]) as League[]).filter(x=>x.my_role&&!x.finished_at));
  }).finally(()=>{if(alive)setBusy(false)});
  return()=>{alive=false};
 },[]);
 return <section className="mm-home-panel mm-league-home">
  <header><div><span className="mm-home-kicker">COMUNIDADES</span>
   <h2>Minhas ligas</h2></div>
   <button className="mm-home-textlink" type="button" onClick={onBrowse}>
    Explorar ligas <UiIcon name="arrow-right" size={16}/>
   </button>
  </header>
  {leagues.length?<div className="mm-league-home-grid">{leagues.slice(0,3).map(item=>
   <LeagueCard key={item.id} item={item} onClick={()=>onOpen(item.id)}/>)}</div>:
   <p className="mm-league-empty">{busy?"Carregando suas ligas...":
    "Você ainda não participa de uma liga. Encontre um grupo público ou crie sua própria liga."}</p>}
  <button className="btn mm-league-home-explore" type="button" onClick={onBrowse}>
    <UiIcon name="plus" size={16}/> Criar ou encontrar uma liga
  </button>
 </section>;
}
type Props={
 leagueId:string;mode:"list"|"detail"|"manage";userId:string;isAdmin:boolean;
 events:Event[];profiles:Profile[];rooms:Room[];attendances:Attendance[];
 onOpenLeague:(id:string,manage?:boolean)=>void;
 onBack:()=>void;onOpenEvent:(id:string)=>void;onCreateEvent:(id:string)=>void;
 onMembershipChanged?:()=>void;
};
export default function LeagueHub({leagueId,mode,userId,isAdmin,events,profiles:catalogProfiles,rooms,attendances,
 onOpenLeague,onBack,onOpenEvent,onCreateEvent,onMembershipChanged}:Props){
 const changed=useRef(onMembershipChanged);
 useEffect(()=>{changed.current=onMembershipChanged},[onMembershipChanged]);
 const [leagues,setLeagues]=useState<League[]>([]);
 const [busy,setBusy]=useState(true);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [create,setCreate]=useState(false);
  const [createStep,setCreateStep]=useState<"info"|"emblem">("info");
  const [emblem,setEmblem]=useState<CrestConfig>(DEFAULT_CREST);
  const [identityOpen,setIdentityOpen]=useState(false);
 const [name,setName]=useState("");
 const [description,setDescription]=useState("");
 const [rules,setRules]=useState("");
 const [visibility,setVisibility]=useState<"public"|"private">("public");
 const [members,setMembers]=useState<Member[]>([]);
 const [requests,setRequests]=useState<Request[]>([]);
 const [detailProfiles,setDetailProfiles]=useState<Profile[]>([]);
 const profiles=useMemo(()=>[...new Map([...catalogProfiles,...detailProfiles].map(p=>[p.id,p])).values()],[catalogProfiles,detailProfiles]);
 const [rank,setRank]=useState<LeagueRank[]>([]);
 const [invite,setInvite]=useState("");
 const [game,setGame]=useState<Game>("poker");
 const [leagueFilter,setLeagueFilter]=useState<"active"|"finished">("active");
 const [showAllEvents,setShowAllEvents]=useState(false);
 const current=leagues.find(l=>l.id===leagueId);
 const owner=current?.owner_id===userId||isAdmin;
 const canOrganize=owner||current?.my_role==="organizer";
 const joined=Boolean(current?.my_role)||isAdmin;
 const refresh=useCallback(async()=>{
  const db=getSupabase();if(!db)return;
  const {data,error:readError}=await db.rpc("get_league_catalog_final");
  if(readError)throw readError;
  const ownerIds=[...new Set((data||[]).map((l:League)=>l.owner_id))] as string[];
  if(ownerIds.length){
   const {data:owners,error}=await db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path").in("id",ownerIds);
   if(error)throw error;
   setDetailProfiles(prev=>[...new Map([...prev,...(owners||[]) as Profile[]].map(p=>[p.id,p])).values()]);
  }
  setLeagues((data||[]) as League[]);
 },[]);
 const refreshDetails=useCallback(async()=>{
  const db=getSupabase();if(!db||!leagueId)return;
  const [roster,pending,ranking]=await Promise.all([
   db.from("league_members").select("league_id,user_id,role,joined_at").eq("league_id",leagueId),
   db.from("league_requests").select("league_id,user_id,status,created_at").eq("league_id",leagueId).eq("status","pending"),
   db.rpc("get_league_ranking_v2",{p_league_id:leagueId})
  ]);
  if(roster.error)throw roster.error;
  if(pending.error)throw pending.error;
  if(ranking.error)throw ranking.error;
  const ids=[...new Set([...(roster.data||[]),...(pending.data||[]),...(ranking.data||[])].map(row=>row.user_id))];
  if(ids.length){
   const {data,error}=await db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path").in("id",ids);
   if(error)throw error;
   setDetailProfiles(prev=>[...new Map([...prev,...(data||[]) as Profile[]].map(p=>[p.id,p])).values()]);
  }
  setMembers((roster.data||[]) as Member[]);
  setRequests((pending.data||[]) as Request[]);
  setRank((ranking.data||[]) as LeagueRank[]);
 },[leagueId]);
 useEffect(()=>{
  let alive=true;
  setBusy(true);setError("");
  void (async()=>{
   try{await refresh();if(leagueId)await refreshDetails()}
   catch(e){if(alive)setError(errorText(e))}
   finally{if(alive)setBusy(false)}
  })();
  return()=>{alive=false};
 },[leagueId,refresh,refreshDetails]);
 useEffect(()=>{
  if(!leagueId||mode==="list")return;
  const db=getSupabase();if(!db)return;
  const channel=db.channel("league-"+leagueId)
   .on("postgres_changes",{event:"*",schema:"public",table:"league_requests",filter:"league_id=eq."+leagueId},
     ()=>{void refreshDetails().catch(()=>{})})
   .on("postgres_changes",{event:"*",schema:"public",table:"league_members",filter:"league_id=eq."+leagueId},
     ()=>{void Promise.all([refresh(),refreshDetails()]).catch(()=>{});changed.current?.()})
   .subscribe();
  const timer=setInterval(()=>{if(document.visibilityState==="visible")void Promise.all([refresh(),refreshDetails()]).catch(()=>{})},90000);
  return()=>{clearInterval(timer);void db.removeChannel(channel)};
 },[leagueId,mode,refresh,refreshDetails]);
 async function run(fn:()=>Promise<void>,done:string){
  setWorking(true);setError("");setMessage("");
  try{await fn();await refresh();if(leagueId)await refreshDetails();setMessage(done)}
  catch(e){setError(errorText(e))}
  finally{setWorking(false)}
 }
 async function saveNew(){
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {data,error:err}=await db.rpc("create_league_premium",{
    p_name:name.trim(),p_description:description.trim(),p_visibility:visibility,p_rules:rules.trim(),p_emblem:emblem
   });
   if(err)throw err;
   setCreate(false);setCreateStep("info");setName("");setDescription("");setRules("");setVisibility("public");setEmblem(DEFAULT_CREST);
   if(typeof data==="string")onOpenLeague(data);
  },"Liga criada! Agora você pode organizar eventos e gerenciar membros.");
 }
 async function pushOwner(id:string){
  try{
   const db=getSupabase();if(!db)return;
   const {data:{session}}=await db.auth.getSession();
   if(!session?.access_token)return;
   await fetch("/api/push/league-request",{method:"POST",
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
    body:JSON.stringify({leagueId:id})});
  }catch{/* In-app notice is durable; push may be unavailable. */}
 }
 async function apply(){
  if(!current)return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {data,error:err}=await db.rpc("request_league_join",{p_league_id:current.id,p_token:null});
   if(err)throw err;
   if(data==="pending")void pushOwner(current.id);
   else changed.current?.();
  },current.visibility==="public"?"Você entrou na Liga!":"Pedido enviado! Aguarde aprovação.");
 }
 async function decide(id:string,approve:boolean){
  if(!current)return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {error:err}=await db.rpc("decide_league_request",{p_league_id:current.id,p_user_id:id,p_approve:approve});
   if(err)throw err;
   if(approve)changed.current?.();
  },approve?"Participante aprovado.":"Solicitação recusada.");
 }
 async function setRole(id:string,role:"organizer"|"member"){
  if(!current)return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {error:err}=await db.rpc("set_league_member_role",{
    p_league_id:current.id,p_user_id:id,p_role:role});
   if(err)throw err;
  },role==="organizer"?"Organizador definido.":"Permissões de membro restauradas.");
 }
 async function remove(id:string){
  if(!current||!window.confirm("Remover este participante da liga?"))return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {error:err}=await db.rpc("leave_league",{p_league_id:current.id,p_user_id:id});
   if(err)throw err;
  },"Participante removido.");
 }
 async function exitLeague(){
  if(!current||!window.confirm("Sair desta liga?"))return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {error:err}=await db.rpc("leave_league",{p_league_id:current.id,p_user_id:userId});
   if(err)throw err;onBack();
  },"Você saiu da liga.");
 }
 async function generate(){
  if(!current)return;
  if(invite&&!window.confirm("Gerar um novo convite invalida o anterior. Continuar?"))return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {data,error:err}=await db.rpc("generate_league_invite",{p_league_id:current.id});
   if(err)throw err;setInvite(String(data||""));
  },"Convite privado gerado. Envie-o para quem deseja solicitar entrada.");
 }
 async function saveIdentity(){
   if(!current)return;
   if(!/^[A-Z0-9]{1,4}$/.test(emblem.initials)||(emblem.withYear&&!/^\d{4}$/.test(emblem.year))){
    setError("Informe uma sigla e um ano de quatro dígitos.");return;
   }
   await run(async()=>{
    const db=getSupabase();if(!db)throw new Error("Sem conexão");
    const {error:err}=await db.rpc("update_league_emblem",{p_league_id:current.id,p_emblem:emblem});
    if(err)throw err;
    setIdentityOpen(false);
   },"Brasão atualizado com sucesso.");
  }
  function openIdentity(){
   if(!current)return;
   setEmblem(normalizeCrest(current.emblem));setIdentityOpen(true);setError("");setMessage("");
  }
  async function update(){
  if(!current)return;
  await run(async()=>{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {error:err}=await db.rpc("update_league",{
    p_league_id:current.id,p_name:name.trim(),p_description:description.trim(),
    p_visibility:visibility,p_rules:rules.trim()
   });if(err)throw err;
   setCreate(false);
  },"Informações da liga atualizadas.");
 }
 function editLeague(){if(!current)return;setName(current.name);setDescription(current.description);
  setRules(current.rules);setVisibility(current.visibility);setCreateStep("info");setCreate(true)}
 const own=leagues.filter(l=>l.my_role);
 const filteredOwn=own.filter(l=>leagueFilter==="finished"?Boolean(l.finished_at):!l.finished_at);
 const available=leagues.filter(l=>!l.my_role&&!l.finished_at);
 const leagueEvents=events.filter(ev=>ev.league_id===leagueId)
  .sort((a,b)=>new Date(b.starts_at).getTime()-new Date(a.starts_at).getTime());
 const rankings=rank.filter(r=>r.game===game).sort((a,b)=>Number(b.net_chips)-Number(a.net_chips));
 const nextEvent=leagueEvents.filter(e=>e.status==="scheduled"&&new Date(e.starts_at).getTime()>Date.now())
  .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime())[0];
 const lastEvent=leagueEvents.find(e=>e.status==="finished");
 const attending=nextEvent?attendances.filter(a=>a.session_id===nextEvent.id).length:0;
 const leaders=rankings.slice(0,3);
 return <div className="mm-leagues">
  <header className="mm-leagues-header">
   <div><span className="mm-home-kicker">COMUNIDADES · MESA MARCADA</span>
    <h1>{mode==="list"?"Ligas":current?.name||"Minha liga"}</h1>
    <p>{mode==="list"?"Participe de grupos, organize noites e acompanhe os resultados de cada liga.":
     current?.description||"Encontros, rankings e participantes em um só lugar."}</p>
   </div>
   <div className="mm-league-header-actions">
   {mode==="list"?<><button className="btn gold" onClick={()=>{setName("");setDescription("");setRules("");setVisibility("public");setEmblem(DEFAULT_CREST);setCreateStep("info");setCreate(true)}}><UiIcon name="plus" size={17}/> Criar liga</button></>:
    <button className="btn" onClick={mode==="manage"?()=>onOpenLeague(leagueId):onBack}>← Voltar</button>}
   </div>
  </header>
  {error&&<div className="mm-message error" role="alert">{error}</div>}
  {message&&<p className="mm-message" role="status">{message}</p>}
  {busy&&<p className="mm-formfoot">Atualizando ligas...</p>}
  {mode==="list"&&<>
   <nav className="mm-league-list-switch" aria-label="Estado das Ligas">
    <button type="button" aria-pressed={leagueFilter==="active"} className={leagueFilter==="active"?"active":""} onClick={()=>setLeagueFilter("active")}>Ativas</button>
    <button type="button" aria-pressed={leagueFilter==="finished"} className={leagueFilter==="finished"?"active":""} onClick={()=>setLeagueFilter("finished")}>Finalizadas</button>
   </nav>
   <section className="panel">
    <div className="panelhead"><h2>{leagueFilter==="active"?"Minhas ligas ativas":"Arquivo de Ligas"}</h2><span className="tag">{filteredOwn.length}</span></div>
    {filteredOwn.length?<div className="mm-league-grid">{filteredOwn.map(item=>
     <LeagueCard key={item.id} item={item} onClick={()=>onOpenLeague(item.id)}/>)}</div>:
     <p className="mm-league-empty">{leagueFilter==="finished"?"Nenhuma Liga finalizada no seu histórico.":"Você ainda não participa de uma Liga ativa. Crie uma ou solicite entrada em uma Liga pública."}</p>}
   </section>
   {leagueFilter==="active"&&<section className="panel">
    <div className="panelhead"><h2>Explorar ligas</h2><span className="tag">{available.length}</span></div>
    <p className="mm-formfoot">Ligas públicas são visíveis. Ligas privadas aparecem apenas após um convite ou solicitação existente.</p>
    {available.length?<div className="mm-league-grid">{available.map(item=>
     <LeagueCard key={item.id} item={item} onClick={()=>onOpenLeague(item.id)}/>)}</div>:
     <p className="mm-league-empty">Nenhuma liga pública disponível no momento.</p>}
   </section>}
  </>}
  {mode!=="list"&&!current&&!busy&&<section className="panel">Liga não encontrada ou você ainda não tem acesso. <button className="btn" onClick={onBack}>Explorar ligas</button></section>}
  {mode==="detail"&&current&&<>
   <section className="mm-league-hero">
    <CrestMark value={current.emblem} className="mm-league-hero-symbol"/>
    <div><LeagueBadge item={current}/>
     <p>{current.member_count} membros · {current.event_count} eventos ·
      Dono: {leagueName(current.owner_id,profiles)}</p>
     {current.rules&&joined&&<p className="mm-league-rules">{current.rules}</p>}
    </div>
   </section>
   {!joined&&!current.finished_at&&<section className="panel mm-league-join">
    <h2>{current.request_status==="pending"?"Solicitação em análise":"Participar desta liga"}</h2>
    <p>{current.request_status==="pending"?"O dono ainda não analisou seu pedido.":
     "Em Ligas públicas, a entrada é imediata. Ligas privadas ainda exigem convite e aprovação."}</p>
    {current.request_status!=="pending"&&current.visibility==="public"&&
     <button className="btn gold" disabled={working} onClick={()=>void apply()}>Entrar na Liga</button>}
    {current.visibility==="private"&&<p className="mm-formfoot">Ligas privadas exigem um convite válido para solicitar entrada.</p>}
   </section>}
   {joined&&<>
    <section className="mm-league-overview" aria-label="Painel principal da liga">
     <header className="mm-league-overview-head">
      <div><span className="mm-home-kicker">VISÃO GERAL</span><h2>Próxima rodada</h2></div>
      {canOrganize&&!current.finished_at&&<button className="btn gold" type="button" onClick={()=>onCreateEvent(current.id)}>
        <UiIcon name="plus" size={16}/> Criar evento</button>}
     </header>
     <div className="mm-league-overview-grid">
      <div className="mm-league-overview-event">
       {nextEvent?<><small>{rooms.find(r=>r.id===nextEvent.room_id)?.name||"Próxima mesa"}</small>
        <strong>{nextEvent.title}</strong>
        <p>{new Date(nextEvent.starts_at).toLocaleString("pt-BR",{weekday:"long",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
        <span>{attending}/{nextEvent.max_participants} cadeiras ocupadas</span>
        <button className="btn gold" onClick={()=>onOpenEvent(nextEvent.id)}>Abrir evento <UiIcon name="arrow-right" size={15}/></button>
       </>:<><strong>Agenda livre</strong>
        <p>{canOrganize?"Você pode marcar o próximo encontro da sua liga.":"A próxima partida será exibida aqui assim que for agendada."}</p></>}
      </div>
      <div className="mm-league-overview-info">
       <div><small>Jogadores</small><strong>{current.member_count}</strong></div>
       <div><small>Eventos realizados</small><strong>{leagueEvents.filter(e=>e.status==="finished").length}</strong></div>
       <div><small>Pedidos pendentes</small><strong>{owner?requests.length:"—"}</strong></div>
       {lastEvent&&<button onClick={()=>onOpenEvent(lastEvent.id)}>
        Última noite: {lastEvent.title} <UiIcon name="arrow-right" size={14}/></button>}
      </div>
     </div>
     {leaders.length>0&&<div className="mm-league-overview-leaders">
      <div className="mm-league-overview-title">
       <span className="mm-home-kicker">DESTAQUES DO RANKING</span>
       <span className="mm-league-overview-switch">
        {(["poker","blackjack"] as Game[]).map(g=><button type="button" key={g}
          className={game===g?"active":""} onClick={()=>setGame(g)}>{g==="poker"?"Poker":"Blackjack"}</button>)}
       </span>
      </div>
      <div>{leaders.map((player,i)=><div key={player.user_id}>
       <b>{i+1}º</b><strong>{leagueName(player.user_id,profiles)}</strong>
       <span>{cash(player.net_chips)}</span>
      </div>)}</div>
     </div>}
    </section>
    <div className="mm-league-stats">
      <div><small>Membros</small><strong>{current.member_count}</strong></div>
      <div><small>Eventos</small><strong>{current.event_count}</strong></div>
      <div><small>Seu papel</small><strong>{owner?"Dono":canOrganize?"Organizador":"Membro"}</strong></div>
    </div>
    <section className="panel">
      <div className="panelhead"><h2>Eventos da liga</h2>
       {canOrganize&&!current.finished_at&&<button className="btn gold" onClick={()=>onCreateEvent(current.id)}>+ Criar evento</button>}</div>
      {leagueEvents.length?<div className="mm-league-event-list">
       {(showAllEvents?leagueEvents:leagueEvents.slice(0,12)).map(ev=><button key={ev.id} onClick={()=>onOpenEvent(ev.id)}>
        <span><strong>{ev.title}</strong><small>{new Date(ev.starts_at).toLocaleString("pt-BR",{dateStyle:"medium",timeStyle:"short"})} · {rooms.find(r=>r.id===ev.room_id)?.name||"Mesa"}</small></span>
        <UiIcon name="arrow-right" size={18}/>
       </button>)}</div>:<p className="mm-league-empty">Ainda não existem eventos nesta liga. Os eventos independentes permanecem na agenda geral.</p>}
      {leagueEvents.length>12&&<button type="button" className="btn" onClick={()=>setShowAllEvents(v=>!v)}>{showAllEvents?"Mostrar menos":"Ver todos os "+leagueEvents.length+" eventos"}</button>}
    </section>
    <section className="panel">
     <div className="panelhead"><h2>Ranking da liga</h2><span className="tag">Eventos encerrados</span></div>
     <div className="mm-filter-bar">{ALL_GAMES.map(g=>
       <button key={g} className={"filter "+(game===g?"active":"")} onClick={()=>setGame(g)}>
       {gameName(g)}</button>)}</div>
     {!isChipGame(game)?<ScoreRanking key={game} game={game} leagueId={leagueId}/>:rankings.length?<div className="mm-league-ranks">{rankings.map((r,i)=>
       <div key={r.user_id} className="mm-league-rank"><span>{i+1}º</span>
        <strong>{leagueName(r.user_id,profiles)}</strong><small>{r.played} noites</small>
        <b className={Number(r.net_chips)>=0?"positive":"negative"}>{cash(r.net_chips)}</b>
       </div>)}</div>:<p className="mm-league-empty">O ranking começa quando os primeiros eventos da liga forem concluídos.</p>}
    </section>
    <section className="panel">
      <div className="panelhead"><h2>Participantes</h2><span className="tag">{members.length}</span></div>
      <div className="mm-league-member-list">{members.map(m=><div key={m.user_id}>
       <span>♠</span><strong>{leagueName(m.user_id,profiles)}</strong>
       <small>{m.role==="owner"?"Dono":m.role==="organizer"?"Organizador":"Membro"}</small>
      </div>)}</div>
    </section>
    <div className="mm-league-bottom-actions">
     {owner?<button className="btn gold" onClick={()=>onOpenLeague(leagueId,true)}>
       <UiIcon name="settings" size={17}/> Gerenciar liga{requests.length>0?" · "+requests.length+" pendentes":""}
     </button>:<button className="btn" disabled={working} onClick={()=>void exitLeague()}>Sair da liga</button>}
    </div>
   </>}
  </>}
  {mode==="manage"&&current&&owner&&<>
   <section className="panel"><div className="panelhead"><h2>Solicitações de entrada</h2><span className="tag">{requests.length}</span></div>
    {requests.length?requests.map(q=><div className="mm-league-request" key={q.user_id}>
     <strong>{leagueName(q.user_id,profiles)}</strong>
     <small>Pedido em {new Date(q.created_at).toLocaleDateString("pt-BR")}</small>
     <div><button className="btn gold" disabled={working} onClick={()=>void decide(q.user_id,true)}>Aprovar</button>
       <button className="btn" disabled={working} onClick={()=>void decide(q.user_id,false)}>Recusar</button></div>
    </div>):<p className="mm-league-empty">Nenhuma solicitação pendente.</p>}
   </section>
   <section className="panel">
    <div className="panelhead"><h2>Convidar jogadores</h2></div>
    <p className="mm-formfoot">Convites privados permitem solicitar entrada, mas somente sua aprovação libera os dados da liga. Um novo convite invalida o anterior.</p>
    <button className="btn gold" disabled={working} onClick={()=>void generate()}>Gerar link privado</button>
    {invite&&<div className="mm-league-invite">
      <input aria-label="Link para pedir entrada na liga" readOnly value={typeof window==="undefined"?"":window.location.origin+"/ligas/convite/"+invite} />
      <button className="btn" onClick={()=>void navigator.clipboard.writeText(window.location.origin+"/ligas/convite/"+invite).then(()=>setMessage("Link copiado!")).catch(()=>setError("Copie o link manualmente."))}>Copiar</button>
      <p className="mm-formfoot">Guarde o link. Ele não será exibido novamente após sair desta tela.</p>
    </div>}
   </section>
   <section className="panel">
    <div className="panelhead"><h2>Gerenciar membros</h2><span className="tag">{members.length}</span></div>
    {members.map(m=><div className="mm-league-request" key={m.user_id}>
     <strong>{leagueName(m.user_id,profiles)}</strong><small>{m.role==="owner"?"Dono":m.role==="organizer"?"Organizador":"Membro"}</small>
     {m.role!=="owner"&&<div className="mm-league-member-actions">
       <button className="btn" disabled={working} onClick={()=>void setRole(m.user_id,
        m.role==="organizer"?"member":"organizer")}>
        {m.role==="organizer"?"Retirar cargo":"Promover a Organizador"}</button>
       <button className="btn" disabled={working} onClick={()=>void remove(m.user_id)}>Remover</button>
      </div>}
    </div>)}
   </section>
   <section className="panel mm-league-identity-panel">
    <div className="panelhead"><h2>Identidade visual</h2><span className="tag">{crestFinishLabel(current.emblem)}</span></div>
    <div className="mm-league-identity-summary"><CrestMark value={current.emblem} className="mm-league-identity-thumb"/>
     <div><strong>Brasão da liga</strong><p>Personalize símbolo, formato, cor, sigla e ano.</p>
      <button className="btn gold" type="button" onClick={openIdentity}>Editar brasão</button></div></div>
   </section>
   <section className="panel">
    <div className="panelhead"><h2>Configurações</h2></div>
    <p className="mm-formfoot">Altere o nome, visibilidade, apresentação e regras da sua liga.</p>
    <button className="btn" onClick={editLeague}><UiIcon name="settings" size={16}/> Editar liga</button>
   </section>
  </>}
  {mode==="manage"&&current&&!owner&&<p className="mm-message error">Somente o dono pode gerenciar esta liga.</p>}
  {create&&<div className="mm-league-overlay" role="presentation" onClick={e=>{if(e.target===e.currentTarget)setCreate(false)}}>
   <form className={"mm-league-modal "+(createStep==="emblem"&&mode!=="manage"?"mm-league-modal-wide":"")} role="dialog" aria-modal="true" aria-label={mode==="manage"?"Editar liga":"Criar liga"}
     onSubmit={e=>{e.preventDefault();if(mode==="manage")void update();else if(createStep==="info")setCreateStep("emblem");else if(/^[A-Z0-9]{1,4}$/.test(emblem.initials)&&(!emblem.withYear||/^\d{4}$/.test(emblem.year)))void saveNew();else setError("Informe uma sigla e ano válidos para o brasão.");}}>
    <h2>{mode==="manage"?"Editar liga":createStep==="info"?"Criar uma liga":"Identidade da sua liga"}</h2>
    <p>{mode==="manage"?"Atualize as informações da comunidade.":createStep==="info"?"Etapa 1 de 2 · Informações da Liga":"Etapa 2 de 2 · Escolha o acabamento e personalize o brasão antes de criar a Liga."}</p>
    {(mode==="manage"||createStep==="info")&&<>
    <label>Nome da liga<input required minLength={3} maxLength={65} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Liga dos Coringas"/></label>
    <label>Descrição<textarea maxLength={500} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Conte sobre a sua comunidade"/></label>
    <label>Privacidade<select value={visibility} onChange={e=>setVisibility(e.target.value as "public"|"private")}>
     <option value="public">Pública · aparece em Explorar</option>
     <option value="private">Privada · encontrada somente por convite</option>
    </select></label>
    <label>Regras (opcional)<textarea maxLength={2500} rows={4} value={rules} onChange={e=>setRules(e.target.value)} placeholder="Regras do grupo, horários, combinados..."/></label>
    </>}
    {mode!=="manage"&&createStep==="emblem"&&<CrestCustomizer value={emblem} onChange={setEmblem}/>}
    {error&&<p className="mm-message error" role="alert">{error}</p>}
    <div className="mm-league-modal-actions">
     {mode!=="manage"&&createStep==="emblem"&&<button className="btn" type="button" onClick={()=>setCreateStep("info")}>← Voltar</button>}
     <button className="btn" type="button" onClick={()=>setCreate(false)}>Cancelar</button>
     <button className="btn gold" disabled={working} type="submit">{working?"Salvando...":mode==="manage"?"Salvar mudanças":createStep==="info"?"Personalizar brasão →":"Criar liga"}</button>
    </div>
   </form>
  </div>}
  {identityOpen&&current&&owner&&<div className="mm-league-overlay" role="presentation"
    onClick={e=>{if(e.target===e.currentTarget)setIdentityOpen(false)}}>
   <div className="mm-league-modal mm-league-modal-wide" role="dialog" aria-modal="true" aria-label="Editar brasão da Liga">
    <h2>Identidade visual</h2><p>Escolha o acabamento e personalize o brasão desta Liga.</p>
    <CrestCustomizer value={emblem} onChange={setEmblem}/>
    {error&&<p className="mm-message error" role="alert">{error}</p>}
    <div className="mm-league-modal-actions">
     <button className="btn" type="button" onClick={()=>setIdentityOpen(false)}>Cancelar</button>
     <button className="btn gold" type="button" disabled={working} onClick={()=>void saveIdentity()}>{working?"Salvando...":"Salvar brasão"}</button>
    </div>
   </div>
  </div>}
  {mode!=="list"&&current&&<LeagueFinalizationControls mode={mode==="manage"?"manage":"detail"} leagueId={current.id} isAdmin={isAdmin}/>}
 </div>;
}
