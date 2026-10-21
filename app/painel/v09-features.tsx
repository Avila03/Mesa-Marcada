"use client";

import {useEffect,useMemo,useState} from "react";
import type {FormEvent, ReactNode} from "react";
import type {Game,Profile,Rank,Attendance,Event} from "@/lib/mesa-types";
import {money,fullDate} from "@/lib/mesa-types";

const avatarOptions=["♠","♥","♦","♣","★","🎲","🃏","🎯"] as const;
const favoriteOptions:Game[]=["poker","blackjack"];
const number=(n:unknown)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(n)||0);

export type FinanceLine={
  user_id:string;
  display_name:string;
  avatar_symbol:string;
  share_brl:number;
  paid_brl:number;
  balance_brl:number;
  chips_bought:number|null;
  chips_final:number|null;
  delta_chips:number|null;
  approved:boolean;
  reviewed_at:string|null;
};

export function PlayerAvatar({symbol,name,large=false}:{symbol?:string;name:string;large?:boolean}){
  return <span className={"mm-player-avatar "+(large?"large":"")} aria-label={"Avatar de "+name}>
    {symbol||name.trim().slice(0,1).toUpperCase()||"♠"}
  </span>;
}

function Stat({name,value,note}:{name:string;value:string;note?:string}){
  return <div className="mm-v09-stat">
    <small>{name}</small><strong>{value}</strong>{note&&<span>{note}</span>}
  </div>;
}

function ProfileStats({stats}:{stats:Rank[]}){
  if(!stats.length)return <div className="mm-empty mm-v09-quiet">
    <span className="mm-empty-symbol">♠</span><p>As estatísticas aparecem quando um evento for encerrado com os resultados revisados.</p>
  </div>;
  return <div className="mm-v09-stat-grid">
    {stats.map(item=><section className={"mm-v09-game-stats "+(item.game==="blackjack"?"blackjack":"")} key={item.game||"poker"}>
      <span className={"tag "+(item.game||"poker")}>{item.game==="blackjack"?"♦ Blackjack":"♠ Poker"}</span>
      <div className="mm-v09-stat-grid">
        <Stat name="Eventos válidos" value={number(item.sessions_played)}/>
        <Stat name="Saldo de fichas" value={(Number(item.net_chips)>0?"+":"")+number(item.net_chips)}/>
        <Stat name="Melhor resultado" value={(Number(item.best_event_chips)>0?"+":"")+number(item.best_event_chips)}/>
        <Stat name="Rendimento médio" value={(Number(item.avg_yield_pct)>0?"+":"")+number(item.avg_yield_pct)+"%"} note="Variação média sobre fichas adquiridas"/>
      </div>
    </section>)}
  </div>;
}

