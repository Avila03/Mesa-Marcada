"use client";
import {useCallback,useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";

type Notice={id:number;league_id:string;actor_id:string|null;kind:
 "join_request"|"join_approved"|"join_rejected"|"role_changed"|"new_event";
 event_id:string|null;created_at:string;read_at:string|null};
const titles:Record<Notice["kind"],string>={
 join_request:"Nova solicitação de entrada",
 join_approved:"Sua entrada foi aprovada",
 join_rejected:"Solicitação recusada",
 role_changed:"Seu cargo na liga mudou",
 new_event:"Novo evento na sua liga"
};
export default function LeagueNotifications({userId,onOpenLeague,onOpenEvent}:{
 userId:string;onOpenLeague:(id:string,manage?:boolean)=>void;
 onOpenEvent?:(id:string)=>void;
}){
 const [notices,setNotices]=useState<Notice[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [open,setOpen]=useState(false);
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const db=getSupabase();if(!db)return;
  const {data,error:loadError}=await db.from("league_notifications")
   .select("id,league_id,actor_id,kind,event_id,created_at,read_at")
   .eq("recipient_id",userId).order("created_at",{ascending:false}).limit(25);
  if(loadError){setError("Não foi possível atualizar os avisos.");return}
  const rows=(data||[]) as Notice[];setNotices(rows);
  const ids=[...new Set(rows.map(n=>n.league_id))];
  if(ids.length){
   const response=await db.from("leagues").select("id,name").in("id",ids);
   if(!response.error)setNames(Object.fromEntries((response.data||[]).map(r=>[r.id,r.name])));
  }
 },[userId]);
 useEffect(()=>{
  void load();
  const db=getSupabase();if(!db)return;
  const channel=db.channel("league-notices-"+userId)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"league_notifications",
    filter:"recipient_id=eq."+userId},()=>{void load()})
   .subscribe();
  const resync=()=>{if(document.visibilityState==="visible")void load()};
  document.addEventListener("visibilitychange",resync);
  const timer=window.setInterval(resync,60000);
  return()=>{document.removeEventListener("visibilitychange",resync);clearInterval(timer);
   void db.removeChannel(channel)};
 },[userId,load]);
 async function access(item:Notice){
  const db=getSupabase();
  if(db&&!item.read_at){
   const {error:ackError}=await db.rpc("read_league_notification",{p_id:item.id});
   if(!ackError)setNotices(prev=>prev.map(p=>p.id===item.id?{...p,read_at:new Date().toISOString()}:p));
  }
  setOpen(false);
  if(item.event_id&&onOpenEvent){onOpenEvent(item.event_id)}
  else onOpenLeague(item.league_id,item.kind==="join_request");
 }
 const unread=notices.filter(x=>!x.read_at).length;
 return <section className="mm-league-notifications" aria-label="Notificações das ligas">
  <button type="button" className="mm-league-notices-toggle"
   onClick={()=>setOpen(x=>!x)} aria-expanded={open}>
   <UiIcon name="bell" size={19}/>
   <strong>Avisos das ligas</strong>
   {unread>0&&<span className="mm-league-unread">{unread} novos</span>}
   <UiIcon name="arrow-right" size={16}/>
  </button>
  {open&&<div className="mm-league-notices-list">
   {error&&<p role="alert">{error}</p>}
   {!notices.length&&<p className="mm-league-empty">Nenhum aviso até agora.</p>}
   {notices.map(item=><button type="button" key={item.id}
    className={"mm-league-notice "+(!item.read_at?"unread":"")} onClick={()=>void access(item)}>
    <span className="mm-league-notice-icon"><UiIcon name={item.kind==="join_request"?"users":"bell"} size={17}/></span>
    <span><strong>{titles[item.kind]}</strong><small>{names[item.league_id]||"Liga"} · {new Date(item.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</small></span>
    {!item.read_at&&<i aria-label="Não lido"/>}
   </button>)}
  </div>}
 </section>;
}
