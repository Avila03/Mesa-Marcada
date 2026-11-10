"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import "../v05-theme.css";
import SiteLogo from "../painel/site-logo";
import {validPostLoginRoute} from "@/lib/app-routes";

function postLoginPath(){
  const next=new URLSearchParams(window.location.search).get("next");
  return validPostLoginRoute(next||"/painel");
}

export default function LoginPage() {
  const [signup,setSignup] = useState(false);
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).has("auth_error"))setMessage("O link de acesso não é válido ou expirou. Solicite um novo link e abra neste navegador.");
    const db=getSupabase();
    if(!db) return;
    void db.auth.getUser().then(({data})=>{if(data.user)window.location.replace(postLoginPath())});
  },[]);

  async function handleSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const db=getSupabase();
    if(!db){setMessage("Não foi possível estabelecer conexão com o servidor. Tente mais tarde.");return;}
    setBusy(true);setMessage("");
    try {
      if(signup){
        const {data,error}=await db.auth.signUp({
          email:email.trim(),password,options:{data:{display_name:name.trim()},emailRedirectTo:window.location.origin+"/auth/callback?next="+encodeURIComponent(postLoginPath())}
        });
        if(error)throw error;
        if(data.session){window.location.replace(postLoginPath());return;}
        // Confirmar e-mail é uma configuração do Supabase Auth, não do frontend.
        setMessage("Conta criada! Confirme seu e-mail pelo link enviado e volte para entrar. Confira também a pasta de spam.");
      }else{
        const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw error;
        window.location.replace(postLoginPath());
      }
    }catch(e){
      const text=e instanceof Error?e.message:"";
      setMessage(/rate limit|only request this|seconds|too many requests/i.test(text)
        ?"Muitas tentativas seguidas. Aguarde um minuto e tente novamente."
        :/invalid login credentials/i.test(text)?"E-mail ou senha incorretos."
        :/email not confirmed/i.test(text)?"Confirme seu e-mail antes de entrar. Confira a mensagem de confirmação na sua caixa de entrada."
        :text||"Ocorreu um erro. Tente novamente.");
    }finally{setBusy(false)}
  }

  return <main className="mm-login-shell">
    <section className="mm-login-card" aria-labelledby="auth-title">
      <SiteLogo kind="login"/>
      <h1 id="auth-title">{signup?"Criar minha conta":"Entrar na mesa"}</h1>
      <form className="mm-form-stack" onSubmit={handleSubmit}>
        {signup&&<label className="mm-field">Nome de jogador
          <input autoComplete="name" placeholder="Como podemos te chamar?" minLength={2} maxLength={64} required value={name} onChange={e=>setName(e.target.value)}/>
        </label>}
        <label className="mm-field">E-mail
          <input type="email" autoComplete="email" required placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </label>
        <label className="mm-field">Senha
          <span className="mm-password-field">
            <input type={visible?"text":"password"} autoComplete={signup?"new-password":"current-password"} minLength={signup?8:6} maxLength={128} required placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible?"Ocultar senha":"Mostrar senha"}>{visible?"◉":"◎"}</button>
          </span>
        </label>
        {message&&<div className="mm-message" role="status">{message}</div>}
        <button className="btn gold mm-login-submit" type="submit" disabled={busy}>{busy?"Aguarde...":signup?"Criar conta":"Entrar"} <span aria-hidden="true">→</span></button>
      </form>
      {!signup&&<p><a href="/recuperar-senha">Esqueci minha senha</a></p>}
      <div className="mm-login-switch">
        <span>{signup?"Já tem uma conta?":"Novo por aqui?"}</span>
        <button type="button" onClick={()=>{setSignup(s=>!s);setMessage("")}}>{signup?"Fazer login":"Criar conta"}</button>
      </div>
    </section>
  </main>;
}
