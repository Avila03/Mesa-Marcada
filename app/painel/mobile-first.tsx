"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {ALL_GAMES,GAME_META,VARIANT_NAMES,defaultVariant,defaultTarget,targetLabel,isChipGame} from "@/lib/games";
import {GAME_IDENTITY} from "@/lib/game-identity";
import GameArtwork from "./game-artwork";
import {rematchForm,nextWeeklySlot} from "@/lib/table-setup";
import QuickRebuy from "./quick-rebuy";
import {runMutation} from "@/lib/mutations";
import type {Catalog,EventSnapshot} from "@/lib/club-data";
import {useProfilePhotos} from "./use-profile-photos";
import { getSupabase } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, View, DetailTab, Profile, Room, Event, Attendance, Poll, Choice, Vote, Buy, BuyItem, ChipResult, Expense, Rank } from "@/lib/mesa-types";
import { money, fullDate, eventTime, gameName, errText } from "@/lib/mesa-types";
import "../v05-theme.css";
import {AttendeeMiniCard,EventShareActions,FinanceReviewBoard,PlayerAvatar,ProfilePanel} from "./v09-features";
import type {FinanceLine} from "./v09-features";
import ChipPurchaseForm from "./chip-purchase-form";
import "../live-checkout.css";
import "./duo-theme.css";
import "./event-overview.css";
import "./connection-indicator.css";
import SiteLogo from "./site-logo";
import NotificationCenter from "./notification-center";
import EventReconfirmation from "./event-reconfirmation";
import "./refinements.css";
import {prepareProfilePhoto} from "./photo-utils";
import {ExpenseSplitsPanel,MySplitsSummary} from "./expense-splits";
import type {ExpenseSplitRow,MyExpenseSplitRow,ExpenseSettlement} from "./expense-splits";
import MobileAppCompanion from "./mobile-app-companion";
import UiIcon from "./ui-icon";
import DashboardV16 from "./dashboard-v16";
import type {League} from "./league-hub";
import PrivateInviteShare from "./private-invite-share";
import PollComposer from "./poll-composer";
import ExpenseComposer from "./expense-composer";
import PlayerProfileTrigger from "./player-profile-preview";
import type {TableSeat} from "./seating-table";
import EventWizard from "./event-wizard";
import TaskNavigation,{type TaskLink} from "./task-navigation";
import {EMPTY_EVENT,eventDraftFromEvent,eventDraftKey,validateEventDraft,type EventDraft as CreateEvent} from "@/lib/event-draft";
import {eventDestination,eventStatus,filterEvents,type EventFilter} from "@/lib/event-navigation";
import type {ProfileTab,LeagueTab} from "@/lib/app-routes";
import "./task-layout.css";
import "./daily.css";
import "../neon-sign.css";
import {readClubRoute,clubHref} from "@/lib/app-routes";
import {useClubRealtime} from "./use-club-realtime";
import type {UpdateScope} from "./use-club-realtime";
import type {LiveState,LiveActivity} from "./event-live-panel";
import type {UiIconName} from "./ui-icon";
import type {HiddenEvent,AdminAudit,AdminFinance} from "./admin-panel";
const TableTutorial=dynamic(()=>import("./table-tutorial"),{loading:()=>null});
const AdminPanel=dynamic(()=>import("./admin-panel"),{loading:()=>null});
const LeagueHub=dynamic(()=>import("./league-hub"),{loading:()=>null});
const EventLivePanel=dynamic(()=>import("./event-live-panel"),{loading:()=>null});
const LiveMovements=dynamic(()=>import("./event-live-panel").then(module=>module.LiveMovements),{loading:()=>null});
const NightSummary=dynamic(()=>import("./night-summary"),{loading:()=>null});
const SeatingTable=dynamic(()=>import("./seating-table"),{loading:()=>null});
const RoundOrder=dynamic(()=>import("./round-order"),{loading:()=>null});
const PostGameShare=dynamic(()=>import("./post-game-share"),{loading:()=>null});
const ScoreGamePanel=dynamic(()=>import("./score-games"),{loading:()=> <p role="status">Carregando placar…</p>});
const PlayerScoreResults=dynamic(()=>import("./score-ranking").then(m=>m.PlayerScoreResults));
const PlayerMedals=dynamic(()=>import("./player-medals"),{loading:()=>null});
const PlayerFrames=dynamic(()=>import("./player-frames"),{loading:()=>null});


const defaultEvent=EMPTY_EVENT;
const MONTHS=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const localDateTimeInput=(iso:string)=>{
 const d=new Date(iso);const pad=(n:number)=>String(n).padStart(2,"0");
 return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-")+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
};

function DateTile({value}:{value:string}){
  const d=new Date(value);
  return <div className="mm-datebox" aria-label={fullDate(value)}>
    <strong>{String(d.getDate()).padStart(2,"0")}</strong><small>{MONTHS[d.getMonth()]}</small>
  </div>;
}

function GameBanner({game,name,large=false}:{game:Game;name?:string;large?:boolean}){
  return <div className={"mm-event-banner "+game+" mm-illustrated"} style={large?{height:142}:undefined}>
    <span className={"tag "+game}>{gameName(game)}</span>
    <GameArtwork game={game}/>{!name&&<span className="mm-art-caption">{GAME_IDENTITY[game].signature}</span>}
    {name&&<span className="tag" style={{position:"absolute",bottom:12,left:18}}>{name}</span>}
  </div>;
}

function EventTile({value,room,count,confirmed,live,open}:{value:Event;room?:Room;count:number;confirmed:boolean;live:boolean;open:()=>void}){
  const game=room?.game||"poker";
  return <article className="mm-event-card">
    <GameBanner game={game} name={value.game_variant?VARIANT_NAMES[value.game_variant]:game==="poker"?VARIANT_NAMES.texas_holdem:undefined}/>
    <div className="mm-event-content">
      <div className="mm-title-actions"><h3>{value.title}</h3><span className={"tag "+(value.status==="scheduled"?game:"archive")}>{eventStatus(value,live)}</span></div>
      <div className="mm-event-info">{value.league_id&&<span>♠ Evento de liga</span>}<span>◷ {fullDate(value.starts_at)}</span><span>⌖ {value.location}</span></div>
      <div className="mm-event-occupancy"><span>{count} de {value.max_participants} participantes</span><span>{Math.max(0,value.max_participants-count)} vagas</span></div>
      <div className="mm-progress" aria-hidden="true"><div style={{width:(Math.min(1,count/value.max_participants)*100)+"%"}}/></div>
      <div className="mm-v09-event-actions">
        <button type="button" className={confirmed?"btn mm-v09-confirmed":"btn gold"} onClick={open}>
          {value.status==="finished"?"Ver resultado →":value.status==="cancelled"?"Ver evento →":live?"Ver partida ao vivo →":confirmed?"✓ Ver meu assento →":"Escolher assento →"}
        </button>
      </div>
    </div>
  </article>;
}