export function ProfilePanel({
  profile,userId,events,attendances,stats,onSave,busy,onBack
}:{
  profile:Profile|undefined;userId:string;events:Event[];attendances:Attendance[];stats:Rank[];
  onSave:(data:{display_name:string;avatar_symbol:string;favorite_game:Game;bio:string})=>Promise<void>;
  busy:boolean;onBack?:()=>void;
}){
  const own=profile?.id===userId;
  const [edit,setEdit]=useState(false);
  const [name,setName]=useState(profile?.display_name||"");
  const [avatar,setAvatar]=useState(profile?.avatar_symbol||"♠");
  const [favorite,setFavorite]=useState<Game>(profile?.favorite_game||"poker");
  const [bio,setBio]=useState(profile?.bio||"");
  const [error,setError]=useState("");

  useEffect(()=>{
    setName(profile?.display_name||"");
    setAvatar(profile?.avatar_symbol||"♠");
    setFavorite(profile?.favorite_game||"poker");
    setBio(profile?.bio||"");
    setEdit(false);
  },[profile?.id,profile?.display_name,profile?.avatar_symbol,profile?.favorite_game,profile?.bio]);
  const nameShown=profile?.display_name||"Jogador";
  const allConfirmations=attendances.filter(a=>a.user_id===profile?.id);
  const upcoming=allConfirmations.filter(a=>events.some(e=>e.id===a.session_id&&e.status==="scheduled"));
  const playerStats=stats.filter(s=>s.user_id===profile?.id);

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setError("");
    if(name.trim().length<2){setError("O apelido precisa ter pelo menos 2 caracteres.");return;}
    try{await onSave({display_name:name.trim(),avatar_symbol:avatar,favorite_game:favorite,bio:bio.trim()});setEdit(false);}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível salvar o perfil.");}
  }

  return <div className="mm-v09-profile">
    {onBack&&<button className="back" type="button" onClick={onBack}>← Voltar ao ranking</button>}
    <div className="heading"><div><div className="eyebrow">JOGADORES DA MESA</div><h1>{own?"Meu perfil":"Perfil do jogador"}</h1><p>Apelido, avatar e histórico das suas noites.</p></div></div>
    <section className="mm-v09-profile-hero">
      <PlayerAvatar symbol={profile?.avatar_symbol} name={nameShown} large/>
      <div className="mm-v09-profile-name"><h2>{nameShown}</h2><span className={"tag "+(profile?.favorite_game||"poker")}>Jogo favorito: {profile?.favorite_game==="blackjack"?"Blackjack":"Poker"}</span>
      {profile?.bio&&<p>{profile.bio}</p>}</div>
      {own&&<button type="button" className="btn" onClick={()=>setEdit(v=>!v)}>{edit?"Cancelar":"✎ Editar perfil"}</button>}
    </section>

    {edit&&own&&<section className="panel mm-v09-edit-profile">
      <div className="panelhead"><h2>Personalizar perfil</h2></div>
      <form className="mm-form-stack" onSubmit={save}>
        <label className="mm-field">Apelido<input required minLength={2} maxLength={64} value={name} onChange={e=>setName(e.target.value)} placeholder="Como seus amigos te conhecem"/></label>
        <div className="mm-field">Escolha um avatar
          <div className="mm-v09-avatar-picker">{avatarOptions.map(s=><button key={s} type="button" className={"mm-v09-avatar-option "+(avatar===s?"active":"")} aria-pressed={avatar===s} aria-label={"Selecionar avatar "+s} onClick={()=>setAvatar(s)}>{s}</button>)}</div>
        </div>
        <label className="mm-field">Jogo favorito<select value={favorite} onChange={e=>setFavorite(e.target.value as Game)}>
          {favoriteOptions.map(g=><option value={g} key={g}>{g==="poker"?"♠ Poker":"♦ Blackjack"}</option>)}
        </select></label>
        <label className="mm-field">Sobre mim (opcional)<textarea rows={3} maxLength={240} placeholder="Uma frase sobre você" value={bio} onChange={e=>setBio(e.target.value)}/></label>
        {error&&<p className="mm-message error" role="alert">{error}</p>}
        <button type="submit" className="btn gold" disabled={busy}>{busy?"Salvando...":"Salvar perfil"}</button>
      </form>
    </section>}

    <section className="mm-v09-profile-overview">
      <Stat name="Presenças confirmadas" value={number(allConfirmations.length)}/>
      <Stat name="Próximos eventos" value={number(upcoming.length)}/>
      <Stat name="Noites contabilizadas" value={number(playerStats.reduce((s,r)=>s+Number(r.sessions_played),0))}/>
    </section>
    <div className="mm-section-title"><h2>Desempenho por modalidade</h2></div>
    <ProfileStats stats={playerStats}/>
    <p className="mm-formfoot">Os dados de desempenho consideram somente eventos encerrados com todos os resultados revisados. Compras em reais não entram nas pontuações.</p>
  </div>;
}

