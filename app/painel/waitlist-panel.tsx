"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";

type Row={user_id:string;joined_at:string;profiles?:{display_name:string|null}|null};
type Props={
 eventId:string;
 userId:string;
 /** Todas as cadeiras ocupadas. */
 full:boolean;
 confirmed:boolean;
 /** Evento agendado e partida ainda não iniciada. */
 open:boolean;
 host:boolean;
 nameFor:(id:string)=>string;
 /** Recarrega presença/cadeiras (por exemplo, quando a vaga chega para mim). */
 onChanged:()=>void;
};

const errorText=(e:unknown)=>e&&typeof e==="object"&&"message" in e?String((e as {message:unknown}).message):"Não foi possível atualizar a lista de espera.";

/** Lista de espera do evento lotado: entrar, ver a posição e sair. A fila anda sozinha no banco. */
export default function WaitlistPanel({eventId,userId,full,confirmed,open,host,nameFor,onChanged}:Props){
 const [rows,setRows]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const wasQueued=useRef(false);
 const changedRef=useRef(onChanged);changedRef.current=onChanged;
 const load=useCallback(async()=>{
  const db=getSupabase();if(!db)return;
  const {data,error:readError}=await db.from("session_waitlist").select("user_id,joined_at,profiles(display_name)")
   .eq("session_id",eventId).order("joined_at",{ascending:true}).order("user_id",{ascending:true});
  if(readError)return;
  const next=(data||[]) as unknown as Row[];
  const queued=next.some(r=>r.user_id===userId);
  // Saí da fila sem pedir: a vaga chegou. Atualiza a mesa para mostrar a cadeira.
  if(wasQueued.current&&!queued)changedRef.current();
  wasQueued.current=queued;
  setRows(next);
 },[eventId,userId]);
 useEffect(()=>{
  void load();const db=getSupabase();if(!db)return;
  const channel=db.channel("waitlist-"+eventId)
   .on("postgres_changes",{event:"*",schema:"public",table:"session_waitlist",filter:"session_id=eq."+eventId},()=>{void load()})
   .subscribe();
  return()=>{void db.removeChannel(channel)};
 },[eventId,load]);
 useEffect(()=>{void load()},[confirmed,full,load]);

 const position=rows.findIndex(r=>r.user_id===userId)+1;
 async function run(fn:"join_event_waitlist"|"leave_event_waitlist"){
  const db=getSupabase();if(!db||busy)return;
  setBusy(true);setError("");
  try{
   const {error:rpcError}=await db.rpc(fn,{p_event_id:eventId});
   if(rpcError)throw rpcError;
   await load();
  }catch(e){setError(errorText(e));void load();onChanged()}
  finally{setBusy(false)}
 }

 if(!open){
  return position>0?<section className="mm-waitlist" aria-label="Lista de espera">
   <p className="mm-waitlist-note">A partida começou e a lista de espera foi encerrada.</p>
  </section>:null;
 }
 const canJoin=full&&!confirmed&&position===0;
 if(!canJoin&&position===0&&!rows.length)return null;

 return <section className="mm-waitlist" aria-label="Lista de espera">
  {position>0?<div className="mm-waitlist-me">
    <span className="mm-waitlist-place" aria-hidden="true">{position}º</span>
    <div><strong>Você está na lista de espera</strong>
     <p>{position===1?"É o próximo da fila.":"Há "+(position-1)+(position===2?" pessoa":" pessoas")+" na sua frente."} Se uma cadeira abrir antes do início, ela é sua automaticamente e você recebe um aviso.</p></div>
    <button type="button" className="btn" disabled={busy} onClick={()=>void run("leave_event_waitlist")}>Sair da lista</button>
   </div>
  :canJoin?<div className="mm-waitlist-me">
    <span className="mm-waitlist-place is-full" aria-hidden="true"><UiIcon name="users" size={20}/></span>
    <div><strong>Mesa cheia</strong>
     <p>{rows.length?rows.length+(rows.length===1?" pessoa aguarda":" pessoas aguardam")+" uma vaga.":"Ninguém na fila ainda."} Entre na lista: se alguém sair, a cadeira fica com você na hora.</p></div>
    <button type="button" className="mm-home-primary" disabled={busy} onClick={()=>void run("join_event_waitlist")}>Entrar na lista de espera</button>
   </div>:null}
  {error&&<p role="alert" className="mm-waitlist-error">{error}</p>}
  {rows.length>0&&(host||confirmed||position>0)&&<details className="mm-waitlist-queue">
   <summary>Lista de espera · {rows.length}</summary>
   <ol>{rows.map(r=><li key={r.user_id} className={r.user_id===userId?"is-me":undefined}>{r.profiles?.display_name||nameFor(r.user_id)}{r.user_id===userId?" (você)":""}</li>)}</ol>
   {confirmed&&<p className="mm-waitlist-note">Não vai conseguir ir? Libere sua cadeira na mesa: o primeiro da fila entra no seu lugar e é avisado.</p>}
  </details>}
 </section>;
}
