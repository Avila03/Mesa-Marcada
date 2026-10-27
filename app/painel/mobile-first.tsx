"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {ALL_GAMES,GAME_META,VARIANT_NAMES,defaultVariant,defaultTarget,targetLabel,isChipGame} from "@/lib/games";
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
import {useStableDialog} from "./use-stable-dialog";
import {readClubRoute,clubHref} from "@/lib/app-routes";
import {useClubRealtime} from "./use-club-realtime";
import type {UpdateScope} from "./use-club-realtime";
import type {LiveState,LiveActivity} from "./event-live-panel";
import type {UiIconName} from "./ui-icon";
import type {AdvancedRank} from "./advanced-ranking";
import type {HiddenEvent,AdminAudit,AdminFinance} from "./admin-panel";
const TableTutorial=dynamic(()=>import("./table-tutorial"),{loading:()=>null});
const AdminPanel=dynamic(()=>import("./admin-panel"),{loading:()=>null});
const LeagueHub=dynamic(()=>import("./league-hub"),{loading:()=>null});
const EventLivePanel=dynamic(()=>import("./event-live-panel"),{loading:()=>null});
const LiveMovements=dynamic(()=>import("./event-live-panel").then(module=>module.LiveMovements),{loading:()=>null});
const NightSummary=dynamic(()=>import("./night-summary"),{loading:()=>null});
const SeatingTable=dynamic(()=>import("./seating-table"),{loading:()=>null});
const ScoreGamePanel=dynamic(()=>import("./score-games"),{loading:()=> <p role="status">Carregando placar…</p>});
const ScoreRanking=dynamic(()=>import("./score-ranking"),{loading:()=> <p role="status">Carregando ranking…</p>});
const PlayerScoreResults=dynamic(()=>import("./score-ranking").then(m=>m.PlayerScoreResults));
const AdvancedRankingPanel=dynamic(()=>import("./advanced-ranking"),{loading:()=>null});
const PlayerAchievements=dynamic(()=>import("./advanced-ranking").then(module=>module.PlayerAchievements),{loading:()=>null});
const PlayerMedals=dynamic(()=>import("./player-medals"),{loading:()=>null});
const PlayerFrames=dynamic(()=>import("./player-frames"),{loading:()=>null});


type LiveSubtab="compra"|"resumo"|"encerrar";
type ChipPriceKey="chip_price_1_brl"|"chip_price_5_brl"|"chip_price_10_brl"|"chip_price_25_brl"|"chip_price_50_brl";
const chipPriceFields:{value:number;key:ChipPriceKey}[]=[
  {value:1,key:"chip_price_1_brl"},
  {value:5,key:"chip_price_5_brl"},
  {value:10,key:"chip_price_10_brl"},
  {value:25,key:"chip_price_25_brl"},
  {value:50,key:"chip_price_50_brl"}
];
type CreateEvent = {game_variant:string;score_target:string;room_id:string;name:string;starts_at:string;location:string;min_entry_brl:string;max_participants:string;league_id:string;visibility:"public"|"private";chip_pricing_special:boolean}&Record<ChipPriceKey,string>;
const defaultEvent:CreateEvent={game_variant:"",score_target:"0",room_id:"",name:"",starts_at:"",location:"",min_entry_brl:"0",max_participants:"10",league_id:"",visibility:"public",chip_pricing_special:false,chip_price_1_brl:"1.00",chip_price_5_brl:"5.00",chip_price_10_brl:"0.10",chip_price_25_brl:"0.25",chip_price_50_brl:"0.50"};
type Modal = "evento" | "editar-evento" | null;
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
  return <div className={"mm-event-banner "+(game==="blackjack"?"blackjack":"")} style={large?{height:142}:undefined}>
    <span className={"tag "+game}>{gameName(game)}</span>
    <span className="mm-symbol" aria-hidden="true">{GAME_META[game].symbol}</span>
    {name&&<span className="tag" style={{position:"absolute",bottom:12,left:18}}>{name}</span>}
  </div>;
}