export function RankingPanel({
  game,onGameChange,ranking,onPlayer
}:{
  game:Game;onGameChange:(g:Game)=>void;ranking:Rank[];onPlayer:(id:string)=>void;
}){
  const ordered=useMemo(()=>ranking.filter(r=>r.game===game).slice()
    .sort((a,b)=>Number(b.avg_yield_pct)-Number(a.avg_yield_pct)||Number(b.net_chips)-Number(a.net_chips)),[ranking,game]);
  return <>
    <div className="heading"><div><div className="eyebrow">CLASSIFICAÇÃO DA GALERA</div><h1>Ranking e estatísticas</h1>
      <p>Resultados de eventos encerrados e revisados, separados por modalidade.</p></div></div>
    <div className="mm-filter-bar">
      {(["poker","blackjack"] as Game[]).map(g=><button key={g} type="button" className={"filter "+(game===g?"active":"")} onClick={()=>onGameChange(g)}>{g==="poker"?"♠ Poker":"♦ Blackjack"}</button>)}
    </div>
    <section className="panel">
      <div className="panelhead"><h2>{game==="poker"?"♠ Poker":"♦ Blackjack"} · Classificação</h2><span className={"tag "+game}>{ordered.length} jogadores</span></div>
      <p className="mm-formfoot" style={{marginBottom:15}}>Ordenado pelo rendimento médio (%) para comparar eventos que utilizem quantidades diferentes de fichas. O saldo absoluto aparece separadamente.</p>
      {ordered.map((r,i)=><button className="mm-v09-rank-player" type="button" key={r.user_id} onClick={()=>onPlayer(r.user_id)}>
        <span className={"mm-v09-medal "+(i<3?"podium":"")}>{i+1}º</span>
        <PlayerAvatar symbol={r.avatar_symbol} name={r.display_name}/>
        <span className="mm-v09-rank-name"><strong>{r.display_name}</strong><small>{r.sessions_played} noites · Melhor: {Number(r.best_event_chips)>0?"+":""}{number(r.best_event_chips)} fichas</small></span>
        <span className="mm-v09-rank-result"><strong>{Number(r.avg_yield_pct)>0?"+":""}{number(r.avg_yield_pct)}%</strong><small>{Number(r.net_chips)>0?"+":""}{number(r.net_chips)} fichas</small></span>
        <span aria-hidden="true">›</span>
      </button>)}
      {ordered.length===0&&<div className="mm-empty"><span className="mm-empty-symbol">★</span>
        <h3>Ainda sem resultados</h3><p>O ranking começará depois que um evento for encerrado com os registros completos e aprovados.</p></div>}
    </section>
    <p className="mm-formfoot">Média percentual = média de (fichas finais − fichas adquiridas) / fichas adquiridas, em cada evento válido. Não se converte fichas em dinheiro.</p>
  </>;
}

function escapeIcs(value:string){
  return value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
}
function utcIcs(value:Date){return value.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");}

export function EventShareActions({id,title,date,room}:{id:string;title:string;date:string;room:string}){
  const [result,setResult]=useState("");
  const url=typeof window==="undefined"?"":window.location.origin+"/evento/"+id;
  const caption=[title,room,fullDate(date),"Confirme sua presença no Mesa Marcada:",url].join("\n");
  async function share(){
    if(!url)return;
    const canShare=typeof navigator!=="undefined"&&typeof navigator.share==="function";
    if(canShare){
      try{await navigator.share({title:"Mesa Marcada · "+title,text:caption,url});setResult("Convite compartilhado!");return;}
      catch(e){if(e instanceof Error&&e.name==="AbortError")return;}
    }
    window.open("https://wa.me/?text="+encodeURIComponent(caption),"_blank","noopener,noreferrer");
    setResult("Convite preparado para compartilhar.");
  }
  async function copy(){
    try{await navigator.clipboard.writeText(url);setResult("Link copiado!");}
    catch{setResult("Copie este endereço: "+url);}
  }
  function calendar(){
    const starts=new Date(date);
    const ends=new Date(starts.getTime()+4*60*60*1000);
    const ics=[
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Mesa Marcada//Eventos//PT-BR",
      "BEGIN:VEVENT","UID:"+id+"@mesa-marcada.vercel.app",
      "DTSTAMP:"+utcIcs(new Date()),
      "DTSTART:"+utcIcs(starts),
      "DTEND:"+utcIcs(ends),
      "SUMMARY:"+escapeIcs(title),
      "DESCRIPTION:"+escapeIcs("Evento de "+room+". Veja local e confirme presença no site: "+url),
      "URL:"+url,"END:VEVENT","END:VCALENDAR"
    ].join("\r\n");
    const address=URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));
    const a=document.createElement("a");a.href=address;a.download="mesa-marcada-"+id.slice(0,8)+".ics";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(address),1000);
    setResult("Calendário preparado. Confira o horário antes de salvar.");
  }
  return <div className="mm-v09-share">
    <button type="button" className="btn mm-v09-share-primary" onClick={()=>void share()}>↗ Compartilhar evento</button>
    <button type="button" className="btn" onClick={()=>void copy()}>⎘ Copiar link</button>
    <button type="button" className="btn" onClick={calendar}>▦ Calendário</button>
    {result&&<div role="status" className="mm-v09-share-notice">{result}</div>}
    <p className="mm-formfoot">O link exige login no Mesa Marcada; compartilhe somente com quem deve saber sobre o encontro. O convite não inclui o endereço exato.</p>
  </div>;
}

