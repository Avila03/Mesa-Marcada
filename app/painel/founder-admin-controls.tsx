"use client";
import {useEffect,useMemo,useState} from "react";
import type {Profile} from "@/lib/mesa-types";
import {getSupabase} from "@/lib/supabase/browser";
import FounderArtwork from "./founder-artwork";
import {notifyFrameUpdated} from "./frame-avatar";
import "./founder-admin-controls.css";

export default function FounderAdminControls({profiles}:{profiles:Profile[]}){
 const [ids,setIds]=useState<string[]>([]);
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 async function reload(){
  const db=getSupabase();
  if(!db)throw new Error("Sem conexão com o banco.");
  const {data,error}=await db.rpc("admin_list_founder_frames");
  if(error)throw error;
  setIds((data||[]) as string[]);
 }
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try{
    const db=getSupabase();
    if(!db)throw new Error("Sem conexão com o banco.");
    const {data,error}=await db.rpc("admin_list_founder_frames");
    if(error)throw error;
    if(active)setIds((data||[]) as string[]);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Não foi possível listar fundadores.");}
   finally{if(active)setLoading(false);}
  })();
  return()=>{active=false};
 },[]);
 const filtered=useMemo(()=>profiles
  .filter(p=>p.display_name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")))
  .sort((a,b)=>a.display_name.localeCompare(b.display_name,"pt-BR")),[profiles,search]);
 async function manage(target:Profile,action:"grant"|"revoke"){
  if(saving)return;
  if(action==="revoke"&&!window.confirm("Revogar a moldura Eixo Fundação de "+target.display_name+"? A moldura será removida automaticamente do avatar."))return;
  setSaving(target.id);setError("");setMessage("");
  try{
   const db=getSupabase();
   if(!db)throw new Error("Sem conexão com o banco.");
   const {error}=await db.rpc("admin_manage_founder_frame",{p_user_id:target.id,p_action:action});
   if(error)throw error;
   await reload();
   notifyFrameUpdated(target.id);
   setMessage(action==="grant"?"Fundador reconhecido: "+target.display_name:"Concessão revogada: "+target.display_name);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível atualizar a concessão.");}
  finally{setSaving(null);}
 }
 return <section className="panel mm-founder-admin">
  <div className="panelhead"><h2>Eixo Fundação · Concessões exclusivas</h2>
   <span className="tag">{ids.length} fundadores</span></div>
  <div className="mm-founder-admin-intro">
   <div className="mm-founder-admin-emblem"><FounderArtwork/></div>
   <div><strong>FUNDADOR · Reconhecimento manual</strong>
    <p>Somente a administração principal pode conceder esta moldura. Não existem requisitos automáticos, compras ou desbloqueios por ranking.</p>
   </div>
  </div>
  <label className="mm-founder-admin-search">
   <span>Selecionar membros fundadores</span>
   <input type="search" value={search} placeholder="Buscar jogador pelo nome"
    onChange={e=>setSearch(e.target.value)}/>
  </label>
  <div className="mm-founder-admin-list">
   {loading?<p className="mm-formfoot">Consultando fundadores…</p>:
   filtered.map(p=>{
    const has=ids.includes(p.id);
    return <div className="mm-founder-admin-person" key={p.id}>
     <div><strong>{p.display_name}</strong>
      <small>{has?"Reconhecido como fundador":"Sem concessão"}</small></div>
     <button type="button" className={has?"mm-founder-revoke":"btn gold"}
      disabled={Boolean(saving)} onClick={()=>void manage(p,has?"revoke":"grant")}>
      {saving===p.id?"Salvando…":has?"Revogar":"Conceder"}
     </button>
    </div>;
   })}
   {!loading&&filtered.length===0&&<p className="mm-formfoot">Nenhum jogador encontrado.</p>}
  </div>
  {message&&<p className="mm-founder-admin-success" role="status">{message}</p>}
  {error&&<p className="mm-founder-admin-error" role="alert">{error}</p>}
 </section>;
}
