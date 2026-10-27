/** Pure rules used by the educational exercises. No saved scores or network writes. */
export type Suit='spades'|'clubs'|'hearts'|'diamonds'|'swords'|'bastos'|'cups'|'coins';
export type LearnCard={rank:number;suit:Suit};
export const SUIT_NAMES:Record<Suit,string>={spades:'espadas',clubs:'paus',hearts:'copas',diamonds:'ouros',swords:'espadas',bastos:'bastos',cups:'copas',coins:'ouros'};
export const SUIT_SIGNS:Record<Suit,string>={spades:'♠',clubs:'♣',hearts:'♥',diamonds:'♦',swords:'',bastos:'',cups:'',coins:''};
export const rankName=(rank:number,spanish=false)=>spanish?String(rank):({1:'A',11:'J',12:'Q',13:'K'}[rank]||String(rank));
export const cardName=(card:LearnCard)=>`${rankName(card.rank,['swords','bastos','cups','coins'].includes(card.suit))} de ${SUIT_NAMES[card.suit]}`;
export const TRUCO_ORDER=[4,5,6,7,12,11,13,1,2,3] as const;
const suitStrength:Partial<Record<Suit,number>>={diamonds:0,spades:1,hearts:2,clubs:3};
export function trucoStrength(card:LearnCard,variant:string,vira=12){
 if(variant==='gauderio'){
  const special=['1swords','1bastos','7swords','7coins'].indexOf(card.rank+card.suit);
  return special>=0?100-special:[4,5,6,7,10,11,12,1,2,3].indexOf(card.rank);
 }
 if(variant==='mineiro'){
  const special=['4clubs','7hearts','1spades','7diamonds'].indexOf(card.rank+card.suit);
  if(special>=0)return 100-special;
 }else if(card.rank===TRUCO_ORDER[(TRUCO_ORDER.indexOf(vira as typeof TRUCO_ORDER[number])+1)%TRUCO_ORDER.length])return 100+(suitStrength[card.suit]??0);
 return TRUCO_ORDER.indexOf(card.rank as typeof TRUCO_ORDER[number]);
}
export function compareTruco(a:LearnCard,b:LearnCard,variant:string,vira=12){return Math.sign(trucoStrength(a,variant,vira)-trucoStrength(b,variant,vira))}
export function envido(cards:readonly LearnCard[]){
 const value=(c:LearnCard)=>c.rank>=10?0:c.rank;
 let best=Math.max(...cards.map(value));
 for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++)if(cards[a].suit===cards[b].suit)best=Math.max(best,20+value(cards[a])+value(cards[b]));
 const flor=cards.length===3&&cards.every(c=>c.suit===cards[0].suit)?20+cards.reduce((n,c)=>n+value(c),0):null;
 return {points:best,flor};
}
export function canFinishCanastra(variant:string,clean:number,dirty:number,morto:boolean){return morto&&(clean>0||variant==='buraco_fechado'&&dirty>0)}
export function canastraScore({cards,clean,dirty,hands,morto,batida}:{cards:number;clean:number;dirty:number;hands:number;morto:boolean;batida:boolean}){return cards+200*clean+100*dirty-hands-(morto?0:100)+(batida?100:0)}
export const pontinhoValue=(card:LearnCard)=>card.rank===1?15:Math.min(card.rank,10);
export function pontinhoBalance(balance:number,cards:readonly LearnCard[],winner=false){const loss=winner?0:cards.reduce((n,c)=>n+pontinhoValue(c),0);return {loss,balance:balance-loss,eliminated:balance-loss<=0}}
export type UnoColor='blue'|'red'|'green'|'yellow'|'wild';
export type UnoCard={color:UnoColor;value:string};
export const UNO_COLORS:Record<UnoColor,string>={blue:'azul',red:'vermelho',green:'verde',yellow:'amarelo',wild:'curinga'};
export const UNO_ACTIONS:Record<string,string>={reverse:'Inverter',skip:'Pular','+2':'Comprar duas',wild:'Curinga','+4':'Comprar quatro'};
export const unoName=(c:UnoCard)=>c.color==='wild'?UNO_ACTIONS[c.value]:`${UNO_ACTIONS[c.value]||c.value} ${UNO_COLORS[c.color]}`;
export const unoValue=(c:UnoCard)=>c.color==='wild'?50:/^\d$/.test(c.value)?Number(c.value):20;
export function canPlayUno(card:UnoCard,top:UnoCard,hand:readonly UnoCard[]){
 if(card.value==='+4')return !hand.some(c=>c.color===top.color);
 return card.color==='wild'||card.color===top.color||card.value===top.value;
}
export function isMeld(cards:readonly LearnCard[]){
 if(cards.length!==3)return false;
 if(cards.every(c=>c.rank===cards[0].rank)&&new Set(cards.map(c=>c.suit)).size===3)return true;
 if(!cards.every(c=>c.suit===cards[0].suit))return false;
 const consecutive=(values:number[])=>{const a=values.sort((a,b)=>a-b);return a[1]===a[0]+1&&a[2]===a[1]+1};
 return consecutive(cards.map(c=>c.rank))||consecutive(cards.map(c=>c.rank===1?14:c.rank));
}
/** Exact partition of nine cards: each physical card can belong to one group only. */
export function pifeGroups(cards:readonly LearnCard[]):number[][]|null{
 if(cards.length!==9)return null;
 function partition(left:number[]):number[][]|null{
  if(!left.length)return [];
  for(let b=1;b<left.length-1;b++)for(let c=b+1;c<left.length;c++){
   const group=[left[0],left[b],left[c]];
   if(!isMeld(group.map(i=>cards[i])))continue;
   const rest=partition(left.filter(i=>!group.includes(i)));
   if(rest)return [group,...rest];
  }
  return null;
 }
 return partition(cards.map((_,i)=>i));
}
