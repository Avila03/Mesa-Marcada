"use client";
import {useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import {getSupabase} from "@/lib/supabase/browser";
export default function JoinInvite(){
 const {token}=useParams<{token:string}>();
 const router=useRouter();
 const [error,setError]=useState("");
 const [working,setWorking]=useState(true);
 useEffect(()=>{
  if(!/^[0-9a-f]{64}$/.test(token||"")){setError("Este convite é inválido.");setWorking(false);return;}
  let alive=true;
  const db=getSupabase();
  if(!db){setError("Não foi possível conectar ao Mesa Marcada.");setWorking(false);return;}
  void(async()=>{
   try{
    const {data:{user}}=await db.auth.getUser();
    if(!user){window.location.replace("/login?next="+encodeURIComponent("/convite/"+token));return;}
    const {data,error:claimError}=await db.rpc("claim_event_invite",{p_token:token});
    if(claimError)throw claimError;
    if(alive)router.replace("/eventos/"+data);
   }catch(e){if(alive){setError(e instanceof Error?e.message:"Convite inválido ou expirado");setWorking(false)}}
  })();
  return()=>{alive=false};
 },[token,router]);
 return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#080A0E",padding:20}}>
  <section style={{maxWidth:470,width:"100%",background:"#101b2a",border:"1px solid #355577",
    borderRadius:17,color:"#f1f5fb",padding:28,textAlign:"center"}}>
   <div style={{fontSize:27,color:"#258BFF",fontWeight:800}}>MESA <span style={{color:"#FF424D"}}>MARCADA</span></div>
   <h1 style={{fontSize:22,marginTop:18}}>Convite para uma mesa</h1>
   <p>{working?"Validando seu convite e preparando a mesa...":error}</p>
   {!working&&<a href="/eventos" style={{display:"inline-block",padding:12,marginTop:12,
      background:"#258BFF",borderRadius:10,color:"#fff"}}>Voltar aos eventos</a>}
  </section>
 </main>;
}
