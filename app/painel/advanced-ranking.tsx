"use client";

import type {Game,Rank} from "@/lib/mesa-types";
import {PlayerAvatar} from "./v09-features";

export type AdvancedRank=Rank&{
  positive_events:number;
  best_yield_pct:number;
  max_positive_streak:number;
  total_chips_bought:number;
  total_chips_final:number;
};

const formatNumber=(value:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(value)||0);
const cash=(value:number)=>(Number(value)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const signed=(value:number)=>(Number(value)>0?"+":"")+formatNumber(value);

/** O rendimento anual usa valores consolidados em centavos. */
function annualReturn(row:AdvancedRank){
  const bought=Number(row.total_chips_bought);
  return bought>0?Number(row.net_chips)/bought*100:null;
}

export default function AdvancedRankingPanel({
  game,onGameChange,ranking,photoUrls,onPlayer,busy
}:{
  game:Game;onGameChange:(g:Game)=>void;
  ranking:AdvancedRank[];photoUrls:Record<string,string>;
  onPlayer:(id:string)=>void;busy:boolean;
}){
  const year=new Date().getFullYear();
  // Cada jogador aparece uma única vez por jogo, com todos os resultados
  // do ano consolidados pelo banco de dados.
  const players=ranking.filter(row=>row.game===game).sort((a,b)=>{
    const x=annualReturn(a),y=annualReturn(b);
    return (y??-Infinity)-(x??-Infinity)||Number(b.net_chips)-Number(a.net_chips);
  });
  const sessions=players.reduce((total,row)=>total+Number(row.sessions_played),0);

  return <div className="mm-advanced-ranking">
    <div className="heading"><div>
      <div className="eyebrow">TEMPORADA {year}</div>
      <h1>Ranking anual</h1>
      <p>Os resultados de todas as noites de {year} ficam reunidos em um único saldo por jogador.</p>
    </div></div>

    <div className="mm-ranking-filter-row">
      <div className="mm-filter-bar" aria-label="Modalidade">
        {(["poker","blackjack"] as Game[]).map(mode=>
          <button key={mode} type="button" aria-pressed={game===mode}
            className={"filter "+(game===mode?"active":"")}
            onClick={()=>onGameChange(mode)}>
            {mode==="poker"?"♠ Poker":"♦ Blackjack"}
          </button>)}
      </div>
      <span className="mm-annual-summary">{year} · {players.length} {players.length===1?"jogador":"jogadores"} · {sessions} {sessions===1?"participação":"participações"}</span>
    </div>

    <section className="panel mm-ranking-board">
      <div className="panelhead">
        <div><h2>{game==="poker"?"♠ Poker":"♦ Blackjack"} · resultado de {year}</h2>
          <p className="mm-formfoot">Saldo anual em reais e rendimento acumulado. Poker e Blackjack têm rankings separados.</p>
        </div>
        {busy&&<span className="tag">Atualizando...</span>}
      </div>

      {players.length>0?<div className="mm-rank-rows">
        {players.map((player,index)=>{
          const roi=annualReturn(player);
          return <button type="button" className={"mm-rank-entry "+(index===0?"mm-rank-leader":"")} key={player.user_id}
            onClick={()=>onPlayer(player.user_id)}>
            <span className={"mm-rank-order "+(index<3?"mm-rank-podium":"")}>{index+1}º</span>
            <PlayerAvatar name={player.display_name} photoUrl={photoUrls[player.user_id]}/>
            <span className="mm-rank-person">
              <strong>{player.display_name}</strong>
              <small>{player.sessions_played} {Number(player.sessions_played)===1?"noite":"noites"} em {year}</small>
            </span>
            <span className="mm-rank-performance">
              <strong className={Number(player.net_chips)>=0?"mm-v09-good":"mm-v09-pending"}>
                {cash(player.net_chips)}
              </strong>
              <small>{roi===null?"Sem base para percentual":signed(roi)+"% no ano"}</small>
            </span>
            <span className="mm-rank-open" aria-hidden="true">›</span>
          </button>;
        })}
      </div>:
        <div className="mm-empty">
          <h3>Nenhum resultado em {year}</h3>
          <p>Os saldos aparecem quando os eventos deste ano forem encerrados, com as fichas e os pagamentos conferidos.</p>
        </div>}
    </section>
    <p className="mm-formfoot">Saldo anual = valores finais − compras de fichas, somados nos eventos conciliados do ano. Rendimento = saldo anual ÷ total comprado. Valores informativos; o aplicativo não movimenta dinheiro.</p>
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
    <div className="mm-section-title"><h2>Conquistas do ano</h2><span className="tag">{unlocked.length}/{badges.length} desbloqueadas</span></div>
    <div className="mm-achievement-grid">
      {badges.map(b=><div key={b.label} className={"mm-achievement "+(b.unlocked?"earned":"locked")}>
        <span className="mm-achievement-symbol" aria-hidden="true">{b.icon}</span>
        <strong>{b.label}</strong><small>{b.note}</small>
        <span className="mm-achievement-status">{b.unlocked?"✓ Desbloqueada":"Bloqueada"}</span>
      </div>)}
    </div>
    <p className="mm-formfoot">Conquistas de {new Date().getFullYear()}, calculadas somente com eventos encerrados e revisados. Não envolvem prêmios ou dinheiro.</p>
  </section>;
}
