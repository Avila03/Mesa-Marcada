"use client";

import type {Game,Rank} from "@/lib/mesa-types";
import {PlayerAvatar} from "./v09-features";

export type RankingPeriod="mes"|"ano"|"geral";
export type AdvancedRank=Rank&{
  positive_events:number;
  best_yield_pct:number;
  max_positive_streak:number;
  total_chips_bought:number;
  total_chips_final:number;
};
const compact=(x:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(x)||0);
const percent=(x:number)=>(Number(x)>0?"+":"")+compact(x)+"%";
const signed=(x:number)=>(Number(x)>0?"+":"")+compact(x);

export default function AdvancedRankingPanel({
  game,onGameChange,period,onPeriodChange,ranking,photoUrls,onPlayer,busy
}:{
  game:Game;onGameChange:(g:Game)=>void;
  period:RankingPeriod;onPeriodChange:(p:RankingPeriod)=>void;
  ranking:AdvancedRank[];photoUrls:Record<string,string>;
  onPlayer:(id:string)=>void;busy:boolean;
}){
  const players=ranking.filter(x=>x.game===game).sort((a,b)=>
    Number(b.avg_yield_pct)-Number(a.avg_yield_pct)||Number(b.net_chips)-Number(a.net_chips));
  const totalSessions=players.reduce((s,x)=>s+Number(x.sessions_played),0);
  const maxStreak=players.reduce((s,x)=>Math.max(s,Number(x.max_positive_streak)),0);
  const bestPositive=players.reduce((s,x)=>s+Number(x.positive_events),0);
  return <div className="mm-advanced-ranking">
    <div className="heading"><div><div className="eyebrow">QUEM DOMINA A MESA?</div>
      <h1>Ranking e estatísticas</h1>
      <p>Desempenho por modalidade, com períodos e resultados conferidos pelo Anfitrião.</p>
    </div></div>
    <div className="mm-ranking-filter-row">
      <div className="mm-filter-bar">
        {(["poker","blackjack"] as Game[]).map(g=><button key={g} type="button"
          className={"filter "+(game===g?"active":"")} onClick={()=>onGameChange(g)}>
          {g==="poker"?"♠ Poker":"♦ Blackjack"}</button>)}
      </div>
      <div className="mm-ranking-period" role="group" aria-label="Período de classificação">
        {([["mes","Mês"],["ano","Ano"],["geral","Histórico"]] as const).map(([value,label])=>
          <button key={value} type="button" aria-pressed={period===value}
            className={period===value?"active":""} onClick={()=>onPeriodChange(value)}>{label}</button>)}
      </div>
    </div>
    <div className="mm-ranking-metrics">
      <div><small>Jogadores no ranking</small><strong>{players.length}</strong></div>
      <div><small>Participações válidas</small><strong>{totalSessions}</strong></div>
      <div><small>Noites positivas</small><strong>{bestPositive}</strong></div>
      <div><small>Maior sequência positiva</small><strong>{maxStreak}</strong></div>
    </div>
    <section className="panel mm-ranking-board">
      <div className="panelhead">
        <div><h2>{game==="poker"?"♠ Poker":"♦ Blackjack"} · {period==="mes"?"Neste mês":period==="ano"?"Neste ano":"Desde o início"}</h2>
        <p className="mm-formfoot">Ordenado por rendimento percentual médio. O número de pontos pode variar entre eventos.</p></div>
        <span className={"tag "+game}>{busy?"Carregando...":players.length+" jogadores"}</span>
      </div>
      {players.length>0?<div className="mm-rank-rows">
        {players.map((player,i)=><button type="button" className={"mm-rank-entry "+(i===0?"mm-rank-leader":"")} key={player.user_id}
          onClick={()=>onPlayer(player.user_id)}>
          <span className={"mm-rank-order "+(i<3?"mm-rank-podium":"")}>{i===0?"1º":i===1?"2º":i===2?"3º":i+1+"º"}</span>
          <PlayerAvatar name={player.display_name} photoUrl={photoUrls[player.user_id]}/>
          <span className="mm-rank-person">
            <strong>{player.display_name}</strong>
            <small>{player.sessions_played} {Number(player.sessions_played)===1?"noite":"noites"} · {player.positive_events} positivas</small>
            <small>Melhor saldo: {signed(player.best_event_chips)} pontos</small>
          </span>
          <span className="mm-rank-performance">
            <strong className={Number(player.avg_yield_pct)>=0?"mm-v09-good":"mm-v09-pending"}>{percent(player.avg_yield_pct)}</strong>
            <small>{signed(player.net_chips)} pontos</small>
            {Number(player.max_positive_streak)>=2&&<small>Sequência: {player.max_positive_streak}</small>}
          </span>
          <span className="mm-rank-open" aria-hidden="true">›</span>
        </button>)}
      </div>:
        <div className="mm-empty"><span className="mm-empty-symbol">★</span>
          <h3>Nenhum resultado nesse período</h3>
          <p>O ranking começará quando um evento for encerrado com fichas, pagamentos e resultados revisados.</p>
          {period!=="geral"&&<button type="button" className="btn"
            onClick={()=>onPeriodChange("geral")}>Ver histórico completo</button>}
        </div>}
    </section>
    <p className="mm-formfoot">Rendimento = (fichas finais − fichas compradas) ÷ fichas compradas. O ranking utiliza a média dos rendimentos de cada evento válido. Não converte pontos em dinheiro.</p>
  </div>;
}

export function PlayerAchievements({stats,userId}:{stats:AdvancedRank[];userId:string}){
  const rows=stats.filter(x=>x.user_id===userId);
  if(!rows.length)return null;
  const nights=rows.reduce((t,x)=>t+Number(x.sessions_played),0);
  const positive=rows.reduce((t,x)=>t+Number(x.positive_events),0);
  const streak=Math.max(...rows.map(x=>Number(x.max_positive_streak)),0);
  const badges=[
    {icon:"♠",label:"Primeira noite",unlocked:nights>=1,note:"Participar de um evento validado"},
    {icon:"★",label:"Presença de peso",unlocked:nights>=5,note:"Cinco eventos validados"},
    {icon:"♦",label:"Noite positiva",unlocked:positive>=1,note:"Terminar um evento com saldo positivo"},
    {icon:"✦",label:"Sequência boa",unlocked:streak>=3,note:"Três eventos seguidos com saldo positivo"},
    {icon:"♣",label:"Veterano",unlocked:nights>=10,note:"Dez eventos validados"},
    {icon:"✧",label:"Consistente",unlocked:positive>=5,note:"Cinco noites positivas"}
  ];
  const unlocked=badges.filter(x=>x.unlocked);
  return <section className="mm-achievements">
    <div className="mm-section-title"><h2>Conquistas</h2><span className="tag">{unlocked.length}/{badges.length} desbloqueadas</span></div>
    <div className="mm-achievement-grid">
      {badges.map(b=><div key={b.label} className={"mm-achievement "+(b.unlocked?"earned":"locked")}>
        <span className="mm-achievement-symbol" aria-hidden="true">{b.icon}</span>
        <strong>{b.label}</strong><small>{b.note}</small>
        <span className="mm-achievement-status">{b.unlocked?"✓ Desbloqueada":"Bloqueada"}</span>
      </div>)}
    </div>
    <p className="mm-formfoot">Conquistas informativas, calculadas a partir de eventos encerrados e revisados. Não envolvem prêmios ou dinheiro.</p>
  </section>;
}