function EventTile({value,room,count,confirmed,live,open}:{value:Event;room?:Room;count:number;confirmed:boolean;live:boolean;open:()=>void}){
  const game=room?.game||"poker";
  return <article className="mm-event-card">
    <GameBanner game={game} name={value.game_variant?VARIANT_NAMES[value.game_variant]:undefined}/>
    <div className="mm-event-content">
      <div className="mm-title-actions"><h3>{value.title}</h3><span className={"tag "+(value.status==="scheduled"?game:"archive")}>{value.status==="scheduled"?(live?"Ao vivo":"Agendado"):value.status==="finished"?"Encerrado":"Cancelado"}</span></div>
      <div className="mm-event-info">{value.league_id&&<span>♠ Evento de liga</span>}<span>◷ {fullDate(value.starts_at)}</span><span>⌖ {value.location}</span></div>
      <div className="mm-event-occupancy"><span>{count} de {value.max_participants} participantes</span><span>{Math.max(0,value.max_participants-count)} vagas</span></div>
      <div className="mm-progress" aria-hidden="true"><div style={{width:(Math.min(1,count/value.max_participants)*100)+"%"}}/></div>
      <div className="mm-v09-event-actions">
        <button type="button" className={confirmed?"btn mm-v09-confirmed":"btn gold"} onClick={open}>
          {value.status!=="scheduled"?"Ver evento →":live?"Ver partida ao vivo →":confirmed?"✓ Ver meu assento →":"Escolher assento →"}
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
  const [detailTab,setDetailTab]=useState<DetailTab>("visao");
  const [selectedId,setSelectedId]=useState("");
  const [selectedLeagueId,setSelectedLeagueId]=useState("");
  const [leagueCatalog,setLeagueCatalog]=useState<League[]>([]);
  const [profileId,setProfileId]=useState("");
  const [profileReturn,setProfileReturn]=useState<View>("ranking");
  const [financeRows,setFinanceRows]=useState<FinanceLine[]>([]);
  const [gameView,setGameView]=useState<Game>("poker");
  const [gameTab,setGameTab]=useState<"eventos"|"tutorial">("eventos");
  const [modal,setModal]=useState<Modal>(null);
  const modalOverlayRef=useStableDialog(modal!==null,page,()=>setModal(null));
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
  const [periodRanking,setPeriodRanking]=useState<AdvancedRank[]>([]);
  const [annualStats,setAnnualStats]=useState<AdvancedRank[]>([]);
  const [rankingLoading,setRankingLoading]=useState(false);
  const [approvals,setApprovals]=useState<{session_id:string;user_id:string;reviewed_at:string}[]>([]);
  const [rankGame,setRankGame]=useState<Game>("poker");
  const [eventFilter,setEventFilter]=useState<"todos"|"agendados"|"encerrados">("agendados");
  const [form,setForm]=useState<CreateEvent>(defaultEvent);
  const ownLeagues=leagueCatalog.filter(item=>!item.finished_at&&(item.my_role==="owner"||item.my_role==="organizer"));
    const [liveSubtab,setLiveSubtab]=useState<LiveSubtab>("compra");
  const [showPastPolls,setShowPastPolls]=useState(false);
  const [cashoutFor,setCashoutFor]=useState("");
  const [cashoutDraft,setCashoutDraft]=useState("");
  const [purchaseFor,setPurchaseFor]=useState("");
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
      const [all,annual]=await Promise.all([db.rpc("get_player_stats_v2",{p_game:null}),db.rpc("get_player_stats_period_v2",{p_game:null,p_period:"ano"})]);
      if(all.error||annual.error)throw new Error(all.error?.message||annual.error?.message);
      setRanking((all.data||[]) as Rank[]);setAnnualStats((annual.data||[]) as AdvancedRank[]);
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
    if(context.current.page==="detalhe"&&context.current.selectedId)await loadEvent(context.current.selectedId);
    if(context.current.page==="perfil")await loadProfileStats();
    if(context.current.page==="admin")await loadAdminAudits();
  },[loadCatalog,loadPersonalSplits,loadEvent,loadProfileStats,loadAdminAudits]);

  // O layout de (app) fica montado entre rotas: URL, voltar/avançar e
  // atualização de página reproduzem a mesma tela sem recarregar a SPA.
  useEffect(()=>{
    const sync=()=>{
      const state=readClubRoute(window.location.pathname,window.location.search);
      setPage(state.page);setSelectedId(state.selectedId);setSelectedLeagueId(state.leagueId);
      setDetailTab(state.detailTab);setGameView(state.gameView);setGameTab(state.gameTab);
      setRouteReady(true);
    };
    sync();
    window.addEventListener("popstate",sync);
    return()=>window.removeEventListener("popstate",sync);
  },[]);

  useEffect(()=>{
    if(!routeReady)return;
    const next=clubHref(page,selectedId,detailTab,gameView,gameTab,selectedLeagueId);
    const now=window.location.pathname+window.location.search;
    if(next!==now)window.history.pushState({mesaMarcada:true},"",next);
  },[routeReady,page,selectedId,detailTab,gameView,gameTab,selectedLeagueId]);

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

  const connection=useClubRealtime({enabled:Boolean(user),eventId:page==="detalhe"?selectedId:"",onRefresh:refreshScope});

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

  useEffect(()=>{
    if(!user||!["ranking","perfil"].includes(page)||!isChipGame(rankGame))return;
    const db=getSupabase();
    if(!db)return;
    let active=true;
    setRankingLoading(true);
    void Promise.resolve(db.rpc("get_player_stats_period_v2",{p_game:rankGame,p_period:"ano"}))
      .then(({data,error:rankingError})=>{
        if(!active)return;
        if(rankingError)setError("Ranking indisponível: "+rankingError.message);
        else {setPeriodRanking((data||[]) as AdvancedRank[]);}
      }).finally(()=>{if(active)setRankingLoading(false);});
    return()=>{active=false};
  },[user,rankGame,page,events]);

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
    const task=page==="detalhe"&&selectedId?loadEvent(selectedId):
      page==="perfil"?loadProfileStats():page==="admin"?loadAdminAudits():Promise.resolve();
    void task.catch(e=>{if(active)setError("Não foi possível carregar esta área: "+errText(e))})
      .finally(()=>{if(active)setDetailLoading(false)});
    return()=>{active=false};
  },[user,routeReady,page,selectedId,loadEvent,loadProfileStats,loadAdminAudits]);

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
  async function sendEventPush(eventId:string,kind:"event"|"poll"|"live"|"summary"|"edit"){
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
    if(!window.confirm("Iniciar o Evento ao Vivo? Os participantes confirmados poderão acompanhar a linha do tempo da partida."))return;
    const db=getSupabase();
    if(!db||!user)return;
    setWorking(true);setMessage("");setError("");
    try{
      const {error:startError}=await db.rpc("start_live_event",{p_event_id:eventId});
      if(startError)throw startError;
      void sendEventPush(eventId,"live");
      const updates=await Promise.allSettled([refreshScope("chips"),refreshScope("catalog")]);
      setDetailTab("ao-vivo");setLiveSubtab("compra");
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
    if(!db||!user)return;
    setWorking(true);setMessage("");setError("");
    try{
      await fn(db,user.id);
      setMessage(success);
      try{
        if(scope)await Promise.all((Array.isArray(scope)?scope:[scope]).map(item=>refreshScope(item)));
        else await reload();
      }catch{setMessage(success+" A atualização da tela está pendente.");}
    }catch(e){setError(errText(e));}
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
    .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
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
  const formGame:Game=activeRooms.find(r=>r.id===form.room_id)?.game||"poker";
  const selected=events.find(e=>e.id===selectedId);
  const selectedLive=liveStates.find(l=>l.session_id===selectedId);
  const eventLiveActivities=liveActivities.filter(a=>a.session_id===selectedId);
  const guests=selected?attendances.filter(a=>a.session_id===selected.id):[];
  const selectedGame:Game=selected?(roomFor(selected.room_id)?.game||"poker"):"poker";
  const selectedPoints=!isChipGame(selectedGame);
  const seatedGuests=selected?tableSeats.filter(st=>st.session_id===selected.id):[];
  const blackjackDealerReady=selectedGame!=="blackjack"||seatedGuests.some(st=>st.seat_no===0);
  const meConfirmed=Boolean(user&&guests.some(a=>a.user_id===user.id));
  const organizer=Boolean(user&&selected?.organizer_id===user.id);
  const privateVisible=meConfirmed||organizer||isAdmin;
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
  const cashoutTarget=(organizer||isAdmin)?(cashoutFor||guests[0]?.user_id||user?.id):(user?.id);
  const buyingTarget=(organizer||isAdmin)?(purchaseFor||guests[0]?.user_id||user?.id):(user?.id);
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
  async function recordPurchase(quantities:number[]):Promise<boolean>{
    const db=getSupabase();if(!db||!user||!selected)return false;
    setWorking(true);setError("");setMessage("");
    try{
      await runMutation(db,user.id,"record_chip_purchase_once",{
        p_event_id:selected.id,p_quantities:quantities,
        p_user_id:organizer||isAdmin?(purchaseFor||guests[0]?.user_id||user.id):user.id
      });
      await afterSaved("chips","Compra registrada!");return true;
    }catch(e){setError(errText(e));return false}finally{setWorking(false)}
  }

  function openEvent(id:string,sub:DetailTab="visao",adminAccess=false){
    // Eventos excluídos são acessíveis exclusivamente pela Administração.
    if(hiddenEvents.some(h=>h.session_id===id)&&!(adminAccess&&isAdmin)){
      setError("Este evento foi excluído da agenda pelo administrador.");
      return;
    }
    setSelectedId(id);setLiveActivities([]);
    const isFinished=events.some(ev=>ev.id===id&&ev.status==="finished");
    setDetailTab(isFinished?"resumo-evento":sub==="fichas"?"ao-vivo":
      (sub==="assentos"||sub==="enquetes"||sub==="gastos"?"visao":sub));
    setLiveSubtab("compra");
    setShowPastPolls(false);
    setPage("detalhe");setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
    if(sub==="gastos")window.setTimeout(()=>document.getElementById("event-expenses")?.scrollIntoView({behavior:"smooth",block:"start"}),140);
  }
  function openLeague(id:string,manage=false){
    setSelectedLeagueId(id);setPage(manage?"liga-admin":"liga");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function go(next:View){
    setPage(next);setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
  }
  function openGame(game:Game,tab:"eventos"|"tutorial"="eventos"){
    setGameView(game);setGameTab(tab);setPage("mesa");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function openEditor(event:Event){
    setForm({
      game_variant:event.game_variant||"",score_target:String(event.score_target||0),room_id:event.room_id,name:event.title,starts_at:localDateTimeInput(event.starts_at),
      location:event.location,min_entry_brl:String(event.min_entry_brl),
      max_participants:String(event.max_participants),league_id:event.league_id||"",
      visibility:event.visibility,chip_pricing_special:event.chip_pricing_special,
      chip_price_1_brl:String(event.chip_price_1_brl),chip_price_5_brl:String(event.chip_price_5_brl),
      chip_price_10_brl:String(event.chip_price_10_brl),chip_price_25_brl:String(event.chip_price_25_brl),
      chip_price_50_brl:String(event.chip_price_50_brl)
    });
    setModal("editar-evento");setError("");setMessage("");
  }
  function openCreator(roomId?:string,leagueId=""){
    const room=(roomId?activeRooms.find(r=>r.id===roomId):undefined)||activeRooms.find(r=>r.game==="poker")||activeRooms[0];
    setForm({...defaultEvent,game_variant:defaultVariant(room?.game||"poker")||"",score_target:String(defaultTarget(room?.game||"poker",defaultVariant(room?.game||"poker"))),room_id:room?.id||"",max_participants:String(GAME_META[room?.game||"poker"].capacity),league_id:leagueId,visibility:leagueId?"private":"public"});
    setModal("evento");setError("");setMessage("");
  }
  useEffect(()=>{
    if(!user||modal!=="evento")return;
    const db=getSupabase();if(!db)return;
    void db.rpc("get_league_catalog_final").then(({data,error})=>{
      if(!error)setLeagueCatalog((data||[]) as League[]);
    });
  },[user,modal]);
  async function addEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    await act(async(db,id)=>{
      const room=activeRooms.find(r=>r.id===form.room_id);
      if(!room)throw new Error("Selecione uma modalidade para criar o evento.");
      if(!form.starts_at)throw new Error("Informe data e horário.");
      if(Number(form.max_participants)>10||Number(form.max_participants)<2)throw new Error("A mesa admite de 2 a 10 participantes.");
       const {data,error:eventError}=await db.from("sessions").insert({
        room_id:room.id,organizer_id:id,title:form.name.trim(),
        starts_at:new Date(form.starts_at).toISOString(),location:form.location.trim(),
        min_entry_brl:isChipGame(room.game)?Number(form.min_entry_brl):0,max_participants:Number(form.max_participants),
         visibility:form.league_id?"private":form.visibility,
        league_id:form.league_id||null,game_variant:isChipGame(room.game)?null:form.game_variant,score_target:isChipGame(room.game)?null:Number(form.score_target),
        chip_pricing_special:isChipGame(room.game)&&form.chip_pricing_special,
        chip_price_1_brl:form.chip_pricing_special?Number(form.chip_price_1_brl):1,
        chip_price_5_brl:form.chip_pricing_special?Number(form.chip_price_5_brl):5,
        chip_price_10_brl:form.chip_pricing_special?Number(form.chip_price_10_brl):0.10,
        chip_price_25_brl:form.chip_pricing_special?Number(form.chip_price_25_brl):0.25,
        chip_price_50_brl:form.chip_pricing_special?Number(form.chip_price_50_brl):0.50
      }).select("id").single();
      if(eventError)throw eventError;
      setModal(null);openEvent(data.id,"visao");
      if(form.visibility==="public"&&!form.league_id)void sendEventPush(data.id,"event");
    },"Evento criado! Escolham uma cadeira para participar.");
  }

  async function editEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const event=selected;
    if(!event)throw new Error("Selecione um evento para editar.");
    await act(async db=>{
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
      setModal(null);
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
  const visibleEvents=agendaEvents.filter(e=>eventFilter==="todos"||
    (eventFilter==="agendados"?e.status==="scheduled":e.status!=="scheduled"));

  if(loading)return <main className="mm-login-shell"><p className="mm-loading">Preparando sua mesa...</p></main>;
  if(!user)return <main className="mm-login-shell"><div className="mm-login-card"><SiteLogo kind="mobile"/><p className="mm-message">{error||"Redirecionando para login..."}</p><a href="/login" className="btn gold">Ir para o login</a></div></main>;

  const navEntries:[View,string,UiIconName][]=[
    ["inicio","Início","home"],
    ["eventos","Eventos","calendar"],
    ["mesas","Mesas","cards"],
    ["ligas","Ligas","users"],
    ["ranking","Ranking","trophy"],
    ["perfil","Perfil","user"],
    ...(isAdmin?[["admin","Administração","settings"] as [View,string,UiIconName]]:[])
  ];
  const activePage=page==="detalhe"?"eventos":page==="mesa"?"mesas":page==="liga"||page==="liga-admin"?"ligas":page;
  // Cinco destinos permanentes: Ligas e Ranking acessíveis de qualquer página,
  // inclusive evento Ao Vivo, perfil e painel do administrador.
  const mobileNavEntries=navEntries.filter(([id])=>
    id==="inicio"||id==="eventos"||id==="ligas"||id==="ranking"||id==="perfil"
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
        <div className="mm-mobile-account"><button type="button" className="mm-v09-profile-link" aria-label="Abrir meu perfil" onClick={()=>{setProfileId(user.id);go("perfil")}}><PlayerAvatar photoUrl={photoUrls[user.id]} name={nickname}/></button><button type="button" aria-label="Sair" onClick={async()=>{await getSupabase()?.auth.signOut();window.location.replace("/login")}}><UiIcon name="log-out" size={21}/></button></div>
      </div>
      <div className="mm-breadcrumb-row">
        <div className="breadcrumb">Mesa Marcada　/　{page==="inicio"?"Visão geral":page==="detalhe"?"Evento":page==="mesa"?"Mesa de "+gameName(gameView):page==="eventos"?"Eventos":page==="mesas"?"Mesas":page==="perfil"?"Perfil":page==="admin"?"Administração":page==="ligas"||page==="liga"||page==="liga-admin"?"Ligas":"Ranking"}</div>
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

      <NotificationCenter userId={user.id} onOpenEvent={id=>openEvent(id)} onOpenLeague={openLeague}/>

       {page==="inicio"&&<DashboardV16
        firstName={firstName} userId={user.id} upcoming={upcoming}
        attendances={attendances} rooms={activeRooms}
        mySplits={mySplits} settlements={settlements}
        isAdmin={isAdmin}
        onCreate={openCreator}
        onOpenEvent={id=>openEvent(id)}

        onEvents={()=>go("eventos")}
        onGame={openGame}
        onTables={()=>go("mesas")}
        onProfile={()=>{setProfileId(user.id);go("perfil")}}
        onRanking={()=>go("ranking")}
        onAdmin={()=>go("admin")}
        onLeagues={()=>go("ligas")}
        onOpenLeague={id=>openLeague(id)}
        pendingReconfirmEventId={pendingReconfirmEventId}
      />}

      {(page==="ligas"||page==="liga"||page==="liga-admin")&&
        <LeagueHub isAdmin={isAdmin} leagueId={selectedLeagueId}
          mode={page==="ligas"?"list":page==="liga-admin"?"manage":"detail"}
          userId={user.id} profiles={profiles} events={agendaEvents} rooms={activeRooms} attendances={attendances}
          onBack={()=>go("ligas")}
          onOpenLeague={openLeague}
          onOpenEvent={id=>openEvent(id)}
          onCreateEvent={leagueId=>openCreator(undefined,leagueId)}
          onMembershipChanged={()=>{void refreshScope("catalog")}}
        />}
      {page==="eventos"&&<>
        <div className="heading"><div><div className="eyebrow">AGENDA DO GRUPO</div><h1>Eventos</h1><p>Confira as próximas noites ou marque um novo encontro.</p></div><button className="btn gold mm-create" type="button" onClick={()=>openCreator()}><UiIcon name="plus" size={18}/> Criar evento</button></div>
        <div className="mm-filter-bar" aria-label="Filtrar eventos">
          {([["agendados","Próximos"],["todos","Todos"],["encerrados","Anteriores"]] as const).map(([id,label])=>
            <button className={"filter "+(eventFilter===id?"active":"")} type="button" key={id} onClick={()=>setEventFilter(id)}>{label}</button>
          )}
        </div>
        <div className="mm-eventgrid">
          {visibleEvents.map(ev=><EventTile key={ev.id} value={ev} room={roomFor(ev.room_id)} count={attendances.filter(a=>a.session_id===ev.id).length} confirmed={attendances.some(a=>a.session_id===ev.id&&a.user_id===user.id)} live={ev.status==="scheduled"&&liveStates.some(l=>l.session_id===ev.id)} open={()=>openEvent(ev.id)}/>)}
          {historyMore&&eventFilter!=="agendados"&&<button type="button" className="btn" disabled={historyLoading} onClick={()=>{
            setHistoryLoading(true);void loadCatalog(true).catch(e=>setError(errText(e))).finally(()=>setHistoryLoading(false));
          }}>{historyLoading?"Carregando…":"Carregar eventos anteriores"}</button>}
        </div>
        {!visibleEvents.length&&<div className="panel mm-empty"><span className="mm-empty-symbol">♠</span><h2>Nenhum evento por aqui</h2><p>Que tal organizar a próxima noite?</p><button className="btn gold" onClick={()=>openCreator()}><UiIcon name="plus" size={18}/> Criar evento</button></div>}
      </>}

      {page==="mesas"&&<>
        <div className="heading">
          <div><div className="eyebrow">ESCOLHA SEU JOGO</div><h1>Mesas</h1><p>Sete modalidades, um lugar para organizar cada rodada. Escolha uma mesa para ver os eventos e aprender as regras.</p></div>
        </div>
        <div className="mm-rooms mm-permanent-tables">
          {ALL_GAMES.map(game=>{
            const room=activeRooms.find(r=>r.game===game);
            const count=agendaEvents.filter(e=>room&&e.room_id===room.id).length;
            return <article className="roomcard mm-fixed-roomcard" key={game}>
              <div className={"roombanner mm-room-banner "+(game==="blackjack"?"blackjack":"")}>
                <span className={"tag "+game}>{gameName(game)}</span>
                <span className="mm-room-suit" aria-hidden="true">{GAME_META[game].symbol}</span>
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
        <button className="back" type="button" onClick={()=>go("mesas")}>← Voltar às mesas</button>
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
        {gameTab==="tutorial"&&<TableTutorial game={gameView}/>}
      </>}

      {page==="ranking"&&<div className="mm-game-selectors" aria-label="Modalidade do ranking">{ALL_GAMES.map(g=><button type="button" key={g} className={"filter "+(rankGame===g?"active":"")} aria-pressed={rankGame===g} onClick={()=>setRankGame(g)}>{gameName(g)}</button>)}</div>}
      {page==="ranking"&&!isChipGame(rankGame)&&<ScoreRanking key={rankGame} game={rankGame}/>}
      {page==="ranking"&&isChipGame(rankGame)&&<AdvancedRankingPanel
        game={rankGame} onGameChange={setRankGame}
        ranking={periodRanking} busy={rankingLoading} photoUrls={photoUrls}
        onPlayer={id=>{setProfileReturn("ranking");setProfileId(id);go("perfil")}}
      />}

      {page==="admin"&&isAdmin&&<AdminPanel
        events={events} profiles={profiles} attendances={attendances} finance={adminFinance}
        hidden={hiddenEvents} audits={adminAudits}
        nameFor={nameFor} busy={working}
        onAction={(id,action)=>void manageAdminEvent(id,action)}
        onOpen={id=>openEvent(id,"visao",true)}
      />}

      {page==="perfil"&&<>
      {isAdmin&&(!profileId||profileId===user.id)&&
        <button type="button" className="mm-profile-admin-link" onClick={()=>go("admin")}>
          <UiIcon name="settings" size={20}/>
          <span><strong>Administração geral</strong><small>Gerenciar eventos, Anfitriões e auditoria</small></span>
          <UiIcon name="arrow-right" size={18}/>
        </button>}
      <ProfilePanel
        profile={profiles.find(p=>p.id===(profileId||user.id))}
        userId={user.id} events={agendaEvents} attendances={attendances.filter(a=>agendaEvents.some(e=>e.id===a.session_id))} stats={ranking}
        photoUrl={photoUrls[profileId||user.id]}
        onUploadPhoto={uploadProfilePhoto} onRemovePhoto={removeProfilePhoto}
        busy={working} onBack={profileId&&profileId!==user.id?()=>go(profileReturn):undefined}
        onSave={async details=>{
          const db=getSupabase();
          if(!db)throw new Error("Sem conexão com o banco.");
          setWorking(true);setError("");
          try{
            const {error:updateError}=await db.from("profiles").update(details).eq("id",user.id);
            if(updateError)throw updateError;
            await reload();setMessage("Perfil atualizado!");
          }finally{setWorking(false);}
        }}
      />
      <PlayerMedals key={profileId||user.id} playerId={profileId||user.id}
        userId={user.id} name={nameFor(profileId||user.id)}
        photoUrl={photoUrls[profileId||user.id]}/>
      <PlayerFrames key={"frames-"+(profileId||user.id)} playerId={profileId||user.id}
        userId={user.id} name={nameFor(profileId||user.id)}
        photoUrl={photoUrls[profileId||user.id]}/>
      <PlayerScoreResults userId={profileId||user.id}/>
      <PlayerAchievements stats={annualStats} userId={profileId||user.id}/>
      {(profileId||user.id)===user.id&&<MySplitsSummary
        splits={mySplits} settlements={settlements} userId={user.id} nameFor={nameFor}
        onOpenEvent={eventId=>openEvent(eventId,"gastos")}

      />}
      </>}

      {page==="detalhe"&&selected&&<>
        {selected.status==="scheduled"&&<EventReconfirmation eventId={selected.id} startsAt={selected.starts_at} userId={user.id} attending={meConfirmed} host={organizer}/>}
        <button type="button" className="back" onClick={()=>selected.league_id?openLeague(selected.league_id):go("eventos")}>← {selected.league_id?"Voltar à liga":"Voltar aos eventos"}</button>
        <section className="detailblock" style={{padding:0,overflow:"hidden"}}>
          <GameBanner game={roomFor(selected.room_id)?.game||"poker"} large/>
          <div style={{padding:"20px 22px 21px"}}>
            <div className="mm-event-head">
              <div><div className="eyebrow">{roomTitle(selected.room_id)}　·　{gameName(roomFor(selected.room_id)?.game||"poker")}</div><h1 style={{marginBottom:6}}>{selected.title}</h1>
              <span className="mm-v1-host-label">♠ Anfitrião: {nameFor(selected.organizer_id)}{organizer?" (você)":""}</span></div>
              <span className={"tag "+(selected.status==="scheduled"?(roomFor(selected.room_id)?.game||"poker"):"archive")}>
                {selected.status==="scheduled"?(selectedLive?"Ao vivo":"Agendado"):selected.status==="finished"?"Encerrado":"Cancelado"}
              </span>
            </div>
            <div className="mm-event-meta"><span>◷ {fullDate(selected.starts_at)}</span><span>⌖ {selected.location}</span><span>♠ {guests.length}/{selected.max_participants} participantes</span></div>
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
            {(organizer||isAdmin)&&selected.status==="scheduled"&&!canFinish&&
              <p className="mm-formfoot">{selected.live_start_required&&!selectedLive
                ?"Inicie a partida na aba Ao vivo para liberar o encerramento.":selectedPoints?"Confira o placar da modalidade na aba Ao vivo.":"Para encerrar, confira compras, resultados e repasses no Ao vivo."}
              </p>}
            {selected.league_id?<div className="mm-league-event-share">
               <p className="mm-formfoot">♠ Este evento pertence a uma liga. Apenas membros aprovados podem abrir o convite e participar.</p>
               <button className="btn" type="button" onClick={()=>openLeague(selected.league_id!)}>Ver liga →</button>
               <EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>
             </div>:selected.visibility==="private"
               ?<PrivateInviteShare eventId={selected.id} title={selected.title}
                   canInvite={organizer||isAdmin} status={selected.status}/>
               :<EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>}

          </div>
        </section>
        <div className="mm-detail-tabs" role="tablist" aria-label="Conteúdo deste evento">
          {([["visao","Visão geral"],["ao-vivo","Ao vivo"],
    ...(selected.status==="finished"?[["resumo-evento","Resumo do evento"] as const]:[])] as const).map(([id,title])=><button type="button" key={id} className={detailTab===id?"active":""} role="tab" aria-selected={detailTab===id} onClick={()=>{setDetailTab(id);if(id==="ao-vivo")setLiveSubtab("compra")}}>{title}</button>)}
        </div>

        {!selectedPoints&&detailTab==="ao-vivo"&&privateVisible&&selectedLive&&selected.status==="scheduled"&&<div className="mm-live-subnav" role="tablist" aria-label="Áreas do Ao vivo">{([["compra","Compra"],["resumo","Resumo"],["encerrar","Encerrar"]] as const).map(([id,title])=><button type="button" role="tab" aria-selected={liveSubtab===id} className={liveSubtab===id?"active":""} key={id} onClick={()=>setLiveSubtab(id)}>{title}</button>)}</div>}
        {!selectedPoints&&detailTab==="ao-vivo"&&(!selectedLive||liveSubtab==="resumo")&&selected.status==="scheduled"&&<EventLivePanel
          title={selected.title}
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
          canStart={blackjackDealerReady}
          onSeats={()=>setDetailTab("visao")}
          onStart={()=>void startLiveEvent(selected.id)}
          onFinish={()=>void finishLiveEvent(selected.id,organizer)}
          onRefresh={()=>void refreshLive(true).catch(e=>setError(errText(e)))}
          onFichas={()=>setLiveSubtab("encerrar")}
          showTimeline={false}
        />}

        {selectedPoints&&(detailTab==="ao-vivo"||detailTab==="resumo-evento")&&(privateVisible?
          <ScoreGamePanel key={selected.id} event={selected} game={selectedGame} guests={guests} seats={seatedGuests} userId={user.id} canManage={organizer||isAdmin} nameFor={nameFor} onChanged={()=>reload()}/>:
          <section className="panel"><h2>Placar restrito</h2><p>Escolha um assento e confirme sua presença para acompanhar o placar.</p></section>)}

        {detailTab==="visao"&&<>
        <SeatingTable game={selectedGame}
          capacity={selected.max_participants} seats={seatedGuests}
          myId={user.id} confirmed={meConfirmed}
          canChange={selected.status==="scheduled"&&!Boolean(selectedLive)}
          busy={working} nameFor={nameFor}
          profiles={profiles} photoUrls={photoUrls}
          onOpenProfile={id=>{setProfileReturn("detalhe");setProfileId(id);go("perfil");}}
          onChoose={seatNo=>void chooseSeat(seatNo)}/>

          <div className="two">
          <section className="panel">
            <div className="panelhead"><h2>Participantes</h2><span className="tag">{guests.length}/{selected.max_participants}</span></div>
            <div className="mm-progress"><div style={{width:(Math.min(1,guests.length/selected.max_participants)*100)+"%"}}/></div>
            <div className="mm-chipgroup">{guests.map(g=>
              <PlayerProfileTrigger key={g.user_id} variant="attendee"
                className="mm-v09-attendee-link" playerId={g.user_id}
                profile={profiles.find(p=>p.id===g.user_id)}
                photoUrl={photoUrls[g.user_id]} fallbackName={nameFor(g.user_id)}
                onOpenProfile={()=>{setProfileReturn("detalhe");setProfileId(g.user_id);go("perfil");}}>
                <AttendeeMiniCard playerId={g.user_id} photoUrl={photoUrls[g.user_id]} name={nameFor(g.user_id)}/>
              </PlayerProfileTrigger>)}</div>
            {!guests.length&&<p>Ainda não há participantes sentados. Convide seus amigos para escolher uma cadeira!</p>}
            {organizer&&!meConfirmed&&<p className="mm-formfoot">Como anfitrião, escolha uma cadeira para participar da partida.</p>}
          </section>
          <section className="panel">
            <div className="panelhead"><h2>Informações do evento</h2></div>
            <div className="mm-detail-stats">
              <div><small>Entrada mínima</small><strong>{money(selected.min_entry_brl)}</strong></div>
              <div><small>Enquetes</small><strong>{eventPolls.length}</strong></div>
              <div><small>Vagas livres</small><strong>{Math.max(0,selected.max_participants-guests.length)}</strong></div>
            </div>
            <p style={{marginTop:16}}>Organizado por {nameFor(selected.organizer_id)}.</p>
            <div className="mm-action-row" style={{marginTop:15}}>
              <button type="button" className="btn" onClick={()=>document.getElementById("event-polls")?.scrollIntoView({behavior:"smooth",block:"start"})}>Ver enquetes abertas →</button>
              <button type="button" className="btn" onClick={()=>document.getElementById("event-expenses")?.scrollIntoView({behavior:"smooth",block:"start"})}>Ver despesas e rachas →</button>
              <button type="button" className="btn" onClick={()=>{setDetailTab("ao-vivo");setLiveSubtab("compra")}}>Ver compras ao vivo →</button>
            </div>
            {meConfirmed&&selected.status==="scheduled"&&<>
              <PollComposer key={"poll-"+selected.id} onCreate={createPoll} disabled={working}/>
              <ExpenseComposer key={"expense-"+selected.id} userId={user.id} organizer={organizer}
                attendees={guests.map(g=>g.user_id)} nameFor={nameFor}
                onCreate={createExpense} disabled={working}/>
            </>}
          </section>
        </div>


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
        {!selectedPoints&&detailTab==="ao-vivo"&&selectedLive&&selected.status==="scheduled"&&privateVisible&&(liveSubtab==="compra"||liveSubtab==="encerrar")&&<>
          {!privateVisible?<div className="panel"><h2>Informações restritas</h2><p>Confirme presença neste evento para consultar ou registrar informações financeiras.</p></div>:<>
            {liveSubtab==="compra"&&<><div className="metrics" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
              <div className="metric"><div className="mhead">Fichas distribuídas <span className="micon"><UiIcon name="check" size={22}/></span></div><strong>{eventBuys.reduce((n,b)=>n+Number(b.chips_received),0).toLocaleString("pt-BR")}</strong><small>Compras e recompras</small></div>
              <div className="metric"><div className="mhead">Entradas registradas <span className="micon"><UiIcon name="calendar" size={22}/></span></div><strong>{money(eventBuys.reduce((n,b)=>n+Number(b.amount_brl),0))}</strong><small>Valor informativo</small></div>
            </div>
            <div className="mm-denom-layout">
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
                  <input type="number" min={0} max={totalBoughtBRL} step="0.01" inputMode="decimal" value={cashoutDraft}
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
                </div>})}
              {(organizer||isAdmin)&&selected.status==="scheduled"&&<button className="btn gold" disabled={!canFinish||working}
                onClick={()=>void finishLiveEvent(selected.id,organizer)}>Encerrar Ao vivo e ver resumo →</button>}
            </section>}
            {liveSubtab==="compra"&&<><section className="panel mm-v09-purchases" style={{marginTop:19}}>
              <div className="panelhead"><h2>Compras e recompras registradas</h2><span className="tag">{eventBuys.length} lançamentos</span></div>
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
            </section>
</>}
            {liveSubtab==="encerrar"&&<details className="mm-live-history">
              <summary>Histórico de movimentações <span>Opcional</span></summary>
              <LiveMovements activities={eventLiveActivities} nameFor={nameFor}
                loading={liveLoading} busy={working}
                onRefresh={()=>void refreshLive(true).catch(e=>setError(errText(e)))}/>
            </details>}
          </>}
        </>}

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
      </>}

      <MobileAppCompanion onUpdate={()=>refreshScope("catalog")} visible={page==="inicio"}/>
      <footer className="mm-formfoot" style={{marginTop:35}}>Mesa Marcada · Organize seus encontros. Valores em reais são apenas registros informativos.</footer>
    </main>

    {(page==="inicio"||page==="eventos")&&!modal&&<button className="mm-fab" aria-label="Criar evento" title="Criar evento" type="button" onClick={()=>openCreator()}><UiIcon name="plus" size={29}/></button>}

    {(modal==="evento"||modal==="editar-evento")&&<div ref={modalOverlayRef} className="mm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="mm-modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title" tabIndex={-1}>
        <header><div><div className="eyebrow">{modal==="editar-evento"?"AJUSTAR EVENTO":"ORGANIZAR UMA NOITE"}</div><h2 id="new-event-title">{modal==="editar-evento"?"Editar evento":"Criar evento"}</h2></div><button className="mm-close" type="button" aria-label="Fechar" onClick={()=>setModal(null)}><UiIcon name="close" size={22}/></button></header>
        <form className="mm-form-stack" onSubmit={modal==="editar-evento"?editEvent:addEvent}>
          <label className="mm-field">Escolha a mesa
            <select value={form.room_id} onChange={e=>{
              const newRoom=activeRooms.find(room=>room.id===e.target.value);
              const g=newRoom?.game||"poker";setForm({...form,room_id:e.target.value,max_participants:String(GAME_META[g].capacity),game_variant:defaultVariant(g)||"",score_target:String(defaultTarget(g,defaultVariant(g))),min_entry_brl:"0",chip_pricing_special:false});
            }} disabled={modal==="editar-evento"} required>
              <option value="" disabled>Selecione uma modalidade</option>
              {ALL_GAMES.map(g=>{
                const table=activeRooms.find(r=>r.game===g);
                return <option key={g} value={table?.id||""} disabled={!table}>{gameName(g)}</option>;
              })}
            </select>
          </label>
          {!isChipGame(formGame)&&<div className="mm-form-grid"><label className="mm-field">Variante<select value={form.game_variant} disabled={modal==="editar-evento"} onChange={e=>setForm({...form,game_variant:e.target.value,score_target:String(defaultTarget(formGame,e.target.value)),max_participants:String(GAME_META[formGame].capacity)})}>{GAME_META[formGame].variants.map(v=><option key={v} value={v}>{VARIANT_NAMES[v]}</option>)}</select></label><label className="mm-field">{targetLabel(formGame)}<input type="number" required min={formGame==="pontinho"?50:formGame==="canastra"||formGame==="uno"?100:1} max={formGame==="pontinho"?500:formGame==="canastra"?10000:formGame==="uno"?2000:100} step={1} value={form.score_target} disabled={modal==="editar-evento"||formGame==="truco"} onChange={e=>setForm({...form,score_target:e.target.value})}/></label></div>}
          {!isChipGame(formGame)&&<p className="mm-game-rules-summary">{GAME_META[formGame].description} Variante e meta são definidas na criação. {formGame==="pontinho"?"Sem reentrada e sem curinga nesta base.":formGame==="pife"?"Sem curinga; a meta de vitórias é um acordo da mesa.":formGame==="uno"?"Clássico, sem acumular cartas +2/+4.":"Confira o tutorial da variante antes de iniciar."}</p>}
          <label className="mm-field">Nome do evento<input required minLength={2} maxLength={100} placeholder="Ex.: Poker de Sexta" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="mm-field">Liga (opcional)
             <select value={form.league_id} disabled={modal==="editar-evento"} onChange={e=>setForm({...form,league_id:e.target.value,visibility:e.target.value?"private":"public"})}>
               <option value="">Evento independente · sem liga</option>
               {ownLeagues.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
               {form.league_id&&!ownLeagues.some(item=>item.id===form.league_id)&&
                <option value={form.league_id}>Liga selecionada</option>}
             </select>
           </label>
           {form.league_id?<p className="mm-formfoot">Somente membros aprovados poderão ver este evento da liga.</p>:
           <>          <label className="mm-field">Privacidade do evento
             <select value={form.visibility} disabled={modal==="editar-evento"} onChange={e=>setForm({...form,visibility:e.target.value as "public"|"private"})}>
               <option value="public">Público · visível aos jogadores cadastrados</option>
               <option value="private">Privado · somente convidados com link ou QR Code</option>
             </select>
           </label></>}

           <div className="mm-form-grid">
            <label className="mm-field">Data e horário<input type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
            <label className="mm-field">Local<input minLength={2} maxLength={200} required placeholder="Ex.: Casa do Bruno" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
          </div>
          <div className="mm-form-grid">
            {isChipGame(formGame)&&<label className="mm-field">Entrada mínima (R$)<input type="number" min={0} step="0.01" disabled={modal==="editar-evento"&&Boolean(selected&&buys.some(b=>b.session_id===selected.id))} required value={form.min_entry_brl} onChange={e=>setForm({...form,min_entry_brl:e.target.value})}/></label>}
            <label className="mm-field">Vagas (cadeiras)<input type="number" min={formGame==="pontinho"?3:2} max={formGame==="blackjack"?6:formGame==="canastra"?4:formGame==="truco"?(form.game_variant==="gauderio"?6:4):formGame==="pontinho"||formGame==="pife"?8:10} step={formGame==="truco"||formGame==="canastra"?2:1} required value={form.max_participants} onChange={e=>setForm({...form,max_participants:e.target.value})}/></label>
          </div>
          {isChipGame(formGame)&&<div className="mm-denom-event-setting">
            <label className="mm-denom-special-switch">
              <input type="checkbox" checked={form.chip_pricing_special} disabled={modal==="editar-evento"&&Boolean(selected&&(selected.chip_pricing_locked||buys.some(b=>b.session_id===selected.id)))}
                onChange={e=>setForm({...form,chip_pricing_special:e.target.checked})}/>
              <span><strong>★ Evento especial</strong><small>Personalizar o preço de cada ficha somente neste evento</small></span>
            </label>
            {form.chip_pricing_special?<div className="mm-denom-price-grid">
              {chipPriceFields.map(field=><label className="mm-field" key={field.key}>
                Ficha {field.value} · R$
                <input type="number" min="0.01" max="1000" step="0.01" disabled={modal==="editar-evento"&&Boolean(selected&&(selected.chip_pricing_locked||buys.some(b=>b.session_id===selected.id)))} required
                  value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})}/>
              </label>)}
              <p className="mm-formfoot">Os preços personalizados ficam bloqueados após a primeira compra deste evento.</p>
            </div>:<p className="mm-formfoot">Padrão: ficha 1 = R$ 1,00 · ficha 5 = R$ 5,00 · ficha 10 = R$ 0,10 · ficha 25 = R$ 0,25 · ficha 50 = R$ 0,50.</p>}
          </div>
          }
          <div className="mm-create-seat-preview"><strong>♠ ♦ Assentos interativos</strong>
            <span>{modal==="editar-evento"?"Os participantes e assentos já confirmados serão preservados.":"Após criar o evento, você irá diretamente para a mesa."} Os convidados confirmados poderão escolher seus lugares{activeRooms.find(r=>r.id===form.room_id)?.game==="blackjack"?", inclusive a cadeira exclusiva do crupiê":""}.</span>
          </div>
          <p className="mm-formfoot">{modal==="editar-evento"?"Alterações de nome, data, horário, local e valores serão avisadas aos participantes. Eventos já iniciados não podem ser editados.":form.visibility==="private"?"Somente convidados autorizados terão acesso. Após criar, gere o convite e compartilhe o QR Code.":"Todos os usuários cadastrados poderão ver este evento."}</p>
          {error&&<p className="mm-message error" role="alert">{error}</p>}
          <div className="mm-form-actions"><button type="button" className="btn" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="btn gold" disabled={working}>{working?"Salvando...":modal==="editar-evento"?"Salvar alterações":"Criar evento →"}</button></div>
        </form>
      </div>
    </div>}

  </div>;
}
