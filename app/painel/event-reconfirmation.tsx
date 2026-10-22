"use client";
import {useCallback,useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";
import "./event-reconfirmation.css";
type Status="pending"|"confirmed"|"declined";
type Reply={user_id:string;status:Status;changed_at:string};
export default function EventReconfirmation({eventId,startsAt,userId,attending,host}:{
 eventId:string;startsAt:string;userId:string;attending:boolean;host:boolean;
}){
 const [rows,setRows]=useState<Reply[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 const load=useCallback(async()=>{
  const db=getSupabase();if(!db||!eventId)return;
  const {data,error:loadError}=await db.from("event_reconfirmations")
   .select("user_id,status,changed_at").eq("event_id",eventId);
  if(loadError){setError("Não foi possível consultar as reconfirmações.");return;}
  setRows((data||[]) as Reply[]);setError("");
 },[eventId]);
 useEffect(()=>{
  void load();
  const db=getSupabase();if(!db)return;
  const channel=db.channel("reconfirm-"+eventId)
   .on("postgres_changes",{event:"*",schema:"public",table:"event_reconfirmations",
    filter:"event_id=eq."+eventId},()=>{void load()}).subscribe();
  const refresh=()=>{if(document.visibilityState==="visible")void load()};
  document.addEventListener("visibilitychange",refresh);
  return()=>{document.removeEventListener("visibilitychange",refresh);void db.removeChannel(channel)};
 },[eventId,startsAt,load]);
 const mine=rows.find(r=>r.user_id===userId);
 if(!attending&&!host)return null;
 if(rows.length===0&&!error)return null;
 async function respond(accept:boolean){
  const db=getSupabase();if(!db)return;
  setBusy(true);setError("");setSuccess("");
  const {error:replyError}=await db.rpc("respond_event_reconfirmation",
   {p_event_id:eventId,p_accept:accept});
  if(replyError)setError(replyError.message);
  else{
   setRows(old=>old.map(r=>r.user_id===userId?{...r,status:accept?"confirmed":"declined"}:r));
   setSuccess(accept?"Presença reconfirmada na nova data.":"Sua indisponibilidade foi registrada. A cadeira permanece reservada até você sair do evento.");
  }
  setBusy(false);
 }
 const waiting=rows.filter(r=>r.status==="pending").length;
 const yes=rows.filter(r=>r.status==="confirmed").length;
 const no=rows.filter(r=>r.status==="declined").length;
 return <section className="mm-reconfirm" aria-label="Reconfirmação de presença">
  <div className="mm-reconfirm-head"><UiIcon name="calendar" size={19}/>
   <div><strong>O horário deste evento foi alterado</strong>
    <p>Quem já estava confirmado pode responder sem perder automaticamente o assento.</p>
   </div></div>
  {host&&<div className="mm-reconfirm-stats">
   <span><strong>{yes}</strong> reconfirmados</span>
   <span><strong>{waiting}</strong> aguardando</span>
   <span><strong>{no}</strong> não poderão ir</span>
  </div>}
  {attending&&mine&&<>
   <p className="mm-reconfirm-current">Sua resposta: <strong>{mine.status==="pending"?"Aguardando reconfirmação":
    mine.status==="confirmed"?"Presença reconfirmada":"Não poderei comparecer"}</strong></p>
   <div className="mm-reconfirm-actions">
    <button type="button" className="btn gold" disabled={busy||mine.status==="confirmed"}
     onClick={()=>void respond(true)}><UiIcon name="check" size={15}/> Confirmar nova data</button>
    <button type="button" className="btn" disabled={busy||mine.status==="declined"}
     onClick={()=>void respond(false)}>Não poderei ir</button>
   </div>
   {mine.status==="declined"&&<p className="mm-reconfirm-note">Se quiser liberar sua vaga, utilize a opção de sair da mesa. Sua presença não será removida automaticamente.</p>}
  </>}
  {error&&<p role="alert" className="mm-reconfirm-error">{error}</p>}
  {success&&<p role="status" className="mm-reconfirm-success">{success}</p>}
 </section>;
}