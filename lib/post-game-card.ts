import type {Game} from './games';
export type PostGameCard={title:string;game:Game;variant:string|null;starts_at:string;participants:number;winner_label:string;winner_names:string[];lines:{label:string;value:number}[];confirmed:boolean};

/** Only the server's minimal, authorized result snapshot is accepted here. */
export function cardText(data:PostGameCard){
 const winners=data.winner_names.length?data.winner_names.join(' & '):data.confirmed?'Sem destaque individual':'Resultado não disponível';
 return {winners,footer:data.confirmed?'Resultado conferido · encontro encerrado':'Registro do encontro · resultado indisponível',date:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(data.starts_at))};
}
