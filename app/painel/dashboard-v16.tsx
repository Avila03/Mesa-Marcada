"use client";

import {ALL_GAMES,GAME_META} from "@/lib/games";
import type {Attendance,Event,Game,Room} from "@/lib/mesa-types";
import {date,eventTime,gameName,money} from "@/lib/mesa-types";
import type {ExpenseSettlement,MyExpenseSplitRow} from "./expense-splits";
import UiIcon from "./ui-icon";
import {LeagueHomePreview} from "./league-hub";

type DashboardProps={
  firstName:string;
  userId:string;
  upcoming:Event[];
  attendances:Attendance[];
  rooms:Room[];
  mySplits:MyExpenseSplitRow[];
  settlements:ExpenseSettlement[];
  isAdmin:boolean;
  onCreate:()=>void;
  onOpenEvent:(id:string)=>void;
  onEvents:()=>void;
  onGame:(game:Game)=>void;
  onTables:()=>void;
  onProfile:()=>void;
  onRanking:()=>void;
  onAdmin:()=>void;
  onLeagues:()=>void;
  onOpenLeague:(id:string)=>void;
  pendingReconfirmEventId?:string;
};

const categoryNames:Record<string,string>={
  food:"Comida",drinks:"Bebidas",materials:"Materiais",other:"Outros"
};

