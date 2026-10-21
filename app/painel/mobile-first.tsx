"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, View, DetailTab, Profile, Room, Event, Attendance, Poll, Choice, Vote, Buy, BuyItem, ChipResult, Expense, Rank } from "@/lib/mesa-types";
import { money, fullDate, eventTime, gameName, errText } from "@/lib/mesa-types";
import TableTutorial from "./table-tutorial";
import "../v05-theme.css";
import {AttendeeMiniCard,EventShareActions,FinanceReviewBoard,PlayerAvatar,ProfilePanel,RankingPanel} from "./v09-features";
import type {FinanceLine} from "./v09-features";
import ChipPurchaseForm from "./chip-purchase-form";
import SiteLogo from "./site-logo";
import {prepareProfilePhoto} from "./photo-utils";
import {ExpenseSplitsPanel,MySplitsSummary} from "./expense-splits";
import type {ExpenseSplitRow,MyExpenseSplitRow} from "./expense-splits";

type ChipPriceKey="chip_price_1_brl"|"chip_price_5_brl"|"chip_price_10_brl"|"chip_price_25_brl"|"chip_price_50_brl";
const chipPriceFields:{value:number;key:ChipPriceKey}[]=[
  {value:1,key:"chip_price_1_brl"},
  {value:5,key:"chip_price_5_brl"},
  {value:10,key:"chip_price_10_brl"},
  {value:25,key:"chip_price_25_brl"},
  {value:50,key:"chip_price_50_brl"}
];
type CreateEvent = {room_id:string;name:string;starts_at:string;location:string;min_entry_brl:string;max_participants:string;chip_pricing_special:boolean}&Record<ChipPriceKey,string>;
const defaultEvent:CreateEvent={room_id:"",name:"",starts_at:"",location:"",min_entry_brl:"0",max_participants:"10",chip_pricing_special:false,chip_price_1_brl:"1.00",chip_price_5_brl:"5.00",chip_price_10_brl:"0.10",chip_price_25_brl:"0.25",chip_price_50_brl:"0.50"};
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

function EventTile({value,room,count,confirmed,busy,open,onConfirm}:{value:Event;room?:Room;count:number;confirmed:boolean;busy:boolean;open:()=>void;onConfirm:()=>void}){
  const game=room?.game||"poker";
  return <article className="mm-event-card">
    <GameBanner game={game}/>
    <div className="mm-event-content">
      <div className="mm-title-actions"><h3>{value.title}</h3><span className={"tag "+(value.status==="scheduled"?game:"archive")}>{value.status==="scheduled"?"Agendado":value.status==="finished"?"Encerrado":"Cancelado"}</span></div>
      <div className="mm-event-info"><span>◷ {fullDate(value.starts_at)}</span><span>⌖ {value.location}</span></div>
      <div className="mm-event-occupancy"><span>{count} de {value.max_participants} confirmados</span><span>{Math.max(0,value.max_participants-count)} vagas</span></div>
      <div className="mm-progress" aria-hidden="true"><div style={{width:(Math.min(1,count/value.max_participants)*100)+"%"}}/></div>
      <div className="mm-v09-event-actions">
        <button type="button" className={confirmed?"btn mm-v09-confirmed":"btn gold"}
          disabled={confirmed||busy||value.status!=="scheduled"||count>=value.max_participants}
          onClick={onConfirm}>{confirmed?"✓ Presença confirmada":"✓ Confirmar presença"}</button>
        <button type="button" className="btn" onClick={open}>Detalhes →</button>
      </div>
    </div>
  </article>;
}

