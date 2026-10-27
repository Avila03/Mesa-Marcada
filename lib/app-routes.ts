import {ALL_GAMES} from "./games";
import type {DetailTab,Game,View} from "./mesa-types";
type GameTab="eventos"|"tutorial";
export type ClubLocation={page:View;selectedId:string;detailTab:DetailTab;gameView:Game;gameTab:GameTab;leagueId:string};
const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function readClubRoute(pathname:string,search=""):ClubLocation{
 const path=pathname.replace(/\/+$/,"")||"/";
 const query=new URLSearchParams(search);
 const result:ClubLocation={page:"inicio",selectedId:"",detailTab:"visao",gameView:"poker",gameTab:"eventos",leagueId:""};
 const parts=path.split("/").filter(Boolean);
 // Convites antigos continuam funcionando sem depender da query ficar
 // intacta durante a sincronização de rotas no navegador.
 if(path==="/painel"&&isUuid(query.get("evento")||"")){
   result.page="detalhe";result.selectedId=query.get("evento")!;
   return result;
 }
 if(parts[0]==="eventos"&&parts[1]&&isUuid(parts[1])){
   result.page="detalhe";result.selectedId=parts[1];
   if(parts[2]==="ao-vivo")result.detailTab="ao-vivo";
   if(parts[2]==="resumo")result.detailTab="resumo-evento";
 }else if(path==="/eventos")result.page="eventos";
 else if(parts[0]==="ligas"&&parts[1]&&isUuid(parts[1])){
   result.page=parts[2]==="gerenciar"?"liga-admin":"liga";result.leagueId=parts[1];
 }else if(path==="/ligas")result.page="ligas";
 else if(parts[0]==="mesas"&&ALL_GAMES.includes(parts[1] as Game)){
   result.page="mesa";result.gameView=parts[1] as Game;
   result.gameTab=query.get("aba")==="tutorial"?"tutorial":"eventos";
 }else if(path==="/mesas")result.page="mesas";
 else if(path==="/ranking")result.page="ranking";
 else if(path==="/perfil")result.page="perfil";
 else if(path==="/administracao")result.page="admin";
 return result;
}
export function clubHref(page:View,selectedId:string,tab:DetailTab,game:Game,gameTab:GameTab,leagueId=""){
 if(page==="detalhe"&&isUuid(selectedId))return "/eventos/"+selectedId+
   (tab==="ao-vivo"?"/ao-vivo":tab==="resumo-evento"?"/resumo":"");
 if((page==="liga"||page==="liga-admin")&&isUuid(leagueId))return "/ligas/"+leagueId+
    (page==="liga-admin"?"/gerenciar":"");
 if(page==="mesa")return "/mesas/"+game+(gameTab==="tutorial"?"?aba=tutorial":"");
 const urls:Record<string,string>={inicio:"/painel",eventos:"/eventos",mesas:"/mesas",
 ranking:"/ranking",perfil:"/perfil",admin:"/administracao",ligas:"/ligas"};
 return urls[page]||"/painel";
}
export function validPostLoginRoute(value:string){
 if(value.startsWith("/")&&!value.startsWith("//")&&
 /^(?:\/ligas(?:\/[0-9a-f-]{36}(?:\/gerenciar)?|\/convite\/[0-9a-f]{64})?|\/convite\/[0-9a-f]{64}|\/painel(?:\?evento=[0-9a-f-]{36})?|\/eventos(?:\/[0-9a-f-]{36}(?:\/(?:ao-vivo|resumo))?)?|\/mesas(?:\/(?:poker|blackjack|truco|canastra|pontinho|uno|pife)(?:\?aba=tutorial)?)?|\/ranking|\/perfil|\/administracao)$/i.test(value))return value;
 return "/painel";
}
