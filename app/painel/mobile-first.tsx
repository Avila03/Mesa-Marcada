"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, View, DetailTab, Profile, Room, Event, Attendance, Poll, Choice, Vote, Buy, BuyItem, ChipResult, Expense, Rank } from "@/lib/mesa-types";
import { money, fullDate, eventTime, gameName, errText } from "@/lib/mesa-types";
import TableTutorial from "./table-tutorial";
import "../v05-theme.css";
import {AttendeeMiniCard,EventShareActions,FinanceReviewBoard,PlayerAvatar,ProfilePanel} from "./v09-features";
import type {FinanceLine} from "./v09-features";
import ChipPurchaseForm from "./chip-purchase-form";
import "../live-checkout.css";
import "./duo-theme.css";
import "./event-overview.css";
import "./connection-indicator.css";
import SiteLogo from "./site-logo";
import {prepareProfilePhoto} from "./photo-utils";
import {ExpenseSplitsPanel,MySplitsSummary} from "./expense-splits";
import type {ExpenseSplitRow,MyExpenseSplitRow,ExpenseSettlement} from "./expense-splits";
import AdminPanel from "./admin-panel";
import MobileAppCompanion from "./mobile-app-companion";
import UiIcon from "./ui-icon";
import DashboardV16 from "./dashboard-v16";
import EventLivePanel,{LiveMovements} from "./event-live-panel";
import NightSummary from "./night-summary";
import PrivateInviteShare from "./private-invite-share";
import SeatingTable from "./seating-table";
import type {TableSeat} from "./seating-table";
import {useStableDialog} from "./use-stable-dialog";
import {readClubRoute,clubHref} from "@/lib/app-routes";
import {useClubRealtime} from "./use-club-realtime";
import type {UpdateScope} from "./use-club-realtime";
import type {LiveState,LiveActivity} from "./event-live-panel";
import type {UiIconName} from "./ui-icon";
import AdvancedRankingPanel,{PlayerAchievements} from "./advanced-ranking";
import type {AdvancedRank} from "./advanced-ranking";
import type {HiddenEvent,AdminAudit} from "./admin-panel";

type LiveSubtab="compra"|"resumo"|"encerrar";
type ChipPriceKey="chip_price_1_brl"|"chip_price_5_brl"|"chip_price_10_brl"|"chip_price_25_brl"|"chip_price_50_brl";
const chipPriceFields:{value:number;key:ChipPriceKey}[]=[
  {value:1,key:"chip_price_1_brl"},
  {value:5,key:"chip_price_5_brl"},
  {value:10,key:"chip_price_10_brl"},
  {value:25,key:"chip_price_25_brl"},
  {value:50,key:"chip_price_50_brl"}
];
type CreateEvent = {room_id:string;name:string;starts_at:string;location:string;min_entry_brl:string;max_participants:string;visibility:"public"|"private";chip_pricing_special:boolean}&Record<ChipPriceKey,string>;
const defaultEvent:CreateEvent={room_id:"",name:"",starts_at:"",location:"",min_entry_brl:"0",max_participants:"10",visibility:"public",chip_pricing_special:false,chip_price_1_brl:"1.00",chip_price_5_brl:"5.00",chip_price_10_brl:"0.10",chip_price_25_brl:"0.25",chip_price_50_brl:"0.50"};
type Modal = "evento" | null;
const MONTHS=["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function DateTile({value}:{value:string}){
  const d=new Date(value);
  return <div className="mm-datebox" aria-label={fullDate(value)}>
    <strong>{String(d.getDate()).padStart(2,"0")}</strong><small>{MONTHS[d.getMonth()]}</small>
  </div>;
}

function GameBanner({game,name,large=false}:{game:Game;name?:string;large?:boolean}){
  return <div className={"mm-event-banner "+(game==="blackjack"?"blackjack":"")} style={large?{height:142}:undefined}>
    <span className={"tag "+game}>{gameName(game)}</span>
    <span className="mm-symbol" aria-hidden="true">{game==="poker"?"♠":"♦"}</span>
    {name&&<span className="tag" style={{position:"absolute",bottom:12,left:18}}>{name}</span>}
  </div>;
}

