"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";
import "../realtime.css";

type UserInfo = { id: string; email?: string };
type Profile = { id: string; display_name: string };
type Room = { id: string; name: string; game: "poker" | "blackjack"; description: string; status: string; created_by: string };
type Session = { id: string; room_id: string; organizer_id: string; title: string; starts_at: string; location: string; min_entry_brl: number; max_participants: number; status: string };
type Attendance = { session_id: string; user_id: string };
type Poll = { id: string; session_id: string; created_by: string; question: string; is_closed: boolean };
type Option = { id: string; poll_id: string; label: string; position: number };
type Vote = { poll_id: string; option_id: string; user_id: string };
type Purchase = { id: string; session_id: string; user_id: string; chips_received: number; amount_brl: number; note: string };
type Result = { session_id: string; user_id: string; chips_final: number };
type Expense = { id: string; session_id: string; created_by: string; label: string; category: string; amount_brl: number };
type Ranking = { user_id: string; display_name: string; net_chips: number; sessions_played: number };
type Tab = "inicio" | "salas" | "sessoes" | "enquetes" | "financeiro" | "rankings" | "tutoriais";

const cash = (value: number | string) => new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"}).format(Number(value) || 0);
const date = (value: string) => new Date(value).toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
const errorText = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";

export default function PainelPage() {
  const [me, setMe] = useState<UserInfo | null>(null);
  const [tab, setTab] = useState<Tab>("inicio");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [rankingGame, setRankingGame] = useState("poker");
  const [sessionId, setSessionId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomGame, setRoomGame] = useState<"poker" | "blackjack">("poker");
  const [event, setEvent] = useState({ room_id:"",title:"",starts_at:"",location:"",min_entry_brl:"0",max_participants:"10" });
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollChoices, setPollChoices] = useState("Pizza\nHambúrguer\nChurrasco");
  const [buyChips, setBuyChips] = useState("");
  const [buyBRL, setBuyBRL] = useState("0");
  const [finalChips, setFinalChips] = useState("");
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("food");

  const reload = useCallback(async () => {
    const db = getSupabase();
    if (!db) throw new Error("Supabase não configurado.");
    const requests = await Promise.all([
      db.from("rooms").select("*").order("created_at", {ascending:false}),
      db.from("sessions").select("*").order("starts_at", {ascending:true}),
      db.from("profiles").select("id,display_name"),
      db.from("session_attendance").select("session_id,user_id"),
      db.from("session_polls").select("*"),
      db.from("session_poll_options").select("*").order("position"),
      db.from("session_poll_votes").select("poll_id,option_id,user_id"),
      db.from("session_chip_purchases").select("*"),
      db.from("session_chip_results").select("*"),
      db.from("session_expenses").select("*")
    ]);
    for (const response of requests) if (response.error) throw response.error;
    setRooms((requests[0].data || []) as Room[]);
    setSessions((requests[1].data || []) as Session[]);
    setPeople((requests[2].data || []) as Profile[]);
    setAttendance((requests[3].data || []) as Attendance[]);
    setPolls((requests[4].data || []) as Poll[]);
    setOptions((requests[5].data || []) as Option[]);
    setVotes((requests[6].data || []) as Vote[]);
    setPurchases((requests[7].data || []) as Purchase[]);
    setResults((requests[8].data || []) as Result[]);
    setExpenses((requests[9].data || []) as Expense[]);
  }, []);

  useEffect(() => {
    const db = getSupabase();
    if (!db) { setError("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Veja o README."); setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const {data, error: authError} = await db.auth.getUser();
        if (authError || !data.user) {window.location.replace("/login");return;}
        if (!cancelled) setMe({id:data.user.id,email:data.user.email});
        await reload();
      } catch (err) {if (!cancelled) setError(errorText(err));}
      finally {if (!cancelled) setLoading(false);}
    })();
    const {data:{subscription}} = db.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_OUT") window.location.replace("/login");
    });
    return () => {cancelled=true;subscription.unsubscribe();};
  }, [reload]);

  useEffect(() => {
    if (!me) return;
    const db=getSupabase();
    if (!db) return;
    void (async () => {
      const {data, error: rankError} = await db.rpc("get_global_ranking",{p_game:rankingGame});
      if (!rankError) setRanking((data||[]) as Ranking[]);
    })();
  }, [me,rankingGame,sessions,purchases,results]);

  async function act(task: (db: SupabaseClient, userId: string) => Promise<void>, success="Registro atualizado!") {
    const db=getSupabase();
    if (!db || !me) return;
    setBusy(true);setError("");setNotice("");
    try {
      await task(db,me.id);
      await reload();
      setNotice(success);
    } catch (err) {
      setError(errorText(err));
    } finally {setBusy(false);}
  }

  const profileName = (id: string) => people.find(p=>p.id===id)?.display_name || "Jogador";
  const roomNameFor = (id: string) => rooms.find(r=>r.id===id)?.name || "Sala";
  const selected = sessions.find(s=>s.id===sessionId) || sessions[0];
  const guests = selected ? attendance.filter(a=>a.session_id===selected.id) : [];
  const mine = Boolean(me && selected && guests.some(a=>a.user_id===me.id));
  const canEdit = Boolean(me && selected && selected.organizer_id===me.id);
  const selectedPurchases = selected ? purchases.filter(p=>p.session_id===selected.id) : [];
  const selectedResults = selected ? results.filter(r=>r.session_id===selected.id) : [];
  const selectedExpenses = selected ? expenses.filter(e=>e.session_id===selected.id) : [];
  const nightRank = useMemo(() => {
    if (!selected) return [];
    return attendance.filter(a=>a.session_id===selected.id).map(a=>{
      const bought = purchases.filter(p=>p.session_id===selected.id && p.user_id===a.user_id).reduce((sum,p)=>sum+Number(p.chips_received),0);
      const current = results.find(r=>r.session_id===selected.id && r.user_id===a.user_id);
      return {id:a.user_id,bought,final:current?.chips_final,net:current ? Number(current.chips_final)-bought : null};
    }).sort((a,b)=>(b.net ?? -Infinity)-(a.net ?? -Infinity));
  },[attendance,purchases,results,selected]);
  const tabs: {id:Tab;label:string}[]=[
    {id:"inicio",label:"Dashboard"},{id:"salas",label:"Salas"},{id:"sessoes",label:"Sessões"},
    {id:"enquetes",label:"Enquetes"},{id:"financeiro",label:"Financeiro"},
    {id:"rankings",label:"Rankings"},{id:"tutoriais",label:"Tutoriais"}
  ];
  function chooseSession(id:string,nextTab:Tab) {setSessionId(id);setTab(nextTab);setError("");setNotice("");}
  function sessionPicker() {
    return <label className="mm-field">Sessão
      <select className="mm-control mm-chooser" value={selected?.id||""} onChange={e=>setSessionId(e.target.value)}>
        {sessions.map(s=><option value={s.id} key={s.id}>{s.title} · {date(s.starts_at)}</option>)}
      </select>
    </label>;
  }
  if (loading) return <main className="mm-auth">Carregando a mesa...</main>;
  if (!me && !error) return <main className="mm-auth">Redirecionando para login...</main>;

  return <div className="mm-shell">
    <header className="mm-header">
      <Link href="/painel" className="mm-brand"><span>♠</span> Mesa <em>Marcada</em></Link>
      <nav className="mm-nav" aria-label="Menu principal">
        {tabs.map(item=><button key={item.id} className={tab===item.id?"active":""} onClick={()=>setTab(item.id)}>{item.label}</button>)}
      </nav>
      <div className="mm-row"><span className="mm-muted">{me ? profileName(me.id) : ""}</span><button className="mm-secondary" onClick={async()=>{await getSupabase()?.auth.signOut();window.location.assign("/login");}}>Sair</button></div>
    </header>
    <main className="mm-container">
      {error && <p role="alert" className="mm-info mm-error">{error}</p>}
      {notice && <p role="status" className="mm-info">{notice}</p>}
      {tab==="inicio" && <>
        <div className="mm-pagehead"><div><p className="mm-overline">SEU CLUBE · SUA MESA</p><h1>Bem-vindo ao Mesa Marcada</h1></div><button className="mm-primary" onClick={()=>setTab("sessoes")}>+ Nova sessão</button></div>
        <div className="mm-cards">
          <div className="mm-card blue"><p>Salas cadastradas</p><div className="mm-stat">{rooms.length}</div></div>
          <div className="mm-card"><p>Sessões agendadas</p><div className="mm-stat">{sessions.filter(s=>s.status==="scheduled").length}</div></div>
          <div className="mm-card red"><p>Suas confirmações</p><div className="mm-stat">{attendance.filter(a=>a.user_id===me?.id).length}</div></div>
          <div className="mm-card"><p>Despesas registradas e autorizadas</p><div className="mm-stat">{cash(expenses.reduce((n,e)=>n+Number(e.amount_brl),0))}</div></div>
        </div>
        <h2 className="mm-section">Próximas noites</h2>
        <div className="mm-cards">{sessions.filter(s=>s.status==="scheduled").slice(0,6).map(s=>
          <div className="mm-card" key={s.id}><span className="mm-badge">{roomNameFor(s.room_id)}</span>
            <h2>{s.title}</h2><p>📅 {date(s.starts_at)}</p><p>📍 {s.location}</p>
            <p>{attendance.filter(a=>a.session_id===s.id).length}/{s.max_participants} confirmados</p>
            <button className="mm-secondary" onClick={()=>chooseSession(s.id,"sessoes")}>Ver evento</button>
          </div>)}
          {sessions.length===0 && <div className="mm-card"><p>Ainda não existe nenhuma sessão. Crie uma sala e organize a primeira noite!</p></div>}
        </div>
      </>}

      {tab==="salas" && <>
        <div className="mm-pagehead"><h1>Salas de jogos</h1><span className="mm-badge">{rooms.length} salas</span></div>
        <div className="mm-split">
          <div><h2 className="mm-section">Todas as salas</h2>
            <div className="mm-cards">{rooms.map(room=><article className={room.game==="poker"?"mm-card blue":"mm-card red"} key={room.id}>
              <span className={room.game==="poker"?"mm-gameicon":"mm-gameicon red"}>{room.game==="poker"?"♠":"♥"}</span>
              <h2>{room.name}</h2><p>{room.game==="poker"?"Poker":"Blackjack"} · {room.status==="archived"?"Arquivada":"Ativa"}</p>
              <p>{room.description}</p>
              <button className="mm-secondary" onClick={()=>{setEvent(old=>({...old,room_id:room.id}));setTab("sessoes");}}>Criar sessão nesta sala</button>
            </article>)}
              {rooms.length===0 && <p className="mm-muted">Nenhuma sala cadastrada.</p>}
            </div>
          </div>
          <section className="mm-card"><h2>Criar sala</h2>
            <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
              const {error}=await db.from("rooms").insert({name:roomName.trim(),game:roomGame,created_by:id});
              if(error)throw error;setRoomName("");
            },"Sala criada!");}}>
              <label>Nome da sala<input required minLength={2} maxLength={90} value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Ex.: Mesa de Sexta"/></label>
              <label>Modalidade<select value={roomGame} onChange={e=>setRoomGame(e.target.value as "poker"|"blackjack")}><option value="poker">Poker ♠</option><option value="blackjack">Blackjack ♥</option></select></label>
              <button className="mm-primary" disabled={busy} type="submit">Criar sala</button>
            </form>
          </section>
        </div>
      </>}

      {tab==="sessoes" && <>
        <div className="mm-pagehead"><h1>Sessões e confirmações</h1><span className="mm-badge">{sessions.length} eventos</span></div>
        <div className="mm-split">
          <section><h2 className="mm-section">Eventos</h2>
            <div className="mm-list">{sessions.map(s=><div className="mm-item" key={s.id}>
              <div><strong>{s.title}</strong><p className="mm-muted">{roomNameFor(s.room_id)} · {date(s.starts_at)} · {attendance.filter(a=>a.session_id===s.id).length}/{s.max_participants} pessoas</p></div>
              <button className="mm-secondary" onClick={()=>setSessionId(s.id)}>Detalhes</button>
            </div>)}
              {sessions.length===0 && <p className="mm-muted">Ainda não há eventos. Crie uma sala primeiro.</p>}
            </div>
          </section>
          <section className="mm-card"><h2>Agendar evento</h2>
            <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
              if(!event.room_id)throw new Error("Selecione a sala.");
              if(!event.starts_at)throw new Error("Informe a data e a hora.");
              const {error}=await db.from("sessions").insert({
                room_id:event.room_id,organizer_id:id,title:event.title.trim(),
                starts_at:new Date(event.starts_at).toISOString(),location:event.location.trim(),
                min_entry_brl:Number(event.min_entry_brl),max_participants:Number(event.max_participants)
              });
              if(error)throw error;setEvent(old=>({...old,title:"",starts_at:"",location:""}));
            },"Evento criado. Agora cada participante poderá confirmar sua presença.");}}>
              <label>Sala<select required value={event.room_id} onChange={e=>setEvent({...event,room_id:e.target.value})}>
                <option value="">Selecione a sala</option>
                {rooms.filter(r=>r.status==="active").map(r=><option value={r.id} key={r.id}>{r.name} · {r.game}</option>)}
              </select></label>
              <label>Título<input value={event.title} onChange={e=>setEvent({...event,title:e.target.value})} required minLength={2} placeholder="Noite de Poker"/></label>
              <label>Data e horário<input type="datetime-local" required value={event.starts_at} onChange={e=>setEvent({...event,starts_at:e.target.value})}/></label>
              <label>Local<input required minLength={2} value={event.location} onChange={e=>setEvent({...event,location:e.target.value})} placeholder="Casa do Bruno"/></label>
              <div className="mm-grid2">
                <label>Entrada mínima informativa (R$)<input type="number" min={0} step="0.01" value={event.min_entry_brl} onChange={e=>setEvent({...event,min_entry_brl:e.target.value})}/></label>
                <label>Limite de participantes<input type="number" required min={1} max={500} value={event.max_participants} onChange={e=>setEvent({...event,max_participants:e.target.value})}/></label>
              </div>
              <button className="mm-primary" type="submit" disabled={busy || rooms.every(r=>r.status!=="active")}>Criar evento</button>
            </form>
          </section>
        </div>
        {selected && <section className="mm-card mm-space">
          <div className="mm-pagehead"><div><span className="mm-badge">{selected.status==="scheduled"?"Agendada":selected.status==="finished"?"Encerrada":"Cancelada"}</span>
            <h2>{selected.title}</h2><p>📅 {date(selected.starts_at)} · 📍 {selected.location}</p>
            <p>Entrada mínima: {cash(selected.min_entry_brl)} · Organizador: {profileName(selected.organizer_id)}</p>
          </div><span className="mm-stat">{guests.length}/{selected.max_participants}</span></div>
          <div className="mm-row">
            {mine ? <button className="mm-danger" disabled={busy || selected.status!=="scheduled"} onClick={()=>void act(async(db,id)=>{
              const {error}=await db.from("session_attendance").delete().eq("session_id",selected.id).eq("user_id",id);
              if(error)throw error;
            },"Presença cancelada.")}>Cancelar minha presença</button>
            : <button className="mm-primary" disabled={busy || selected.status!=="scheduled" || guests.length>=selected.max_participants}
              onClick={()=>void act(async(db,id)=>{
                const {error}=await db.from("session_attendance").insert({session_id:selected.id,user_id:id});
                if(error)throw error;
              },"Sua presença foi confirmada!")}>Confirmar minha presença</button>}
            <button className="mm-secondary" onClick={()=>setTab("enquetes")}>Ver enquetes</button>
            {canEdit && selected.status==="scheduled" && <button className="mm-secondary" disabled={busy}
              onClick={()=>{if(window.confirm("Encerrar a sessão? Lançamentos pendentes ficarão fora do ranking geral."))void act(async db=>{
                const {error}=await db.from("sessions").update({status:"finished"}).eq("id",selected.id);
                if(error)throw error;
              },"Sessão encerrada.");}}>Encerrar sessão</button>}
          </div>
          <h3 className="mm-section">Confirmados</h3>
          <div className="mm-row">{guests.map(a=><span key={a.user_id} className="mm-badge">{profileName(a.user_id)}</span>)}{guests.length===0 && <p className="mm-muted">Aguardando confirmações individuais.</p>}</div>
        </section>}
      </>}

      {tab==="enquetes" && <>
        <div className="mm-pagehead"><h1>Enquetes da noite</h1></div>
        {sessions.length===0 ? <p className="mm-muted">Agende uma sessão para criar enquetes.</p>: <>
          {sessionPicker()}
          {selected && <div className="mm-split mm-space">
            <div><h2 className="mm-section">Votações</h2><div className="mm-stack">
              {polls.filter(p=>p.session_id===selected.id).map(p=><section className="mm-card" key={p.id}>
                <div className="mm-pagehead"><h3>{p.question}</h3><span className="mm-badge">{p.is_closed?"Encerrada":"Aberta"}</span></div>
                <div className="mm-stack">{options.filter(o=>o.poll_id===p.id).map(o=><button
                  className={votes.some(v=>v.poll_id===p.id && v.user_id===me?.id && v.option_id===o.id)?"mm-primary":"mm-secondary"}
                  key={o.id} disabled={busy || !mine || p.is_closed}
                  onClick={()=>void act(async(db,id)=>{
                    const {error}=await db.from("session_poll_votes").upsert({
                      poll_id:p.id,option_id:o.id,user_id:id,updated_at:new Date().toISOString()
                    },{onConflict:"poll_id,user_id"});
                    if(error)throw error;
                  },"Voto registrado!")}>{o.label} · {votes.filter(v=>v.option_id===o.id).length} votos</button>)}</div>
                {p.created_by===me?.id && !p.is_closed && <button className="mm-textbtn" disabled={busy}
                  onClick={()=>void act(async db=>{
                    const {error}=await db.from("session_polls").update({is_closed:true}).eq("id",p.id);
                    if(error)throw error;
                  },"Enquete encerrada.")}>Encerrar enquete</button>}
              </section>)}
              {polls.filter(p=>p.session_id===selected.id).length===0 && <p className="mm-muted">Não há enquetes nesta sessão.</p>}
            </div></div>
            <section className="mm-card"><h2>Criar enquete</h2>
              <p>Um voto por participante confirmado. O voto pode mudar enquanto a enquete estiver aberta.</p>
              {!mine && <p className="mm-info">Confirme presença na sessão para criar ou participar de enquetes.</p>}
              <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                if(!selected) throw new Error("Selecione um evento.");
                const choices=pollChoices.split(/\n|;/).map(x=>x.trim()).filter(Boolean);
                if(choices.length<2)throw new Error("Informe ao menos duas opções, uma por linha.");
                const {data,error}=await db.from("session_polls").insert({session_id:selected.id,created_by:id,question:pollQuestion.trim()}).select("id").single();
                if(error)throw error;
                const {error:optionError}=await db.from("session_poll_options").insert(choices.map((label,position)=>({poll_id:data.id,label,position})));
                if(optionError)throw new Error("Enquete criada, mas houve falha nas opções: "+optionError.message);
                setPollQuestion("");
              },"Enquete criada!");}}>
                <label>Pergunta<input required minLength={2} value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)} placeholder="O que vamos consumir?"/></label>
                <label>Opções (uma por linha)<textarea rows={5} value={pollChoices} onChange={e=>setPollChoices(e.target.value)}/></label>
                <button className="mm-primary" disabled={busy || !mine || selected?.status!=="scheduled"}>Criar enquete</button>
              </form>
            </section>
          </div>}
        </>}
      </>}

      {tab==="financeiro" && <>
        <div className="mm-pagehead"><h1>Fichas e gastos</h1></div>
        <p className="mm-info">Fichas/pontos e valores em reais são registros informativos separados. O Mesa Marcada não processa pagamentos.</p>
        {sessions.length===0?<p className="mm-muted">Crie uma sessão primeiro.</p>:<>
          <div className="mm-space">{sessionPicker()}</div>
          {selected && <>
            <div className="mm-cards mm-space">
              <div className="mm-card blue"><p>Fichas adquiridas na sessão</p><div className="mm-stat">{selectedPurchases.reduce((n,p)=>n+Number(p.chips_received),0).toLocaleString("pt-BR")}</div></div>
              <div className="mm-card"><p>Compras informadas em reais</p><div className="mm-stat">{cash(selectedPurchases.reduce((n,p)=>n+Number(p.amount_brl),0))}</div></div>
              <div className="mm-card red"><p>Despesas compartilhadas registradas</p><div className="mm-stat">{cash(selectedExpenses.reduce((n,e)=>n+Number(e.amount_brl),0))}</div><p>Rateio estimado entre {guests.length} confirmados: {guests.length?cash(selectedExpenses.reduce((n,e)=>n+Number(e.amount_brl),0)/guests.length):"—"} por pessoa</p></div>
            </div>
            {!mine && <p className="mm-info">Confirme sua presença para registrar seus próprios valores. Os lançamentos desta sessão ficam disponíveis apenas aos participantes e ao organizador.</p>}
            <div className="mm-cards mm-space">
              <section className="mm-card"><h3>Compra ou recompra de fichas</h3>
                <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error}=await db.from("session_chip_purchases").insert({
                    session_id:selected.id,user_id:id,chips_received:Number(buyChips),amount_brl:Number(buyBRL)
                  });
                  if(error)throw error;setBuyChips("");
                },"Fichas registradas.");}}>
                  <label>Quantidade de fichas<input required type="number" min="1" step="1" value={buyChips} onChange={e=>setBuyChips(e.target.value)}/></label>
                  <label>Valor registrado em reais<input type="number" min="0" step="0.01" value={buyBRL} onChange={e=>setBuyBRL(e.target.value)}/></label>
                  <button className="mm-primary" disabled={busy || !mine || selected.status!=="scheduled"}>Registrar compra</button>
                </form>
              </section>
              <section className="mm-card"><h3>Minhas fichas finais</h3>
                <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error}=await db.from("session_chip_results").upsert({
                    session_id:selected.id,user_id:id,chips_final:Number(finalChips),updated_at:new Date().toISOString()
                  },{onConflict:"session_id,user_id"});
                  if(error)throw error;
                },"Resultado salvo.");}}>
                  <label>Quantas fichas você terminou?<input required type="number" min={0} step={1} value={finalChips} onChange={e=>setFinalChips(e.target.value)}/></label>
                  <button className="mm-primary" disabled={busy || !mine || selected.status!=="scheduled"}>Salvar resultado</button>
                </form>
              </section>
              <section className="mm-card"><h3>Registrar despesa compartilhada</h3>
                <form className="mm-form" onSubmit={e=>{e.preventDefault();void act(async(db,id)=>{
                  const {error}=await db.from("session_expenses").insert({
                    session_id:selected.id,created_by:id,label:expenseLabel.trim(),category:expenseCategory,amount_brl:Number(expenseAmount)
                  });
                  if(error)throw error;setExpenseLabel("");setExpenseAmount("");
                },"Despesa registrada.");}}>
                  <label>O que foi comprado?<input required minLength={2} value={expenseLabel} onChange={e=>setExpenseLabel(e.target.value)} placeholder="Pizza e refrigerante"/></label>
                  <div className="mm-grid2">
                    <label>Valor (R$)<input required type="number" min="0.01" step="0.01" value={expenseAmount} onChange={e=>setExpenseAmount(e.target.value)}/></label>
                    <label>Categoria<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}><option value="food">Comidas</option><option value="drinks">Bebidas</option><option value="materials">Materiais</option><option value="other">Outros</option></select></label>
                  </div>
                  <button className="mm-primary" disabled={busy || !mine || selected.status!=="scheduled"}>Adicionar despesa</button>
                </form>
              </section>
            </div>
            <div className="mm-split mm-space">
              <section className="mm-card mm-contents"><h3>Compras de fichas</h3>
                <table className="mm-table"><thead><tr><th>Jogador</th><th>Fichas</th><th>R$</th></tr></thead>
                  <tbody>{selectedPurchases.map(p=><tr key={p.id}><td>{profileName(p.user_id)}</td><td>{p.chips_received}</td><td>{cash(p.amount_brl)}</td></tr>)}</tbody></table>
                {selectedPurchases.length===0 && <p>Nenhum registro disponível.</p>}
              </section>
              <section className="mm-card mm-contents"><h3>Despesas compartilhadas</h3>
                <table className="mm-table"><thead><tr><th>Descrição</th><th>Quem registrou</th><th>Valor</th></tr></thead>
                  <tbody>{selectedExpenses.map(e=><tr key={e.id}><td>{e.label}</td><td>{profileName(e.created_by)}</td><td>{cash(e.amount_brl)}</td></tr>)}</tbody></table>
                {selectedExpenses.length===0 && <p>Nenhuma despesa registrada.</p>}
              </section>
            </div>
          </>}
        </>}
      </>}

      {tab==="rankings" && <>
        <div className="mm-pagehead"><h1>Classificações</h1></div>
        <p className="mm-info">Saldo em fichas = fichas finais menos fichas compradas/recebidas. Gastos e valores em reais não integram a pontuação. Compare sessões com escalas semelhantes.</p>
        <div className="mm-split mm-space">
          <section className="mm-card mm-contents"><h2>Ranking da noite</h2>
            {sessions.length>0 && sessionPicker()}
            <table className="mm-table mm-space"><thead><tr><th>Jogador</th><th>Comprou</th><th>Terminou</th><th>Saldo</th></tr></thead>
              <tbody>{nightRank.map((r,i)=><tr key={r.id}><td>{i+1}º · {profileName(r.id)}</td><td>{r.bought}</td><td>{r.final??"Pendente"}</td><td>{r.net===null?"—":r.net>0?"+"+r.net:r.net}</td></tr>)}</tbody></table>
            {nightRank.length===0 && <p>Nenhum resultado disponível nesta sessão.</p>}
          </section>
          <section className="mm-card mm-contents"><h2>Ranking geral acumulado</h2>
            <label className="mm-field">Modalidade<select className="mm-control" value={rankingGame} onChange={e=>setRankingGame(e.target.value)}><option value="poker">Poker</option><option value="blackjack">Blackjack</option></select></label>
            <table className="mm-table mm-space"><thead><tr><th>Jogador</th><th>Fichas líquidas</th><th>Noites</th></tr></thead>
              <tbody>{ranking.map((r,i)=><tr key={r.user_id}><td>{i+1}º · {r.display_name}</td><td>{Number(r.net_chips)>0?"+"+r.net_chips:r.net_chips}</td><td>{r.sessions_played}</td></tr>)}</tbody></table>
            {ranking.length===0 && <p>O ranking geral considera somente sessões encerradas com registros completos de todos os confirmados.</p>}
          </section>
        </div>
      </>}

      {tab==="tutoriais" && <section className="mm-card"><h1>Aprenda a jogar</h1>
        <p>Os guias de Poker e Blackjack continuam disponíveis na demonstração da versão 0.5, enquanto migramos esse material para componentes React.</p>
        <div className="mm-row"><Link className="mm-primary" href="/demo.html">Abrir tutoriais da versão 0.5 →</Link></div>
      </section>}
      <p className="mm-muted mm-small mm-space">Mesa Marcada v0.6 — ambiente de desenvolvimento. Seus dados de teste ficam no Supabase e seguem as permissões de cada sessão.</p>
    </main>
  </div>;
}
