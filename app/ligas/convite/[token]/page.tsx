"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {getSupabase} from "@/lib/supabase/browser";
export default function LeagueInvitePage(){
 const {token}=useParams<{token:string}>();
 const [preview,setPreview]=useState<{league_id:string;league_name:string;description:string}|null>(null);
 const [error,setError]=useState("");const [pending,setPending]=useState(false);const [saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!/^[a-f0-9]{64}$/.test(token||"")){setError("O convite não é válido.");return;}
  let active=true;const db=getSupabase();if(!db){setError("Sem conexão com o aplicativo");return;}
  void(async()=>{
   try{
    const {data:{user}}=await db.auth.getUser();
    if(!user){window.location.replace("/login?next="+encodeURIComponent("/ligas/convite/"+token));return;}
    const {data,error:rpcError}=await db.rpc("preview_league_invite",{p_token:token});
    if(rpcError)throw rpcError;
    if(!data?.length)throw new Error("Convite expirado. Solicite um novo link ao dono da liga.");
    if(active)setPreview(data[0]);
   }catch(e){if(active)setError(e instanceof Error?e.message:"Erro ao validar convite")}
  })();
  return()=>{active=false};
 },[token]);
 async function request(){
  if(!preview)return;setSaving(true);setError("");
  try{
   const db=getSupabase();if(!db)throw new Error("Sem conexão");
   const {data,error:err}=await db.rpc("request_league_join",{p_league_id:preview.league_id,p_token:token});
   if(err)throw err;
   if(data==="member"){window.location.href="/ligas/"+preview.league_id;return}
   const {data:{session}}=await db.auth.getSession();
   if(session?.access_token){
    void fetch("/api/push/league-request",{
     method:"POST",headers:{"Content-Type":"application/json",
      Authorization:"Bearer "+session.access_token},
     body:JSON.stringify({leagueId:preview.league_id})
    }).catch(()=>{});
   }
   setPending(true);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível solicitar entrada")}
  finally{setSaving(false)}
 }
 return <main style={{minHeight:"100dvh",background:"#080A0E",color:"#F1F5FB",display:"grid",placeItems:"center",padding:20}}>
  <section style={{width:"100%",maxWidth:470,background:"#131E2D",border:"1px solid #36577A",borderRadius:18,padding:25}}>
   <div style={{color:"#8EC5FF",fontSize:12,letterSpacing:2,fontWeight:800}}>MESA MARCADA · LIGAS</div>
   <h1 style={{fontSize:27,marginBottom:8}}>{preview?.league_name||"Convite para uma liga"}</h1>
   <p style={{fontSize:14,lineHeight:1.6,color:"#A9BCD1"}}>
    {preview?.description||"Entre na sua conta para acessar a liga privada."}
   </p>
   <p style={{fontSize:12,color:"#9FB7CD"}}>A entrada não é automática: o dono precisa aprovar cada solicitação.</p>
   {error&&<p role="alert" style={{color:"#FF8E98"}}>{error}</p>}
   {pending?<p role="status" style={{padding:15,background:"#1E3246",borderRadius:10}}>
    Solicitação enviada! Você verá a liga em suas solicitações enquanto aguarda aprovação.
   </p>:preview&&<button onClick={()=>void request()} disabled={saving} style={{width:"100%",marginTop:12,padding:13,
      border:0,borderRadius:10,background:"#258BFF",color:"#fff",fontWeight:700}}>
     {saving?"Enviando...":"Solicitar entrada na liga"}
   </button>}
   <a href="/ligas" style={{display:"block",marginTop:20,color:"#A3D2FF",textAlign:"center"}}>Voltar para as Ligas</a>
  </section>
 </main>;
}