export default function DashboardV16({
  firstName,userId,upcoming,attendances,rooms,mySplits,settlements,isAdmin,
  onCreate,onOpenEvent,onEvents,onGame,onTables,onProfile,onRanking,onAdmin,onLeagues,onOpenLeague,pendingReconfirmEventId
}:DashboardProps){
  const confirmed=new Set(attendances.filter(a=>a.user_id===userId).map(a=>a.session_id));
  const myUpcoming=upcoming.filter(e=>confirmed.has(e.id));
  const next=myUpcoming[0]||upcoming[0];
  const myNext=Boolean(myUpcoming.length);
  const settled=new Set(settlements.map(s=>s.expense_id+":"+s.user_id));
  const owed=mySplits.filter(s=>s.user_id===userId&&s.paid_by!==userId&&!settled.has(s.expense_id+":"+s.user_id));
  const receivable=mySplits.filter(s=>s.paid_by===userId&&s.user_id!==userId&&!settled.has(s.expense_id+":"+s.user_id));
  const debt=owed.reduce((c,s)=>c+Math.round(Number(s.share_brl)*100),0)/100;
  const credit=receivable.reduce((c,s)=>c+Math.round(Number(s.share_brl)*100),0)/100;
  const gameRoom=(game:Game)=>rooms.find(room=>room.game===game);
  const nextGuests=next?attendances.filter(a=>a.session_id===next.id).length:0;
  return <div className="mm-home-v16">
    <header className="mm-home-head">
      <div>
        <span className="mm-home-kicker">SEU CLUBE DE JOGOS</span>
        <h1>Próxima rodada, <span>{firstName}.</span></h1>
        <p>Tudo o que importa para organizar a noite, em um só lugar.</p>
      </div>
      <button type="button" className="mm-home-create" onClick={onCreate}>
        <UiIcon name="plus" size={19}/> Criar evento
      </button>
    </header>

    {next?<section className="mm-home-featured" aria-label="Próximo evento">
      <div className="mm-home-featured-meta">
        <span className="mm-home-label"><UiIcon name="calendar" size={15}/> {myNext?"MEU PRÓXIMO EVENTO":"PRÓXIMO EVENTO DISPONÍVEL"}</span>
        <span className={"mm-home-presence "+(confirmed.has(next.id)?"yes":"waiting")}>
          <UiIcon name={confirmed.has(next.id)?"check":"clock"} size={14}/>
          {confirmed.has(next.id)?"Participando":"Escolha um assento"}
        </span>
      </div>
      <h2>{next.title}</h2>
      <div className="mm-home-event-info">
        <span><UiIcon name="calendar" size={16}/>{date(next.starts_at)}</span>
        <span><UiIcon name="clock" size={16}/>{eventTime(next.starts_at)}</span>
        <span><UiIcon name="cards" size={16}/>{gameName(gameRoomId(next.room_id,rooms))}</span>
      </div>
      <div className="mm-home-event-info mm-home-location">
        <span><UiIcon name="map-pin" size={16}/>{next.location}</span>
        <span><UiIcon name="users" size={16}/>{nextGuests}/{next.max_participants} participantes</span>
      </div>
      <div className="mm-home-featured-actions">
        <button type="button" className="mm-home-primary"
          onClick={()=>onOpenEvent(next.id)}>{confirmed.has(next.id)?"Ver meu assento":"Escolher assento"} <UiIcon name="arrow-right" size={17}/></button>
      </div>
    </section>:<section className="mm-home-featured mm-home-no-event">
      <span className="mm-home-label"><UiIcon name="calendar" size={15}/> AGENDA LIVRE</span>
      <h2>Nenhuma noite marcada por enquanto.</h2>
      <p>Escolha Poker ou Blackjack, marque o encontro e convide a galera.</p>
      <button type="button" className="mm-home-primary" onClick={onCreate}>
        <UiIcon name="plus" size={18}/> Marcar uma noite
      </button>
    </section>}

    <LeagueHomePreview onBrowse={onLeagues} onOpen={onOpenLeague}/>
    {pendingReconfirmEventId&&<section className="mm-home-reconfirm-callout">
      <div><strong>Reconfirme sua presença</strong><small>A data ou o horário de um evento mudou. Sua cadeira está preservada.</small></div>
      <button type="button" onClick={()=>onOpenEvent(pendingReconfirmEventId)}>Responder agora <UiIcon name="arrow-right" size={14}/></button>
    </section>}
    <section className="mm-home-statgrid" aria-label="Resumo pessoal">
      <button type="button" onClick={onEvents}>
        <UiIcon name="calendar" size={21}/>
        <span><strong>{upcoming.length}</strong><small>Próximos eventos</small></span>
      </button>
      <button type="button" onClick={onEvents}>
        <UiIcon name="check" size={21}/>
        <span><strong>{myUpcoming.length}</strong><small>Minhas presenças</small></span>
      </button>
      <button type="button" onClick={onProfile} className={debt>0?"has-debt":""}>
        <UiIcon name="credit-card" size={21}/>
        <span><strong>{money(debt)}</strong><small>Meus rachas pendentes</small></span>
      </button>
    </section>

    <div className="mm-home-columns">
      <section className="mm-home-panel">
        <header>
          <div><span className="mm-home-kicker">AGENDA</span><h2>Próximas noites</h2></div>
          <button type="button" className="mm-home-textlink" onClick={onEvents}>Ver agenda <UiIcon name="arrow-right" size={16}/></button>
        </header>
        {upcoming.length?upcoming.slice(0,3).map(ev=><button key={ev.id} type="button"
          className="mm-home-event-row" onClick={()=>onOpenEvent(ev.id)}>
          <span className="mm-home-datebox">
            <strong>{new Date(ev.starts_at).toLocaleDateString("pt-BR",{day:"2-digit"})}</strong>
            <small>{new Date(ev.starts_at).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</small>
          </span>
          <span className="mm-home-rowtext">
            <strong>{ev.title}</strong>
            <small>{gameName(gameRoomId(ev.room_id,rooms))} · {eventTime(ev.starts_at)}</small>
          </span>
          <span className={"mm-home-rowstatus "+(confirmed.has(ev.id)?"joined":"")}>
            {confirmed.has(ev.id)?"Participando":"Escolher lugar"}
          </span>
        </button>):<div className="mm-home-empty">Ainda não há eventos. Você pode criar o primeiro!</div>}
      </section>
      <section className="mm-home-panel mm-home-money-panel">
        <header>
          <div><span className="mm-home-kicker">ORGANIZAÇÃO</span><h2>Meus rachas</h2></div>
          <button type="button" className="mm-home-textlink" onClick={onProfile}>Ver no perfil <UiIcon name="arrow-right" size={16}/></button>
        </header>
        <div className="mm-home-money-stat">
          <div><small>A pagar</small><strong className={debt>0?"outgoing":""}>{money(debt)}</strong></div>
          <div><small>A receber</small><strong className={credit>0?"incoming":""}>{money(credit)}</strong></div>
        </div>
        {owed.length>0?<div className="mm-home-debt-list">
          {owed.slice(0,2).map(share=><button key={share.expense_id} type="button"
            onClick={onProfile} className="mm-home-debt-row">
            <span>{categoryNames[share.category]||"Despesa"} · {share.label}</span>
            <strong>{money(share.share_brl)}</strong>
          </button>)}
        </div>:<p className="mm-home-money-empty">
          <UiIcon name="check" size={16}/> Você não tem rachas pendentes para pagar.
        </p>}
      </section>
    </div>

    <section className="mm-home-tables">
      <header>
        <div><span className="mm-home-kicker">MESAS FIXAS</span><h2>Escolha seu jogo</h2></div>
        <button type="button" className="mm-home-textlink" onClick={onTables}>Mesas e tutoriais <UiIcon name="arrow-right" size={16}/></button>
      </header>
      <div className="mm-home-tablegrid">
        {ALL_GAMES.map(game=><button type="button"
          key={game} onClick={()=>onGame(game)}
          className={"mm-home-table "+game}>
          <span className="mm-home-table-icon"><UiIcon name={game==="poker"?"spade":game==="blackjack"?"diamond":"cards"} size={32}/></span>
          <span className="mm-home-table-description">
            <strong>{gameName(game)}</strong>
            <small>{GAME_META[game].variants.length>1?"Variantes, eventos e placar":"Eventos, regras e resultados"}</small>
          </span>
          <UiIcon name="arrow-right" size={18}/>
        </button>)}
      </div>
    </section>

    <section className="mm-home-shortcuts" aria-label="Outros acessos">
      <button type="button" onClick={onRanking}><UiIcon name="trophy" size={19}/> Ranking <UiIcon name="arrow-right" size={15}/></button>
      {isAdmin&&<button type="button" onClick={onAdmin}><UiIcon name="settings" size={19}/> Administração <UiIcon name="arrow-right" size={15}/></button>}
    </section>
  </div>;
}

function gameRoomId(roomId:string,rooms:Room[]):Game{
  return rooms.find(room=>room.id===roomId)?.game||"poker";
}
