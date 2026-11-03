import {GAME_META,TRUCO_STAKES,defaultTarget,isChipGame,type Game} from './games';
import type {Event,Room} from './mesa-types';
export type ChipPriceKey='chip_price_1_brl'|'chip_price_5_brl'|'chip_price_10_brl'|'chip_price_25_brl'|'chip_price_50_brl';
export type EventDraft={game_variant:string;score_target:string;room_id:string;name:string;starts_at:string;location:string;min_entry_brl:string;max_participants:string;league_id:string;visibility:'public'|'private';chip_pricing_special:boolean}&Record<ChipPriceKey,string>;
export const EMPTY_EVENT:EventDraft={game_variant:'',score_target:'0',room_id:'',name:'',starts_at:'',location:'',min_entry_brl:'0',max_participants:'8',league_id:'',visibility:'public',chip_pricing_special:false,chip_price_1_brl:'1.00',chip_price_5_brl:'5.00',chip_price_10_brl:'0.10',chip_price_25_brl:'0.25',chip_price_50_brl:'0.50'};
export const chipPriceFields:{value:number;key:ChipPriceKey}[]=[1,5,10,25,50].map(value=>({value,key:('chip_price_'+value+'_brl') as ChipPriceKey}));
export const eventDraftKey=(userId:string,eventId='new')=>'mm-event-draft-v1:'+userId+':'+eventId;
export function restoreEventDraft(raw:string|null):{form:EventDraft;step:number}|null{
 try{
  const value=JSON.parse(raw||'null');if(value?.version!==1||!value.form||typeof value.form!=='object')return null;
  const form={...EMPTY_EVENT};for(const key of Object.keys(form) as (keyof EventDraft)[]){
   if(typeof value.form[key]!==typeof form[key])return null;
   Object.assign(form,{[key]:value.form[key]});
  }
  if(!['public','private'].includes(form.visibility))return null;
  return {form,step:[1,2,3].includes(value.step)?value.step:1};
 }catch{return null}
}
export function eventDraftFromEvent(event:Event,game:Game='poker'):EventDraft{
 const d=new Date(event.starts_at),pad=(n:number)=>String(n).padStart(2,'0');
 const starts=[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-')+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
 return {...EMPTY_EVENT,room_id:event.room_id,game_variant:event.game_variant||(game==='poker'?'texas_holdem':''),score_target:String(event.score_target||0),name:event.title,starts_at:starts,location:event.location,min_entry_brl:String(event.min_entry_brl),max_participants:String(event.max_participants),league_id:event.league_id||'',visibility:event.visibility,chip_pricing_special:event.chip_pricing_special,...Object.fromEntries(chipPriceFields.map(({key})=>[key,String(event[key])]))};
}
export function eventCapacity(game:Game,variant:string){return {min:game==='pontinho'?3:2,max:game==='blackjack'?6:game==='canastra'?4:game==='truco'?(variant==='gauderio'?6:4):game==='pontinho'||game==='pife'?8:10,step:game==='truco'||game==='canastra'?2:1}}
export type DraftIssue={step:1|2;message:string};
export function validateEventDraft(form:EventDraft,rooms:readonly Room[],through=2):DraftIssue|null{
 const room=rooms.find(r=>r.id===form.room_id);if(!room)return {step:1,message:'Escolha o jogo desta partida.'};
 const game=room.game,meta=GAME_META[game];
 if(meta.variants.length&&!meta.variants.includes(form.game_variant))return {step:1,message:'Escolha uma variante válida para este jogo.'};
 if(!isChipGame(game)){
  const target=Number(form.score_target),min=game==='pontinho'?50:game==='canastra'||game==='uno'?100:1,max=game==='pontinho'?500:game==='canastra'?10000:game==='uno'?2000:100;
  if(!Number.isInteger(target)||target<min||target>max||game==='truco'&&target!==defaultTarget(game,form.game_variant)||game==='truco'&&!TRUCO_STAKES[form.game_variant])return {step:1,message:'Confira a meta de pontos desta variante.'};
 }
 const capacity=eventCapacity(game,form.game_variant),seats=Number(form.max_participants);
 if(!Number.isInteger(seats)||seats<capacity.min||seats>capacity.max||capacity.step===2&&seats%2!==0)return {step:1,message:capacity.step===2?'Escolha uma quantidade par de jogadores, dentro do limite da modalidade.':`A modalidade admite de ${capacity.min} a ${capacity.max} jogadores.`};
 if(isChipGame(game)){
  const entry=Number(form.min_entry_brl);if(!Number.isFinite(entry)||entry<0||Math.abs(entry*100-Math.round(entry*100))>.00001)return {step:1,message:'Informe uma entrada mínima válida em reais.'};
  if(form.chip_pricing_special&&chipPriceFields.some(({key})=>!Number.isFinite(Number(form[key]))||Number(form[key])<.01||Number(form[key])>1000||Math.abs(Number(form[key])*100-Math.round(Number(form[key])*100))>.00001))return {step:1,message:'Confira os preços personalizados das fichas, com até duas casas decimais.'};
 }
 if(through===1)return null;
 if(form.name.trim().length<2||form.name.trim().length>100)return {step:2,message:'Dê um nome ao evento, com 2 a 100 caracteres.'};
 if(!form.starts_at||!Number.isFinite(Date.parse(form.starts_at)))return {step:2,message:'Informe a data e o horário do encontro.'};
 if(form.location.trim().length<2||form.location.trim().length>200)return {step:2,message:'Informe o local do encontro, com 2 a 200 caracteres.'};
 return null;
}
