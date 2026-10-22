"use client";
import {useCallback,useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";
import "./notification-center.css";

type Item={key:string;id:number|string;source:"league"|"event"|"reconfirm";time:string;
  title:string;detail:string;read:boolean;eventId?:string;leagueId?:string;manage?:boolean};
type Filter="all"|"league"|"event";
const leagueTitles:Record<string,string>={
 join_request:"Nova solicitação de entrada",join_approved:"Entrada aprovada",
 join_rejected:"Solicitação recusada",role_changed:"Cargo na Liga alterado",new_event:"Novo evento da Liga"
};
export default function NotificationCenter({userId,onOpenEvent,onOpenLeague}:{
 userId:string;onOpenEvent:(id:string)=>void;onOpenLeague:(id:string,manage?:boolean)=>void
}){
 const [items,setItems]=useState<Item[]>([]);
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState<Filter>("all");
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const db=getSupabase();if(!db||!userId)return;
  const [l,e,r]=await Promise.all([
   db.from("league_notifications").select("id,league_id,kind,event_id,created_at,read_at")
    .eq("recipient_id",userId).order("created_at",{ascending:false}).limit(35),
   db.from("event_change_notices").select("id,event_id,changed_fields,created_at,read_at")
    .eq("recipient_id",userId).order("created_at",{ascending:false}).limit(35),
   db.from("event_reconfirmations").select("event_id,status,changed_at")
    .eq("user_id",userId).eq("status","pending").order("changed_at",{ascending:false}).limit(30)
  ]);
  if(l.error||e.error||r.error){setError("Não foi possível carregar os avisos.");return;}
  const league=(l.data||[]).map(x=>({
   key:"l-"+x.id,id:x.id,source:"league" as const,time:x.created_at,
   title:leagueTitles[x.kind]||"Atualização da Liga",detail:"Acompanhe as novidades da comunidade",
   read:!!x.read_at,eventId:x.event_id||undefined,leagueId:x.league_id,
   manage:x.kind==="join_request"
  }));
  const edited=(e.data||[]).map(x=>({
   key:"e-"+x.id,id:x.id,source:"event" as const,time:x.created_at,
   title:"Evento atualizado",detail:"Alterações: "+(x.changed_fields||[]).join(", "),
   read:!!x.read_at,eventId:x.event_id
  }));
  const reconfirm=(r.data||[]).map(x=>({
   key:"r-"+x.event_id,id:x.event_id,source:"reconfirm" as const,time:x.changed_at,
   title:"Sua presença precisa ser reconfirmada",
   detail:"A data ou horário mudou. Confirme sua disponibilidade.",read:false,eventId:x.event_id
  }));
  setItems([...reconfirm,...edited,...league].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,70));
  setError("");
 },[userId]);
 useEffect(()=>{
  void load();const db=getSupabase();if(!db||!userId)return;
  const channel=db.channel("notification-center-"+userId)
   .on("postgres_changes",{event:"*",schema:"public",table:"league_notifications",filter:"recipient_id=eq."+userId},()=>{void load()})
   .on("postgres_changes",{event:"*",schema:"public",table:"event_change_notices",filter:"recipient_id=eq."+userId},()=>{void load()})
   .on("postgres_changes",{event:"*",schema:"public",table:"event_reconfirmations",filter:"user_id=eq."+userId},()=>{void load()})
   .subscribe();
  const resync=()=>{if(document.visibilityState==="visible")void load()};
  document.addEventListener("visibilitychange",resync);
  const timer=window.setInterval(resync,45000);
  return()=>{document.removeEventListener("visibilitychange",resync);clearInterval(timer);void db.removeChannel(channel)};
 },[userId,load]);
 const unread=items.filter(i=>!i.read).length;
 const visible=items.filter(i=>filter==="all"||(filter==="league"?i.source==="league":i.source!=="league"));
 async function navigate(item:Item){
  const db=getSupabase();
  if(db&&!item.read){
   if(item.source==="league"){
    const {error:mark}=await db.rpc("read_league_notification",{p_id:item.id});
    if(mark){setError("Erro ao marcar aviso da Liga.");return;}
   }else if(item.source==="event"){
    const {error:mark}=await db.from("event_change_notices").update({read_at:new Date().toISOString()})
     .eq("id",item.id).eq("recipient_id",userId);
    if(mark){setError("Erro ao marcar aviso do evento.");return;}
   }
   if(item.source!=="reconfirm")setItems(old=>old.map(i=>i.key===item.key?{...i,read:true}:i));
  }
  setOpen(false);
  if(item.eventId)onOpenEvent(item.eventId);
  else if(item.leagueId)onOpenLeague(item.leagueId,item.manage);
 }
 return <section className="mm-notif-center" aria-label="Central de notificações">
  <button type="button" className="mm-notif-trigger" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
   <UiIcon name="bell" size={18}/>
   <strong>Notificações</strong>
   {unread>0&&<span className="mm-notif-count">{unread} {unread===1?"nova":"novas"}</span>}
   <UiIcon name="arrow-right" size={15}/>
  </button>
  {open&&<div className="mm-notif-panel">
   <div className="mm-notif-filters">
    {([["all","Todas"],["event","Eventos"],["league","Ligas"]] as const).map(([key,label])=>
     <button key={key} type="button" className={filter===key?"active":""} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}
   </div>
   {error&&<p role="alert" className="mm-notif-message">{error}</p>}
   {!visible.length&&<p className="mm-notif-message">Nenhum aviso nesta categoria.</p>}
   <div className="mm-notif-list">{visible.map(item=>
    <button key={item.key} type="button" onClick={()=>void navigate(item)} className={"mm-notif-entry "+(!item.read?"unread":"")}>
     <span className="mm-notif-type"><UiIcon name={item.source==="league"?"users":"calendar"} size={16}/></span>
     <span className="mm-notif-main"><strong>{item.title}</strong><small>{item.detail}</small>
      <small>{new Date(item.time).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</small></span>
     {!item.read&&<i aria-label="Não lida"/>}
    </button>)}</div>
  </div>}
 </section>;
}