function EventTile({value,room,count,confirmed,live,open}:{value:Event;room?:Room;count:number;confirmed:boolean;live:boolean;open:()=>void}){
  const game=room?.game||"poker";
  return <article className="mm-event-card">
    <GameBanner game={game}/>
    <div className="mm-event-content">
      <div className="mm-title-actions"><h3>{value.title}</h3><span className={"tag "+(value.status==="scheduled"?game:"archive")}>{value.status==="scheduled"?(live?"Ao vivo":"Agendado"):value.status==="finished"?"Encerrado":"Cancelado"}</span></div>
      <div className="mm-event-info"><span>◷ {fullDate(value.starts_at)}</span><span>⌖ {value.location}</span></div>
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
  const [page,setPage]=useState<View>("inicio");
  const [routeReady,setRouteReady]=useState(false);
  const [detailTab,setDetailTab]=useState<DetailTab>("visao");
  const [selectedId,setSelectedId]=useState("");
  const [profileId,setProfileId]=useState("");
  const [profileReturn,setProfileReturn]=useState<View>("ranking");
  const [financeRows,setFinanceRows]=useState<FinanceLine[]>([]);
  const [financeLoading,setFinanceLoading]=useState(false);
  const [gameView,setGameView]=useState<Game>("poker");
  const [gameTab,setGameTab]=useState<"eventos"|"tutorial">("eventos");
  const [modal,setModal]=useState<Modal>(null);
  const modalOverlayRef=useStableDialog(modal!==null,page,()=>setModal(null));
  const [loading,setLoading]=useState(true);
  const fullDataRequested=useRef(false);
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
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
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
  const [ranking,setRanking]=useState<Rank[]>([]);
  const [periodRanking,setPeriodRanking]=useState<AdvancedRank[]>([]);
  const [annualStats,setAnnualStats]=useState<AdvancedRank[]>([]);
  const [rankingLoading,setRankingLoading]=useState(false);
  const [approvals,setApprovals]=useState<{session_id:string;user_id:string;reviewed_at:string}[]>([]);
  const [rankGame,setRankGame]=useState<Game>("poker");
  const [eventFilter,setEventFilter]=useState<"todos"|"agendados"|"encerrados">("agendados");
  const [form,setForm]=useState<CreateEvent>(defaultEvent);
  const [pollQuestion,setPollQuestion]=useState("");
  const [pollOptions,setPollOptions]=useState("Pizza\nHambúrguer\nChurrasco");
    const [liveSubtab,setLiveSubtab]=useState<LiveSubtab>("compra");
  const [showPastPolls,setShowPastPolls]=useState(false);
  const [showCreatePoll,setShowCreatePoll]=useState(false);
  const [showAddExpense,setShowAddExpense]=useState(false);
  const [cashoutFor,setCashoutFor]=useState("");
  const [cashoutDraft,setCashoutDraft]=useState("");
  const [purchaseFor,setPurchaseFor]=useState("");
  const [finalItems,setFinalItems]=useState<{session_id:string;user_id:string;chip_value:number;quantity:number}[]>([]);
  const [chipCashouts,setChipCashouts]=useState<{session_id:string;user_id:string;final_brl:number;updated_at:string}[]>([]);
  const [chipPayouts,setChipPayouts]=useState<{session_id:string;user_id:string;confirmed_at:string}[]>([]);
  const [expenseName,setExpenseName]=useState("");
  const [expenseAmount,setExpenseAmount]=useState("");
  const [expenseCategory,setExpenseCategory]=useState("food");
  const [expensePayer,setExpensePayer]=useState("");

  const reload=useCallback(async(mode:"full"|"list"="full")=>{
    const db=getSupabase();
    if(!db)throw new Error("A conexão com o Supabase ainda não está configurada.");
    if(mode==="full")fullDataRequested.current=true;
    // A agenda precisa de poucas coleções; o restante só é carregado
    // quando o usuário abre um evento, ranking, perfil ou administração.
    const lean=mode==="list";
    const skipped=Promise.resolve({data:[],error:null});
    const requests=await Promise.all([
      db.from("rooms").select("*").order("created_at",{ascending:false}),
      db.from("sessions").select("*").order("starts_at",{ascending:true}),
      db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path"),
      db.from("session_attendance").select("session_id,user_id"),
      lean?skipped:db.from("session_polls").select("*").order("created_at",{ascending:false}),
      lean?skipped:db.from("session_poll_options").select("*").order("position"),
      lean?skipped:db.from("session_poll_votes").select("poll_id,option_id,user_id"),
      lean?skipped:db.from("session_chip_purchases").select("*"),
      lean?skipped:db.from("session_chip_purchase_items").select("*"),
      lean?skipped:db.from("session_chip_results").select("*"),
      lean?skipped:db.from("session_expenses").select("*"),
      lean?skipped:db.from("session_finance_approvals").select("session_id,user_id,reviewed_at"),
      lean?skipped:db.rpc("get_player_stats",{p_game:null}),
      lean?skipped:db.from("expense_split_members").select("expense_id,session_id,user_id,joined_at"),
      db.rpc("get_my_expense_splits"),
      db.from("expense_split_settlements").select("expense_id,session_id,user_id,confirmed_at"),
      db.from("admin_hidden_events").select("session_id,previous_status,hidden_by,hidden_at"),
      lean?skipped:db.from("event_admin_audit").select("id,session_id,action,performed_by,occurred_at,description").order("occurred_at",{ascending:false}).limit(30),
      lean?skipped:db.rpc("get_player_stats_period",{p_game:null,p_period:"ano"}),
      lean?skipped:db.from("session_live_state").select("session_id,started_at,started_by"),
      lean?skipped:db.from("session_chip_final_items").select("session_id,user_id,chip_value,quantity"),
      lean?skipped:db.from("session_chip_payouts").select("session_id,user_id,confirmed_at"),
      lean?skipped:db.from("session_chip_cashouts").select("session_id,user_id,final_brl,updated_at"),
      lean?skipped:db.from("session_table_seats").select("session_id,user_id,seat_no,chosen_at")
    ]);
    requests.forEach(r=>{if(r.error)throw r.error});
    setRooms((requests[0].data||[]) as Room[]);
    setEvents((requests[1].data||[]) as Event[]);
    setLiveStates((requests[19].data||[]) as LiveState[]);
    setFinalItems((requests[20].data||[]) as {session_id:string;user_id:string;chip_value:number;quantity:number}[]);
    setChipPayouts((requests[21].data||[]) as {session_id:string;user_id:string;confirmed_at:string}[]);
    setChipCashouts((requests[22].data||[]) as {session_id:string;user_id:string;final_brl:number;updated_at:string}[]);
    setTableSeats((requests[23].data||[]) as TableSeat[]);
    const currentProfiles=(requests[2].data||[]) as Profile[];
    setProfiles(currentProfiles);
    const withPhotos=currentProfiles.filter(profile=>Boolean(profile.avatar_path));
    if(withPhotos.length){
      const {data:signed,error:signError}=await db.storage.from("player-avatars")
        .createSignedUrls(withPhotos.map(profile=>profile.avatar_path as string),3600);
      if(!signError&&signed){
        const urls:Record<string,string>={};
        for(let i=0;i<withPhotos.length;i++){
          const signedUrl=signed[i]?.signedUrl;
          if(signedUrl)urls[withPhotos[i].id]=signedUrl;
        }
        setPhotoUrls(urls);
      }else setPhotoUrls({});
    }else setPhotoUrls({});
    setAttendances((requests[3].data||[]) as Attendance[]);
    setPolls((requests[4].data||[]) as Poll[]);
    setChoices((requests[5].data||[]) as Choice[]);
    setVotes((requests[6].data||[]) as Vote[]);
    setBuys((requests[7].data||[]) as Buy[]);
    setChipItems((requests[8].data||[]) as BuyItem[]);
    setResults((requests[9].data||[]) as ChipResult[]);
    setExpenses((requests[10].data||[]) as Expense[]);
    setApprovals((requests[11].data||[]) as {session_id:string;user_id:string;reviewed_at:string}[]);
    setRanking((requests[12].data||[]) as Rank[]);
    setExpenseMembers((requests[13].data||[]) as {expense_id:string;session_id:string;user_id:string;joined_at:string}[]);
    setMySplits((requests[14].data||[]) as MyExpenseSplitRow[]);
    setSettlements((requests[15].data||[]) as ExpenseSettlement[]);
    setHiddenEvents((requests[16].data||[]) as HiddenEvent[]);
    setAdminAudits((requests[17].data||[]) as AdminAudit[]);
    setAnnualStats((requests[18].data||[]) as AdvancedRank[]);
  },[]);

  // O layout de (app) fica montado entre rotas: URL, voltar/avançar e
  // atualização de página reproduzem a mesma tela sem recarregar a SPA.
  useEffect(()=>{
    const sync=()=>{
      const state=readClubRoute(window.location.pathname,window.location.search);
      setPage(state.page);setSelectedId(state.selectedId);
      setDetailTab(state.detailTab);setGameView(state.gameView);setGameTab(state.gameTab);
      setRouteReady(true);
    };
    sync();
    window.addEventListener("popstate",sync);
    return()=>window.removeEventListener("popstate",sync);
  },[]);

  useEffect(()=>{
    if(!routeReady)return;
    const next=clubHref(page,selectedId,detailTab,gameView,gameTab);
    const now=window.location.pathname+window.location.search;
    if(next!==now)window.history.pushState({mesaMarcada:true},"",next);
  },[routeReady,page,selectedId,detailTab,gameView,gameTab]);

  // Leituras incrementais por área: evita as 24 consultas de reload()
  // quando outro participante escolhe cadeira, vota ou registra fichas.
  const refreshScope=useCallback(async(scope:UpdateScope)=>{
    const db=getSupabase();
    if(!db)return;
    const unwrap=<T,>(result:{data:T|null;error:{message:string}|null}):T=>{
      if(result.error)throw new Error(result.error.message);
      return result.data as T;
    };
    const merge=<T extends {session_id:string}>(prev:T[],data:T[],id:string):T[]=>[
      ...prev.filter(row=>row.session_id!==id),...data
    ];
    if(scope==="catalog"){
      const [eventRows,attendeeRows,hiddenRows]=await Promise.all([
        db.from("sessions").select("*").order("starts_at",{ascending:true}),
        db.from("session_attendance").select("session_id,user_id"),
        db.from("admin_hidden_events").select("session_id,previous_status,hidden_by,hidden_at")
      ]);
      setEvents(unwrap(eventRows) as Event[]);
      setAttendances(unwrap(attendeeRows) as Attendance[]);
      setHiddenEvents(unwrap(hiddenRows) as HiddenEvent[]);
      return;
    }
    if(scope==="profiles"){
      const result=await db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path");
      setProfiles(unwrap(result) as Profile[]);
      return;
    }
    if(!selectedId)return;
    if(scope==="presence"){
      const [attendance,seats,event]=await Promise.all([
        db.from("session_attendance").select("session_id,user_id").eq("session_id",selectedId),
        db.from("session_table_seats").select("session_id,user_id,seat_no,chosen_at").eq("session_id",selectedId),
        db.from("sessions").select("*").eq("id",selectedId).maybeSingle()
      ]);
      setAttendances(prev=>merge(prev,unwrap(attendance) as Attendance[],selectedId));
      setTableSeats(prev=>merge(prev,unwrap(seats) as TableSeat[],selectedId));
      const updated=unwrap(event) as Event|null;
      if(updated)setEvents(prev=>prev.map(ev=>ev.id===selectedId?updated:ev));
      return;
    }
    if(scope==="polls"){
      const [survey,options,voting]=await Promise.all([
        db.from("session_polls").select("*").eq("session_id",selectedId).order("created_at",{ascending:false}),
        db.from("session_poll_options").select("*").order("position"),
        db.from("session_poll_votes").select("poll_id,option_id,user_id")
      ]);
      setPolls(prev=>merge(prev,unwrap(survey) as Poll[],selectedId));
      setChoices(unwrap(options) as Choice[]);
      setVotes(unwrap(voting) as Vote[]);
      return;
    }
    if(scope==="expenses"){
      const [expensesForEvent,members,payments,personal,shares]=await Promise.all([
        db.from("session_expenses").select("*").eq("session_id",selectedId),
        db.from("expense_split_members").select("expense_id,session_id,user_id,joined_at").eq("session_id",selectedId),
        db.from("expense_split_settlements").select("expense_id,session_id,user_id,confirmed_at").eq("session_id",selectedId),
        db.rpc("get_my_expense_splits"),
        db.rpc("get_expense_split_shares",{p_event_id:selectedId})
      ]);
      setExpenses(prev=>merge(prev,unwrap(expensesForEvent) as Expense[],selectedId));
      setExpenseMembers(prev=>merge(prev,unwrap(members) as {expense_id:string;session_id:string;user_id:string;joined_at:string}[],selectedId));
      setSettlements(prev=>merge(prev,unwrap(payments) as ExpenseSettlement[],selectedId));
      setMySplits(unwrap(personal) as MyExpenseSplitRow[]);
      setExpenseShares(unwrap(shares) as ExpenseSplitRow[]);
      return;
    }
    if(scope==="timeline"){
      const result=await db.from("session_live_activity")
        .select("id,session_id,kind,actor_id,subject_id,occurred_at")
        .eq("session_id",selectedId).order("occurred_at",{ascending:false}).limit(100);
      setLiveActivities(unwrap(result) as LiveActivity[]);
      return;
    }
    if(scope==="chips"){
      const [purchases,items,resultsRows,finals,payouts,cashouts,approvalsRows,live]=await Promise.all([
        db.from("session_chip_purchases").select("*").eq("session_id",selectedId),
        db.from("session_chip_purchase_items").select("*"),
        db.from("session_chip_results").select("*").eq("session_id",selectedId),
        db.from("session_chip_final_items").select("session_id,user_id,chip_value,quantity").eq("session_id",selectedId),
        db.from("session_chip_payouts").select("session_id,user_id,confirmed_at").eq("session_id",selectedId),
        db.from("session_chip_cashouts").select("session_id,user_id,final_brl,updated_at").eq("session_id",selectedId),
        db.from("session_finance_approvals").select("session_id,user_id,reviewed_at").eq("session_id",selectedId),
        db.from("session_live_state").select("session_id,started_at,started_by").eq("session_id",selectedId)
      ]);
      setBuys(prev=>merge(prev,unwrap(purchases) as Buy[],selectedId));
      setChipItems(unwrap(items) as BuyItem[]);
      setResults(prev=>merge(prev,unwrap(resultsRows) as ChipResult[],selectedId));
      setFinalItems(prev=>merge(prev,unwrap(finals) as {session_id:string;user_id:string;chip_value:number;quantity:number}[],selectedId));
      setChipPayouts(prev=>merge(prev,unwrap(payouts) as {session_id:string;user_id:string;confirmed_at:string}[],selectedId));
      setChipCashouts(prev=>merge(prev,unwrap(cashouts) as {session_id:string;user_id:string;final_brl:number;updated_at:string}[],selectedId));
      setApprovals(prev=>merge(prev,unwrap(approvalsRows) as {session_id:string;user_id:string;reviewed_at:string}[],selectedId));
      setLiveStates(prev=>merge(prev,unwrap(live) as LiveState[],selectedId));
    }
  },[selectedId]);

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
        const lean=["inicio","eventos","mesas","mesa"].includes(entry.page);
        await reload(lean?"list":"full");
      }catch(e){if(alive)setError(errText(e));}
      finally{if(alive)setLoading(false);}
    })();
    const {data:{subscription}}=db.auth.onAuthStateChange(e=>{if(e==="SIGNED_OUT")window.location.replace("/login")});
    return()=>{alive=false;subscription.unsubscribe()};
  },[reload]);

  useEffect(()=>{
    if(!user)return;
    const db=getSupabase();
    if(!db)return;
    let active=true;
    setRankingLoading(true);
    void Promise.resolve(db.rpc("get_player_stats_period",{p_game:rankGame,p_period:"ano"}))
      .then(({data,error:rankingError})=>{
        if(!active)return;
        if(rankingError)setError("Ranking indisponível: "+rankingError.message);
        else setPeriodRanking((data||[]) as AdvancedRank[]);
      }).finally(()=>{if(active)setRankingLoading(false);});
    return()=>{active=false};
  },[user,rankGame,events,buys,results,approvals]);

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
    if(!user||!routeReady||fullDataRequested.current)return;
    if(!["detalhe","perfil","ranking","admin"].includes(page))return;
    setDetailLoading(true);
    void reload().catch(e=>setError("Não foi possível carregar esta área: "+errText(e)))
      .finally(()=>setDetailLoading(false));
  },[user,routeReady,page,reload]);

  const refreshLive=useCallback(async(showLoading=false)=>{
    if(!selectedId||!user)return;
    const db=getSupabase();
    if(!db)throw new Error("Conexão indisponível para consultar a linha do tempo.");
    if(showLoading)setLiveLoading(true);
    try{
      const [state,activity]=await Promise.all([
        db.from("session_live_state")
          .select("session_id,started_at,started_by").eq("session_id",selectedId).maybeSingle(),
        db.from("session_live_activity")
          .select("id,session_id,kind,actor_id,subject_id,occurred_at")
          .eq("session_id",selectedId).order("occurred_at",{ascending:false}).limit(100)
      ]);
      if(state.error)throw state.error;
      if(activity.error)throw activity.error;
      setLiveStates(prev=>[
        ...prev.filter(item=>item.session_id!==selectedId),
        ...(state.data?[state.data as LiveState]:[])
      ]);
      setLiveActivities((activity.data||[]) as LiveActivity[]);
    }finally{
      if(showLoading)setLiveLoading(false);
    }
  },[selectedId,user]);

  useEffect(()=>{
    if(!user||!selectedId||page!=="detalhe"||detailTab!=="visao")return;
    const db=getSupabase();
    if(!db)return;
    let active=true;
    const refresh=()=>{
      if(document.visibilityState==="hidden")return;
      void db.from("session_table_seats").select("session_id,user_id,seat_no,chosen_at")
        .eq("session_id",selectedId).then(({data,error:seatError})=>{
          if(!active)return;
          if(seatError){setError("Não foi possível atualizar os assentos: "+seatError.message);return;}
          setTableSeats(previous=>[
            ...previous.filter(st=>st.session_id!==selectedId),...((data||[]) as TableSeat[])
          ]);
        });
    };
    refresh();
    const t=window.setInterval(refresh,12000);
    return()=>{active=false;window.clearInterval(t);};
  },[user,selectedId,page,detailTab]);

  useEffect(()=>{
    if(!user||!selectedId||page!=="detalhe"||detailTab!=="ao-vivo")return;
    let active=true;
    const tick=()=>{
      if(document.visibilityState==="hidden")return;
      void refreshLive().catch(e=>{if(active)setError("Linha do tempo: "+errText(e));});
    };
    tick();
    const handleVisibility=()=>{if(document.visibilityState==="visible")tick()};
    document.addEventListener("visibilitychange",handleVisibility);
    const timer=window.setInterval(tick,15000);
    return()=>{
      active=false;
      document.removeEventListener("visibilitychange",handleVisibility);
      window.clearInterval(timer);
    };
  },[user,selectedId,page,detailTab,refreshLive]);

  useEffect(()=>{
    if(!user||!selectedId){setFinanceRows([]);setExpenseShares([]);return;}
    const db=getSupabase();
    if(!db)return;
    let active=true;
    setFinanceLoading(true);
    void Promise.all([
      db.rpc("get_event_finances",{p_event_id:selectedId}),
      db.rpc("get_expense_split_shares",{p_event_id:selectedId})
    ]).then(([finance,split])=>{
      if(!active)return;
      if(finance.error||split.error){
        setFinanceRows([]);setExpenseShares([]);
        setError("Não foi possível atualizar os gastos: "+(finance.error?.message||split.error?.message));
      }else{
        setFinanceRows((finance.data||[]) as FinanceLine[]);
        setExpenseShares((split.data||[]) as ExpenseSplitRow[]);
      }
    }).finally(()=>{if(active)setFinanceLoading(false);});
    return()=>{active=false};
  },[user,selectedId,approvals,attendances,buys,results,expenses,expenseMembers]);

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

  async function startLiveEvent(eventId:string){
    if(!window.confirm("Iniciar o Evento ao Vivo? Os participantes confirmados poderão acompanhar a linha do tempo da partida."))return;
    const db=getSupabase();
    if(!db||!user)return;
    setWorking(true);setMessage("");setError("");
    try{
      const {error:startError}=await db.rpc("start_live_event",{p_event_id:eventId});
      if(startError)throw startError;
      await Promise.all([refreshScope("chips"),refreshScope("catalog")]);
      setDetailTab("ao-vivo");setLiveSubtab("compra");
      setMessage("Evento ao Vivo iniciado! Os registros da mesa aparecem na linha do tempo.");
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
      await Promise.all([refreshScope("chips"),refreshScope("catalog")]);
      setDetailTab("resumo-evento");
      setMessage("Partida encerrada! Resumo da noite disponível.");
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
      if(scope)await Promise.all((Array.isArray(scope)?scope:[scope]).map(item=>refreshScope(item)));
      else await reload();
      setMessage(success);
    }catch(e){setError(errText(e));}
    finally{setWorking(false);}
  }

  const nameFor=(id:string)=>profiles.find(p=>p.id===id)?.display_name||"Jogador";
  const roomFor=(id:string)=>rooms.find(r=>r.id===id);
  const roomTitle=(id:string)=>roomFor(id)?.name||"Mesa";
  const nickname=user?nameFor(user.id):"Jogador";
  const ownProfile=profiles.find(p=>p.id===user?.id);
  const firstName=nickname.split(" ")[0];
  const activeRooms=(["poker","blackjack"] as Game[]).map(g=>rooms.find(r=>r.game===g&&r.status==="active")).filter((r):r is Room=>Boolean(r));
  // A RLS oculta eventos excluídos dos usuários comuns, mas Admin os recebe
  // para restauração. Apenas a Administração utiliza a lista completa.
  const hiddenEventIds=new Set(hiddenEvents.map(h=>h.session_id));
  const agendaEvents=events.filter(e=>!hiddenEventIds.has(e.id));
  // Evita apresentar eventos históricos ou excluídos como "Sua próxima noite".
  const upcoming=agendaEvents.filter(e=>e.status==="scheduled"&&new Date(e.starts_at).getTime()>=Date.now())
    .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  const myUpcoming=upcoming.filter(e=>attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id));
  const selected=events.find(e=>e.id===selectedId);
  const selectedLive=liveStates.find(l=>l.session_id===selectedId);
  const eventLiveActivities=liveActivities.filter(a=>a.session_id===selectedId);
  const guests=selected?attendances.filter(a=>a.session_id===selected.id):[];
  const selectedGame:Game=selected?(roomFor(selected.room_id)?.game||"poker"):"poker";
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

  async function recordPurchase(quantities:number[]):Promise<boolean>{
    const db=getSupabase();
    if(!db||!user||!selected){setError("Entre em um evento para registrar fichas.");return false;}
    if(!(organizer||isAdmin)&&!attendances.some(a=>a.session_id===selected.id&&a.user_id===user.id)){
      setError("Escolha uma cadeira antes de comprar fichas.");
      return false;
    }
    setWorking(true);setError("");setMessage("");
    try{
      const {error:purchaseError}=await db.rpc("record_chip_purchase_for",{
        p_event_id:selected.id,p_quantities:quantities,p_user_id:organizer||isAdmin?(purchaseFor||attendances.find(a=>a.session_id===selected.id)?.user_id||user.id):user.id
      });
      if(purchaseError)throw purchaseError;
      await refreshScope("chips");
      setMessage("Compra registrada! Quantidades, pontos e valor calculados pelo Supabase.");
      return true;
    }catch(e){setError(errText(e));return false;}
    finally{setWorking(false);}
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
    setShowPastPolls(false);setShowCreatePoll(false);setShowAddExpense(false);
    setPage("detalhe");setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
    if(sub==="gastos")window.setTimeout(()=>document.getElementById("event-expenses")?.scrollIntoView({behavior:"smooth",block:"start"}),140);
  }
  function go(next:View){
    setPage(next);setError("");setMessage("");window.scrollTo({top:0,behavior:"auto"});
  }
  function openGame(game:Game,tab:"eventos"|"tutorial"="eventos"){
    setGameView(game);setGameTab(tab);setPage("mesa");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"auto"});
  }
  function openCreator(roomId?:string){
    const room=(roomId?activeRooms.find(r=>r.id===roomId):undefined)||activeRooms.find(r=>r.game==="poker")||activeRooms[0];
    setForm({...defaultEvent,room_id:room?.id||"",max_participants:room?.game==="blackjack"?"6":"8"});
    setModal("evento");setError("");setMessage("");
  }
  async function addEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    await act(async(db,id)=>{
      const room=activeRooms.find(r=>r.id===form.room_id);
      if(!room)throw new Error("Selecione Poker ou Blackjack para criar o evento.");
      if(!form.starts_at)throw new Error("Informe data e horário.");
      if(Number(form.max_participants)>10||Number(form.max_participants)<2)throw new Error("A mesa admite de 2 a 10 participantes.");
       const {data,error:eventError}=await db.from("sessions").insert({
        room_id:room.id,organizer_id:id,title:form.name.trim(),
        starts_at:new Date(form.starts_at).toISOString(),location:form.location.trim(),
        min_entry_brl:Number(form.min_entry_brl),max_participants:Number(form.max_participants),
         visibility:form.visibility,
        chip_pricing_special:form.chip_pricing_special,
        chip_price_1_brl:form.chip_pricing_special?Number(form.chip_price_1_brl):1,
        chip_price_5_brl:form.chip_pricing_special?Number(form.chip_price_5_brl):5,
        chip_price_10_brl:form.chip_pricing_special?Number(form.chip_price_10_brl):0.10,
        chip_price_25_brl:form.chip_pricing_special?Number(form.chip_price_25_brl):0.25,
        chip_price_50_brl:form.chip_pricing_special?Number(form.chip_price_50_brl):0.50
      }).select("id").single();
      if(eventError)throw eventError;
      setModal(null);openEvent(data.id,"visao");
    },"Evento criado! Escolham uma cadeira para participar.");
  }
  async function chooseSeat(seatNo:number|null){
    if(!selected)return;
    await act(async db=>{
      const {error:seatError}=await db.rpc("choose_table_seat",{p_event_id:selected.id,p_seat_no:seatNo});
      if(seatError)throw seatError;
    },seatNo===null?"Você saiu da mesa.":seatNo===0?"Você assumiu o crupiê e entrou no evento.":"Você entrou no evento! Assento reservado.",["presence","catalog"]);
  }

  async function createPoll(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!selected)return;
    await act(async(db,id)=>{
      const labels=pollOptions.split(/\n|;/).map(x=>x.trim()).filter(Boolean);
      if(labels.length<2)throw new Error("Informe pelo menos duas opções (uma por linha).");
      if(labels.length>41)throw new Error("Máximo de 41 opções.");
      const {data,error:pollError}=await db.from("session_polls").insert({session_id:selected.id,created_by:id,question:pollQuestion.trim()}).select("id").single();
      if(pollError)throw pollError;
      const {error:choiceError}=await db.from("session_poll_options").insert(labels.map((label,position)=>({poll_id:data.id,label,position})));
      if(choiceError)throw new Error("A enquete foi criada, mas faltou cadastrar as opções: "+choiceError.message);
      setPollQuestion("");
    },"Enquete criada!","polls");
  }
  const visibleEvents=agendaEvents.filter(e=>eventFilter==="todos"||
    (eventFilter==="agendados"?e.status==="scheduled":e.status!=="scheduled"));

  if(loading)return <main className="mm-login-shell"><p className="mm-loading">Preparando sua mesa...</p></main>;
  if(!user)return <main className="mm-login-shell"><div className="mm-login-card"><SiteLogo kind="mobile"/><p className="mm-message">{error||"Redirecionando para login..."}</p><a href="/login" className="btn gold">Ir para o login</a></div></main>;

  const navEntries:[View,string,UiIconName][]=[
    ["inicio","Início","home"],
    ["eventos","Eventos","calendar"],
    ["mesas","Mesas","cards"],
    ["ranking","Ranking","trophy"],
    ["perfil","Perfil","user"],
    ...(isAdmin?[["admin","Administração","settings"] as [View,string,UiIconName]]:[])
  ];
  const activePage=page==="detalhe"?"eventos":page==="mesa"?"mesas":page;
  const mobileNavEntries=navEntries.filter(([id])=>
    id==="inicio"||id==="eventos"||id==="ranking"||id==="perfil"
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
        <div className="breadcrumb">Mesa Marcada　/　{page==="inicio"?"Visão geral":page==="detalhe"?"Evento":page==="mesa"?"Mesa de "+gameName(gameView):page==="eventos"?"Eventos":page==="mesas"?"Mesas":page==="perfil"?"Perfil":page==="admin"?"Administração":"Ranking"}</div>
        <div className="mm-connection-group">
          <span className={"mm-sync-pill "+connection} role="status" aria-live="polite"
            title={connection==="connected"?"Atualizações em tempo real ativas":connection==="offline"?"Sem conexão; atualiza ao reconectar":"Sincronizando dados"}>
            <span className="mm-sync-dot" aria-hidden="true"/>
            {connection==="connected"?"Em tempo real":connection==="offline"?"Sem conexão":"Sincronizando"}
          </span>
          <span className="pill"><UiIcon name={isAdmin?"settings":"user"} size={14}/>{isAdmin?"Administrador":firstName}</span>
        </div>
      </div>
      {detailLoading&&<p className="mm-message" role="status" style={{marginBottom:12}}>Carregando dados desta área...</p>}
      {error&&<p className="mm-message error" role="alert" style={{marginBottom:16}}>{error}</p>}
      {message&&<p className="mm-message" role="status" style={{marginBottom:16}}>{message}</p>}

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
        </div>
        {!visibleEvents.length&&<div className="panel mm-empty"><span className="mm-empty-symbol">♠</span><h2>Nenhum evento por aqui</h2><p>Que tal organizar a próxima noite?</p><button className="btn gold" onClick={()=>openCreator()}><UiIcon name="plus" size={18}/> Criar evento</button></div>}
      </>}

      {page==="mesas"&&<>
        <div className="heading">
          <div><div className="eyebrow">ESCOLHA SEU JOGO</div><h1>Mesas</h1><p>Dois jogos, um lugar para organizar cada rodada. Escolha uma mesa para ver os eventos e aprender as regras.</p></div>
        </div>
        <div className="mm-rooms mm-permanent-tables">
          {(["poker","blackjack"] as Game[]).map(game=>{
            const room=activeRooms.find(r=>r.game===game);
            const count=agendaEvents.filter(e=>room&&e.room_id===room.id).length;
            return <article className="roomcard mm-fixed-roomcard" key={game}>
              <div className={"roombanner mm-room-banner "+(game==="blackjack"?"blackjack":"")}>
                <span className={"tag "+game}>{gameName(game)}</span>
                <span className="mm-room-suit" aria-hidden="true">{game==="poker"?"♠":"♦"}</span>
              </div>
              <div className="mm-room-card-content">
                <h2>{game==="poker"?"Poker · Texas Hold’em":"Blackjack · 21"}</h2>
                <p>{game==="poker"?"Combine suas cartas, domine as mãos e organize uma noite de Poker.":"Aprenda a chegar perto de 21 sem estourar e desafie o dealer."}</p>
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
            <div className="eyebrow">MESA FIXA · {gameView==="poker"?"TEXAS HOLD’EM":"JOGO DO 21"}</div>
            <h1>{gameName(gameView)}</h1>
            <p>{gameView==="poker"?"Escolha as melhores cartas, organize eventos e consulte o ranking das mãos.":"Organize um encontro, consulte as regras e calcule o valor das suas cartas."}</p>
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
            <span className="mm-empty-symbol">{gameView==="poker"?"♠":"♦"}</span>
            <h2>Nenhum evento de {gameName(gameView)} ainda</h2>
            <p>Crie um evento nesta mesa e convide seus amigos.</p>
            <button type="button" className="btn gold" onClick={()=>openCreator(activeRooms.find(r=>r.game===gameView)?.id)}><UiIcon name="plus" size={18}/> Criar evento</button>
          </div>}
        </>}
        {gameTab==="tutorial"&&<TableTutorial game={gameView}/>}
      </>}

      {page==="ranking"&&<AdvancedRankingPanel
        game={rankGame} onGameChange={setRankGame}
        ranking={periodRanking} busy={rankingLoading} photoUrls={photoUrls}
        onPlayer={id=>{setProfileReturn("ranking");setProfileId(id);go("perfil")}}
      />}

      {page==="admin"&&isAdmin&&<AdminPanel
        events={events} profiles={profiles} attendances={attendances} buys={buys}
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
      <PlayerAchievements stats={annualStats} userId={profileId||user.id}/>
      {(profileId||user.id)===user.id&&<MySplitsSummary
        splits={mySplits} settlements={settlements} userId={user.id} nameFor={nameFor}
        onOpenEvent={eventId=>openEvent(eventId,"gastos")}

      />}
      </>}

      {page==="detalhe"&&selected&&<>
        <button type="button" className="back" onClick={()=>go("eventos")}>← Voltar aos eventos</button>
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
                ?"Inicie a partida na aba Ao vivo para liberar o encerramento.":"Para encerrar, confira compras, resultados e repasses no Ao vivo."}
              </p>}
            {selected.visibility==="private"
               ?<PrivateInviteShare eventId={selected.id} title={selected.title}
                   canInvite={organizer||isAdmin} status={selected.status}/>
               :<EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>}

          </div>
        </section>
        <div className="mm-detail-tabs" role="tablist" aria-label="Conteúdo deste evento">
          {([["visao","Visão geral"],["ao-vivo","Ao vivo"],
    ...(selected.status==="finished"?[["resumo-evento","Resumo do evento"] as const]:[])] as const).map(([id,title])=><button type="button" key={id} className={detailTab===id?"active":""} role="tab" aria-selected={detailTab===id} onClick={()=>{setDetailTab(id);if(id==="ao-vivo")setLiveSubtab("compra")}}>{title}</button>)}
        </div>

        {detailTab==="ao-vivo"&&privateVisible&&selectedLive&&selected.status==="scheduled"&&<div className="mm-live-subnav" role="tablist" aria-label="Áreas do Ao vivo">{([["compra","Compra"],["resumo","Resumo"],["encerrar","Encerrar"]] as const).map(([id,title])=><button type="button" role="tab" aria-selected={liveSubtab===id} className={liveSubtab===id?"active":""} key={id} onClick={()=>setLiveSubtab(id)}>{title}</button>)}</div>}
        {detailTab==="ao-vivo"&&(!selectedLive||liveSubtab==="resumo")&&selected.status==="scheduled"&&<EventLivePanel
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

        {detailTab==="visao"&&<>
        <SeatingTable game={selectedGame}
          capacity={selected.max_participants} seats={seatedGuests}
          myId={user.id} confirmed={meConfirmed}
          canChange={selected.status==="scheduled"&&!Boolean(selectedLive)}
          busy={working} nameFor={nameFor}
          onChoose={seatNo=>void chooseSeat(seatNo)}/>

          <div className="two">
          <section className="panel">
            <div className="panelhead"><h2>Participantes</h2><span className="tag">{guests.length}/{selected.max_participants}</span></div>
            <div className="mm-progress"><div style={{width:(Math.min(1,guests.length/selected.max_participants)*100)+"%"}}/></div>
            <div className="mm-chipgroup">{guests.map(g=><button className="mm-v09-attendee-link" type="button" key={g.user_id}
              onClick={()=>{setProfileReturn("detalhe");setProfileId(g.user_id);go("perfil")}}>
              <AttendeeMiniCard photoUrl={photoUrls[g.user_id]} name={nameFor(g.user_id)}/>
            </button>)}</div>
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
          </section>
        </div>


        <div id="event-polls" className="mm-overview-polls">
          <div className="stack">
            <section className="panel">
              <div className="panelhead"><h2>Enquetes abertas</h2><span className="tag">{openPolls.length}</span></div>
              <div className="mm-overview-poll-actions">
                {eventPolls.some(p=>p.is_closed)&&<button type="button" className="btn" onClick={()=>setShowPastPolls(x=>!x)}>
                  {showPastPolls?"Ocultar encerradas":"Ver enquetes encerradas"}</button>}
                <button type="button" className="btn" onClick={()=>setShowCreatePoll(x=>!x)}>
                  {showCreatePoll?"Fechar formulário":"＋ Nova enquete"}</button>
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
          {showCreatePoll&&<section className="panel">
            <h2>Criar enquete</h2>
            <p style={{margin:"9px 0 15px"}}>Cada participante pode votar uma vez e mudar de ideia até o encerramento.</p>
            <form className="mm-form-stack" onSubmit={createPoll}>
              <label className="mm-field">Pergunta<input minLength={2} required value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="O que vamos comer?"/></label>
              <label className="mm-field">Opções, uma por linha<textarea required rows={5} value={pollOptions} onChange={e=>setPollOptions(e.target.value)}/></label>
              <button className="btn gold" disabled={!meConfirmed||selected.status!=="scheduled"||working}><UiIcon name="plus" size={18}/> Criar enquete</button>
            </form>
            {!meConfirmed&&<p className="mm-formfoot">Escolha uma cadeira para participar das enquetes.</p>}
          </section>}
        </div>
        <section id="event-expenses" className="mm-overview-expenses" aria-label="Despesas e rachas">
          {privateVisible&&<div className="mm-overview-expense-tools">
            <button type="button" className="btn" aria-expanded={showAddExpense}
              onClick={()=>setShowAddExpense(open=>!open)}>
              {showAddExpense?"Fechar formulário":"＋ Adicionar despesa"}
            </button>
          </div>}
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
            createForm={showAddExpense?<section className="panel">
                <h2>Adicionar despesa</h2><p style={{margin:"9px 0 16px"}}>Comidas, bebidas e materiais da noite.</p>
                <form className="mm-form-stack" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error:expenseError}=await db.from("session_expenses").insert({session_id:selected.id,created_by:id,paid_by:organizer&&guests.some(g=>g.user_id===expensePayer)?expensePayer:id,label:expenseName.trim(),category:expenseCategory,amount_brl:Number(expenseAmount)});
                  if(expenseError)throw expenseError;setExpenseName("");setExpenseAmount("");
                },"Despesa registrada!","expenses")}}>
                  <label className="mm-field">Descrição<input minLength={2} required value={expenseName} onChange={e=>setExpenseName(e.target.value)} placeholder="Pizza e bebidas"/></label>
                  <div className="mm-form-grid">
                    <label className="mm-field">Valor (R$)<input type="number" min="0.01" step="0.01" required value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label>
                    <label className="mm-field">Categoria<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option value="food">Comida</option><option value="drinks">Bebidas</option><option value="materials">Materiais</option><option value="other">Outros</option></select></label>
                  </div>
                  <label className="mm-field">Quem pagou?
                    {organizer?<select value={expensePayer||user.id} onChange={e=>setExpensePayer(e.target.value)}>
                      {guests.map(g=><option key={g.user_id} value={g.user_id}>{nameFor(g.user_id)}{g.user_id===user.id?" (eu)":""}</option>)}
                    </select>:<input disabled readOnly value={nickname+" (eu)"}/>}
                  </label>
                  <button className="btn gold" disabled={working||!meConfirmed||selected.status!=="scheduled"}>Salvar despesa</button>
                </form>
              </section>:null}
          />
        }
        </section>

        </>}
        {detailTab==="ao-vivo"&&selectedLive&&selected.status==="scheduled"&&privateVisible&&(liveSubtab==="compra"||liveSubtab==="encerrar")&&<>
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

        {selected.status==="finished"&&detailTab==="ao-vivo"&&<section className="panel mm-night-redirect">
          <h2>Partida encerrada</h2><p>O Ao vivo terminou. Consulte os resultados no Resumo do evento.</p>
          <button className="btn gold" type="button" onClick={()=>setDetailTab("resumo-evento")}>Ver Resumo da noite →</button>
        </section>}
        {detailTab==="resumo-evento"&&selected.status==="finished"&&
          (privateVisible?<NightSummary guests={guests} buys={eventBuys} cashouts={eventCashouts}
            expenses={eventExpenses} shares={eventExpenseShares} hostId={selected.organizer_id}
            currentUserId={user.id} nameFor={nameFor} eventFinished title={selected.title}
            startsAt={selected.starts_at} location={selected.location} game={gameName(selectedGame)}/>:
          <section className="panel"><p>Confirme sua presença para consultar o resumo financeiro do evento.</p></section>)}
      </>}

      <MobileAppCompanion onUpdate={reload} visible={page==="inicio"}/>
      <footer className="mm-formfoot" style={{marginTop:35}}>Mesa Marcada · Organize seus encontros. Valores em reais são apenas registros informativos.</footer>
    </main>

    <button className="mm-fab" aria-label="Criar evento" title="Criar evento" type="button" onClick={()=>openCreator()}><UiIcon name="plus" size={29}/></button>

    {modal==="evento"&&<div ref={modalOverlayRef} className="mm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="mm-modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title" tabIndex={-1}>
        <header><div><div className="eyebrow">ORGANIZAR UMA NOITE</div><h2 id="new-event-title">Criar evento</h2></div><button className="mm-close" type="button" aria-label="Fechar" onClick={()=>setModal(null)}><UiIcon name="close" size={22}/></button></header>
        <form className="mm-form-stack" onSubmit={addEvent}>
          <label className="mm-field">Escolha a mesa
            <select value={form.room_id} onChange={e=>{
              const newRoom=activeRooms.find(room=>room.id===e.target.value);
              setForm({...form,room_id:e.target.value,max_participants:newRoom?.game==="blackjack"?"6":"8"});
            }} required>
              <option value="" disabled>Selecione Poker ou Blackjack</option>
              {(["poker","blackjack"] as Game[]).map(g=>{
                const table=activeRooms.find(r=>r.game===g);
                return <option key={g} value={table?.id||""} disabled={!table}>{g==="poker"?"♠ Poker":"♦ Blackjack"}</option>;
              })}
            </select>
          </label>
          <label className="mm-field">Nome do evento<input required minLength={2} maxLength={100} placeholder="Ex.: Poker de Sexta" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="mm-field">Privacidade do evento
             <select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value as "public"|"private"})}>
               <option value="public">Público · visível aos jogadores cadastrados</option>
               <option value="private">Privado · somente convidados com link ou QR Code</option>
             </select>
           </label>
           <div className="mm-form-grid">
            <label className="mm-field">Data e horário<input type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
            <label className="mm-field">Local<input minLength={2} maxLength={200} required placeholder="Ex.: Casa do Bruno" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
          </div>
          <div className="mm-form-grid">
            <label className="mm-field">Entrada mínima (R$)<input type="number" min={0} step="0.01" required value={form.min_entry_brl} onChange={e=>setForm({...form,min_entry_brl:e.target.value})}/></label>
            <label className="mm-field">Vagas (cadeiras)<input type="number" min={2} max={10} step={1} required value={form.max_participants} onChange={e=>setForm({...form,max_participants:e.target.value})}/></label>
          </div>
          <div className="mm-denom-event-setting">
            <label className="mm-denom-special-switch">
              <input type="checkbox" checked={form.chip_pricing_special}
                onChange={e=>setForm({...form,chip_pricing_special:e.target.checked})}/>
              <span><strong>★ Evento especial</strong><small>Personalizar o preço de cada ficha somente neste evento</small></span>
            </label>
            {form.chip_pricing_special?<div className="mm-denom-price-grid">
              {chipPriceFields.map(field=><label className="mm-field" key={field.key}>
                Ficha {field.value} · R$
                <input type="number" min="0.01" max="1000" step="0.01" required
                  value={form[field.key]} onChange={e=>setForm({...form,[field.key]:e.target.value})}/>
              </label>)}
              <p className="mm-formfoot">Os preços personalizados ficam bloqueados após a primeira compra deste evento.</p>
            </div>:<p className="mm-formfoot">Padrão: ficha 1 = R$ 1,00 · ficha 5 = R$ 5,00 · ficha 10 = R$ 0,10 · ficha 25 = R$ 0,25 · ficha 50 = R$ 0,50.</p>}
          </div>
          <div className="mm-create-seat-preview"><strong>♠ ♦ Assentos interativos</strong>
            <span>Após criar o evento, você irá diretamente para a mesa. Os convidados confirmados poderão escolher seus lugares{activeRooms.find(r=>r.id===form.room_id)?.game==="blackjack"?", inclusive a cadeira exclusiva do crupiê":""}.</span>
          </div>
          <p className="mm-formfoot">{form.visibility==="private"?"Somente convidados autorizados terão acesso. Após criar, gere o convite e compartilhe o QR Code.":"Todos os usuários cadastrados poderão ver este evento."}</p>
          {error&&<p className="mm-message error" role="alert">{error}</p>}
          <div className="mm-form-actions"><button type="button" className="btn" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="btn gold" disabled={working}>{working?"Salvando...":"Criar evento →"}</button></div>
        </form>
      </div>
    </div>}

  </div>;
}
