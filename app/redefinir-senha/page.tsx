"use client";
import {useEffect,useState,type FormEvent} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import SiteLogo from "../painel/site-logo";
import "../v05-theme.css";
export default function ResetPassword(){
 const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [password,setPassword]=useState("");const [confirmation,setConfirmation]=useState("");const [notice,setNotice]=useState("");
 useEffect(()=>{
  let active=true;const db=getSupabase();
  void db?.auth.getUser().then(({data})=>{if(active){setReady(!!data.user);if(!data.user)setNotice("O link não é válido ou expirou. Solicite um novo link.")}}).catch(()=>{if(active)setNotice("Não foi possível validar o link. Tente novamente.")});
  return()=>{active=false};
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ready||busy)return;
  if(password!==confirmation){setNotice("As senhas precisam ser iguais.");return;}
  setBusy(true);setNotice("");
  try{
   const db=getSupabase();if(!db)throw new Error();
   const {error}=await db.auth.updateUser({password});if(error)throw error;
   setPassword("");setConfirmation("");setReady(false);
   await db.auth.signOut();setNotice("Senha atualizada. Entre novamente com a nova senha.");
  }catch{setNotice("Não foi possível atualizar. Use uma senha nova com pelo menos 8 caracteres ou solicite outro link.")}
  finally{setBusy(false)}
 }
 return <main className="mm-login-shell"><section className="mm-login-card"><SiteLogo kind="login"/><h1>Nova senha</h1>
  {notice&&<p className="mm-message" role="status">{notice}</p>}
  {ready&&<form className="mm-form-stack" onSubmit={event=>void submit(event)}>
   <label className="mm-field">Nova senha<input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label className="mm-field">Confirmar senha<input type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
   <button className="btn gold mm-login-submit" disabled={busy}>{busy?"Salvando…":"Salvar nova senha"}</button>
  </form>}
  <p><a href="/login">Entrar</a> · <a href="/recuperar-senha">Solicitar novo link</a></p>
 </section></main>;
}
