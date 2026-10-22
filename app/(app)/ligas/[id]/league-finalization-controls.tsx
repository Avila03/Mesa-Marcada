"use client";
import {useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import {CrestMark,type CrestConfig} from "@/app/brasoes/demo/crest-editor";
import LeagueFinalReport,{type LeagueFinalSummary} from "@/app/painel/league-final-report";
import "./league-finalization-controls.css";

type LeagueArchiveRow={
 id:string;name:string;owner_id:string;my_role:"owner"|"organizer"|"member"|null;
 finished_at:string|null;final_summary:LeagueFinalSummary|null;emblem:CrestConfig;
};

export default function LeagueFinalizationControls({mode,leagueId}:{mode:"detail"|"manage";leagueId:string}){
 const [league,setLeague]=useState<LeagueArchiveRow|null>(null);
 const [userId,setUserId]=useState("");
 const [scheduled,setScheduled]=useState(0);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [confirmOpen,setConfirmOpen]=useState(false);
 const [confirmText,setConfirmText]=useState("");
 const [error,setError]=useState("");

 useEffect(()=>{
  if(!leagueId)return;
  let active=true;
  void(async()=>{
   try{
    const db=getSupabase();if(!db)throw new Error("Não foi possível conectar.");
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError)throw authError;
    if(!user){if(active)setLoading(false);return;}
    const {data,error:catalogError}=await db.rpc("get_league_catalog_final");
    if(catalogError)throw catalogError;
    const row=((data||[]) as LeagueArchiveRow[]).find(x=>x.id===leagueId)||null;
    if(!active)return;
    setUserId(user.id);setLeague(row);
    if(row&&row.owner_id===user.id&&!row.finished_at){
     const count=await db.from("sessions").select("id",{head:true,count:"exact"}).eq("league_id",leagueId).eq("status","scheduled");
     if(count.error)throw count.error;
     if(active)setScheduled(count.count||0);
    }
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false};
 },[leagueId]);
 
 async function finalize(){
  if(!league||confirmText.trim()!=="FINALIZAR")return;
  setBusy(true);setError("");
  try{
   const db=getSupabase();if(!db)throw new Error("Conexão indisponível");
   const {data,error:closeError}=await db.rpc("finish_league",{p_league_id:league.id});
   if(closeError)throw closeError;
   setLeague({...league,finished_at:(data as LeagueFinalSummary).finished_at,final_summary:data as LeagueFinalSummary});
   setConfirmOpen(false);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }

 if(loading)return null;
 if(!league)return null;

 if(league.finished_at)return <div className="mm-closed-overlay">
  <div className="mm-closed-document">
   <div className="mm-closed-bar">
    <a href="/ligas" className="btn">← Voltar às Ligas</a>
    <span>ARQUIVO DA LIGA</span>
   </div>
   {league.final_summary?
    <LeagueFinalReport summary={league.final_summary} emblem={league.emblem}/>:
    <section className="mm-league-final-report">
     <div className="mm-closed-ident"><CrestMark value={league.emblem}/><h2>{league.name}</h2></div>
     <p>Esta Liga foi finalizada. O resumo histórico está disponível apenas para os membros e o dono.</p>
    </section>}
  </div>
 </div>;

 if(mode!=="manage"||league.owner_id!==userId)return null;
 return <>
  <div className="mm-final-floating" role="region" aria-label="Encerramento da Liga">
   <div><strong>Encerramento da Liga</strong><small>Gerar o resumo e arquivar os resultados.</small></div>
   <button type="button" disabled={busy} className="btn mm-final-danger" onClick={()=>{setConfirmText("");setConfirmOpen(true);setError("");}}>
    Finalizar Liga
   </button>
  </div>
  {confirmOpen&&<div className="mm-final-modal-backdrop" role="presentation">
   <div className="mm-final-modal" role="dialog" aria-modal="true" aria-label="Finalizar Liga" aria-describedby="mm-final-warning">
    <h2>Finalizar {league.name}?</h2>
    <p id="mm-final-warning">Esta ação encerra definitivamente a Liga e gera um relatório com os campeões de Poker e Blackjack, rankings e histórico. Não será possível criar novos eventos nem editar a identidade da Liga.</p>
    {scheduled>0?<p className="mm-final-error">Ainda existem {scheduled} eventos agendados. Encerre ou cancele esses eventos antes de finalizar a Liga.</p>:
    <label htmlFor="mm-confirm-finish">Para confirmar, digite <strong>FINALIZAR</strong>:
     <input id="mm-confirm-finish" autoComplete="off" value={confirmText}
      onChange={e=>setConfirmText(e.target.value.toUpperCase())} placeholder="FINALIZAR"/>
    </label>}
    {error&&<p className="mm-final-error" role="alert">{error}</p>}
    <div className="mm-final-modal-actions">
     <button className="btn" type="button" disabled={busy} onClick={()=>setConfirmOpen(false)}>Cancelar</button>
     <button className="btn mm-final-danger" type="button" disabled={busy||scheduled>0||confirmText.trim()!=="FINALIZAR"} onClick={()=>void finalize()}>
      {busy?"Finalizando...":"Confirmar encerramento"}
     </button>
    </div>
   </div>
  </div>}
 </>;
}
