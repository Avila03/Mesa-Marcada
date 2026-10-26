"use client";
import {useState,type FormEvent} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import SiteLogo from "../painel/site-logo";
import "../v05-theme.css";
export default function RecoverPassword(){
 const [email,setEmail]=useState("");const [busy,setBusy]=useState(false);const [notice,setNotice]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setNotice("");
  try{
   const db=getSupabase();if(!db)throw new Error("Conexão indisponível. Tente novamente.");
   const {error}=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/auth/callback?next=%2Fredefinir-senha"});
   if(error)throw error;
   setNotice("Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha. Abra o link neste navegador e confira também o spam.");
  }catch{setNotice("Não foi possível enviar o link agora. Aguarde um momento e tente novamente.")}
  finally{setBusy(false)}
 }
 return <main className="mm-login-shell"><section className="mm-login-card">
  <SiteLogo kind="login"/><h1>Recuperar senha</h1>
  <p>Informe o e-mail da sua conta para receber um link de recuperação.</p>
  <form className="mm-form-stack" onSubmit={event=>void submit(event)}>
   <label className="mm-field">E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   {notice&&<p className="mm-message" role="status">{notice}</p>}
   <button className="btn gold mm-login-submit" disabled={busy}>{busy?"Enviando…":"Enviar link"}</button>
  </form><p><a href="/login">Voltar para entrar</a></p>
 </section></main>;
}