export function FinanceReviewBoard({
  lines,organizer,scheduled,loading,busy,pendingPaymentsByUser,onApprove,onReopen
}:{
  lines:FinanceLine[];
  organizer:boolean;
  scheduled:boolean;
  loading:boolean;
  busy:boolean;
  pendingPaymentsByUser:Record<string,number>;
  onApprove:(userId:string)=>void;
  onReopen:(userId:string)=>void;
}){
  const total=lines.reduce((s,r)=>s+Number(r.share_brl),0);
  const approved=lines.filter(l=>l.approved).length;
  const ready=lines.length>0&&lines.every(l=>l.approved&&l.chips_final!==null&&l.chips_bought!==null&&(pendingPaymentsByUser[l.user_id]||0)===0);
  return <section className="panel mm-v09-finance-review">
    <div className="panelhead">
      <div><h2>Conferência da noite</h2><p className="mm-formfoot">O organizador revisa as fichas de cada jogador antes de encerrar o evento.</p></div>
      <span className={"tag "+(ready?"poker":"archive")}>{approved}/{lines.length} aprovados</span>
    </div>
    {loading&&<p className="mm-formfoot">Calculando o rateio de despesas...</p>}
    <div className="mm-v09-finance-summary">
      <Stat name="Despesas compartilhadas" value={money(total)}/>
      <Stat name="Registros aprovados" value={approved+" de "+lines.length}/>
      <Stat name="Encerramento" value={ready?"Pronto":"Pendente"}/>
    </div>
    <div className="mm-v09-finance-rows">
      {lines.map(line=><div className="mm-v09-finance-line" key={line.user_id}>
        <div className="mm-v09-finance-person">
          <PlayerAvatar symbol={line.avatar_symbol} name={line.display_name}/>
          <div><strong>{line.display_name}</strong><small className={line.approved?"mm-v09-good":"mm-v09-pending"}>{line.approved?"✓ Revisado":"● Aguardando revisão"}</small>
          {(pendingPaymentsByUser[line.user_id]||0)>0&&<small className="mm-v09-pending">● {pendingPaymentsByUser[line.user_id]} compras aguardando recebimento</small>}</div>
        </div>
        <div className="mm-v09-finance-numbers">
          <span><small>Fichas compradas</small><strong>{line.chips_bought===null?"Pendente":number(line.chips_bought)}</strong></span>
          <span><small>Fichas finais</small><strong>{line.chips_final===null?"Pendente":number(line.chips_final)}</strong></span>
          <span><small>Saldo de fichas</small><strong>{line.delta_chips===null?"—":(line.delta_chips>0?"+":"")+number(line.delta_chips)}</strong></span>
        </div>
        <div className="mm-v09-finance-numbers">
          <span><small>Quota de despesas</small><strong>{money(line.share_brl)}</strong></span>
          <span><small>Despesas pagas</small><strong>{money(line.paid_brl)}</strong></span>
          <span><small>Diferença informativa</small><strong className={line.balance_brl>=0?"mm-v09-good":"mm-v09-pending"}>{money(line.balance_brl)}</strong></span>
        </div>
        {organizer&&scheduled&&<div className="mm-v09-review-action">
          {line.approved?
            <button className="btn" disabled={busy} type="button" onClick={()=>onReopen(line.user_id)}>Reabrir revisão</button>:
            <button className="btn gold" disabled={busy||line.chips_bought===null||line.chips_final===null||(pendingPaymentsByUser[line.user_id]||0)>0}
              type="button" onClick={()=>onApprove(line.user_id)}>✓ Aprovar fichas</button>}
        </div>}
      </div>)}
      {!lines.length&&!loading&&<p className="mm-empty">Confirme jogadores no evento para gerar o rateio e revisar os resultados.</p>}
    </div>
    <p className="mm-formfoot">Rateio igualitário entre confirmados, calculado no banco de dados com precisão de centavos. Diferença positiva significa que a pessoa informou ter pago mais do que sua quota; este aplicativo não realiza cobranças, transferências ou liquidações.</p>
    {organizer&&scheduled&&!ready&&<p className="mm-message">Para encerrar o evento, todos os confirmados precisam registrar suas compras, ter os pagamentos marcados como recebidos e receber aprovação do Anfitrião. Alterações posteriores cancelam automaticamente a aprovação anterior.</p>}
  </section>;
}

export function AttendeeMiniCard({symbol,name}:{symbol?:string;name:string}){
  return <span className="mm-v09-attendee"><PlayerAvatar symbol={symbol} name={name}/><span>{name}</span></span>;
}
