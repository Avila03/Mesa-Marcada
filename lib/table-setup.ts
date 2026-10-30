import type {Event} from './mesa-types';
import type {Game} from './games';
import {defaultVariant} from './games';

/** Configuration only: no participants, financial records, dates or results are reused. */
export function rematchForm(event:Event,game:Game,allowedLeagues:readonly string[]){
 const league=event.league_id&&allowedLeagues.includes(event.league_id)?event.league_id:'';
 return {room_id:event.room_id,name:event.title,starts_at:'',location:event.location,
  min_entry_brl:String(event.min_entry_brl),max_participants:String(event.max_participants),
  league_id:league,visibility:league||event.league_id?'private' as const:event.visibility,
  game_variant:event.game_variant||defaultVariant(game)||'',score_target:String(event.score_target||0),
  chip_pricing_special:event.chip_pricing_special,chip_price_1_brl:String(event.chip_price_1_brl),
  chip_price_5_brl:String(event.chip_price_5_brl),chip_price_10_brl:String(event.chip_price_10_brl),
  chip_price_25_brl:String(event.chip_price_25_brl),chip_price_50_brl:String(event.chip_price_50_brl)};
}
function secureIndex(size:number){
 const range=0x100000000,limit=Math.floor(range/size)*size,buffer=new Uint32Array(1);let n:number;
 do{crypto.getRandomValues(buffer);n=buffer[0]}while(n>=limit);
 return n%size;
}
/** Preview the draw before start; the host can still adjust either side. */
export function drawBalancedTeams(players:readonly string[],randomIndex:(size:number)=>number=secureIndex){
 if(players.length<2||players.length%2||new Set(players).size!==players.length)throw new Error('Selecione um número par de participantes distintos.');
 const shuffled=[...players];for(let i=shuffled.length-1;i>0;i--){const j=randomIndex(i+1);if(!Number.isInteger(j)||j<0||j>i)throw new Error('Sorteio inválido.');[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
 return Object.fromEntries(shuffled.map((id,i)=>[id,i%2]));
}