export default function PainelPage(){
  const [user,setUser]=useState<{id:string;email?:string}|null>(null);
  const [isAdmin,setIsAdmin]=useState(false);
  const [page,setPage]=useState<View>("inicio");
  const [detailTab,setDetailTab]=useState<DetailTab>("visao");
  const [selectedId,setSelectedId]=useState("");
  const [profileId,setProfileId]=useState("");
  const [profileReturn,setProfileReturn]=useState<View>("ranking");
  const [financeRows,setFinanceRows]=useState<FinanceLine[]>([]);
  const [financeLoading,setFinanceLoading]=useState(false);
  const [gameView,setGameView]=useState<Game>("poker");
  const [gameTab,setGameTab]=useState<"eventos"|"tutorial">("eventos");
  const [modal,setModal]=useState<Modal>(null);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [rooms,setRooms]=useState<Room[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
  const [attendances,setAttendances]=useState<Attendance[]>([]);
  const [polls,setPolls]=useState<Poll[]>([]);
  const [choices,setChoices]=useState<Choice[]>([]);
  const [votes,setVotes]=useState<Vote[]>([]);
  const [buys,setBuys]=useState<Buy[]>([]);
  const [chipItems,setChipItems]=useState<BuyItem[]>([]);
  const [results,setResults]=useState<ChipResult[]>([]);
  const [expenses,setExpenses]=useState<Expense[]>([]);
  const [expenseMembers,setExpenseMembers]=useState<{expense_id:string;session_id:string;user_id:string;joined_at:string}[]>([]);
  const [expenseShares,setExpenseShares]=useState<ExpenseSplitRow[]>([]);
  const [mySplits,setMySplits]=useState<MyExpenseSplitRow[]>([]);
  const [ranking,setRanking]=useState<Rank[]>([]);
  const [approvals,setApprovals]=useState<{session_id:string;user_id:string;reviewed_at:string}[]>([]);
  const [rankGame,setRankGame]=useState<Game>("poker");
  const [eventFilter,setEventFilter]=useState<"todos"|"agendados"|"encerrados">("agendados");
  const [form,setForm]=useState<CreateEvent>(defaultEvent);
  const [pollQuestion,setPollQuestion]=useState("");
  const [pollOptions,setPollOptions]=useState("Pizza\nHambúrguer\nChurrasco");
  const [finalChips,setFinalChips]=useState("");
  const [expenseName,setExpenseName]=useState("");
  const [expenseAmount,setExpenseAmount]=useState("");
  const [expenseCategory,setExpenseCategory]=useState("food");
  const [expensePayer,setExpensePayer]=useState("");

  const reload=useCallback(async()=>{
    const db=getSupabase();
    if(!db)throw new Error("A conexão com o Supabase ainda não está configurada.");
    const requests=await Promise.all([
      db.from("rooms").select("*").order("created_at",{ascending:false}),
      db.from("sessions").select("*").order("starts_at",{ascending:true}),
      db.from("profiles").select("id,display_name,avatar_symbol,favorite_game,bio,avatar_path"),
      db.from("session_attendance").select("session_id,user_id"),
      db.from("session_polls").select("*").order("created_at",{ascending:false}),
      db.from("session_poll_options").select("*").order("position"),
      db.from("session_poll_votes").select("poll_id,option_id,user_id"),
      db.from("session_chip_purchases").select("*"),
      db.from("session_chip_purchase_items").select("*"),
      db.from("session_chip_results").select("*"),
      db.from("session_expenses").select("*"),
      db.from("session_finance_approvals").select("session_id,user_id,reviewed_at"),
      db.rpc("get_player_stats",{p_game:null}),
      db.from("expense_split_members").select("expense_id,session_id,user_id,joined_at"),
      db.rpc("get_my_expense_splits")
    ]);
    requests.forEach(r=>{if(r.error)throw r.error});
    setRooms((requests[0].data||[]) as Room[]);
    setEvents((requests[1].data||[]) as Event[]);
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
  },[]);

  useEffect(()=>{
    let alive=true;
    const db=getSupabase();
    if(!db){setError("Não foi possível conectar ao sistema. Contate o administrador.");setLoading(false);return;}
    void(async()=>{
      try{
        const {data,error:authError}=await db.auth.getUser();
        if(authError||!data.user){
          const eventId=new URLSearchParams(window.location.search).get("evento");
          const safeNext=eventId&&/^[0-9a-f-]{36}$/i.test(eventId)
            ?"/login?next="+encodeURIComponent("/painel?evento="+eventId):"/login";
          window.location.replace(safeNext);return;
        }
        if(!alive)return;
        setUser({id:data.user.id,email:data.user.email});
        const {data:adminRow}=await db.from("app_admins").select("user_id").eq("user_id",data.user.id).maybeSingle();
        if(alive)setIsAdmin(Boolean(adminRow));
        await reload();
      }catch(e){if(alive)setError(errText(e));}
      finally{if(alive)setLoading(false);}
    })();
    const {data:{subscription}}=db.auth.onAuthStateChange(e=>{if(e==="SIGNED_OUT")window.location.replace("/login")});
    return()=>{alive=false;subscription.unsubscribe()};
  },[reload]);

  useEffect(()=>{
    if(!user)return;
    const id=new URLSearchParams(window.location.search).get("evento");
    if(!id||events.length===0)return;
    if(events.some(e=>e.id===id)){
      setSelectedId(id);setDetailTab("visao");setPage("detalhe");
    }else{
      setError("Evento não encontrado. Verifique o link compartilhado.");
    }
    window.history.replaceState(null,"","/painel");
  },[user,events]);

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

  useEffect(()=>{
    if(!modal)return;
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setModal(null)};
    window.addEventListener("keydown",escape);
    return()=>window.removeEventListener("keydown",escape);
  },[modal]);

  async function act(fn:(db:SupabaseClient,id:string)=>Promise<void>,success:string){
    const db=getSupabase();
    if(!db||!user)return;
    setWorking(true);setMessage("");setError("");
    try{await fn(db,user.id);await reload();setMessage(success);}
    catch(e){setError(errText(e));}
    finally{setWorking(false);}
  }

  const nameFor=(id:string)=>profiles.find(p=>p.id===id)?.display_name||"Jogador";
  const roomFor=(id:string)=>rooms.find(r=>r.id===id);
  const roomTitle=(id:string)=>roomFor(id)?.name||"Mesa";
  const nickname=user?nameFor(user.id):"Jogador";
  const ownProfile=profiles.find(p=>p.id===user?.id);
  const firstName=nickname.split(" ")[0];
  const activeRooms=(["poker","blackjack"] as Game[]).map(g=>rooms.find(r=>r.game===g&&r.status==="active")).filter((r):r is Room=>Boolean(r));
  const upcoming=events.filter(e=>e.status==="scheduled").sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  const myUpcoming=upcoming.filter(e=>attendances.some(a=>a.session_id===e.id&&a.user_id===user?.id));
  const selected=events.find(e=>e.id===selectedId);
  const guests=selected?attendances.filter(a=>a.session_id===selected.id):[];
  const meConfirmed=Boolean(user&&guests.some(a=>a.user_id===user.id));
  const organizer=Boolean(user&&selected?.organizer_id===user.id);
  const privateVisible=meConfirmed||organizer;
  const eventBuys=selected?buys.filter(b=>b.session_id===selected.id):[];
  const unpaid=eventBuys.filter(b=>b.payment_status!=="paid");
  const myPurchasedTotal=eventBuys.filter(b=>b.user_id===user?.id).reduce((total,b)=>total+Number(b.amount_brl),0);
  const minToComplete=Math.max(0,Number(selected?.min_entry_brl||0)-myPurchasedTotal);
  const pendingByUser=Object.fromEntries(guests.map(a=>[a.user_id,eventBuys.filter(b=>b.user_id===a.user_id&&b.payment_status!=="paid").length]));
  const canFinish=unpaid.length===0&&guests.length>0&&financeRows.length===guests.length&&financeRows.every(r=>r.approved&&r.chips_bought!==null&&r.chips_final!==null);
  const eventResults=selected?results.filter(r=>r.session_id===selected.id):[];
  const eventExpenses=selected?expenses.filter(e=>e.session_id===selected.id):[];
  const eventPolls=selected?polls.filter(p=>p.session_id===selected.id):[];
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
    if(!attendances.some(a=>a.session_id===selected.id&&a.user_id===user.id)){
      setError("Confirme sua presença antes de comprar fichas.");
      return false;
    }
    setWorking(true);setError("");setMessage("");
    try{
      const {error:purchaseError}=await db.rpc("record_chip_purchase",{
        p_event_id:selected.id,p_quantities:quantities
      });
      if(purchaseError)throw purchaseError;
      await reload();
      setMessage("Compra registrada! Quantidades, pontos e valor calculados pelo Supabase.");
      return true;
    }catch(e){setError(errText(e));return false;}
    finally{setWorking(false);}
  }

  async function confirmAttendance(eventId:string){
    await act(async(db,id)=>{
      const {error:attendanceError}=await db.from("session_attendance")
        .insert({session_id:eventId,user_id:id});
      if(attendanceError)throw attendanceError;
    },"Presença confirmada!");
  }

  function openEvent(id:string,sub:DetailTab="visao"){
    setSelectedId(id);setDetailTab(sub);setPage("detalhe");setError("");setMessage("");window.scrollTo({top:0,behavior:"smooth"});
  }
  function go(next:View){
    setPage(next);setError("");setMessage("");window.scrollTo({top:0,behavior:"smooth"});
  }
  function openGame(game:Game,tab:"eventos"|"tutorial"="eventos"){
    setGameView(game);setGameTab(tab);setPage("mesa");setError("");setMessage("");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function openCreator(roomId?:string){
    const room=(roomId?activeRooms.find(r=>r.id===roomId):undefined)||activeRooms.find(r=>r.game==="poker")||activeRooms[0];
    setForm({...defaultEvent,room_id:room?.id||""});
    setModal("evento");setError("");setMessage("");
  }
  async function addEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    await act(async(db,id)=>{
      const room=activeRooms.find(r=>r.id===form.room_id);
      if(!room)throw new Error("Selecione Poker ou Blackjack para criar o evento.");
      if(!form.starts_at)throw new Error("Informe data e horário.");
      const {data,error:eventError}=await db.from("sessions").insert({
        room_id:room.id,organizer_id:id,title:form.name.trim(),
        starts_at:new Date(form.starts_at).toISOString(),location:form.location.trim(),
        min_entry_brl:Number(form.min_entry_brl),max_participants:Number(form.max_participants),
        chip_pricing_special:form.chip_pricing_special,
        chip_price_1_brl:form.chip_pricing_special?Number(form.chip_price_1_brl):1,
        chip_price_5_brl:form.chip_pricing_special?Number(form.chip_price_5_brl):5,
        chip_price_10_brl:form.chip_pricing_special?Number(form.chip_price_10_brl):0.10,
        chip_price_25_brl:form.chip_pricing_special?Number(form.chip_price_25_brl):0.25,
        chip_price_50_brl:form.chip_pricing_special?Number(form.chip_price_50_brl):0.50
      }).select("id").single();
      if(eventError)throw eventError;
      setModal(null);openEvent(data.id);
    },"Evento criado! Seus amigos já podem confirmar presença.");
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
    },"Enquete criada!");
  }
  const visibleEvents=events.filter(e=>eventFilter==="todos"||
    (eventFilter==="agendados"?e.status==="scheduled":e.status!=="scheduled"));

  if(loading)return <main className="mm-login-shell"><p className="mm-loading">Preparando sua mesa...</p></main>;
  if(!user)return <main className="mm-login-shell"><div className="mm-login-card"><SiteLogo kind="mobile"/><p className="mm-message">{error||"Redirecionando para login..."}</p><a href="/login" className="btn gold">Ir para o login</a></div></main>;

  const navEntries:[View,string,string][]=[["inicio","Início","▦"],["eventos","Eventos","▤"],["mesas","Mesas","♠"],["ranking","Ranking","★"],["perfil","Perfil",""]];
  const activePage=page==="detalhe"?"eventos":page==="mesa"?"mesas":page;
  return <div className="layout">
    <aside className="sidebar">
      <SiteLogo kind="sidebar"/>
      <nav className="nav" aria-label="Navegação principal">
        <div className="navlabel">NAVEGAÇÃO</div>
        {navEntries.map(([id,label,icon])=><button className={"mm-nav-btn "+(activePage===id?"active":"")} key={id} type="button" onClick={()=>{if(id==="perfil")setProfileId(user.id);go(id)}} aria-current={activePage===id?"page":undefined}>
          <span className="ico" aria-hidden="true">
            {id==="perfil"?<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.8"/><path d="M4.2 20c.3-4.1 3.2-6.2 7.8-6.2s7.5 2.1 7.8 6.2"/></svg>:icon}
          </span>{label}
        </button>)}
      </nav>
      <div className="mm-side-profile">
        <PlayerAvatar photoUrl={photoUrls[user.id]} name={nickname}/>
        <div className="person"><strong>{nickname}</strong><small>{isAdmin?"Administrador geral":"Jogador"}</small></div>
        <button type="button" aria-label="Sair" title="Sair" onClick={async()=>{await getSupabase()?.auth.signOut();window.location.replace("/login")}}>↪</button>
      </div>
    </aside>

    <main className="main" id="main-content">
      <div className="mm-mobile-head">
        <SiteLogo kind="mobile"/>
        <div className="mm-mobile-account"><button type="button" className="mm-v09-profile-link" aria-label="Abrir meu perfil" onClick={()=>{setProfileId(user.id);go("perfil")}}><PlayerAvatar photoUrl={photoUrls[user.id]} name={nickname}/></button><button type="button" aria-label="Sair" onClick={async()=>{await getSupabase()?.auth.signOut();window.location.replace("/login")}}>↪</button></div>
      </div>
      <div className="mm-breadcrumb-row">
        <div className="breadcrumb">Mesa Marcada　/　{page==="inicio"?"Visão geral":page==="detalhe"?"Evento":page==="mesa"?"Mesa de "+gameName(gameView):page==="eventos"?"Eventos":page==="mesas"?"Mesas":page==="perfil"?"Perfil":"Ranking"}</div>
        <span className="pill">{isAdmin?"★ Administrador":`♠ ${firstName}`}</span>
      </div>
      {error&&<p className="mm-message error" role="alert" style={{marginBottom:16}}>{error}</p>}
      {message&&<p className="mm-message" role="status" style={{marginBottom:16}}>{message}</p>}

      {page==="inicio"&&<>
        <div className="heading">
          <div><div className="eyebrow">BEM-VINDO DE VOLTA</div><h1>A próxima rodada<br/>começa aqui, {firstName}.</h1><p className="mm-page-intro">Encontre sua próxima noite e reúna todo mundo na mesa.</p></div>
          <button type="button" className="btn gold mm-create" onClick={()=>openCreator()}><span>＋</span> Criar evento</button>
        </div>
        <div className="metrics">
          <div className="metric"><div className="mhead">Eventos agendados <span className="micon">▤</span></div><strong>{upcoming.length}</strong><small>Próximas noites</small></div>
          <div className="metric"><div className="mhead">Minhas presenças <span className="micon">♠</span></div><strong>{myUpcoming.length}</strong><small>Confirmações ativas</small></div>
          <div className="metric"><div className="mhead">Mesas de jogos <span className="micon">♦</span></div><strong>{activeRooms.length}</strong><small>Poker e Blackjack</small></div>
          <div className="metric"><div className="mhead">Jogadores cadastrados <span className="micon">♣</span></div><strong>{profiles.length}</strong><small>Na comunidade</small></div>
        </div>
        <div className="two">
          <section className="panel">
            <div className="panelhead"><h2>Próximos eventos</h2><button className="link" type="button" onClick={()=>go("eventos")}>Ver todos →</button></div>
            {upcoming.length>0?upcoming.slice(0,5).map(ev=><div className="item" key={ev.id}>
              <DateTile value={ev.starts_at}/>
              <div className="itemcontent">
                <button className="mm-itemlink" type="button" onClick={()=>openEvent(ev.id)}>{ev.title}</button>
                <small>{eventTime(ev.starts_at)}　·　{roomTitle(ev.room_id)}　·　{attendances.filter(a=>a.session_id===ev.id).length}/{ev.max_participants} confirmados</small>
              </div>
              <button type="button" className="link" onClick={()=>openEvent(ev.id)}>Abrir →</button>
            </div>):<div className="mm-empty"><span className="mm-empty-symbol">♠</span><strong>Nenhum evento marcado</strong><p>Comece criando o primeiro encontro.</p><button type="button" className="btn gold" onClick={()=>openCreator()}>＋ Criar evento</button></div>}
          </section>
          <div className="stack">
            <section className="hero">
              <div><div className="eyebrow">TUDO EM UM SÓ LUGAR</div><h2 className="mm-hero-heading">Uma noite para<br/><span className="mm-hero-title-strong">ficar na memória.</span></h2><p>Escolha a mesa, marque o horário e organize seus amigos.</p><button className="btn gold mm-hero-cta" type="button" onClick={()=>openCreator()}>＋ Criar evento</button></div>
              <span className="mm-hero-symbol" aria-hidden="true">♠ <em>♦</em></span>
            </section>
            <section className="panel">
              <div className="panelhead"><h2>As duas mesas</h2><button type="button" className="link" onClick={()=>go("mesas")}>Explorar →</button></div>
              {(["poker","blackjack"] as Game[]).map(g=>{
                const room=activeRooms.find(r=>r.game===g);
                return <div className="item" key={g}>
                  <span className="datebox" style={{fontSize:23,color:g==="poker"?"#439fff":"#ff4653"}}>{g==="poker"?"♠":"♦"}</span>
                  <div className="itemcontent"><strong>{gameName(g)}</strong><small>{events.filter(e=>room&&e.room_id===room.id).length} eventos · Guia de regras</small></div>
                  <button type="button" className="link" onClick={()=>openGame(g)}>Abrir →</button>
                </div>;
              })}
            </section>
          </div>
        </div>
      </>}

      {page==="eventos"&&<>
        <div className="heading"><div><div className="eyebrow">AGENDA DO GRUPO</div><h1>Eventos</h1><p>Confira as próximas noites ou marque um novo encontro.</p></div><button className="btn gold mm-create" type="button" onClick={()=>openCreator()}>＋ Criar evento</button></div>
        <div className="mm-filter-bar" aria-label="Filtrar eventos">
          {([["agendados","Próximos"],["todos","Todos"],["encerrados","Anteriores"]] as const).map(([id,label])=>
            <button className={"filter "+(eventFilter===id?"active":"")} type="button" key={id} onClick={()=>setEventFilter(id)}>{label}</button>
          )}
        </div>
        <div className="mm-eventgrid">
          {visibleEvents.map(ev=><EventTile key={ev.id} value={ev} room={roomFor(ev.room_id)} count={attendances.filter(a=>a.session_id===ev.id).length} confirmed={attendances.some(a=>a.session_id===ev.id&&a.user_id===user.id)} busy={working} onConfirm={()=>void confirmAttendance(ev.id)} open={()=>openEvent(ev.id)}/>)}
        </div>
        {!visibleEvents.length&&<div className="panel mm-empty"><span className="mm-empty-symbol">♠</span><h2>Nenhum evento por aqui</h2><p>Que tal organizar a próxima noite?</p><button className="btn gold" onClick={()=>openCreator()}>＋ Criar evento</button></div>}
      </>}

      {page==="mesas"&&<>
        <div className="heading">
          <div><div className="eyebrow">ESCOLHA SEU JOGO</div><h1>Mesas</h1><p>Dois jogos, um lugar para organizar cada rodada. Escolha uma mesa para ver os eventos e aprender as regras.</p></div>
        </div>
        <div className="mm-rooms mm-permanent-tables">
          {(["poker","blackjack"] as Game[]).map(game=>{
            const room=activeRooms.find(r=>r.game===game);
            const count=events.filter(e=>room&&e.room_id===room.id).length;
            return <article className="roomcard mm-fixed-roomcard" key={game}>
              <div className={"roombanner mm-room-banner "+(game==="blackjack"?"blackjack":"")}>
                <span className={"tag "+game}>{gameName(game)}</span>
                <span className="mm-room-suit" aria-hidden="true">{game==="poker"?"♠":"♦"}</span>
              </div>
              <div className="mm-room-card-content">
                <h2>{game==="poker"?"Poker · Texas Hold’em":"Blackjack · 21"}</h2>
                <p>{game==="poker"?"Combine suas cartas, domine as mãos e organize uma noite de Poker.":"Aprenda a chegar perto de 21 sem estourar e desafie o dealer."}</p>
                <div className="mm-room-facts"><span>▤ {count} {count===1?"evento":"eventos"}</span><span>▣ Tutorial completo</span></div>
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
          <button type="button" role="tab" aria-selected={gameTab==="eventos"} className={gameTab==="eventos"?"active":""} onClick={()=>setGameTab("eventos")}>▤ Eventos</button>
          <button type="button" role="tab" aria-selected={gameTab==="tutorial"} className={gameTab==="tutorial"?"active":""} onClick={()=>setGameTab("tutorial")}>▣ Tutorial e regras</button>
        </div>
        {gameTab==="eventos"&&<>
          <div className="mm-section-title"><h2>Eventos de {gameName(gameView)}</h2><span className={"tag "+gameView}>{events.filter(e=>roomFor(e.room_id)?.game===gameView).length} registrados</span></div>
          <div className="mm-eventgrid">
            {events.filter(e=>roomFor(e.room_id)?.game===gameView)
              .sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime())
              .map(ev=><EventTile key={ev.id} value={ev} room={roomFor(ev.room_id)} count={attendances.filter(a=>a.session_id===ev.id).length} confirmed={attendances.some(a=>a.session_id===ev.id&&a.user_id===user.id)} busy={working} onConfirm={()=>void confirmAttendance(ev.id)} open={()=>openEvent(ev.id)}/>)}
          </div>
          {events.filter(e=>roomFor(e.room_id)?.game===gameView).length===0&&<div className="panel mm-empty">
            <span className="mm-empty-symbol">{gameView==="poker"?"♠":"♦"}</span>
            <h2>Nenhum evento de {gameName(gameView)} ainda</h2>
            <p>Crie um evento nesta mesa e convide seus amigos.</p>
            <button type="button" className="btn gold" onClick={()=>openCreator(activeRooms.find(r=>r.game===gameView)?.id)}>＋ Criar evento</button>
          </div>}
        </>}
        {gameTab==="tutorial"&&<TableTutorial game={gameView}/>}
      </>}

      {page==="ranking"&&<RankingPanel game={rankGame} onGameChange={setRankGame} ranking={ranking} photoUrls={photoUrls}
        onPlayer={id=>{setProfileReturn("ranking");setProfileId(id);go("perfil")}}/>}

      {page==="perfil"&&<><ProfilePanel
        profile={profiles.find(p=>p.id===(profileId||user.id))}
        userId={user.id} events={events} attendances={attendances} stats={ranking}
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
      {(profileId||user.id)===user.id&&<MySplitsSummary
        splits={mySplits} userId={user.id} nameFor={nameFor}
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
              <span className={"tag "+(selected.status==="scheduled"?(roomFor(selected.room_id)?.game||"poker"):"archive")}>{selected.status==="scheduled"?"Agendado":selected.status==="finished"?"Encerrado":"Cancelado"}</span>
            </div>
            <div className="mm-event-meta"><span>◷ {fullDate(selected.starts_at)}</span><span>⌖ {selected.location}</span><span>♠ {guests.length}/{selected.max_participants} participantes</span></div>
            <div className="mm-action-row">
              {meConfirmed?
                <button className="mm-btn-destructive" type="button" disabled={working||selected.status!=="scheduled"} onClick={()=>void act(async(db,id)=>{
                  const {error:leaveError}=await db.from("session_attendance").delete().eq("session_id",selected.id).eq("user_id",id);
                  if(leaveError)throw leaveError;
                },"Sua presença foi cancelada.")}>Cancelar presença</button>
              :<button className="btn gold" type="button" disabled={working||selected.status!=="scheduled"||guests.length>=selected.max_participants} onClick={()=>void confirmAttendance(selected.id)}>✓ Confirmar minha presença</button>}
              {organizer&&selected.status==="scheduled"&&<button className="btn" type="button" disabled={working||!canFinish} onClick={()=>{
                if(window.confirm("Encerrar este evento com os registros financeiros aprovados?"))void act(async db=>{
                  const {error:endError}=await db.from("sessions").update({status:"finished"}).eq("id",selected.id);
                  if(endError)throw endError;
                },"Evento encerrado.");
              }}>Encerrar evento</button>}
              {organizer&&selected.status==="scheduled"&&<button className="mm-btn-destructive" type="button"
                disabled={working} onClick={()=>{
                  if(!window.confirm("Cancelar este evento? Os registros e o histórico serão preservados, mas os participantes não poderão realizar novos lançamentos."))return;
                  void act(async(db,id)=>{
                    const {error:cancelError}=await db.from("sessions").update({status:"cancelled"})
                      .eq("id",selected.id).eq("organizer_id",id);
                    if(cancelError)throw cancelError;
                  },"Evento cancelado. O histórico foi mantido.");
                }}>Cancelar evento</button>}
            </div>
            {organizer&&selected.status==="scheduled"&&!canFinish&&<p className="mm-formfoot">Para encerrar, confirme o recebimento das compras e aprove os resultados na aba Financeiro.</p>}
            <EventShareActions id={selected.id} title={selected.title} date={selected.starts_at} room={roomTitle(selected.room_id)}/>
          </div>
        </section>
        <div className="mm-detail-tabs" role="tablist" aria-label="Conteúdo deste evento">
          {([["visao","Visão geral"],["enquetes","Enquetes"],["fichas","Fichas"],["gastos","Gastos"]] as const).map(([id,title])=><button type="button" key={id} className={detailTab===id?"active":""} role="tab" aria-selected={detailTab===id} onClick={()=>setDetailTab(id)}>{title}</button>)}
        </div>

        {detailTab==="visao"&&<div className="two">
          <section className="panel">
            <div className="panelhead"><h2>Participantes</h2><span className="tag">{guests.length}/{selected.max_participants}</span></div>
            <div className="mm-progress"><div style={{width:(Math.min(1,guests.length/selected.max_participants)*100)+"%"}}/></div>
            <div className="mm-chipgroup">{guests.map(g=><button className="mm-v09-attendee-link" type="button" key={g.user_id}
              onClick={()=>{setProfileReturn("detalhe");setProfileId(g.user_id);go("perfil")}}>
              <AttendeeMiniCard photoUrl={photoUrls[g.user_id]} name={nameFor(g.user_id)}/>
            </button>)}</div>
            {!guests.length&&<p>Ainda não há presenças confirmadas. Convide seus amigos!</p>}
            {organizer&&!meConfirmed&&<p className="mm-formfoot">Como organizador, você também pode confirmar sua presença para votar e registrar fichas.</p>}
          </section>
          <section className="panel">
            <div className="panelhead"><h2>Resumo da noite</h2></div>
            <div className="mm-detail-stats">
              <div><small>Entrada mínima</small><strong>{money(selected.min_entry_brl)}</strong></div>
              <div><small>Enquetes</small><strong>{eventPolls.length}</strong></div>
              <div><small>Vagas livres</small><strong>{Math.max(0,selected.max_participants-guests.length)}</strong></div>
            </div>
            <p style={{marginTop:16}}>Organizado por {nameFor(selected.organizer_id)}.</p>
            <div className="mm-action-row" style={{marginTop:15}}>
              <button type="button" className="btn" onClick={()=>setDetailTab("enquetes")}>Ver enquetes →</button>
              <button type="button" className="btn" onClick={()=>setDetailTab("fichas")}>Ver fichas →</button>
            </div>
          </section>
        </div>}

        {detailTab==="enquetes"&&<div className="two">
          <div className="stack">
            <section className="panel">
              <div className="panelhead"><h2>Enquetes do evento</h2><span className="tag">{eventPolls.length}</span></div>
              {!privateVisible&&<p className="mm-message">Confirme presença para participar das enquetes. Os votos ficam visíveis apenas aos participantes e ao organizador.</p>}
              <div className="mm-poll-stack">
                {eventPolls.map(p=>{
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
                {!eventPolls.length&&<p>Nenhuma enquete ainda. Crie a primeira pergunta sobre comida, bebida ou qualquer detalhe da noite.</p>}
              </div>
            </section>
          </div>
          <section className="panel">
            <h2>Criar enquete</h2>
            <p style={{margin:"9px 0 15px"}}>Cada participante pode votar uma vez e mudar de ideia até o encerramento.</p>
            <form className="mm-form-stack" onSubmit={createPoll}>
              <label className="mm-field">Pergunta<input minLength={2} required value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="O que vamos comer?"/></label>
              <label className="mm-field">Opções, uma por linha<textarea required rows={5} value={pollOptions} onChange={e=>setPollOptions(e.target.value)}/></label>
              <button className="btn gold" disabled={!meConfirmed||selected.status!=="scheduled"||working}>＋ Criar enquete</button>
            </form>
            {!meConfirmed&&<p className="mm-formfoot">Confirme sua presença neste evento antes de criar enquetes.</p>}
          </section>
        </div>}

        {detailTab==="fichas"&&<>
          <div className="mm-message" style={{marginBottom:18}}>Registre apenas as fichas adquiridas e seus resultados. Para organizar as despesas com comida e bebidas, abra a aba Gastos.</div>
          {!privateVisible?<div className="panel"><h2>Informações restritas</h2><p>Confirme presença neste evento para consultar ou registrar informações financeiras.</p></div>:<>
            <div className="metrics" style={{gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
              <div className="metric"><div className="mhead">Fichas distribuídas <span className="micon">♠</span></div><strong>{eventBuys.reduce((n,b)=>n+Number(b.chips_received),0).toLocaleString("pt-BR")}</strong><small>Compras e recompras</small></div>
              <div className="metric"><div className="mhead">Entradas registradas <span className="micon">▤</span></div><strong>{money(eventBuys.reduce((n,b)=>n+Number(b.amount_brl),0))}</strong><small>Valor informativo</small></div>
            </div>
            <div className="mm-denom-layout">
              <ChipPurchaseForm key={selected.id} eventId={selected.id}
                prices={[selected.chip_price_1_brl,selected.chip_price_5_brl,
                  selected.chip_price_10_brl,selected.chip_price_25_brl,selected.chip_price_50_brl]}
                special={selected.chip_pricing_special}
                locked={selected.chip_pricing_locked}
                disabled={!meConfirmed||selected.status!=="scheduled"} busy={working}
                minToComplete={minToComplete} entryMinimum={Number(selected.min_entry_brl)}
                onSave={recordPurchase}
              />
              <div className="stack">
              <section className="panel">
                <h2>Meu resultado</h2><p style={{margin:"9px 0 16px"}}>Quantas fichas você tinha ao final?</p>
                <form className="mm-form-stack" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error:resultError}=await db.from("session_chip_results").upsert({session_id:selected.id,user_id:id,chips_final:Number(finalChips),updated_at:new Date().toISOString()},{onConflict:"session_id,user_id"});
                  if(resultError)throw resultError;
                },"Resultado registrado!")}}>
                  <label className="mm-field">Fichas finais<input type="number" min={0} step={1} required value={finalChips} onChange={e=>setFinalChips(e.target.value)}/></label>
                  <button className="btn gold" disabled={working||!meConfirmed||selected.status!=="scheduled"}>Salvar resultado</button>
                </form>
              </section>

              </div>
            </div>
            <section className="panel mm-v09-purchases" style={{marginTop:19}}>
              <div className="panelhead"><h2>Compras e recompras registradas</h2><span className="tag">{eventBuys.length} lançamentos</span></div>
              <p className="mm-v1-payment-explain">O Anfitrião confirma o dinheiro recebido presencialmente. O site não realiza pagamentos ou transferências.</p>
              {organizer&&unpaid.length>0&&<p className="mm-message">Há {unpaid.length} {unpaid.length===1?"compra pendente":"compras pendentes"} de confirmação.</p>}
              {eventBuys.map(b=><div className="item mm-v09-finance-history" key={b.id}>
                <div className="itemcontent"><strong>{nameFor(b.user_id)}</strong>
                  <small>{Number(b.chips_received).toLocaleString("pt-BR")} pontos em fichas · {money(b.amount_brl)}</small>
                  {chipItems.some(item=>item.purchase_id===b.id)&&<small className="mm-denom-receipt">
                    {chipItems.filter(item=>item.purchase_id===b.id)
                      .sort((a,b)=>a.chip_value-b.chip_value)
                      .map(item=>item.quantity+"× ficha "+item.chip_value).join(" · ")}
                  </small>}
                </div>
                <span className={"mm-v1-payment-state "+(b.payment_status==="paid"?"received":"pending")}>
                  {b.payment_status==="paid"?"✓ Recebido":"● Aguardando"}
                </span>
                {organizer&&selected.status==="scheduled"&&<button type="button" className="btn mm-v1-payment-action"
                  disabled={working} onClick={()=>{
                    const paid=b.payment_status!=="paid";
                    if(!window.confirm(paid?"Confirmar que este valor foi recebido presencialmente?":"Reabrir a confirmação de recebimento?"))return;
                    void act(async(db)=>{
                      const {error:paymentError}=await db.rpc("confirm_chip_payment",{p_purchase_id:b.id,p_paid:paid});
                      if(paymentError)throw paymentError;
                    },paid?"Recebimento confirmado!":"Recebimento voltou para pendente.");
                  }}>{b.payment_status==="paid"?"Marcar pendente":"✓ Marcar recebido"}</button>}
                {b.user_id===user.id&&selected.status==="scheduled"&&<button type="button"
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
            <div className="mm-v11-night-ranking" style={{marginTop:19}}>
              <section className="panel">
                <div className="panelhead"><h2>Ranking da noite</h2></div>
                {nightRank.map((r,i)=><div className="item" key={r.id}>
                  <span className="datebox">{i+1}º</span>
                  <div className="itemcontent"><strong>{nameFor(r.id)}</strong><small>{r.acquired} fichas adquiridas · {r.total??"Pendente"} finais</small></div>
                  <strong style={{color:r.difference===null?"#b2becc":r.difference>=0?"#71baff":"#ff737d"}}>{r.difference===null?"—":(r.difference>0?"+":"")+r.difference}</strong>
                </div>)}
                {!nightRank.length&&<p>Os resultados aparecerão conforme a participação.</p>}
              </section>

            </div>
            <FinanceReviewBoard lines={financeRows} loading={financeLoading} organizer={organizer} pendingPaymentsByUser={pendingByUser} photoUrls={photoUrls}
              scheduled={selected.status==="scheduled"} busy={working}
              onApprove={userId=>void act(async(db,id)=>{
                const {error:approveError}=await db.from("session_finance_approvals").insert({
                  session_id:selected.id,user_id:userId,reviewed_by:id
                });
                if(approveError)throw approveError;
              },"Fichas e resultado aprovados!")}
              onReopen={userId=>void act(async(db)=>{
                const {error:revokeError}=await db.from("session_finance_approvals").delete()
                  .eq("session_id",selected.id).eq("user_id",userId);
                if(revokeError)throw revokeError;
              },"Revisão reaberta.")}
            />
          </>}
        </>}

        {detailTab==="gastos"&&(!privateVisible?
          <div className="panel"><h2>Gastos restritos</h2><p>Confirme sua presença para consultar e participar dos rachas deste evento.</p></div>:
          <ExpenseSplitsPanel
            expenses={eventExpenses} shares={expenseShares}
            userId={user.id} canJoin={meConfirmed} canManage={organizer}
            scheduled={selected.status==="scheduled"} busy={working}
            nameFor={nameFor} photoUrls={photoUrls}
            onJoin={(expenseId,join)=>void act(async(db)=>{
              const {error:splitError}=await db.rpc("set_expense_split_membership",{p_expense_id:expenseId,p_join:join});
              if(splitError)throw splitError;
            },join?"Você entrou no racha.":"Você saiu do racha.")}
            onToggleOpen={(expenseId,open)=>void act(async(db)=>{
              const {error:splitError}=await db.rpc("set_expense_split_open",{p_expense_id:expenseId,p_open:open});
              if(splitError)throw splitError;
            },open?"Racha reaberto.":"Racha fechado.")}
            onDelete={expenseId=>{
              if(!window.confirm("Excluir esta despesa? O racha e as dívidas calculadas deixarão de existir."))return;
              void act(async(db,id)=>{
                const {error:deleteError}=await db.from("session_expenses").delete()
                  .eq("id",expenseId).eq("created_by",id);
                if(deleteError)throw deleteError;
              },"Gasto e racha excluídos.");
            }}
            createForm={              <section className="panel">
                <h2>Adicionar despesa</h2><p style={{margin:"9px 0 16px"}}>Comidas, bebidas e materiais da noite.</p>
                <form className="mm-form-stack" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error:expenseError}=await db.from("session_expenses").insert({session_id:selected.id,created_by:id,paid_by:organizer&&guests.some(g=>g.user_id===expensePayer)?expensePayer:id,label:expenseName.trim(),category:expenseCategory,amount_brl:Number(expenseAmount)});
                  if(expenseError)throw expenseError;setExpenseName("");setExpenseAmount("");
                },"Despesa registrada!")}}>
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
              </section>}
          />
        )}
      </>}

      <footer className="mm-formfoot" style={{marginTop:35}}>Mesa Marcada · Organize seus encontros. Valores em reais são apenas registros informativos.</footer>
    </main>

    <button className="mm-fab" aria-label="Criar evento" type="button" onClick={()=>openCreator()}>＋</button>

    {modal==="evento"&&<div className="mm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}>
      <div className="mm-modal" role="dialog" aria-modal="true" aria-labelledby="new-event-title">
        <header><div><div className="eyebrow">ORGANIZAR UMA NOITE</div><h2 id="new-event-title">Criar evento</h2></div><button className="mm-close" type="button" aria-label="Fechar" onClick={()=>setModal(null)}>×</button></header>
        <form className="mm-form-stack" onSubmit={addEvent}>
          <label className="mm-field">Escolha a mesa
            <select value={form.room_id} onChange={e=>setForm({...form,room_id:e.target.value})} required>
              <option value="" disabled>Selecione Poker ou Blackjack</option>
              {(["poker","blackjack"] as Game[]).map(g=>{
                const table=activeRooms.find(r=>r.game===g);
                return <option key={g} value={table?.id||""} disabled={!table}>{g==="poker"?"♠ Poker":"♦ Blackjack"}</option>;
              })}
            </select>
          </label>
          <label className="mm-field">Nome do evento<input required minLength={2} maxLength={100} placeholder="Ex.: Poker de Sexta" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <div className="mm-form-grid">
            <label className="mm-field">Data e horário<input type="datetime-local" required value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label>
            <label className="mm-field">Local<input minLength={2} maxLength={200} required placeholder="Ex.: Casa do Bruno" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
          </div>
          <div className="mm-form-grid">
            <label className="mm-field">Entrada mínima (R$)<input type="number" min={0} step="0.01" required value={form.min_entry_brl} onChange={e=>setForm({...form,min_entry_brl:e.target.value})}/></label>
            <label className="mm-field">Vagas<input type="number" min={1} max={500} step={1} required value={form.max_participants} onChange={e=>setForm({...form,max_participants:e.target.value})}/></label>
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
          <p className="mm-formfoot">O valor é apenas informativo. Todos os usuários cadastrados poderão ver este evento.</p>
          <div className="mm-form-actions"><button type="button" className="btn" onClick={()=>setModal(null)}>Cancelar</button><button type="submit" className="btn gold" disabled={working}>{working?"Salvando...":"Criar evento →"}</button></div>
          {error&&<p className="mm-message error" role="alert">{error}</p>}
        </form>
      </div>
    </div>}

  </div>;
}
