"use client";
import {useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import "./invite-controls.css";

type Props={eventId:string;title:string;canInvite:boolean;status:string};
export default function PrivateInviteShare({eventId,title,canInvite,status}:Props){
 const [token,setToken]=useState("");
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [working,setWorking]=useState(false);
 const url=typeof window!=="undefined"&&token?window.location.origin+"/convite/"+token:"";
 const [qr,setQr]=useState("");
 // O gerador de QR (≈50 KB) só é baixado quando um convite é criado.
 useEffect(()=>{
  let active=true;
  if(!url){setQr("");return}
  void import("@/lib/vendor/qrcode.mjs").then(({default:qrcode})=>{
   try{const code=qrcode(0,"M");code.addData(url);code.make();if(active)setQr(code.createDataURL(4,5))}
   catch{if(active)setQr("")}
  });
  return()=>{active=false};
 },[url]);
 async function generate(){
  const db=getSupabase();if(!db||!canInvite)return;
  if(!window.confirm("Se já existir um convite, gerar novo link invalidará o anterior para novos convidados. Continuar?"))return;
  setWorking(true);setMessage("");setError("");
  try{
   const {data,error:rpcError}=await db.rpc("create_event_invite",{p_event_id:eventId});
   if(rpcError)throw rpcError;
   if(typeof data!=="string")throw new Error("O convite não foi gerado.");
   setToken(data);setMessage("Convite pronto. Envie o link ou compartilhe o QR Code.");
  }catch(e){setError(e instanceof Error?e.message:"Erro ao criar o convite");}
  finally{setWorking(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(url);setMessage("Link copiado!");}
  catch{setMessage("Copie o endereço exibido abaixo.");}
 }
 async function share(){
  try{
   if(navigator.share){await navigator.share({title:"Convite · "+title,text:"Escolha seu assento no Mesa Marcada.",url});}
   else await copy();
  }catch(e){if(e instanceof Error&&e.name!=="AbortError")setError(e.message)}
 }
 return <section className="mm-invite-panel" aria-label="Convites privados">
  <div className="mm-invite-heading"><span className="mm-invite-lock">✦</span><div>
   <strong>Evento privado · somente convidados</strong>
   <p>O link permite que cada convidado entre com a própria conta e escolha uma cadeira.</p>
  </div></div>
  {canInvite&&status==="scheduled"&&<p className="mm-formfoot">
    O link aparece somente quando é gerado. Guarde uma cópia: gerar outro substitui o anterior.
  </p>}
  {canInvite&&status==="scheduled"&&<div className="mm-invite-actions">
   <button type="button" className="btn gold" disabled={working} onClick={()=>void generate()}>
    {working?"Criando convite...":token?"Gerar novo convite":"Gerar link e QR Code"}
   </button>
   {token&&<><button className="btn" type="button" onClick={()=>void copy()}>Copiar convite</button>
     <button className="btn" type="button" onClick={()=>void share()}>Compartilhar</button></>}
  </div>}
  {token&&<div className="mm-invite-secret">
   {qr&&<img alt="QR Code privado do evento" src={qr} width={194} height={194}/>}
   <div><strong>Convite exclusivo</strong><p>Ao gerar outro convite, este link deixará de aceitar novos participantes. Quem já aceitou mantém seu acesso.</p>
    <input type="text" aria-label="Link do convite" readOnly value={url} onFocus={e=>e.target.select()}/>
   </div>
  </div>}
  {!canInvite&&<p className="mm-formfoot">Sua participação já foi autorizada pelo convite. O anfitrião pode gerar novos links.</p>}
  {error&&<p className="mm-message error" role="alert">{error}</p>}
  {message&&<p className="mm-formfoot" role="status">{message}</p>}
 </section>;
}
