"use client";
import {useEffect,useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";

export type UpdateScope="catalog"|"presence"|"polls"|"expenses"|"chips"|"profiles";
export type ConnectionState="connecting"|"connected"|"reconnecting"|"offline";

// As políticas RLS continuam sendo aplicadas pelo Supabase Realtime.
const watched:[string,UpdateScope][]=[
 ["sessions","catalog"],
 ["session_attendance","presence"],
 ["session_table_seats","presence"],
 ["session_polls","polls"],
 ["session_poll_options","polls"],
 ["session_poll_votes","polls"],
 ["session_expenses","expenses"],
 ["expense_split_members","expenses"],
 ["expense_split_settlements","expenses"],
 ["session_chip_purchases","chips"],
 ["session_chip_purchase_items","chips"],
 ["session_chip_cashouts","chips"],
 ["session_chip_results","chips"],
 ["session_live_state","chips"],
 ["admin_hidden_events","catalog"],
 ["profiles","profiles"]
];

export function useClubRealtime({
 enabled,eventId,onRefresh
}:{
 enabled:boolean;eventId:string;onRefresh:(scope:UpdateScope)=>Promise<void>;
}):ConnectionState {
 const [status,setStatus]=useState<ConnectionState>("connecting");
 const handler=useRef(onRefresh);
 useEffect(()=>{handler.current=onRefresh},[onRefresh]);
 useEffect(()=>{
   if(!enabled)return;
   const db=getSupabase();
   if(!db){setStatus("offline");return;}
   let active=true;
   let running=false;
   let needsAgain=false;
   const pending=new Set<UpdateScope>();
   let debounce:ReturnType<typeof setTimeout>|undefined;
   // Consolida mudanças próximas para evitar chamadas redundantes.
   const flush=async()=>{
     if(!active||running){needsAgain=true;return;}
     running=true;
     try{
       do{
         needsAgain=false;
         const scopes=[...pending];pending.clear();
         await Promise.allSettled(scopes.map(scope=>handler.current(scope)));
       }while(active&&(needsAgain||pending.size>0));
     }finally{running=false;}
   };
   const enqueue=(scope:UpdateScope)=>{
     pending.add(scope);
     if(debounce)clearTimeout(debounce);
     debounce=setTimeout(()=>void flush(),320);
   };
   const reconcile=()=>{
     if(document.visibilityState==="hidden"||!navigator.onLine)return;
     enqueue("catalog");
     enqueue("profiles");
     if(eventId){for(const key of ["presence","polls","expenses","chips"] as UpdateScope[])enqueue(key);}
   };
   const channel=db.channel("mm-changes-"+(eventId||"catalog"));
   for(const [table,scope] of watched){
     // Fora de um evento, somente alterações relevantes à agenda
     // e aos perfis geram tráfego (não acompanha 12 tabelas à toa).
     if(!eventId&&scope!=="catalog"&&scope!=="profiles"&&table!=="session_attendance")continue;
     channel.on("postgres_changes",{event:"*",schema:"public",table},payload=>{
       if(!eventId&&table==="session_attendance"){enqueue("catalog");return;}
       const record=(payload.new&&Object.keys(payload.new).length?payload.new:payload.old) as Record<string,unknown>;
       // Eventos podem não incluir id em DELETE sob RLS; conciliação cobre esses casos.
       if(eventId&&record?.session_id&&record.session_id!==eventId&&scope!=="catalog")return;
       if(eventId&&table==="sessions"&&record?.id===eventId)enqueue("presence");
       enqueue(scope);
       if(table==="session_attendance")enqueue("catalog");
     });
   }
   channel.subscribe(next=>{
     if(!active)return;
     if(next==="SUBSCRIBED"){setStatus("connected");reconcile();}
     else if(next==="CHANNEL_ERROR"||next==="TIMED_OUT")setStatus(navigator.onLine?"reconnecting":"offline");
     else if(next==="CLOSED")setStatus("reconnecting");
   });
   const online=()=>{setStatus("reconnecting");reconcile()};
   const offline=()=>setStatus("offline");
   const visibility=()=>{if(document.visibilityState==="visible")reconcile()};
   window.addEventListener("online",online);
   window.addEventListener("offline",offline);
   document.addEventListener("visibilitychange",visibility);
   // Fallback para perda de mensagens, mudança de rede e deletes com RLS.
   const fallback=setInterval(reconcile,45000);
   return()=>{
     active=false;if(debounce)clearTimeout(debounce);clearInterval(fallback);
     window.removeEventListener("online",online);
     window.removeEventListener("offline",offline);
     document.removeEventListener("visibilitychange",visibility);
     void db.removeChannel(channel);
   };
 },[enabled,eventId]);
 return status;
}
