"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/browser";
import "../v05-theme.css";

export default function LoginPage() {
  const [signup,setSignup] = useState(false);
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  useEffect(()=>{
    const db=getSupabase();
    if(!db) return;
    void db.auth.getUser().then(({data})=>{if(data.user)window.location.replace("/painel")});
  },[]);

  async function handleSubmit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const db=getSupabase();
    if(!db){setMessage("Não foi possível estabelecer conexão com o servidor. Tente mais tarde.");return;}
    setBusy(true);setMessage("");
    try {
      if(signup){
        const {data,error}=await db.auth.signUp({
          email:email.trim(),password,options:{data:{display_name:name.trim()},emailRedirectTo:window.location.origin+"/auth/callback"}
        });
        if(error)throw error;
        if(data.session){window.location.replace("/painel");return;}
        // Confirmar e-mail é uma configuração do Supabase Auth, não do frontend.
        setMessage("A conta foi registrada, mas o Supabase ainda solicita confirmação por e-mail. O administrador precisa desativar essa exigência nas configurações de autenticação.");
      }else{
        const {error}=await db.auth.signInWithPassword({email:email.trim(),password});
        if(error)throw error;
        window.location.replace("/painel");
      }
    }catch(e){
      const text=e instanceof Error?e.message:"";
      setMessage(/rate limit|only request this|seconds|too many requests/i.test(text)
        ?"Muitas tentativas seguidas. Aguarde um minuto e tente novamente."
        :/invalid login credentials/i.test(text)?"E-mail ou senha incorretos."
        :/email not confirmed/i.test(text)?"O Supabase ainda exige a confirmação do e-mail desta conta."
        :text||"Ocorreu um erro. Tente novamente.");
    }finally{setBusy(false)}
  }

  return <main className="mm-login-shell">
    <section className="mm-login-card" aria-labelledby="auth-title">
      <div className="brand">
        <span className="brandmark">♠</span>
        <span className="brandname">Mesa <em>Marcada</em></span>
      </div>
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
            <input type={visible?"text":"password"} autoComplete={signup?"new-password":"current-password"} minLength={6} required placeholder="Sua senha" value={password} onChange={e=>setPassword(e.target.value)}/>
            <button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible?"Ocultar senha":"Mostrar senha"}>{visible?"◉":"◎"}</button>
          </span>
        </label>
        {message&&<div className="mm-message" role="status">{message}</div>}
        <button className="btn gold mm-login-submit" type="submit" disabled={busy}>{busy?"Aguarde...":signup?"Criar conta":"Entrar"} <span aria-hidden="true">→</span></button>
      </form>
      <div className="mm-login-switch">
        <span>{signup?"Já tem uma conta?":"Novo por aqui?"}</span>
        <button type="button" onClick={()=>{setSignup(s=>!s);setMessage("")}}>{signup?"Fazer login":"Criar conta"}</button>
      </div>
    </section>
  </main>;
}
