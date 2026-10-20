"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/browser";
import "../realtime.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auth_error") === "confirmation") {
      setStatus("Não foi possível concluir a confirmação do e-mail. Tente cadastrar-se novamente ou entrar em contato com o suporte.");
    }
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setStatus("Informe um nome com pelo menos dois caracteres.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin + "/auth/callback"
          }
        });
        if (error) throw error;
        if (!data.session) setStatus("Cadastro enviado! Confira seu e-mail e siga o link de confirmação para ativar sua conta.");
        else window.location.assign("/painel");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign("/painel");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mm-auth">
    <section className="mm-authbox">
      <div className="mm-brand"><span>♠</span> Mesa <em>Marcada</em></div>
      <p className="mm-overline">BOAS CARTAS · BONS AMIGOS · GRANDES NOITES</p>
      <h1>{mode === "login" ? "Entrar na mesa" : "Criar minha conta"}</h1>
      <p className="mm-muted">Salas, confirmações, fichas, gastos e rankings em um só lugar.</p>
      {mode === "signup" && <p className="mm-info">Cadastro aberto: não é necessário convite. Por segurança, confirme seu e-mail antes de entrar, quando solicitado.</p>}
      <form onSubmit={submit} className="mm-form">
        {mode === "signup" && <label>Nome de jogador<input autoComplete="name" required minLength={2} maxLength={64} value={name} onChange={e => setName(e.target.value)} placeholder="Como vão te identificar?"/></label>}
        <label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"/></label>
        <label>Senha<input required minLength={6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
        <button className="mm-primary" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}</button>
      </form>
      {status && <p role="status" className="mm-notice">{status}</p>}
      <button className="mm-textbtn" type="button" onClick={() => {setMode(mode === "login" ? "signup" : "login");setStatus("");}}>
        {mode === "login" ? "Não tenho conta — criar cadastro" : "Já tenho conta — fazer login"}
      </button>
      <p className="mm-muted mm-small">Ainda quer explorar sem cadastro? <Link href="/demo.html">Abrir demonstração v0.5</Link></p>
    </section>
  </main>;
}
