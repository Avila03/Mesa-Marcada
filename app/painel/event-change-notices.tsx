"use client";
import {useCallback,useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";
import "./event-change-notices.css";

type EventNotice={
 id:number;event_id:string;recipient_id:string;changed_fields:string[];
 created_at:string;read_at:string|null;
};
export default function EventChangeNotices({userId,onOpenEvent}:{
 userId:string;onOpenEvent:(id:string)=>void;
}){
 const [notices,setNotices]=useState<EventNotice[]>([]);
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const db=getSupabase();if(!db||!userId)return;
  const {data,error:loadError}=await db.from("event_change_notices")
   .select("id,event_id,recipient_id,changed_fields,created_at,read_at")
   .eq("recipient_id",userId).order("created_at",{ascending:false}).limit(20);
  if(loadError){setError("Não foi possível carregar avisos de alterações.");return;}
  setNotices((data||[]) as EventNotice[]);setError("");
 },[userId]);
 useEffect(()=>{
  void load();
  const db=getSupabase();if(!db||!userId)return;
  const channel=db.channel("event-changes-"+userId).on("postgres_changes",
   {event:"INSERT",schema:"public",table:"event_change_notices",filter:"recipient_id=eq."+userId},
   ()=>{void load()}).subscribe();
  const resync=()=>{if(document.visibilityState==="visible")void load();};
  document.addEventListener("visibilitychange",resync);
  const timer=window.setInterval(resync,60000);
  return()=>{document.removeEventListener("visibilitychange",resync);
   window.clearInterval(timer);void db.removeChannel(channel);};
 },[userId,load]);
 const unread=notices.filter(n=>!n.read_at).length;
 async function readAndOpen(n:EventNotice){
  const db=getSupabase();
  if(db&&!n.read_at){
   const {error:markError}=await db.from("event_change_notices")
    .update({read_at:new Date().toISOString()}).eq("id",n.id).eq("recipient_id",userId);
   if(markError){setError("Não foi possível marcar o aviso como lido.");return;}
   setNotices(old=>old.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x));
  }
  setOpen(false);onOpenEvent(n.event_id);
 }
 return <section className="mm-event-change-notices" aria-label="Avisos de alterações de eventos">
  <button type="button" className="mm-event-change-toggle" aria-expanded={open}
   onClick={()=>setOpen(x=>!x)}>
   <UiIcon name="bell" size={19}/>
   <strong>Alterações em eventos</strong>
   {unread>0&&<span className="mm-event-change-count">{unread} {unread===1?"novo":"novos"}</span>}
   <UiIcon name="arrow-right" size={17}/>
  </button>
  {open&&<div className="mm-event-change-items">
   {error&&<p role="alert">{error}</p>}
   {!notices.length&&<p>Nenhuma alteração recente nos seus eventos.</p>}
   {notices.map(n=><button type="button" key={n.id} className={n.read_at?"":"unread"}
    onClick={()=>void readAndOpen(n)}>
    <span><strong>Evento atualizado</strong>
     <small>O anfitrião alterou: {n.changed_fields.join(", ")}.</small>
     <small>{new Date(n.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</small>
    </span><UiIcon name="arrow-right" size={15}/>
   </button>)}
  </div>}
 </section>;
}