export default function PainelPage(){
  const [user,setUser]=useState<{id:string;email?:string}|null>(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [hiddenEvents,setHiddenEvents]=useState<HiddenEvent[]>([]);
  const [adminAudits,setAdminAudits]=useState<AdminAudit[]>([]);
  const [adminFinance,setAdminFinance]=useState<AdminFinance[]>([]);
  const [page,setPage]=useState<View>("inicio");
  const [routeReady,setRouteReady]=useState(false);
  const hydratingRoute=useRef(true);
  const firstRoute=useRef(true),autoEvent=useRef<string|null>(null),replaceRoute=useRef(false);
  const [detailTab,setDetailTab]=useState<DetailTab>("visao");
  const [selectedId,setSelectedId]=useState("");
  const [selectedLeagueId,setSelectedLeagueId]=useState("");
  const [leagueCatalog,setLeagueCatalog]=useState<League[]>([]);
  const [profileId,setProfileId]=useState("");
  const [profileReturn,setProfileReturn]=useState<View>("inicio");
  const [financeRows,setFinanceRows]=useState<FinanceLine[]>([]);
  const [gameView,setGameView]=useState<Game>("poker");
  const [gameVariant,setGameVariant]=useState("");
  const [gameTab,setGameTab]=useState<"eventos"|"tutorial">("eventos");
  const [profileTab,setProfileTab]=useState<ProfileTab>("resumo");
  const [leagueTab,setLeagueTab]=useState<LeagueTab>("eventos");
  const [creatorStep,setCreatorStep]=useState(1);
  const [creatorEpoch,setCreatorEpoch]=useState(0);
  const [editSeedId,setEditSeedId]=useState("");
  const [repeatSource,setRepeatSource]=useState("");
  const [repeatSourceId,setRepeatSourceId]=useState("");
  const [isMobile,setIsMobile]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia("(max-width: 750px)");
    const sync=()=>setIsMobile(query.matches);sync();
    query.addEventListener("change",sync);return()=>query.removeEventListener("change",sync);
  },[]);
  const [loading,setLoading]=useState(true);
  const context=useRef({selectedId,page,profileId});context.current={selectedId,page,profileId};
  const catalogFlight=useRef(new Map<string,Promise<void>>());
  const eventFlights=useRef(new Map<string,Promise<void>>());
  const profileFlight=useRef<Promise<void>|null>(null);
  const [historyMore,setHistoryMore]=useState(false);
  const historyCursor=useRef<{at:string;id:string}|null>(null);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [detailLoading,setDetailLoading]=useState(false);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [rooms,setRooms]=useState<Room[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [liveStates,setLiveStates]=useState<LiveState[]>([]);
  const [liveActivities,setLiveActivities]=useState<LiveActivity[]>([]);
  const [liveLoading,setLiveLoading]=useState(false);
  const [profiles,setProfiles]=useState<Profile[]>([]);

  const [attendances,setAttendances]=useState<Attendance[]>([]);
  const [tableSeats,setTableSeats]=useState<TableSeat[]>([]);
  const [polls,setPolls]=useState<Poll[]>([]);
  const [choices,setChoices]=useState<Choice[]>([]);
  const [votes,setVotes]=useState<Vote[]>([]);
  const [buys,setBuys]=useState<Buy[]>([]);
  const [chipItems,setChipItems]=useState<BuyItem[]>([]);
  const [results,setResults]=useState<ChipResult[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [expenseMembers,setExpenseMembers]=useState<{expense_id:string;session_id:string;user_id:string;joined_at:string}[]>([]);
  const [expenseShares,setExpenseShares]=useState<ExpenseSplitRow[]>([]);
  const [settlements,setSettlements]=useState<ExpenseSettlement[]>([]);
  const [mySplits,setMySplits]=useState<MyExpenseSplitRow[]>([]);
  const [pendingReconfirmEventId,setPendingReconfirmEventId]=useState<string|undefined>();
  const [ranking,setRanking]=useState<Rank[]>([]);
  const [approvals,setApprovals]=useState<{session_id:string;user_id:string;reviewed_at:string}[]>([]);
  const [eventFilter,setEventFilter]=useState<EventFilter>("abertos");
  const [form,setForm]=useState<CreateEvent>(defaultEvent);
  const ownLeagues=leagueCatalog.filter(item=>!item.finished_at&&(isAdmin||item.my_role==="owner"||item.my_role==="organizer"));
  const liveSubtab=detailTab==="conferencia"?"encerrar":"compra";
  const [showPastPolls,setShowPastPolls]=useState(false);
  const [cashoutFor,setCashoutFor]=useState("");
  const [cashoutDraft,setCashoutDraft]=useState("");
  const [purchaseFor,setPurchaseFor]=useState("");
  useEffect(()=>{setPurchaseFor("");setCashoutFor("");setCashoutDraft("")},[selectedId]);
  const [finalItems,setFinalItems]=useState<{session_id:string;user_id:string;chip_value:number;quantity:number}[]>([]);
  const [chipCashouts,setChipCashouts]=useState<{session_id:string;user_id:string;final_brl:number;updated_at:string}[]>([]);
  const [chipPayouts,setChipPayouts]=useState<{session_id:string;user_id:string;confirmed_at:string}[]>([]);

  const photoUrls=useProfilePhotos(profiles);
  const loadCatalog=useCallback(async(older=false)=>{
    const requestedId=context.current.selectedId;
    const key=String(older)+":"+requestedId;
    const existing=catalogFlight.current.get(key);if(existing)return existing;
    const task=(async()=>{
      const db=getSupabase();if(!db)throw new Error("Conexão indisponível.");
      const cursor=older?historyCursor.current:null;
      const {data,error:readError}=await db.rpc("get_club_catalog",{
        p_before:cursor?.at||null,p_before_id:cursor?.id||null,p_event_id:requestedId||null
      });
      if(readError)throw new Error(readError.message);
      if(context.current.selectedId!==requestedId)return;
      const value=data as Catalog;
      setRooms(value.rooms);setHiddenEvents(value.hidden);setAdminFinance(value.admin_finance);
      setEvents(previous=>older?[...new Map([...previous,...value.events].map(e=>[e.id,e])).values()]:value.events);
      setAttendances(previous=>older?[...new Map([...previous,...value.attendance].map(a=>[a.session_id+":"+a.user_id,a])).values()]:value.attendance);
      setProfiles(previous=>[...new Map([...previous,...value.profiles].map(p=>[p.id,p])).values()]);
      setLiveStates(value.live);setHistoryMore(value.history_more);historyCursor.current=value.history_cursor;
    })();
    catalogFlight.current.set(key,task);
    try{await task}finally{if(catalogFlight.current.get(key)===task)catalogFlight.current.delete(key);}
  },[]);
  const loadPersonalSplits=useCallback(async()=>{
    const db=getSupabase();if(!db)return;
    const {data,error:readError}=await db.rpc("get_my_splits_snapshot");
    if(readError)throw new Error(readError.message);
    setMySplits((data?.shares||[]) as MyExpenseSplitRow[]);
    setSettlements((data?.settlements||[]) as ExpenseSettlement[]);
  },[]);
  const loadEvent=useCallback(async(id:string)=>{
    const existing=eventFlights.current.get(id);if(existing)return existing;
    const task=(async()=>{
      const db=getSupabase();if(!db)throw new Error("Conexão indisponível.");
      const {data,error:readError}=await db.rpc("get_event_snapshot",{p_event_id:id});
      if(readError)throw new Error(readError.message);
      if(context.current.selectedId!==id)return;
      const v=data as EventSnapshot;
      const merge=<T extends {session_id:string}>(prev:T[],next:T[])=>[...prev.filter(x=>x.session_id!==id),...next];
      setAttendances(prev=>merge(prev,v.attendance));
      setProfiles(prev=>[...new Map([...prev,...v.profiles].map(p=>[p.id,p])).values()]);
      setPolls(v.polls);setChoices(v.choices);setVotes(v.votes);setChipItems(v.items);
      setBuys(prev=>merge(prev,v.buys));setResults(prev=>merge(prev,v.results));
      setExpenses(prev=>merge(prev,v.expenses));setExpenseMembers(prev=>merge(prev,v.members));
      setSettlements(prev=>merge(prev,v.settlements));setApprovals(prev=>merge(prev,v.approvals));
      setFinalItems(prev=>merge(prev,v.finals));setChipCashouts(prev=>merge(prev,v.cashouts));
      setChipPayouts(prev=>merge(prev,v.payouts));setTableSeats(prev=>merge(prev,v.seats));
      setLiveStates(prev=>merge(prev,v.live));setLiveActivities(v.timeline);
      setFinanceRows(v.finance);setExpenseShares(v.shares);
    })();
    eventFlights.current.set(id,task);
    try{await task}finally{if(eventFlights.current.get(id)===task)eventFlights.current.delete(id);}
  },[]);
  const loadProfileStats=useCallback(async()=>{
    if(profileFlight.current)return profileFlight.current;
    const task=(async()=>{
      const db=getSupabase();if(!db)return;
      const {data,error}=await db.rpc("get_player_stats_v2",{p_game:null});
      if(error)throw new Error(error.message);
      setRanking((data||[]) as Rank[]);
    })();
    profileFlight.current=task;
    try{await task}finally{if(profileFlight.current===task)profileFlight.current=null}
  },[]);
  const loadAdminAudits=useCallback(async()=>{
    const db=getSupabase();if(!db)return;
    const {data,error}=await db.from("event_admin_audit").select("*").order("occurred_at",{ascending:false}).limit(30);
    if(error)throw new Error(error.message);setAdminAudits(data||[]);
  },[]);
  const reload=useCallback(async(_mode:"full"|"list"="full")=>{
    await Promise.all([loadCatalog(),loadPersonalSplits()]);
    if((context.current.page==="detalhe"||context.current.page==="editar-evento")&&context.current.selectedId)await loadEvent(context.current.selectedId);
    if(context.current.page==="perfil")await loadProfileStats();
    if(context.current.page==="admin")await loadAdminAudits();
  },[loadCatalog,loadPersonalSplits,loadEvent,loadProfileStats,loadAdminAudits]);

  // O layout de (app) fica montado entre rotas: URL, voltar/avançar e
  // atualização de página reproduzem a mesma tela sem recarregar a SPA.
  useEffect(()=>{
    const sync=()=>{
      hydratingRoute.current=true;
      const state=readClubRoute(window.location.pathname,window.location.search);
      if(firstRoute.current){if(state.page==="detalhe"&&(/^\/eventos\/[0-9a-f-]{36}\/?$/i.test(window.location.pathname)||window.location.pathname==="/painel"))autoEvent.current=state.selectedId;firstRoute.current=false;}
      setPage(state.page);setSelectedId(state.selectedId);setSelectedLeagueId(state.leagueId);
      setDetailTab(state.detailTab);setGameView(state.gameView);setGameTab(state.gameTab);setGameVariant(state.gameVariant||"");
      setProfileId(state.profileId);setProfileTab(state.profileTab);setLeagueTab(state.leagueTab);setCreatorStep(state.creatorStep);setEventFilter(state.eventFilter);
      setRouteReady(true);
    };
    sync();
    window.addEventListener("popstate",sync);
    return()=>window.removeEventListener("popstate",sync);
  },[]);

  useEffect(()=>{
    if(!routeReady)return;
    const next=clubHref(page,selectedId,detailTab,gameView,gameTab,selectedLeagueId,{profileId:profileId&&profileId!==user?.id?profileId:"",profileTab,leagueTab,creatorStep,eventFilter,gameVariant});
    const now=window.location.pathname+window.location.search;
    if(next!==now){
      const canonical=hydratingRoute.current||replaceRoute.current||/\/(ao-vivo|resumo)$/.test(window.location.pathname)||window.location.pathname==="/ranking"||page==="perfil"&&profileId===user?.id&&window.location.pathname.startsWith("/jogadores/");
      if(canonical)window.history.replaceState(window.history.state,"",next);else window.history.pushState({mesaMarcada:true,from:now},"",next);
    }
    hydratingRoute.current=false;replaceRoute.current=false;
  },[routeReady,page,selectedId,detailTab,gameView,gameTab,selectedLeagueId,profileId,profileTab,leagueTab,creatorStep,eventFilter,gameVariant,user?.id]);

  useEffect(()=>{
    if(!routeReady)return;
    const frame=requestAnimationFrame(()=>{const heading=document.querySelector<HTMLElement>("#main-content h1");if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}});
    return()=>cancelAnimationFrame(frame);
  },[routeReady,page,detailTab,profileTab,leagueTab,creatorStep]);

  // Concurrent scopes share one catalog request and one event snapshot.
  const refreshScope=useCallback(async(scope:UpdateScope)=>{
    if(scope==="catalog")return loadCatalog();
    if(scope==="profiles"){
      await loadCatalog();
      if(context.current.page==="perfil"&&context.current.profileId){
        const db=getSupabase();if(!db)return;
        const {data,error}=await db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path").eq("id",context.current.profileId).maybeSingle();
        if(error)throw new Error(error.message);
        if(data)setProfiles(prev=>[...prev.filter(p=>p.id!==data.id),data as Profile]);
      }
      return;
    }
    if(context.current.selectedId)await loadEvent(context.current.selectedId);
    if(scope==="expenses")await loadPersonalSplits();
  },[loadCatalog,loadEvent,loadPersonalSplits]);

  const connection=useClubRealtime({enabled:Boolean(user),eventId:page==="detalhe"||page==="editar-evento"?selectedId:"",onRefresh:refreshScope});

  useEffect(()=>{
    let alive=true;
    const db=getSupabase();
    if(!db){setError("Não foi possível conectar ao sistema. Contate o administrador.");setLoading(false);return;}
    void(async()=>{
      try{
        const {data,error:authError}=await db.auth.getUser();
        if(authError||!data.user){
          const target=window.location.pathname+window.location.search;
          window.location.replace("/login?next="+encodeURIComponent(target));return;
        }
        if(!alive)return;
        setUser({id:data.user.id,email:data.user.email});
        const {data:adminRow}=await db.from("app_admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
        if(alive)setIsAdmin(Boolean(adminRow));
        const entry=readClubRoute(window.location.pathname,window.location.search);
        const lean=["inicio","eventos","mesas","mesa","ligas","liga","liga-admin"].includes(entry.page);
        await reload(lean?"list":"full");
      }catch(e){if(alive)setError(errText(e));}
      finally{if(alive)setLoading(false);}
    })();
    const {data:{subscription}}=db.auth.onAuthStateChange(e=>{if(e==="SIGNED_OUT")window.location.replace("/login")});
    return()=>{alive=false;subscription.unsubscribe()};
  },[reload]);

  // Compatibilidade com convites anteriores a v2: /painel?evento=UUID.
  useEffect(()=>{
    if(!user||!routeReady)return;
    const id=new URLSearchParams(window.location.search).get("evento");
    if(!id||!events.length||window.location.pathname!=="/painel")return;
    if(events.some(e=>e.id===id&&!hiddenEvents.some(h=>h.session_id===id))){
      setSelectedId(id);setDetailTab("visao");setPage("detalhe");
    }else setError("Evento não encontrado. Verifique o link compartilhado.");
  },[user,routeReady,events,hiddenEvents]);

  useEffect(()=>{
    if(!user||!routeReady)return;
    let active=true;
    setDetailLoading(true);
    const task=(page==="detalhe"||page==="editar-evento")&&selectedId?(events.some(e=>e.id===selectedId)?loadEvent(selectedId):loadCatalog().then(()=>loadEvent(selectedId))):
      page==="perfil"?loadProfileStats():page==="admin"?loadAdminAudits():Promise.resolve();
    void task.catch(e=>{if(active)setError("Não foi possível carregar esta área: "+errText(e))})
      .finally(()=>{if(active)setDetailLoading(false)});
    return()=>{active=false};
  },[user,routeReady,page,selectedId,loadEvent,loadCatalog,loadProfileStats,loadAdminAudits,events.some(e=>e.id===selectedId)]);

  useEffect(()=>{
    const id=profileId||user?.id;if(page!=="perfil"||!id)return;
    const db=getSupabase();if(!db)return;let active=true;
    void db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path").eq("id",id).maybeSingle().then(({data,error})=>{
      if(active&&data&&!error)setProfiles(prev=>[...prev.filter(p=>p.id!==id),data as Profile]);
    });
    return()=>{active=false};
  },[page,profileId,user?.id]);

  const refreshLive=useCallback(async(showLoading=false)=>{
    if(!selectedId||!user)return;
    if(showLoading)setLiveLoading(true);
    try{await loadEvent(selectedId)}finally{if(showLoading)setLiveLoading(false)}
  },[selectedId,user,loadEvent]);

  async function manageAdminEvent(eventId:string,action:"hide"|"restore"|"cancel"|"finish"){
    const messages:Record<string,string>={
      hide:"Excluir este evento da agenda? A operação é reversível e mantém os registros.",
      restore:"Restaurar este evento na agenda?",
      cancel:"Cancelar este evento? Os registros serão preservados.",
      finish:"Encerrar este evento? Todos os resultados e pagamentos precisam estar revisados."
    };
    if(!window.confirm(messages[action]))return;
    await act(async db=>{
      const {error:adminError}=await db.rpc("admin_manage_event",{p_event_id:eventId,p_action:action});
      if(adminError)throw adminError;
    },action==="hide"?"Evento excluído da agenda.":"Alteração administrativa registrada.");
  }

  // Notificações opcionais: envio autorizado pelo servidor e protegido por JWT.
  async function sendEventPush(eventId:string,kind:"event"|"poll"|"live"|"summary"|"edit"|"invited"){
    try{
      const db=getSupabase();if(!db)return;
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)return;
      await fetch("/api/push/notify",{
        method:"POST",headers:{"Content-Type":"application/json",
          Authorization:"Bearer "+session.access_token},
        body:JSON.stringify({eventId,kind})
      });
    }catch{/* A falha do push não cancela uma operação bem-sucedida. */}
  }

  async function startLiveEvent(eventId:string){
    if(!window.confirm("Iniciar a partida com os participantes confirmados? Os assentos ficam bloqueados até o encerramento."))return;
    const db=getSupabase();
    if(!db||!user)return;
    setWorking(true);setMessage("");setError("");
    try{
      const {error:startError}=await db.rpc("start_live_event",{p_event_id:eventId});
      if(startError)throw startError;
      void sendEventPush(eventId,"live");
      const updates=await Promise.allSettled([refreshScope("chips"),refreshScope("catalog")]);
      setDetailTab("ao-vivo");
      setMessage("Evento ao Vivo iniciado!"+(updates.some(r=>r.status==="rejected")?" A atualização da tela está pendente.":" Os registros da mesa aparecem na linha do tempo."));
    }catch(e){setError(errText(e));}
    finally{setWorking(false);}
  }

  async function finishLiveEvent(eventId:string,isHost:boolean){
    if(!window.confirm("Encerrar a partida e abrir o Resumo da noite? Confira se o valor final de todos os jogadores soma o total comprado."))return;
    const db=getSupabase();
    if(!db)return;
    setWorking(true);setError("");setMessage("");
    try{
      const {error:finishError}=isHost
        ?await db.from("sessions").update({status:"finished"}).eq("id",eventId)
        :await db.rpc("admin_manage_event",{p_event_id:eventId,p_action:"finish"});
      if(finishError)throw finishError;
      void sendEventPush(eventId,"summary");
      const updates=await Promise.allSettled([refreshScope("chips"),refreshScope("catalog")]);
      setDetailTab("resumo-evento");
      setMessage("Partida encerrada!"+(updates.some(r=>r.status==="rejected")?" A atualização da tela está pendente.":" Resumo da noite disponível."));
      window.scrollTo({top:0,behavior:"auto"});
    }catch(e){setError(errText(e));}finally{setWorking(false);}
  }

  async function act(fn:(db:SupabaseClient,id:string)=>Promise<void>,success:string,
                     scope?:UpdateScope|UpdateScope[]){
    const db=getSupabase();
    if(!db||!user)return false;
    setWorking(true);setMessage("");setError("");
    try{
      await fn(db,user.id);
      setMessage(success);
      try{
        if(scope)await Promise.all((Array.isArray(scope)?scope:[scope]).map(item=>refreshScope(item)));
        else await reload();
      }catch{setMessage(success+" A atualização da tela está pendente.");}
      return true;
    }catch(e){setError(errText(e));return false;}
    finally{setWorking(false);}
  }

  const nameFor=(id:string)=>profiles.find(p=>p.id===id)?.display_name||"Jogador";
  const roomFor=(id:string)=>rooms.find(r=>r.id===id);
  const roomTitle=(id:string)=>roomFor(id)?.name||"Mesa";
  const nickname=user?nameFor(user.id):"Jogador";
  const ownProfile=profiles.find(p=>p.id===user?.id);
  const firstName=nickname.split(" ")[0];
  const activeRooms=ALL_GAMES.map(g=>rooms.find(r=>r.game===g&&r.status==="active")).filter((r):r is Room=>Boolean(r));
  // A RLS oculta eventos excluídos dos usuários comuns, mas Admin os recebe
  // para restauração. Apenas a Administração utiliza a lista completa.
  const hiddenEventIds=new Set(hiddenEvents.map(h=>h.session_id));
  const agendaEvents=events.filter(e=>!hiddenEventIds.has(e.id));
  // Evita apresentar eventos históricos ou excluídos como "Sua próxima noite".
  const upcoming=agendaEvents.filter(e=>e.status==="scheduled"&&new Date(e.starts_at).getTime()>=Date.now())
    .filter(e=>!liveStates.some(l=>l.session_id===e.id))
    .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  const activeEvents=agendaEvents.filter(e=>e.status==="scheduled"&&liveStates.some(l=>l.session_id===e.id)&&(e.organizer_id===user?.id||attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id)));
  const lastNight=agendaEvents.filter(e=>e.status==="finished"&&(e.organizer_id===user?.id||attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id)))
    .sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at))[0]||null;
  const waitingEvents=agendaEvents.filter(e=>e.status==="scheduled"&&!liveStates.some(l=>l.session_id===e.id)&&Date.parse(e.starts_at)<Date.now()&&(e.organizer_id===user?.id||attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id)));
  const myUpcoming=upcoming.filter(e=>attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id));
  useEffect(()=>{
    const uid=user?.id;
    if(!uid)return;
    const db=getSupabase();if(!db)return;
    let alive=true;
    async function refreshPending(){
      const {data}=await db!.from("event_reconfirmations")
        .select("event_id").eq("user_id",uid).eq("status","pending")
        .order("changed_at",{ascending:false}).limit(30);
      if(alive)setPendingReconfirmEventId((data||[]).find(r=>upcoming.some(ev=>ev.id===r.event_id))?.event_id);
    }
    void refreshPending();
    const focus=()=>{if(document.visibilityState==="visible")void refreshPending()};
    document.addEventListener("visibilitychange",focus);
    const timer=window.setInterval(focus,45000);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener("visibilitychange",focus)};
  },[user?.id,upcoming.map(e=>e.id+e.starts_at).join(",")]);
  const selected=events.find(e=>e.id===selectedId);
  const selectedLive=liveStates.find(l=>l.session_id===selectedId);
  const eventLiveActivities=liveActivities.filter(a=>a.session_id===selectedId);
  const guests=selected?attendances.filter(a=>a.session_id===selected.id):[];
  const selectedGame:Game=selected?(roomFor(selected.room_id)?.game||"poker"):"poker";
  const selectedPoints=!isChipGame(selectedGame);
  useEffect(()=>{
    if(loading||detailLoading||page!=="detalhe"||!selected||autoEvent.current!==selected.id)return;
    autoEvent.current=null;const destination=eventDestination(selected,Boolean(selectedLive));
    if(destination!==detailTab){replaceRoute.current=true;setDetailTab(destination)}
  },[loading,detailLoading,page,selected?.id,selected?.status,Boolean(selectedLive),detailTab]);
  const seatedGuests=selected?tableSeats.filter(st=>st.session_id===selected.id):[];
  const blackjackDealerReady=selectedGame!=="blackjack"||seatedGuests.some(st=>st.seat_no===0);
  const meConfirmed=Boolean(user&&guests.some(a=>a.user_id===user.id));
  const organizer=Boolean(user&&selected?.organizer_id===user.id);
  const privateVisible=meConfirmed||organizer||isAdmin;
  useEffect(()=>{
    if(page!=="editar-evento"||!selected||editSeedId===selected.id)return;
    setForm(eventDraftFromEvent(selected,selectedGame));setEditSeedId(selected.id);
  },[page,selected,editSeedId,selectedGame]);
  const eventBuys=selected?buys.filter(b=>b.session_id===selected.id):[];
  const eventFinalItems=selected?finalItems.filter(f=>f.session_id===selected.id):[];
  const eventCashouts=selected?chipCashouts.filter(c=>c.session_id===selected.id):[];
  const eventPayouts=selected?chipPayouts.filter(p=>p.session_id===selected.id):[];
  const chipValues=[1,5,10,25,50] as const;
  const chipPrices=selected?[selected.chip_price_1_brl,selected.chip_price_5_brl,selected.chip_price_10_brl,selected.chip_price_25_brl,selected.chip_price_50_brl]:[1,5,0.1,0.25,0.5];
  const soldByDenom=chipValues.map(value=>chipItems.filter(i=>i.chip_value===value&&eventBuys.some(b=>b.id===i.purchase_id)).reduce((sum,i)=>sum+i.quantity,0));
  const finishedByDenom=chipValues.map(value=>eventFinalItems.filter(i=>i.chip_value===value).reduce((sum,i)=>sum+i.quantity,0));
  const stockBalanced=soldByDenom.every((n,i)=>n===finishedByDenom[i])&&eventBuys.length>0&&guests.every(g=>eventFinalItems.some(x=>x.user_id===g.user_id));
  const totalBoughtBRL=eventBuys.reduce((n,b)=>n+Number(b.amount_brl),0);
  const totalFinalBRL=eventCashouts.reduce((n,c)=>n+Number(c.final_brl),0);
  const cashBalanced=eventBuys.length>0&&guests.length>0&&guests.every(g=>eventCashouts.some(c=>c.user_id===g.user_id))
    &&eventCashouts.every(c=>guests.some(g=>g.user_id===c.user_id))
    &&Math.round(totalFinalBRL*100)===Math.round(totalBoughtBRL*100);
  const cashoutTarget=(organizer||isAdmin)?(cashoutFor||(guests.some(g=>g.user_id===user?.id)?user?.id:guests[0]?.user_id)):(user?.id);
  const buyingTarget=(organizer||isAdmin)?(purchaseFor||(guests.some(g=>g.user_id===user?.id)?user?.id:guests[0]?.user_id)):(user?.id);
  const playerSettlement=(id:string)=>{
    const purchased=eventBuys.filter(b=>b.user_id===id).reduce((n,b)=>n+Number(b.amount_brl),0);
    const returned=selected?.chip_settlement_brl
      ?Number(eventCashouts.find(c=>c.user_id===id)?.final_brl||0)
      :eventFinalItems.filter(f=>f.user_id===id).reduce((n,f)=>n+f.quantity*Number(chipPrices[chipValues.indexOf(f.chip_value as (typeof chipValues)[number])]||0),0);
    return {purchased,returned,net:returned-purchased};
  };
  const unpaid=eventBuys.filter(b=>b.payment_status!=="paid");
  const myPurchasedTotal=eventBuys.filter(b=>b.user_id===buyingTarget).reduce((total,b)=>total+Number(b.amount_brl),0);
  const minToComplete=Math.max(0,Number(selected?.min_entry_brl||0)-myPurchasedTotal);
  const pendingByUser=Object.fromEntries(guests.map(a=>[a.user_id,eventBuys.filter(b=>b.user_id===a.user_id&&b.payment_status!=="paid").length]));
  const canFinish=(!selected?.live_start_required||Boolean(selectedLive))&&(
    selected?.chip_settlement_brl
      ?cashBalanced
      :(selected?.chip_stock_legacy!==false||(stockBalanced&&guests.every(g=>{const p=playerSettlement(g.user_id);return p.returned===0||eventPayouts.some(x=>x.user_id===g.user_id)})))
         &&guests.length>0&&financeRows.length===guests.length
         &&financeRows.every(r=>r.approved&&r.chips_bought!==null&&r.chips_final!==null)
  );
  const checkedCount=selected?.chip_settlement_brl?guests.filter(g=>eventCashouts.some(c=>c.user_id===g.user_id)).length:
    financeRows.filter(r=>r.approved&&r.chips_bought!==null&&r.chips_final!==null).length;
  const paidCount=eventBuys.filter(b=>b.payment_status==="paid").length;
  const eventResults=selected?results.filter(r=>r.session_id===selected.id):[];
  const eventExpenses=selected?expenses.filter(e=>e.session_id===selected.id):[];
  const eventPolls=selected?polls.filter(p=>p.session_id===selected.id):[];
  const openPolls=eventPolls.filter(p=>!p.is_closed);
  const eventExpenseShares=selected?expenseShares.filter(sh=>sh.session_id===selected.id):[];
  const nightRank=useMemo(()=>{
    if(!selected)return [];
    return guests.map(g=>{
      const acquired=buys.filter(b=>b.session_id===selected.id&&b.user_id===g.user_id).reduce((sum,b)=>sum+Number(b.chips_received),0);
      const found=results.find(r=>r.session_id===selected.id&&r.user_id===g.user_id);
      const total=found?Number(found.chips_final):null;
      return {id:g.user_id,acquired,total,difference:total===null?null:total-acquired};
    }).sort((a,b)=>(b.difference??-Infinity)-(a.difference??-Infinity));
  },[guests,buys,results,selected]);

  async function uploadProfilePhoto(original:File):Promise<void>{
    const db=getSupabase();
    if(!db||!user)throw new Error("Entre novamente na sua conta para enviar a foto.");
    const photo=await prepareProfilePhoto(original);
    const path=user.id+"/"+photo.name;
    const previous=profiles.find(profile=>profile.id===user.id)?.avatar_path;
    setWorking(true);
    try{
      const {error:uploadError}=await db.storage.from("player-avatars").upload(path,photo,{
        cacheControl:"3600",upsert:false,contentType:photo.type
      });
      if(uploadError)throw uploadError;
      const {error:updateError}=await db.from("profiles").update({avatar_path:path}).eq("id",user.id);
      if(updateError){
        await db.storage.from("player-avatars").remove([path]);
        throw updateError;
      }
      await reload();
      if(previous&&previous!==path){
        void db.storage.from("player-avatars").remove([previous]);
      }
    }finally{setWorking(false);}
  }

  async function removeProfilePhoto():Promise<void>{
    const db=getSupabase();
    if(!db||!user)throw new Error("Entre novamente para remover a foto.");
    const previous=profiles.find(profile=>profile.id===user.id)?.avatar_path;
    setWorking(true);
    try{
      const {error:updateError}=await db.from("profiles").update({avatar_path:null}).eq("id",user.id);
      if(updateError)throw updateError;
      await reload();
      if(previous)void db.storage.from("player-avatars").remove([previous]);
    }finally{setWorking(false);}
  }

  async function afterSaved(scope:UpdateScope,success:string){
    setMessage(success);
    try{await refreshScope(scope)}catch{setMessage(success+" A atualização da tela está pendente; não repita o lançamento.");}
  }
  async function recordPurchase(quantities:number[],forUser?:string):Promise<boolean>{
    const db=getSupabase();if(!db||!user||!selected)return false;
    setWorking(true);setError("");setMessage("");
    try{
      await runMutation(db,user.id,"record_chip_purchase_once",{
        p_event_id:selected.id,p_quantities:quantities,
        p_user_id:organizer||isAdmin?(forUser||purchaseFor||guests[0]?.user_id||user.id):user.id
      });
      await afterSaved("chips","Compra registrada!");return true;
    }catch(e){setError(errText(e));return false}finally{setWorking(false)}
  }

  function openEvent(id:string,sub?:DetailTab,adminAccess=false){
    if(hiddenEvents.some(h=>h.session_id===id)&&!(adminAccess&&isAdmin)){setError("Este evento foi excluído da agenda pelo administrador.");return}
    const event=events.find(ev=>ev.id===id),live=liveStates.some(l=>l.session_id===id);
    autoEvent.current=sub?null:id;
    setSelectedId(id);setLiveActivities([]);setPurchaseFor("");setCashoutFor("");setCashoutDraft("");
    setDetailTab(sub==="fichas"?"ao-vivo":sub==="assentos"?"visao":sub||eventDestination(event||{status:"scheduled"},live));
    setShowPastPolls(false);setPage("detalhe");setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
  }
  function goBack(fallback:()=>void){
    if(window.history.state?.mesaMarcada&&typeof window.history.state.from==="string")window.history.back();else fallback();
  }
  function openLeague(id:string,manage=false,section:LeagueTab="eventos"){
    setSelectedLeagueId(id);setLeagueTab(section);setPage(manage?"liga-admin":"liga");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function go(next:View){
    if(next==="perfil")setProfileTab("resumo");
    setPage(next);setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
  }
  function openGame(game:Game,tab:"eventos"|"tutorial"="eventos",variant=""){
    setGameView(game);setGameTab(tab);setGameVariant(variant);setPage("mesa");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function cancelEventFromHome(event:Event){
    if(!window.confirm("Cancelar \""+event.title+"\"? Os registros e o histórico serão preservados."))return;
    void act(async(db,id)=>{
      const {error:cancelError}=await db.from("sessions").update({status:"cancelled"}).eq("id",event.id).eq("organizer_id",id);
      if(cancelError)throw cancelError;
    },"Evento cancelado. O histórico foi mantido.");
  }
  function openEditor(event:Event){
    setRepeatSource("");setRepeatSourceId("");setSelectedId(event.id);setForm(eventDraftFromEvent(event,roomFor(event.room_id)?.game));setEditSeedId(event.id);setCreatorStep(1);setCreatorEpoch(n=>n+1);go("editar-evento");
  }
  function openCreator(roomId?:string,leagueId=""){
    setRepeatSource("");setRepeatSourceId("");
    const room=roomId?activeRooms.find(r=>r.id===roomId):undefined;
    setForm({...defaultEvent,...(room?{game_variant:defaultVariant(room.game)||"",score_target:String(defaultTarget(room.game,defaultVariant(room.game))),room_id:room.id,max_participants:String(GAME_META[room.game].capacity)}:{}),league_id:leagueId,visibility:leagueId?"private":"public"});
    setCreatorStep(1);setCreatorEpoch(n=>n+1);go("criar-evento");
  }
  async function openRematch(event:Event){
    if(working)return;setWorking(true);setError("");
    try{
      const game=roomFor(event.room_id)?.game;
      const room=activeRooms.find(r=>r.game===game);
      if(!game||!room)throw new Error("Esta mesa não está disponível para um novo evento.");
      const db=getSupabase();if(!db)throw new Error("Conexão indisponível.");
      const {data,error}=await db.rpc("get_league_catalog_final");if(error)throw error;
      const leagues=(data||[]) as League[];setLeagueCatalog(leagues);
      const allowed=leagues.filter(l=>!l.finished_at&&(isAdmin||l.my_role==="owner"||l.my_role==="organizer")).map(l=>l.id);
      const form={...rematchForm(event,game,allowed),starts_at:nextWeeklySlot(event.starts_at)};setForm({...form,room_id:room.id});
      try{sessionStorage.setItem(eventDraftKey(user!.id),JSON.stringify({version:1,form:{...form,room_id:room.id},step:1}))}catch{}
      setRepeatSource(event.title);setRepeatSourceId(event.status==="finished"?event.id:"");setCreatorStep(1);setCreatorEpoch(n=>n+1);go("criar-evento");
      setMessage(event.league_id&&!form.league_id?"A liga de origem não está disponível para você organizar. O novo encontro será independente; você pode escolher outra liga.":"");
    }catch(e){setError(errText(e))}finally{setWorking(false)}
  }
  useEffect(()=>{
    if(!user||(page!=="criar-evento"&&page!=="editar-evento"))return;
    const db=getSupabase();if(!db)return;
    void db.rpc("get_league_catalog_final").then(({data,error})=>{
      if(!error)setLeagueCatalog((data||[]) as League[]);
    });
  },[user,page]);
  async function addEvent(form:CreateEvent):Promise<boolean>{
    const issue=validateEventDraft(form,activeRooms);if(issue){setError(issue.message);return false}
    return act(async(db,id)=>{
      const room=activeRooms.find(r=>r.id===form.room_id);
      if(!room)throw new Error("Selecione uma modalidade para criar o evento.");
      if(!form.starts_at)throw new Error("Informe data e horário.");
      if(Number(form.max_participants)>10||Number(form.max_participants)<2)throw new Error("A mesa admite de 2 a 10 participantes.");
       const {data,error:eventError}=await db.from("sessions").insert({
        room_id:room.id,organizer_id:id,title:form.name.trim(),
        starts_at:new Date(form.starts_at).toISOString(),location:form.location.trim(),
        min_entry_brl:isChipGame(room.game)?Number(form.min_entry_brl):0,max_participants:Number(form.max_participants),
         visibility:form.league_id?"private":form.visibility,
        league_id:form.league_id||null,game_variant:room.game==="blackjack"?null:form.game_variant,score_target:isChipGame(room.game)?null:Number(form.score_target),
        chip_pricing_special:isChipGame(room.game)&&form.chip_pricing_special,
        chip_price_1_brl:form.chip_pricing_special?Number(form.chip_price_1_brl):1,
        chip_price_5_brl:form.chip_pricing_special?Number(form.chip_price_5_brl):5,
        chip_price_10_brl:form.chip_pricing_special?Number(form.chip_price_10_brl):0.10,
        chip_price_25_brl:form.chip_pricing_special?Number(form.chip_price_25_brl):0.25,
        chip_price_50_brl:form.chip_pricing_special?Number(form.chip_price_50_brl):0.50
      }).select("id").single();
      if(eventError)throw eventError;
      openEvent(data.id,"visao");
      if(form.visibility==="public"&&!form.league_id)void sendEventPush(data.id,"event");
      if(repeatSourceId){
        const source=repeatSourceId;setRepeatSourceId("");
        const {data:invited,error:inviteError}=await db.rpc("invite_previous_players",{p_event_id:data.id,p_source_event_id:source});
        if(!inviteError&&Number(invited)>0)void sendEventPush(data.id,"invited");
      }
    },"Evento criado! Escolham uma cadeira para participar.");
  }

  async function editEvent(form:CreateEvent):Promise<boolean>{
    const event=selected;
    if(!event){setError("Selecione um evento para editar.");return false}
    const issue=validateEventDraft(form,activeRooms);if(issue){setError(issue.message);return false}
    return act(async db=>{
      if(!form.starts_at)throw new Error("Informe data e horário.");
      const {error:editError}=await db.rpc("edit_event_details",{
        p_event_id:event.id,p_title:form.name.trim(),
        p_starts_at:new Date(form.starts_at).toISOString(),
        p_location:form.location.trim(),p_min_entry_brl:Number(form.min_entry_brl),
        p_max_participants:Number(form.max_participants),
        p_chip_pricing_special:form.chip_pricing_special,
        p_chip_price_1_brl:form.chip_pricing_special?Number(form.chip_price_1_brl):1,
        p_chip_price_5_brl:form.chip_pricing_special?Number(form.chip_price_5_brl):5,
        p_chip_price_10_brl:form.chip_pricing_special?Number(form.chip_price_10_brl):0.10,
        p_chip_price_25_brl:form.chip_pricing_special?Number(form.chip_price_25_brl):0.25,
        p_chip_price_50_brl:form.chip_pricing_special?Number(form.chip_price_50_brl):0.50
      });
      if(editError)throw editError;
      openEvent(event.id,"visao");
      void sendEventPush(event.id,"edit");
    },"Evento atualizado! Os participantes serão avisados das alterações.",["catalog","presence"]);
  }
  async function chooseSeat(seatNo:number|null){
    if(!selected)return;
    await act(async db=>{
      const {error:seatError}=await db.rpc("choose_table_seat",{p_event_id:selected.id,p_seat_no:seatNo});
      if(seatError)throw seatError;
    },seatNo===null?"Você saiu da mesa.":seatNo===0?"Você assumiu o crupiê e entrou no evento.":"Você entrou no evento! Assento reservado.",["presence","catalog"]);
  }

  async function createExpense(details:{label:string;amount:number;category:string;paidBy:string}):Promise<void>{
    if(!selected||!user)throw new Error("Selecione um evento e entre na sua conta.");
    if(!meConfirmed||selected.status!=="scheduled")throw new Error("É necessário participar de um evento agendado para registrar despesas.");
    const db=getSupabase();if(!db)throw new Error("Não foi possível conectar ao Supabase.");
    if(details.label.trim().length<2||!Number.isFinite(details.amount)||details.amount<=0)
      throw new Error("Confira a descrição e o valor da despesa.");
    const payer=organizer&&guests.some(g=>g.user_id===details.paidBy)?details.paidBy:user.id;
    setWorking(true);setError("");setMessage("");
    try{
      await runMutation(db,user.id,"create_expense_once",{
        p_event_id:selected.id,p_label:details.label.trim(),p_amount:details.amount,p_category:details.category,p_paid_by:payer
      });
      await afterSaved("expenses","Despesa registrada!");
    }catch(e){
      const description=errText(e);setError(description);throw new Error(description);
    }finally{setWorking(false);}
  }

  async function createPoll(question:string,labels:string[]):Promise<void>{
    if(!selected||!user)throw new Error("Selecione um evento e entre na sua conta.");
    if(!meConfirmed||selected.status!=="scheduled")throw new Error("É necessário participar de um evento agendado para criar enquetes.");
    const db=getSupabase();if(!db)throw new Error("Não foi possível conectar ao Supabase.");
    if(question.trim().length<2||question.trim().length>200)throw new Error("Informe uma pergunta válida.");
    if(labels.length<2||labels.length>41)throw new Error("Adicione entre 2 e 41 opções.");
    if(labels.some(label=>!label.trim()||label.length>80))throw new Error("Cada opção deve ter de 1 a 80 caracteres.");
    if(new Set(labels.map(label=>label.toLocaleLowerCase("pt-BR"))).size!==labels.length)throw new Error("Não é permitido repetir opções.");
    setWorking(true);setError("");setMessage("");
    try{
      await runMutation(db,user.id,"create_poll_once",{p_event_id:selected.id,p_question:question.trim(),p_options:labels});
      await afterSaved("polls","Enquete criada!");
      void sendEventPush(selected.id,"poll");
    }catch(e){
      const description=errText(e);setError(description);throw new Error(description);
    }finally{setWorking(false);}
  }
  const visibleEvents=filterEvents(agendaEvents,new Set(liveStates.map(l=>l.session_id)),eventFilter);

  if(loading)return <main className="mm-login-shell"><p className="mm-loading">Preparando sua mesa...</p></main>;
  if(!user)return <main className="mm-login-shell"><div className="mm-login-card"><SiteLogo kind="mobile"/><p className="mm-message">{error||"Redirecionando para login..."}</p><a href="/login" className="btn gold">Ir para o login</a></div></main>;

  const navEntries:[View,string,UiIconName][]=[
    ["inicio","Início","home"],
    ["eventos","Eventos","calendar"],
    ["mesas","Jogos","cards"],
    ["ligas","Ligas","users"],
    ["perfil","Perfil","user"],
    ...(isAdmin?[["admin","Administração","settings"] as [View,string,UiIconName]]:[])
  ];
  const activePage=page==="detalhe"||page==="criar-evento"||page==="editar-evento"?"eventos":page==="mesa"?"mesas":page==="liga"||page==="liga-admin"?"ligas":page;
  // Quatro destinos: o ranking fica dentro de cada liga.
  const mobileNavEntries=navEntries.filter(([id])=>
    id==="inicio"||id==="eventos"||id==="ligas"||id==="perfil"
  );
  const mobileActivePage=page==="mesas"||page==="mesa"?"inicio":page==="admin"?"perfil":activePage;
  return <div className={"layout "+(page==="mesa"&&gameView==="blackjack"||page==="detalhe"&&selectedGame==="blackjack"?"mm-game-blackjack":page==="mesa"&&gameView==="poker"||page==="detalhe"&&selectedGame==="poker"?"mm-game-poker":"")}>
    <aside className="sidebar">
      <SiteLogo kind="sidebar"/>
      <nav className="nav mm-desktop-nav" aria-label="Navegação lateral">
        <div className="navlabel">NAVEGAÇÃO</div>
        {navEntries.map(([id,label,icon])=><button className={"mm-nav-btn "+(activePage===id?"active":"")} key={id} type="button" title={label}
          aria-label={label} onClick={()=>{if(id==="perfil")setProfileId(user.id);go(id)}}
          aria-current={activePage===id?"page":undefined}>
          <span className="ico" aria-hidden="true"><UiIcon name={icon} size={22}/></span>
          <span className="mm-nav-label">{id==="admin"?"Admin":label}</span>
        </button>)}
      </nav>
      <nav className="nav mm-bottom-nav" aria-label="Navegação inferior">
        {mobileNavEntries.map(([id,label,icon])=><button
          className={"mm-nav-btn "+(mobileActivePage===id?"active":"")}
          key={id} type="button" title={label} aria-label={label}
          aria-current={mobileActivePage===id?"page":undefined}
          onClick={()=>{if(id==="perfil")setProfileId(user.id);go(id)}}>
          <span className="ico" aria-hidden="true"><UiIcon name={icon} size={23}/></span>
          <span className="mm-nav-label">{label}</span>
        </button>)}
      </nav>
      <div className="mm-side-profile">
        <PlayerAvatar photoUrl={photoUrls[user.id]} name={nickname}/>
        <div className="person"><strong>{nickname}</strong><small>{isAdmin?"Administrador geral":"Jogador"}</small></div>
        <button type="button" aria-label="Sair" title="Sair" onClick={async()=>{await getSupabase()?.auth.signOut();window.location.replace("/login")}}><UiIcon name="log-out" size={21}/></button>
      </div>
    </aside>

    <main className="main" id="main-content">
      <div className="mm-mobile-head">
        <SiteLogo kind="mobile"/>
        <div className="mm-mobile-account">{connection!=="connected"&&<span className={"mm-mobile-sync "+connection} role="status" title={connection==="offline"?"Sem conexão":"Sincronizando"}><span className="mm-visually-hidden">{connection==="offline"?"Sem conexão":"Sincronizando"}</span></span>}{isMobile&&<NotificationCenter compact userId={user.id} onOpenEvent={id=>openEvent(id)} onOpenLeague={openLeague}/>}<button type="button" className="mm-v09-profile-link" aria-label="Abrir meu perfil" onClick={()=>{setProfileId(user.id);go("perfil")}}><PlayerAvatar photoUrl={photoUrls[user.id]} name={nickname}/></button></div>
      </div>
      <div className="mm-breadcrumb-row">
        <div className="breadcrumb">Mesa Marcada　/　{page==="inicio"?"Visão geral":page==="detalhe"?"Evento":page==="mesa"?"Mesa de "+gameName(gameView):page==="eventos"?"Eventos":page==="criar-evento"?"Criar evento":page==="editar-evento"?"Editar evento":page==="mesas"?"Jogos":page==="perfil"?"Perfil":page==="admin"?"Administração":page==="ligas"||page==="liga"||page==="liga-admin"?"Ligas":"Visão geral"}</div>
        <div className="mm-connection-group">
          <span className={"mm-sync-pill "+connection} role="status" aria-live="polite"
            title={connection==="connected"?"Atualizações em tempo real ativas":connection==="offline"?"Sem conexão; atualiza ao reconectar":connection==="stale"?"Atualização pendente; uma nova tentativa será feita automaticamente":"Sincronizando dados"}>
            <span className="mm-sync-dot" aria-hidden="true"/>
            {connection==="connected"?"Em tempo real":connection==="offline"?"Sem conexão":connection==="stale"?"Atualização pendente":"Sincronizando"}
          </span>
          <span className="pill"><UiIcon name={isAdmin?"settings":"user"} size={14}/>{isAdmin?"Administrador":firstName}</span>
        </div>
      </div>
      {detailLoading&&<p className="mm-message" role="status" style={{marginBottom:12}}>Carregando dados desta área...</p>}
      {error&&<div className="mm-message error" role="alert" style={{marginBottom:16}}>{error} <button type="button" className="btn" onClick={()=>{setError("");void reload().catch(e=>setError(errText(e)))}}>Tentar novamente</button></div>}
      {message&&<p className="mm-message" role="status" style={{marginBottom:16}}>{message}</p>}

      {!isMobile&&<NotificationCenter userId={user.id} onOpenEvent={id=>openEvent(id)} onOpenLeague={openLeague}/>}

      {(page==="criar-evento"||page==="editar-evento")&&(page==="criar-evento"||selected&&editSeedId===selected.id)&&
        (page==="editar-evento"&&(!selected||selected.status!=="scheduled"||selectedLive||!organizer&&!isAdmin)?
          <section className="panel"><h1>Evento indisponível para edição</h1><p>Somente o anfitrião ou administrador pode editar um evento antes do início.</p><button className="btn" onClick={()=>openEvent(selectedId)}>Voltar ao evento</button></section>:
          <EventWizard key={user.id+":"+page+":"+selectedId+":"+creatorEpoch} userId={user.id} initial={form}
            event={page==="editar-evento"?selected||undefined:undefined} rooms={activeRooms} leagues={ownLeagues}
            step={creatorStep} onStep={setCreatorStep} onSave={page==="editar-evento"?editEvent:addEvent}
            onExit={()=>page==="editar-evento"?openEvent(selectedId,"visao"):go("eventos")}
            busy={working} pricingLocked={page==="editar-evento"&&Boolean(selected?.chip_pricing_locked||eventBuys.length)} source={repeatSource}/>) }
       {page==="inicio"&&<DashboardV16
        firstName={firstName} userId={user.id} upcoming={upcoming} activeEvents={activeEvents} waitingEvents={waitingEvents}
        attendances={attendances} rooms={activeRooms}
        mySplits={mySplits} settlements={settlements}
        isAdmin={isAdmin}
        onCreate={()=>openCreator()}
        onOpenEvent={id=>openEvent(id)}
        lastNight={lastNight} onRepeat={event=>void openRematch(event)}
        onStartEvent={id=>openEvent(id,"visao")} onReschedule={openEditor} onCancelEvent={cancelEventFromHome}

        onEvents={()=>go("eventos")}
        onGame={openGame}
        onTables={()=>go("mesas")}
        onProfile={()=>{setProfileId(user.id);setProfileTab("rachas");setPage("perfil");window.scrollTo({top:0,behavior:"auto"})}}
        onAdmin={()=>go("admin")}
        onLeagues={()=>go("ligas")}
        onOpenLeague={id=>openLeague(id)}
        pendingReconfirmEventId={pendingReconfirmEventId}
      />}

      {(page==="ligas"||page==="liga"||page==="liga-admin")&&
        <LeagueHub isAdmin={isAdmin} leagueId={selectedLeagueId}
          mode={page==="ligas"?"list":page==="liga-admin"?"manage":"detail"}
          userId={user.id} profiles={profiles} events={agendaEvents} rooms={activeRooms} attendances={attendances}
          section={leagueTab} onSection={setLeagueTab} liveEventIds={liveStates.map(l=>l.session_id)}
          onBack={()=>goBack(()=>page==="liga-admin"?openLeague(selectedLeagueId):go("ligas"))}
          onOpenLeague={openLeague}
          onOpenEvent={id=>openEvent(id)}
          onCreateEvent={leagueId=>openCreator(undefined,leagueId)}
          onMembershipChanged={()=>{void refreshScope("catalog")}}
        />}
      {page==="eventos"&&<>
        <div className="heading"><div><div className="eyebrow">AGENDA DO GRUPO</div><h1>Eventos</h1><p>Confira as próximas noites ou marque um novo encontro.</p></div><button className="btn gold mm-create" type="button" onClick={()=>openCreator()}><UiIcon name="plus" size={18}/> Criar evento</button></div>
        <div className="mm-filter-bar" aria-label="Filtrar eventos">
          {([["abertos","Em aberto"],["ao-vivo","Ao vivo"],["encerrados","Histórico"],["todos","Todos"]] as const).map(([id,label])=>
            <button className={"filter "+(eventFilter===id?"active":"")} type="button" aria-pressed={eventFilter===id} key={id} onClick={()=>setEventFilter(id)}>{label}</button>
          )}
        </div>
        <div className="mm-eventgrid">
          {visibleEvents.map(ev=><EventTile key={ev.id} value={ev} room={roomFor(ev.room_id)} count={attendances.filter(a=>a.session_id===ev.id).length} confirmed={attendances.some(a=>a.session_id===ev.id&&a.user_id===user.id)} live={ev.status==="scheduled"&&liveStates.some(l=>l.session_id===ev.id)} open={()=>openEvent(ev.id)}/>)}
          {historyMore&&(eventFilter==="todos"||eventFilter==="encerrados")&&<button type="button" className="btn" disabled={historyLoading} onClick={()=>{
            setHistoryLoading(true);void loadCatalog(true).catch(e=>setError(errText(e))).finally(()=>setHistoryLoading(false));
          }}>{historyLoading?"Carregando…":"Carregar eventos anteriores"}</button>}
        </div>
        {!visibleEvents.length&&<div className="panel mm-empty"><span className="mm-empty-symbol">♠</span><h2>Nenhum evento por aqui</h2><p>Que tal organizar a próxima noite?</p><button className="btn gold" onClick={()=>openCreator()}><UiIcon name="plus" size={18}/> Criar evento</button></div>}
      </>}

      {page==="mesas"&&<>
        <div className="heading">
          <div><div className="eyebrow">ESCOLHA SEU JOGO</div><h1>Jogos e tutoriais</h1><p>Escolha uma modalidade para organizar um encontro ou aprender a jogar.</p></div>
        </div>
        <div className="mm-rooms mm-permanent-tables">
          {ALL_GAMES.map(game=>{
            const room=activeRooms.find(r=>r.game===game);
            const count=agendaEvents.filter(e=>room&&e.room_id===room.id).length;
            return <article className="roomcard mm-fixed-roomcard" key={game}>
              <div className={"roombanner mm-room-banner "+game+" mm-illustrated"}>
                <span className={"tag "+game}>{gameName(game)}</span>
                <GameArtwork game={game}/><span className="mm-art-caption">{GAME_IDENTITY[game].signature}</span>
              </div>
              <div className="mm-room-card-content">
                <h2>{GAME_META[game].name}</h2>
                <p>{GAME_META[game].description}</p>
                <div className="mm-room-facts"><span><UiIcon name="calendar" size={15}/> {count} {count===1?"evento":"eventos"}</span><span><UiIcon name="book-open" size={15}/> Tutorial completo</span></div>
                <div className="mm-room-actions">
                  <button type="button" className="btn gold" onClick={()=>openGame(game)}>Abrir mesa →</button>
                  <button type="button" className="btn" onClick={()=>openGame(game,"tutorial")}>Aprender a jogar</button>
                </div>
              </div>
            </article>;
          })}
        </div>
      </>}

      {page==="mesa"&&<>
        <button className="back" type="button" onClick={()=>goBack(()=>go("mesas"))}>← Voltar</button>
        <div className="mm-table-hero">
          <GameBanner game={gameView} large/>
          <div className="mm-table-hero-content">
            <div className="eyebrow">MESA FIXA · {gameName(gameView).toUpperCase()}</div>
            <h1>{gameName(gameView)}</h1>
            <p>{GAME_META[gameView].description}</p>
            <button type="button" className="btn gold" onClick={()=>openCreator(activeRooms.find(r=>r.game===gameView)?.id)} disabled={!activeRooms.some(r=>r.game===gameView)}>
              ＋ Criar evento de {gameName(gameView)}
            </button>
          </div>
        </div>
        <div className="mm-detail-tabs" role="tablist" aria-label="Seções da mesa">
          <button type="button" role="tab" aria-selected={gameTab==="eventos"} className={gameTab==="eventos"?"active":""} onClick={()=>setGameTab("eventos")}><UiIcon name="calendar" size={16}/> Eventos</button>
          <button type="button" role="tab" aria-selected={gameTab==="tutorial"} className={gameTab==="tutorial"?"active":""} onClick={()=>setGameTab("tutorial")}><UiIcon name="book-open" size={16}/> Tutorial e regras</button>
        </div>
        {gameTab==="eventos"&&<>
          <div className="mm-section-title"><h2>Eventos de {gameName(gameView)}</h2><span className={"tag "+gameView}>{agendaEvents.filter(e=>roomFor(e.room_id)?.game===gameView).length} registrados</span></div>
          <div className="mm-eventgrid">
            {agendaEvents.filter(e=>roomFor(e.room_id)?.game===gameView)
              .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime())
              .map(ev=><EventTile key={ev.id} value={ev} room={roomFor(ev.room_id)} count={attendances.filter(a=>a.session_id===ev.id).length} confirmed={attendances.some(a=>a.session_id===ev.id&&a.user_id===user.id)} live={ev.status==="scheduled"&&liveStates.some(l=>l.session_id===ev.id)} open={()=>openEvent(ev.id)}/>)}
          </div>
          {agendaEvents.filter(e=>roomFor(e.room_id)?.game===gameView).length===0&&<div className="panel mm-empty">
            <span className="mm-empty-symbol">{GAME_META[gameView].symbol}</span>
            <h2>Nenhum evento de {gameName(gameView)} ainda</h2>
            <p>Crie um evento nesta mesa e convide seus amigos.</p>
            <button type="button" className="btn gold" onClick={()=>openCreator(activeRooms.find(r=>r.game===gameView)?.id)}><UiIcon name="plus" size={18}/> Criar evento</button>
          </div>}
        </>}
        {gameTab==="tutorial"&&<TableTutorial key={gameView+":"+gameVariant} game={gameView} variant={gameVariant}/>}
      </>}

      {page==="admin"&&isAdmin&&<AdminPanel
        events={events} profiles={profiles} attendances={attendances} finance={adminFinance}
        hidden={hiddenEvents} audits={adminAudits}
        nameFor={nameFor} busy={working}
        onAction={(id,action)=>void manageAdminEvent(id,action)}
        onOpen={id=>openEvent(id,"visao",true)}
      />}

      {page==="perfil"&&<>
        {profileTab!=="resumo"&&<><button type="button" className="back" onClick={()=>goBack(()=>setProfileTab("resumo"))}>← Voltar</button><TaskNavigation label="Páginas do perfil" active={profileTab} items={([
          ["resumo","Perfil"],["conquistas","Conquistas"],["molduras","Molduras"],["resultados","Resultados"],
          ...(!profileId||profileId===user.id?[["rachas","Meus rachas"]]:[])
        ] as [ProfileTab,string][]).map(([id,label])=>({id,label,href:clubHref("perfil","","visao","poker","eventos","",{profileId:profileId&&profileId!==user.id?profileId:"",profileTab:id}),onSelect:()=>setProfileTab(id)}))}/></>}
        {(["resumo","editar","resultados"] as ProfileTab[]).includes(profileTab)&&<>
      <ProfilePanel key={(profileId||user.id)+":"+profileTab} mode={profileTab==="editar"?"edit":profileTab==="resultados"?"results":"summary"} onEdit={()=>setProfileTab("editar")} onCancel={()=>setProfileTab("resumo")}
        profile={profiles.find(p=>p.id===(profileId||user.id))}
        userId={user.id} events={agendaEvents} attendances={attendances.filter(a=>agendaEvents.some(e=>e.id===a.session_id))} stats={ranking} liveEventIds={liveStates.map(l=>l.session_id)}
        photoUrl={photoUrls[profileId||user.id]}
        onUploadPhoto={uploadProfilePhoto} onRemovePhoto={removeProfilePhoto}
        busy={working} onBack={profileId&&profileId!==user.id?()=>goBack(()=>go(profileReturn)):undefined}
        onSave={async details=>{
          const db=getSupabase();
          if(!db)throw new Error("Sem conexão com o banco.");
          setWorking(true);setError("");
          try{
            const {error:updateError}=await db.from("profiles").update(details).eq("id",user.id);
            if(updateError)throw updateError;
            await reload();setProfileTab("resumo");setMessage("Perfil atualizado!");
          }finally{setWorking(false);}
        }}
      />

        </>}
        {profileTab==="resumo"&&<><div className="mm-profile-destinations" aria-label="Áreas do perfil">{([
          ["conquistas","Conquistas","Sua coleção de medalhas"],["molduras","Molduras","Personalize sua foto"],["resultados","Resultados","Seu desempenho por jogo"],
          ...(!profileId||profileId===user.id?[["rachas","Meus rachas","Sua parte nas despesas"]]:[])
        ] as [ProfileTab,string,string][]).map(([id,label,description])=><button key={id} type="button" onClick={()=>{setProfileTab(id);window.scrollTo({top:0,behavior:"auto"})}}><span><strong>{label}</strong><small>{description}</small></span><UiIcon name="arrow-right" size={20}/></button>)}</div>
        <PlayerMedals key={"compact-"+(profileId||user.id)} compact onView={()=>setProfileTab("conquistas")} playerId={profileId||user.id} userId={user.id} name={nameFor(profileId||user.id)} photoUrl={photoUrls[profileId||user.id]}/>
        {isAdmin&&(!profileId||profileId===user.id)&&<button type="button" className="mm-profile-admin-link" onClick={()=>go("admin")}><UiIcon name="settings" size={20}/><span><strong>Administração geral</strong><small>Gerenciar eventos, anfitriões e auditoria</small></span><UiIcon name="arrow-right" size={18}/></button>}
        {(!profileId||profileId===user.id)&&<button type="button" className="mm-profile-logout" onClick={async()=>{if(!window.confirm("Sair da sua conta neste aparelho?"))return;await getSupabase()?.auth.signOut();window.location.replace("/login")}}><UiIcon name="log-out" size={20}/><span>Sair da conta</span></button>}
        </>}
        {profileTab==="conquistas"&&<><header className="mm-task-heading"><h1>Conquistas</h1><p>Medalhas, progresso e seus três troféus em destaque.</p></header><PlayerMedals key={profileId||user.id} expandedOnLoad playerId={profileId||user.id} userId={user.id} name={nameFor(profileId||user.id)} photoUrl={photoUrls[profileId||user.id]}/></>}
        {profileTab==="molduras"&&<><header className="mm-task-heading"><h1>Molduras</h1><p>Escolha a moldura que acompanha sua foto.</p></header><PlayerFrames key={"frames-"+(profileId||user.id)} playerId={profileId||user.id} userId={user.id} name={nameFor(profileId||user.id)} photoUrl={photoUrls[profileId||user.id]}/></>}
        {profileTab==="resultados"&&<PlayerScoreResults userId={profileId||user.id}/>}
        {profileTab==="rachas"&&(!profileId||profileId===user.id)&&<><header className="mm-task-heading"><h1>Meus rachas</h1><p>Consulte sua parte nas despesas e abra o evento correspondente.</p></header><MySplitsSummary splits={mySplits} settlements={settlements} userId={user.id} nameFor={nameFor} onOpenEvent={eventId=>openEvent(eventId,"gastos")}/></>}
      </>}

      {(page==="detalhe"||page==="editar-evento")&&!selected&&!detailLoading&&<section className="panel"><h1>Evento indisponível</h1><p>Confira se você tem acesso ao encontro ou abra sua agenda.</p><button className="btn" onClick={()=>go("eventos")}>Ver eventos</button></section>}
      {page==="detalhe"&&selected&&<>
        {selected.status==="scheduled"&&<EventReconfirmation eventId={selected.id} startsAt={selected.starts_at} userId={user.id} attending={meConfirmed} host={organizer}/>}
        <button type="button" className="back" onClick={()=>goBack(()=>go("eventos"))}>← Voltar</button>
        <header className={"mm-event-context mm-event-"+selectedGame}>
          <div className="mm-event-mini-art" aria-hidden="true"><GameArtwork game={selectedGame}/></div><div className="mm-event-context-title"><span className="eyebrow">{({visao:"Preparação",["ao-vivo"]:"Partida",gastos:"Despesas e rachas",conferencia:"Conferência",["resumo-evento"]:"Resultado",enquetes:"Enquetes",gerenciar:"Gerenciar evento"} as Partial<Record<DetailTab,string>>)[detailTab]} · {GAME_META[selectedGame].name}</span><h1>{selected.title}</h1>
            <p>{VARIANT_NAMES[selected.game_variant||""]||GAME_META[selectedGame].name} · {guests.length} participantes · {organizer?"Você é o anfitrião":"Anfitrião: "+nameFor(selected.organizer_id)}</p></div>
          <span className={"tag "+(selected.status==="scheduled"?selectedGame:"archive")}>{eventStatus(selected,Boolean(selectedLive))}</span>
        </header>
        <TaskNavigation label="Etapas do evento" active={detailTab} items={(()=>{
          const flow:DetailTab[]=["visao","ao-vivo",...(selected.status==="scheduled"&&selectedLive?["conferencia" as DetailTab]:[]),"resumo-evento"];
          const current=selected.status==="finished"?"resumo-evento":selectedLive?"ao-vivo":"visao";
          const at=flow.indexOf(current);
          const labels=Object.fromEntries([["visao","Preparação"],["ao-vivo","Partida"],["conferencia","Conferência"],["resumo-evento","Resultado"],["gastos","Despesas"],["gerenciar","Gerenciar"]] as [DetailTab,string][]) as Partial<Record<DetailTab,string>>;
          const link=(id:DetailTab,extra:Partial<TaskLink>)=>({id,label:labels[id]||id,href:clubHref("detalhe",selected.id,id,selectedGame,"eventos"),onSelect:()=>setDetailTab(id),...extra});
          return [
            ...flow.map((id,i)=>link(id,{state:(selected.status==="finished"||i<at?"done":i===at?"now":"next") as TaskLink["state"]})),
            link("gastos",{secondary:true}),
            ...(organizer||isAdmin?[link("gerenciar",{secondary:true})]:[])
          ];
        })()}/>
        <fieldset className="mm-event-task-content" disabled={detailLoading} aria-busy={detailLoading} aria-label="Conteúdo do evento">
        {detailTab==="resumo-evento"&&selected.status!=="finished"&&<section className="panel"><h2>O resultado ainda não foi publicado</h2><p>O resultado fica disponível após a conferência e o encerramento.</p><button className="btn gold" onClick={()=>setDetailTab(selectedLive?"ao-vivo":"visao")}>Voltar ao encontro →</button></section>}
        {detailTab==="conferencia"&&!selectedLive&&<section className="panel"><h2>Prepare a partida antes de conferir</h2><button className="btn gold" onClick={()=>setDetailTab("visao")}>Abrir preparação →</button></section>}
        {detailTab==="gerenciar"&&!organizer&&!isAdmin&&<section className="panel"><h2>Área do anfitrião</h2><p>Os ajustes do encontro são feitos pelo organizador.</p><button className="btn" onClick={()=>setDetailTab("visao")}>Voltar à preparação</button></section>}
        {detailTab==="gerenciar"&&(organizer||isAdmin)&&<section className="panel mm-event-management"><h2>Gerenciar evento</h2><p>Ajustes e ações administrativas do anfitrião.</p>
            <div className="mm-action-row">


              {(organizer||isAdmin)&&selected.status==="scheduled"&&!selectedLive&&
                <button type="button" className="btn" disabled={working} onClick={()=>openEditor(selected)}>
                  <UiIcon name="settings" size={16}/> Editar evento
                </button>}
              {(organizer||isAdmin)&&selected.status==="scheduled"&&!selectedLive&&
                !selected.live_start_required&&
                <button className="btn" type="button" disabled={working||!canFinish}
                  onClick={()=>void finishLiveEvent(selected.id,organizer)}>
                  Encerrar evento antigo
                </button>}
              {(organizer||isAdmin)&&selected.status==="scheduled"&&<button className="mm-btn-destructive" type="button"
                disabled={working} onClick={()=>{
                  if(!window.confirm("Cancelar este evento? Os registros e o histórico serão preservados, mas os participantes não poderão realizar novos lançamentos."))return;
                  void act(async(db,id)=>{
                    const {error:cancelError}=organizer
                      ?await db.from("sessions").update({status:"cancelled"})
                        .eq("id",selected.id).eq("organizer_id",id)
                      :await db.rpc("admin_manage_event",{p_event_id:selected.id,p_action:"cancel"});
                    if(cancelError)throw cancelError;
                  },"Evento cancelado. O histórico foi mantido.");
                }}>Cancelar evento</button>}
            </div>
        </section>}
        {detailTab==="ao-vivo"&&selectedLive&&!privateVisible&&<section className="panel"><h2>Partida reservada aos participantes</h2><p>Acompanhar o placar e os lançamentos exige participação confirmada no encontro.</p><button className="btn" onClick={()=>setDetailTab("visao")}>Ver preparação</button></section>}
        {detailTab==="ao-vivo"&&!selectedLive&&selected.status==="scheduled"&&!selectedPoints&&<section className="panel"><h2>A partida ainda não começou</h2><p>Confira os participantes na Preparação e inicie quando a mesa estiver pronta.</p><button className="btn gold" onClick={()=>setDetailTab("visao")}>Abrir preparação →</button></section>}
        {!selectedPoints&&privateVisible&&(detailTab==="visao"&&!selectedLive||detailTab==="conferencia"&&selectedLive)&&selected.status==="scheduled"&&<EventLivePanel
          title={selected.title}
          reviewOnly={detailTab==="conferencia"}
          status={selected.status}
          startedAt={selectedLive?.started_at||null}
          requiresStart={selected.live_start_required}
          canSee={privateVisible}
          host={organizer}
          admin={isAdmin}
          busy={working}
          loading={liveLoading}
          guestCount={guests.length}
          purchaseCount={eventBuys.length}
          paidCount={paidCount}
          checkedCount={checkedCount}
          canFinish={canFinish}
          activities={eventLiveActivities}
          nameFor={nameFor}
          canStart={blackjackDealerReady&&guests.length>=2}
          startHint={guests.length<2?"Confirme pelo menos dois participantes antes de iniciar.":"Alguém precisa ocupar a cadeira do crupiê para iniciar o Blackjack."}
          onSeats={()=>document.getElementById("event-seats")?.scrollIntoView({behavior:"auto",block:"start"})}
          onStart={()=>void startLiveEvent(selected.id)}
          onFinish={()=>void finishLiveEvent(selected.id,organizer)}
          onRefresh={()=>void refreshLive(true).catch(e=>setError(errText(e)))}
          onFichas={()=>setDetailTab("conferencia")}
          showTimeline={false}
        />}

        {selectedPoints&&(detailTab!=="resumo-evento"||selected.status==="finished")&&(["visao","ao-vivo","conferencia","resumo-evento"] as DetailTab[]).includes(detailTab)&&(privateVisible?
          <ScoreGamePanel key={selected.id} event={selected} game={selectedGame} guests={guests} seats={seatedGuests} userId={user.id} canManage={organizer||isAdmin} nameFor={nameFor} mode={detailTab==="visao"?"prepare":detailTab==="conferencia"?"review":detailTab==="resumo-evento"?"result":"play"} onNavigate={setDetailTab} onRules={()=>openGame(selectedGame,"tutorial",selected.game_variant||"")} onChanged={()=>reload()}/>:
          <section className="panel"><h2>Placar restrito</h2><p>Escolha um assento e confirme sua presença para acompanhar o placar.</p></section>)}

        {detailTab==="ao-vivo"&&selectedLive&&privateVisible&&<RoundOrder key={selected.id} eventId={selected.id} game={selectedGame} participants={[...seatedGuests].sort((a,b)=>a.seat_no-b.seat_no).map(s=>s.user_id)} userId={user.id} canManage={(organizer||isAdmin)&&selected.status==="scheduled"} nameFor={nameFor}/>}

        {detailTab==="visao"&&<>
          <section className="panel mm-event-preparation"><h2>O encontro</h2><dl className="mm-event-facts"><div><dt>Quando</dt><dd>{fullDate(selected.starts_at)}</dd></div><div><dt>Local</dt><dd>{selected.location}</dd></div><div><dt>{selectedPoints?"Meta da mesa":"Entrada mínima"}</dt><dd>{selectedPoints?selected.score_target+" "+(selectedGame==="pife"?"vitórias":"pontos"):money(selected.min_entry_brl)}</dd></div></dl>
            {selectedLive&&selected.status==="scheduled"&&<button className="btn gold" onClick={()=>setDetailTab("ao-vivo")}>Retomar partida →</button>}
            {selected.status==="finished"&&<button className="btn gold" onClick={()=>setDetailTab("resumo-evento")}>Ver resultado →</button>}
          </section>
          <div id="event-seats">
        <SeatingTable game={selectedGame} variant={selected.game_variant}
          capacity={selected.max_participants} seats={seatedGuests}
          myId={user.id} confirmed={meConfirmed}
          canChange={selected.status==="scheduled"&&!Boolean(selectedLive)}
          busy={working} nameFor={nameFor}
          profiles={profiles} photoUrls={photoUrls}
          onOpenProfile={id=>{setProfileReturn("detalhe");setProfileId(id);go("perfil");}}
          onChoose={seatNo=>void chooseSeat(seatNo)}/>

          </div>
          <details className="mm-task-options"><summary>Participantes confirmados · {guests.length}</summary><div className="mm-chipgroup">{guests.map(g=><PlayerProfileTrigger key={g.user_id} variant="attendee" className="mm-v09-attendee-link" playerId={g.user_id} profile={profiles.find(p=>p.id===g.user_id)} photoUrl={photoUrls[g.user_id]} fallbackName={nameFor(g.user_id)} onOpenProfile={()=>{setProfileReturn("detalhe");setProfileId(g.user_id);go("perfil")}}><AttendeeMiniCard playerId={g.user_id} photoUrl={photoUrls[g.user_id]} name={nameFor(g.user_id)}/></PlayerProfileTrigger>)}</div>{organizer&&!meConfirmed&&<p>Escolha uma cadeira para também participar da partida.</p>}</details>
          <section className="mm-event-shortcuts" aria-label="Planejar o encontro"><button className="btn" onClick={()=>setDetailTab("enquetes")}>Enquetes · {openPolls.length} abertas →</button><button className="btn" onClick={()=>openGame(selectedGame,"tutorial",selected.game_variant||"")}>Regras do jogo →</button></section>
          <section className="panel mm-event-invite"><h2>Convidar jogadores</h2>
            {selected.league_id?<div className="mm-league-event-share">
               <p className="mm-formfoot">♠ Este evento pertence a uma liga. Os membros da liga podem abrir o convite e participar.</p>
               <button className="btn" type="button" onClick={()=>openLeague(selected.league_id!)}>Ver liga →</button>
               <EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>
             </div>:selected.visibility==="private"
               ?<PrivateInviteShare eventId={selected.id} title={selected.title}
                   canInvite={organizer||isAdmin} status={selected.status}/>
               :<EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>}
          </section>
        </>}
        {detailTab==="enquetes"&&<><button className="back" onClick={()=>setDetailTab("visao")}>← Voltar à preparação</button><header className="mm-task-heading"><h2>Enquetes do encontro</h2><p>Combine os detalhes com quem participa.</p></header>{meConfirmed&&selected.status==="scheduled"&&<PollComposer key={"poll-"+selected.id} onCreate={createPoll} disabled={working}/>}
        <div id="event-polls" className="mm-overview-polls">
          <div className="stack">
            <section className="panel">
              <div className="panelhead"><h2>Enquetes abertas</h2><span className="tag">{openPolls.length}</span></div>
              <div className="mm-overview-poll-actions">
                {eventPolls.some(p=>p.is_closed)&&<button type="button" className="btn" onClick={()=>setShowPastPolls(x=>!x)}>
                  {showPastPolls?"Ocultar encerradas":"Ver enquetes encerradas"}</button>}
              </div>
              {!privateVisible&&<p className="mm-message">Confirme presença para participar das enquetes. Os votos ficam visíveis apenas aos participantes e ao organizador.</p>}
              <div className="mm-poll-stack">
                {eventPolls.filter(p=>!p.is_closed||showPastPolls).map(p=>{
                  const pollVotes=votes.filter(v=>v.poll_id===p.id);
                  return <div className="pollbox" key={p.id}>
                    <div className="panelhead"><div><h3>{p.question}</h3><p className="mm-note">{pollVotes.length} votos</p></div><span className={"tag "+(p.is_closed?"archive":"poker")}>{p.is_closed?"Encerrada":"Aberta"}</span></div>
                    {choices.filter(c=>c.poll_id===p.id).map(c=>{
                      const count=pollVotes.filter(v=>v.option_id===c.id).length;
                      const picked=pollVotes.some(v=>v.option_id===c.id&&v.user_id===user.id);
                      return <button className={"mm-option-choice "+(picked?"chosen":"")} type="button" key={c.id} disabled={!meConfirmed||p.is_closed||selected.status!=="scheduled"||working}
                        onClick={()=>void act(async(db,id)=>{
                          const {error:voteError}=await db.from("session_poll_votes").upsert({poll_id:p.id,option_id:c.id,user_id:id,updated_at:new Date().toISOString()},{onConflict:"poll_id,user_id"});
                          if(voteError)throw voteError;
                        },"Voto registrado!")}>
                        <span style={{width:"100%"}}><span className="mm-title-actions"><span>{picked?"◉":"○"} {c.label}</span><small>{count} votos</small></span><span className="mm-poll-track" style={{display:"block",marginTop:8}}><span style={{width:(pollVotes.length?100*count/pollVotes.length:0)+"%"}}/></span></span>
                      </button>;
                    })}
                    {p.created_by===user.id&&!p.is_closed&&selected.status==="scheduled"&&<button type="button" className="mm-button-text" disabled={working} onClick={()=>void act(async db=>{
                      const {error:closeError}=await db.from("session_polls").update({is_closed:true}).eq("id",p.id);
                      if(closeError)throw closeError;
                    },"Enquete encerrada.")}>Encerrar votação</button>}
                  </div>;
                })}
                {!openPolls.length&&!showPastPolls&&<p>Nenhuma enquete aberta neste momento.</p>}
              </div>
            </section>
          </div>
        </div>

        </>}
        {detailTab==="gastos"&&<><header className="mm-task-heading"><h2>Despesas e rachas</h2><p>Comida, bebida e outros gastos do encontro.</p></header>{meConfirmed&&selected.status==="scheduled"&&<ExpenseComposer key={"expense-"+selected.id} userId={user.id} organizer={organizer} attendees={guests.map(g=>g.user_id)} nameFor={nameFor} onCreate={createExpense} disabled={working}/>}
        <section id="event-expenses" className="mm-overview-expenses" aria-label="Despesas e rachas">
        {!privateVisible?
          <div className="panel"><h2>Despesas restritas</h2><p>Confirme sua presença para consultar e participar dos rachas deste evento.</p></div>:
          <ExpenseSplitsPanel
            expenses={eventExpenses} shares={expenseShares} settlements={settlements}
            userId={user.id} canJoin={meConfirmed} canManage={organizer}
            scheduled={selected.status==="scheduled"} busy={working}
            nameFor={nameFor} photoUrls={photoUrls}
            onJoin={(expenseId,join)=>void act(async(db)=>{
              const {error:splitError}=await db.rpc("set_expense_split_membership",{p_expense_id:expenseId,p_join:join});
              if(splitError)throw splitError;
            },join?"Você entrou no racha.":"Você saiu do racha.","expenses")}

            onToggleOpen={(expenseId,open)=>void act(async(db)=>{
              const {error:splitError}=await db.rpc("set_expense_split_open",{p_expense_id:expenseId,p_open:open});
              if(splitError)throw splitError;
            },open?"Racha reaberto.":"Racha fechado.","expenses")}
            onDelete={expenseId=>{
              if(!window.confirm("Excluir esta despesa? O racha e as dívidas calculadas deixarão de existir."))return;
              void act(async(db,id)=>{
                const {error:deleteError}=await db.from("session_expenses").delete()
                  .eq("id",expenseId).eq("created_by",id);
                if(deleteError)throw deleteError;
              },"Gasto e racha excluídos.","expenses");
            }}
            createForm={null}
          />
        }
        </section>

        </>}

        {!selectedPoints&&(detailTab==="ao-vivo"||detailTab==="conferencia")&&selectedLive&&selected.status==="scheduled"&&privateVisible&&<>
          {!privateVisible?<div className="panel"><h2>Informações restritas</h2><p>Confirme presença neste evento para consultar ou registrar informações financeiras.</p></div>:<>
            {liveSubtab==="compra"&&<><div className="metrics" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
              <div className="metric"><div className="mhead">Pontos em fichas <span className="micon"><UiIcon name="check" size={22}/></span></div><strong>{eventBuys.reduce((n,b)=>n+Number(b.chips_received),0).toLocaleString("pt-BR")}</strong><small>Compras e recompras</small></div>
              <div className="metric"><div className="mhead">Entradas registradas <span className="micon"><UiIcon name="calendar" size={22}/></span></div><strong>{money(eventBuys.reduce((n,b)=>n+Number(b.amount_brl),0))}</strong><small>Valor informativo</small></div>
            </div>
            <div className="mm-denom-layout">
              {(organizer||isAdmin)&&<QuickRebuy guests={guests} buys={eventBuys} items={chipItems} busy={working} nameFor={nameFor}
                available={chipValues.map((v,i)=>Math.max(0,Math.max(40,selected.chip_stock_legacy?soldByDenom[i]:40)-soldByDenom[i]))}
                onRebuy={(userId,quantities)=>recordPurchase(quantities,userId)}/>}
              {(organizer||isAdmin)&&<label className="mm-field" style={{marginBottom:14}}>Registrar compra para o jogador
                <select value={buyingTarget||""} onChange={e=>setPurchaseFor(e.target.value)}>
                  {guests.map(g=><option key={g.user_id} value={g.user_id}>{nameFor(g.user_id)}</option>)}
                </select>
              </label>}
              <ChipPurchaseForm key={selected.id} eventId={selected.id}
                prices={[selected.chip_price_1_brl,selected.chip_price_5_brl,
                  selected.chip_price_10_brl,selected.chip_price_25_brl,selected.chip_price_50_brl]}
                special={selected.chip_pricing_special}
                locked={selected.chip_pricing_locked}
                disabled={!(meConfirmed||(organizer||isAdmin)&&guests.length>0)||selected.status!=="scheduled"||(selected.chip_settlement_brl&&eventCashouts.length>0)} busy={working}
                available={chipValues.map((v,i)=>Math.max(0,Math.max(40,selected.chip_stock_legacy?soldByDenom[i]:40)-soldByDenom[i]))}
                maxStock={chipValues.map((v,i)=>Math.max(40,selected.chip_stock_legacy?soldByDenom[i]:40))}
                minToComplete={minToComplete} entryMinimum={Number(selected.min_entry_brl)}
                onSave={recordPurchase}
              />
              </div>
            </>}
            {liveSubtab==="encerrar"&&<section className="panel mm-live-checkout">
              <div className="panelhead"><h2>Acerto final em reais</h2><span className="tag">R$</span></div>
              <p>As compras já foram convertidas em reais. Informe somente o valor final que cada jogador deve receber do Anfitrião.</p>
              <div className="mm-cash-summary">
                <div><small>Total comprado</small><strong>{money(totalBoughtBRL)}</strong></div>
                <div><small>Valores informados</small><strong>{money(totalFinalBRL)}</strong></div>
                <div><small>{Math.round((totalBoughtBRL-totalFinalBRL)*100)>=0?"Falta distribuir":"Valor excedente"}</small>
                  <strong>{money(Math.abs(Math.round((totalBoughtBRL-totalFinalBRL)*100))/100)}</strong></div>
              </div>
              {selected.status==="scheduled"&&<div className="mm-cash-form">
                {(organizer||isAdmin)&&<label className="mm-field">Jogador
                  <select value={cashoutTarget||""} onChange={e=>{setCashoutFor(e.target.value);setCashoutDraft("");}}>
                    {guests.map(g=><option value={g.user_id} key={g.user_id}>{nameFor(g.user_id)}</option>)}
                  </select>
                </label>}
                <label className="mm-field">Valor final a receber (R$)
                  <input id="mm-final-cashout" type="number" min={0} max={totalBoughtBRL} step="0.01" inputMode="decimal" value={cashoutDraft}
                    placeholder="Ex.: 25,00" onChange={e=>setCashoutDraft(e.target.value)}/>
                </label>
                <button type="button" className="btn gold" disabled={working||!cashoutDraft.trim()||!(meConfirmed||organizer||isAdmin)}
                  onClick={()=>void act(async db=>{
                    const finalValue=Number(cashoutDraft);
                    if(!Number.isFinite(finalValue)||finalValue<0||Math.abs(finalValue*100-Math.round(finalValue*100))>0.00001)
                      throw new Error("Informe um valor válido em reais com até duas casas decimais.");
                    if(!cashoutTarget)throw new Error("Selecione um jogador.");
                    const {error:e}=await db.rpc("record_chip_cashout",{p_event_id:selected.id,p_user_id:cashoutTarget,p_final_brl:finalValue});
                    if(e)throw e;
                    setCashoutDraft("");
                  },"Valor final em reais registrado!","chips")}>Salvar valor final</button>
                {cashoutTarget&&eventCashouts.some(c=>c.user_id===cashoutTarget)&&
                  <p className="mm-formfoot">Valor salvo para {nameFor(cashoutTarget)}: <strong>{money(Number(eventCashouts.find(c=>c.user_id===cashoutTarget)?.final_brl||0))}</strong>. Você pode corrigir esse valor até encerrar o evento.</p>}
                {eventCashouts.length>0&&<p className="mm-formfoot">A conferência financeira começou: novas compras ficam bloqueadas para evitar diferenças no caixa.</p>}
              </div>}
              {!cashBalanced&&<p className="mm-message error">
                {checkedCount<guests.length?`Faltam valores finais de ${guests.length-checkedCount} jogador(es).`:
                "O total final precisa ser exatamente igual ao valor das compras."}
              </p>}
              <h3>Resultado final dos jogadores</h3>
              <p>Confira os valores finais. O encerramento exige que a soma em reais corresponda exatamente às compras.</p>
              {guests.map(g=>{const v=playerSettlement(g.user_id);
                const submitted=eventCashouts.some(c=>c.user_id===g.user_id);
                return <div className="mm-live-settle-row" key={g.user_id}>
                  <div><strong>{nameFor(g.user_id)}</strong>
                    <small>Compras: {money(v.purchased)} · A receber: {submitted?money(v.returned):"Pendente"}</small>
                    <small>Lucro / prejuízo: {submitted?(v.net>0?"+":"")+money(v.net):"—"}</small>
                  </div>
                  {submitted&&v.returned===0&&<span className="mm-cash-zero">Sem repasse</span>}
                  {(organizer||isAdmin)&&<button className="btn" type="button" disabled={working} onClick={()=>{setCashoutFor(g.user_id);setCashoutDraft(submitted?String(v.returned):"");requestAnimationFrame(()=>{const input=document.getElementById("mm-final-cashout");input?.scrollIntoView({block:"center",behavior:"auto"});input?.focus({preventScroll:true})})}}>{submitted?"Corrigir":"Informar valor"}</button>}
                </div>})}
              {(organizer||isAdmin)&&selected.status==="scheduled"&&<button className="btn gold" disabled={!canFinish||working}
                onClick={()=>void finishLiveEvent(selected.id,organizer)}>Encerrar Ao vivo e ver resumo →</button>}
            </section>}
            {liveSubtab==="compra"&&<><details className="panel mm-v09-purchases" style={{marginTop:19}}><summary>Compras e recompras registradas · {eventBuys.length} lançamentos</summary>
              <p className="mm-v1-payment-explain">Compras registradas em reais. Não há confirmação manual de pagamentos.</p>

              {eventBuys.map(b=><div className="item mm-v09-finance-history" key={b.id}>
                <div className="itemcontent"><strong>{nameFor(b.user_id)}</strong>
                  <small>{Number(b.chips_received).toLocaleString("pt-BR")} pontos em fichas · {money(b.amount_brl)}</small>
                  {chipItems.some(item=>item.purchase_id===b.id)&&<small className="mm-denom-receipt">
                    {chipItems.filter(item=>item.purchase_id===b.id)
                      .sort((a,b)=>a.chip_value-b.chip_value)
                      .map(item=>item.quantity+"× ficha "+item.chip_value).join(" · ")}
                  </small>}
                </div>
                {b.user_id===user.id&&selected.status==="scheduled"&&(!selected.chip_settlement_brl||eventCashouts.length===0)&&<button type="button"
                  className="mm-v09-delete-entry" disabled={working} onClick={()=>{
                    if(!window.confirm("Excluir este lançamento de fichas? Se o resultado já estava aprovado, a aprovação será retirada."))return;
                    void act(async(db,id)=>{
                      const {error:deleteError}=await db.from("session_chip_purchases").delete()
                        .eq("id",b.id).eq("user_id",id);
                      if(deleteError)throw deleteError;
                    },"Compra excluída.");
                  }}>Excluir</button>}
              </div>)}
              {!eventBuys.length&&<p>Nenhuma compra ou recompra registrada até agora.</p>}
            </details>
</>}
            {liveSubtab==="encerrar"&&<details className="mm-live-history">
              <summary>Histórico de movimentações <span>Opcional</span></summary>
              <LiveMovements activities={eventLiveActivities} nameFor={nameFor}
                loading={liveLoading} busy={working}
                onRefresh={()=>void refreshLive(true).catch(e=>setError(errText(e)))}/>
            </details>}
          </>}
        </>}

        {!selectedPoints&&detailTab==="ao-vivo"&&selectedLive&&selected.status==="scheduled"&&privateVisible&&<div className="mm-primary-next"><button className="btn" onClick={()=>setDetailTab("conferencia")}>Conferir valores e encerrar →</button></div>}
        {!selectedPoints&&selected.status==="finished"&&detailTab==="ao-vivo"&&<section className="panel mm-night-redirect">
          <h2>Partida encerrada</h2><p>O Ao vivo terminou. Consulte os resultados no Resumo do evento.</p>
          <button className="btn gold" type="button" onClick={()=>setDetailTab("resumo-evento")}>Ver Resumo da noite →</button>
        </section>}
        {!selectedPoints&&detailTab==="resumo-evento"&&selected.status==="finished"&&
          (privateVisible?<NightSummary guests={guests} buys={eventBuys} cashouts={eventCashouts}
            expenses={eventExpenses} shares={eventExpenseShares} hostId={selected.organizer_id}
            currentUserId={user.id} nameFor={nameFor} eventFinished title={selected.title}
            startsAt={selected.starts_at} location={selected.location} game={gameName(selectedGame)}/>:
          <section className="panel"><p>Confirme sua presença para consultar o resumo financeiro do evento.</p></section>)}
        </fieldset>
      </>}

      {page==="detalhe"&&selected?.status==="finished"&&privateVisible&&detailTab==="resumo-evento"&&<div className="mm-result-actions"><button type="button" className="btn gold" disabled={working} onClick={()=>void openRematch(selected)}>Jogar novamente</button>{selected.league_id&&<button className="btn" onClick={()=>openLeague(selected.league_id!,false,"ranking")}>Ver ranking da liga →</button>}</div>}
      {page==="detalhe"&&selected?.status==="finished"&&privateVisible&&detailTab==="resumo-evento"&&<PostGameShare key={selected.id} eventId={selected.id}/>}

      <MobileAppCompanion onUpdate={()=>refreshScope("catalog")} visible={page==="perfil"&&profileTab==="editar"}/>
      <footer className="mm-formfoot" style={{marginTop:35}}>Mesa Marcada · Organize seus encontros. Valores em reais são apenas registros informativos.</footer>
    </main>


  </div>;
}
