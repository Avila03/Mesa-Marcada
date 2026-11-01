import {ALL_GAMES,GAME_META,VARIANT_NAMES,isChipGame,type Game} from './games';
import type {LeagueFinalPlayer,LeagueFinalSummary,LeagueScorePlayer} from './league-final-summary';

export type Ranked<T>=T&{rank:number};

/** Names and IDs stabilize the archived order; they never break a sporting tie. */
function ranked<T>(rows:readonly T[],compare:(a:T,b:T)=>number):Ranked<T>[] {
 const sorted=rows.slice().sort(compare);
 let place=1;
 return sorted.map((row,i)=>{
  if(i&&compare(sorted[i-1],row)!==0)place=i+1;
  return {...row,rank:place};
 });
}
export const rankFinancialPlayers=(rows:readonly LeagueFinalPlayer[])=>ranked(rows,(a,b)=>b.net_chips-a.net_chips||b.played-a.played);
export const rankScorePlayers=(rows:readonly LeagueScorePlayer[])=>ranked(rows,(a,b)=>b.wins-a.wins||(b.wins*a.played-a.wins*b.played)||b.played-a.played);

type LeagueCardPlayer={id:string;name:string;rank:number;played:number;wins:number|null};
export type LeagueCardMode={id:string;game:Game;variant:string|null;label:string;events:number|null;players:LeagueCardPlayer[]};
export type LeagueFinalCard={
 leagueName:string;finishedAt:string;game:Game;modeLabel:string;financial:boolean;
 featured:LeagueCardPlayer;championsCount:number;players:LeagueCardPlayer[];events:number|null;
};

const validPlayed=(n:number)=>Number.isSafeInteger(n)&&n>0;
const cleanName=(name:string)=>name.trim()||'Jogador';

/** Uses only the immutable final report already authorized for this viewer. */
export function leagueCardModes(summary:LeagueFinalSummary):LeagueCardMode[]{
 if(!summary.finished_at||!Number.isFinite(Date.parse(summary.finished_at)))return [];
 const modes:LeagueCardMode[]=[];
 for(const game of ['poker','blackjack'] as const){
  const archive=summary.games?.[game];
  const players=rankFinancialPlayers((archive?.ranking||[]).filter(p=>validPlayed(p.played)&&Number.isSafeInteger(p.net_chips)));
  if(!players.length)continue;
  modes.push({id:game,game,variant:null,label:GAME_META[game].name,events:archive?.events??null,
   players:players.map(p=>({id:p.user_id,name:cleanName(p.name),rank:p.rank,played:p.played,wins:null}))});
 }
 for(const mode of summary.score_games||[]){
  if(!ALL_GAMES.includes(mode.game)||isChipGame(mode.game))continue;
  const players=rankScorePlayers(mode.ranking.filter(p=>validPlayed(p.played)&&Number.isSafeInteger(p.wins)&&p.wins>=0&&p.wins<=p.played));
  if(!players.length||players[0].wins===0)continue;
  const variant=VARIANT_NAMES[mode.variant]||mode.variant;
  const label=['truco','canastra'].includes(mode.game)?`${GAME_META[mode.game].name} · ${variant}`:variant||GAME_META[mode.game].name;
  modes.push({id:mode.game+':'+mode.variant,game:mode.game,variant:mode.variant,label,events:null,
   players:players.map(p=>({id:p.user_id,name:cleanName(p.name),rank:p.rank,played:p.played,wins:p.wins}))});
 }
 return modes;
}

export function leagueFinalCard(summary:LeagueFinalSummary,mode:LeagueCardMode,featuredId?:string):LeagueFinalCard{
 const champions=mode.players.filter(p=>p.rank===1);
 const featured=featuredId?champions.find(p=>p.id===featuredId):champions[0];
 if(!featured)throw new Error('Escolha um dos campeões registrados nesta modalidade.');
 return {leagueName:summary.league_name,finishedAt:summary.finished_at,game:mode.game,modeLabel:mode.label,
  financial:isChipGame(mode.game),featured,championsCount:champions.length,players:mode.players,events:mode.events};
}

export function leagueCardMetrics(card:LeagueFinalCard):{value:string;label:string}[]{
 const number=(n:number)=>new Intl.NumberFormat('pt-BR').format(n);
 if(card.financial)return [
  {value:number(card.featured.played),label:'RESULTADOS'},
  {value:number(card.players.length),label:'JOGADORES'},
  {value:card.events===null?'—':number(card.events),label:'EVENTOS'},
 ];
 const wins=card.featured.wins!;
 return [{value:number(card.featured.played),label:'PARTIDAS'},
  {value:number(wins),label:'VITÓRIAS'},
  {value:Math.round(wins/card.featured.played*100)+'%',label:'APROVEITAMENTO'}];
}

export const leagueCardDate=(date:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(date));
