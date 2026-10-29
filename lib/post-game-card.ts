import type {Game} from './games';
export type CardFormat='compact'|'story';
export type CardLine={label:string;value:number;winner?:boolean;eliminated?:boolean};
export type CardAward={medal_id:string;level_index:number;player_name:string};
export type PostGameCard={title:string;game:Game;variant:string|null;starts_at:string;participants:number;winner_label:string;winner_names:string[];lines:CardLine[];confirmed:boolean;target?:number|null;league?:{name:string;emblem:unknown}|null;teams?:{label:string;names:string[];score:number;winner:boolean}[];awards?:CardAward[]};
export function cardText(data:PostGameCard){
 const winners=data.winner_names.length?data.winner_names.join(' & '):data.confirmed?'Sem destaque individual':'Resultado não disponível';
 return {winners,footer:data.confirmed?'Resultado conferido · encontro encerrado':'Registro do encontro · resultado indisponível',date:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(data.starts_at))};
}
export const cardDimensions=(format:CardFormat)=>({width:1080,height:format==='story'?1920:1350});
