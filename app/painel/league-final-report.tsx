"use client";
import {GAME_META,VARIANT_NAMES,type Game} from "@/lib/games";
import {useState} from "react";
import type {CrestConfig} from "@/app/brasoes/demo/crest-editor";
import {CrestMark} from "@/app/brasoes/demo/crest-editor";
import "./league-final-report.css";

export type LeagueFinalPlayer={user_id:string;name:string;played:number;net_chips:number};
export type LeagueFinalEvent={title:string;starts_at:string;status:string;game:Game};
export type LeagueFinalSummary={
 version:number;score_unit?:"brl_cents";league_name:string;started_at:string;finished_at:string;
 score_games?:{game:Game;variant:string;ranking:{user_id:string;name:string;played:number;wins:number}[]}[];
 members:number;events_total:number;events_finished:number;events_cancelled:number;
 events:LeagueFinalEvent[];
 games:Record<"poker"|"blackjack",{events:number;ranking:LeagueFinalPlayer[]}>;
};
const points=(n:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(n)||0);
const date=(v:string)=>new Date(v).toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"});
const gameLabel=(game:Game)=>GAME_META[game]?.name||game;

export default function LeagueFinalReport({summary,emblem}:{
 summary:LeagueFinalSummary;emblem:CrestConfig;
}){
 const [game,setGame]=useState<"poker"|"blackjack">("poker");
 const [copied,setCopied]=useState(false);
 const result=(n:number)=>summary.score_unit==="brl_cents"?(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}):points(n)+" fichas";
 const ranking=summary.games?.[game]?.ranking||[];
 const events=summary.events||[];
 async function copyReport(){
  const parts=[
   "MESA MARCADA — RELATÓRIO FINAL",
   summary.league_name,
   "Período: "+date(summary.started_at)+" a "+date(summary.finished_at),
   "Participantes: "+summary.members,
   "Eventos: "+summary.events_finished+" concluídos, "+summary.events_cancelled+" cancelados",
  ];
  for(const key of ["poker","blackjack"] as const){
   parts.push("",gameLabel(key)+" · "+(summary.games?.[key]?.events||0)+" eventos");
   const rows=summary.games?.[key]?.ranking||[];
   if(!rows.length)parts.push("Sem partidas com resultados registrados");
   rows.forEach((p,i)=>parts.push((i+1)+"º "+p.name+" · "+result(p.net_chips)+" de saldo · "+p.played+" rodadas"));
  }
  for(const mode of summary.score_games||[]){
   parts.push("",gameLabel(mode.game)+" · "+VARIANT_NAMES[mode.variant]);
   mode.ranking.forEach((p,i)=>parts.push((i+1)+"º "+p.name+" · "+p.wins+" vitórias em "+p.played+" partidas"));
  }
  try{await navigator.clipboard.writeText(parts.join("\n"));setCopied(true);}
  catch{setCopied(false);}
 }
 return <section className="mm-league-final-report" aria-label="Resumo final da liga">
  <header className="mm-final-header">
   <div className="mm-final-emblem"><CrestMark value={emblem}/></div>
   <div className="mm-final-title">
    <small>ARQUIVO OFICIAL · MESA MARCADA</small>
    <h2>Resumo final da Liga</h2>
    <p>{summary.league_name}</p>
    <span>{date(summary.started_at)} — {date(summary.finished_at)}</span>
   </div>
   <span className="mm-final-stamp">FINALIZADA</span>
  </header>
  <div className="mm-final-metrics">
   <div><small>Participantes</small><strong>{points(summary.members)}</strong></div>
   <div><small>Eventos realizados</small><strong>{points(summary.events_finished)}</strong></div>
   <div><small>Cancelados</small><strong>{points(summary.events_cancelled)}</strong></div>
   <div><small>Total de eventos</small><strong>{points(summary.events_total)}</strong></div>
  </div>
  {Boolean(!summary.score_games?.length||summary.games?.poker?.ranking.length||summary.games?.blackjack?.ranking.length)&&<>
  <div className="mm-final-ranking-head">
   <div><small>RESULTADOS CONSOLIDADOS</small><h3>Classificação final</h3></div>
   <div className="mm-final-tabs">
    {(["poker","blackjack"] as const).map(g=><button type="button" aria-pressed={game===g}
     className={game===g?"active":""} onClick={()=>setGame(g)} key={g}>
     {g==="poker"?"♠ Poker":"♦ Blackjack"}</button>)}
   </div>
  </div>
  <p className="mm-final-context">{summary.games?.[game]?.events||0} eventos concluídos nesta modalidade. {summary.score_unit==="brl_cents"?"Saldo em reais das partidas conciliadas.":"Pontuação histórica: saldo líquido de fichas."}</p>
  {ranking.length?<div className="mm-final-ranking">
   {ranking.map((player,i)=><div className={"mm-final-player "+(i===0?"champion":"")} key={player.user_id}>
    <div className="mm-final-place">{i===0?"★":i+1+"º"}</div>
    <div className="mm-final-player-name"><strong>{player.name}</strong>
     <small>{player.played} {player.played===1?"resultado":"resultados"} registrados</small></div>
    <div className={"mm-final-net "+(player.net_chips>=0?"positive":"negative")}>
     {player.net_chips>0?"+":""}{result(player.net_chips)}</div>
   </div>)}
  </div>:<p className="mm-league-empty">Nenhuma pontuação registrada em {gameLabel(game)}. Não há campeão desta modalidade.</p>}
  </>}
  {(summary.score_games||[]).map(mode=><section className="mm-score-archive" key={mode.game+":"+mode.variant}>
   <h3>{gameLabel(mode.game)} · {VARIANT_NAMES[mode.variant]}</h3>
   <p className="mm-formfoot">Vitórias em partidas concluídas. Cada integrante da equipe vencedora recebe uma vitória.</p>
   <div className="mm-final-ranking">{mode.ranking.map((p,i)=><div className={"mm-final-player "+(i===0?"champion":"")} key={p.user_id}><div className="mm-final-place">{i+1}º</div><div className="mm-final-player-name"><strong>{p.name}</strong><small>{p.played} partidas</small></div><div className="mm-final-net positive">{p.wins} vitórias</div></div>)}</div>
  </section>)}
  <div className="mm-final-events">
   <h3>Histórico de eventos</h3>
   {events.length?<div>{events.map((event,i)=><div className="mm-final-event" key={i}>
    <div><strong>{event.title}</strong><small>{date(event.starts_at)} · {gameLabel(event.game)}</small></div>
    <span>{event.status==="finished"?"Concluído":event.status==="cancelled"?"Cancelado":"Agendado"}</span>
   </div>)}</div>:<p className="mm-league-empty">Esta Liga terminou sem eventos.</p>}
  </div>
  <footer className="mm-final-actions">
   <p>Relatório histórico gerado no encerramento. Os resultados e a identidade da Liga permanecem arquivados.</p>
   <button className="btn" type="button" onClick={()=>void copyReport()}>{copied?"✓ Copiado":"Copiar resumo"}</button>
  </footer>
 </section>;
}
