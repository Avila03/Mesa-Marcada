import {ALL_GAMES,GAME_META} from './games';
import type {DetailTab,Game,View} from './mesa-types';
import type {EventFilter} from './event-navigation';
type GameTab='eventos'|'tutorial';
export type ProfileTab='resumo'|'conquistas'|'molduras'|'resultados'|'rachas'|'editar';
export type LeagueTab='eventos'|'ranking'|'membros';
export type RouteOptions={profileId:string;profileTab:ProfileTab;leagueTab:LeagueTab;creatorStep:number;eventFilter:EventFilter;gameVariant?:string};
export type ClubLocation={page:View;selectedId:string;detailTab:DetailTab;gameView:Game;gameTab:GameTab;leagueId:string}&RouteOptions;
const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const profileTabs:ProfileTab[]=['conquistas','molduras','resultados','rachas','editar'];
const eventPaths:Record<string,DetailTab>={'preparacao':'visao','partida':'ao-vivo','ao-vivo':'ao-vivo','despesas':'gastos','conferencia':'conferencia','resultado':'resumo-evento','resumo':'resumo-evento','enquetes':'enquetes','gerenciar':'gerenciar'};
export function readClubRoute(pathname:string,search=''):ClubLocation{
 const path=pathname.replace(/\/+$/,'')||'/',query=new URLSearchParams(search),parts=path.split('/').filter(Boolean);
 const result:ClubLocation={page:'inicio',selectedId:'',detailTab:'visao',gameView:'poker',gameTab:'eventos',leagueId:'',profileId:'',profileTab:'resumo',leagueTab:'eventos',creatorStep:[1,2,3].includes(Number(query.get('etapa')))?Number(query.get('etapa')):1,eventFilter:'abertos'};
 if(path==='/painel'&&isUuid(query.get('evento')||'')){result.page='detalhe';result.selectedId=query.get('evento')!;return result}
 if(path==='/eventos/novo')result.page='criar-evento';
 else if(parts[0]==='eventos'&&parts[1]&&isUuid(parts[1])){
  result.page=parts[2]==='editar'?'editar-evento':'detalhe';result.selectedId=parts[1];result.detailTab=eventPaths[parts[2]]||'visao';
 }else if(path==='/eventos'){
  result.page='eventos';const filter=query.get('filtro');if(['abertos','ao-vivo','encerrados','todos'].includes(filter||''))result.eventFilter=filter as EventFilter;
 }else if(parts[0]==='ligas'&&parts[1]&&isUuid(parts[1])){
  result.page=parts[2]==='gerenciar'?'liga-admin':'liga';result.leagueId=parts[1];
  if(parts[2]==='ranking'||parts[2]==='membros')result.leagueTab=parts[2];
 }else if(path==='/ligas'||path==='/ranking')result.page='ligas';
 else if(parts[0]==='mesas'&&ALL_GAMES.includes(parts[1] as Game)){
  result.page='mesa';result.gameView=parts[1] as Game;result.gameTab=query.get('aba')==='tutorial'?'tutorial':'eventos';const variant=query.get('variante')||'';result.gameVariant=GAME_META[result.gameView].variants.includes(variant)?variant:'';
 }else if(path==='/mesas')result.page='mesas';
 else if(parts[0]==='perfil'||parts[0]==='jogadores'&&isUuid(parts[1]||'')){
  result.page='perfil';result.profileId=parts[0]==='jogadores'?parts[1]:'';
  const tab=parts[parts[0]==='jogadores'?2:1];if(profileTabs.includes(tab as ProfileTab))result.profileTab=tab as ProfileTab;
  if(result.profileId&&(result.profileTab==='editar'||result.profileTab==='rachas'))result.profileTab='resumo';
 }else if(path==='/administracao')result.page='admin';
 return result;
}
export function clubHref(page:View,selectedId:string,tab:DetailTab,game:Game,gameTab:GameTab,leagueId='',options:Partial<RouteOptions>={}){
 const step=options.creatorStep&&options.creatorStep>1?'?etapa='+options.creatorStep:'';
 if(page==='criar-evento')return '/eventos/novo'+step;
 if(page==='editar-evento'&&isUuid(selectedId))return '/eventos/'+selectedId+'/editar'+step;
 if(page==='detalhe'&&isUuid(selectedId)){
  const suffix:Partial<Record<DetailTab,string>>={visao:'preparacao',assentos:'preparacao','ao-vivo':'partida',fichas:'partida',gastos:'despesas',conferencia:'conferencia','resumo-evento':'resultado',enquetes:'enquetes',gerenciar:'gerenciar'};
  return '/eventos/'+selectedId+(suffix[tab]?'/'+suffix[tab]:'');
 }
 if((page==='liga'||page==='liga-admin')&&isUuid(leagueId))return '/ligas/'+leagueId+(page==='liga-admin'?'/gerenciar':options.leagueTab&&options.leagueTab!=='eventos'?'/'+options.leagueTab:'');
 if(page==='mesa')return '/mesas/'+game+(gameTab==='tutorial'?'?aba=tutorial'+(options.gameVariant&&GAME_META[game].variants.includes(options.gameVariant)?'&variante='+encodeURIComponent(options.gameVariant):''):'');
 if(page==='perfil'){
  const base=options.profileId&&isUuid(options.profileId)?'/jogadores/'+options.profileId:'/perfil';
  return base+(options.profileTab&&options.profileTab!=='resumo'?'/'+options.profileTab:'');
 }
 const urls:Record<string,string>={inicio:'/painel',eventos:'/eventos',mesas:'/mesas',admin:'/administracao',ligas:'/ligas'};
 return (urls[page]||'/painel')+(page==='eventos'&&options.eventFilter&&options.eventFilter!=='abertos'?'?filtro='+options.eventFilter:'');
}
export function validPostLoginRoute(value:string){
 if(!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/painel';
 const [path,search='']=value.split('?');
 if(/^\/(?:convite\/[0-9a-f]{64}|ligas\/convite\/[0-9a-f]{64})$/i.test(path))return path;
 if(!/^(?:\/painel|\/eventos(?:\/novo|\/[0-9a-f-]{36}(?:\/(?:preparacao|partida|ao-vivo|despesas|enquetes|conferencia|resultado|resumo|gerenciar|editar))?)?|\/ligas(?:\/[0-9a-f-]{36}(?:\/(?:gerenciar|ranking|membros))?)?|\/perfil(?:\/(?:conquistas|molduras|resultados|rachas|editar))?|\/jogadores\/[0-9a-f-]{36}(?:\/(?:conquistas|molduras|resultados))?|\/mesas(?:\/(?:poker|blackjack|truco|canastra|pontinho|uno|pife))?|\/ranking|\/administracao)\/?$/i.test(path))return '/painel';
 const state=readClubRoute(path,'?'+search);
 return clubHref(state.page,state.selectedId,state.detailTab,state.gameView,state.gameTab,state.leagueId,state);
}
