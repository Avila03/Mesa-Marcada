import type {LearnCard} from './tutorial-games';

/** Educational calculations only. No requests, money or saved match results. */
export type PokerHand={category:number;tiebreak:number[];label:string;indices:number[]};
const POKER_LABELS=['Carta alta','Um par','Dois pares','Trinca','Sequência','Flush','Full house','Quadra','Straight flush'];
const frenchSuits=new Set(['spades','hearts','diamonds','clubs']);
function validatePoker(cards:readonly LearnCard[]){
 if(cards.length<5||cards.length>7)throw new Error('Escolha de cinco a sete cartas.');
 if(cards.some(c=>!Number.isInteger(c.rank)||c.rank<1||c.rank>13||!frenchSuits.has(c.suit)))throw new Error('Carta inválida para Texas Hold’em.');
 if(new Set(cards.map(c=>c.rank+c.suit)).size!==cards.length)throw new Error('Uma carta física não pode aparecer duas vezes.');
}
export function comparePoker(a:Pick<PokerHand,'category'|'tiebreak'>,b:Pick<PokerHand,'category'|'tiebreak'>){
 const left=[a.category,...a.tiebreak],right=[b.category,...b.tiebreak];
 for(let i=0;i<Math.max(left.length,right.length);i++){const d=(left[i]||0)-(right[i]||0);if(d)return Math.sign(d)}
 return 0;
}
function fiveCards(cards:readonly LearnCard[]):Omit<PokerHand,'indices'>{
 const ranks=cards.map(c=>c.rank===1?14:c.rank).sort((a,b)=>b-a);
 const counts=new Map<number,number>();for(const r of ranks)counts.set(r,(counts.get(r)||0)+1);
 const groups=[...counts].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
 const flush=cards.every(c=>c.suit===cards[0].suit);
 const straight=counts.size===5?(ranks[0]-ranks[4]===4?ranks[0]:ranks.join(',')==='14,5,4,3,2'?5:0):0;
 let category=0,tiebreak=ranks;
 if(flush&&straight){category=8;tiebreak=[straight]}
 else if(groups[0][1]===4){category=7;tiebreak=groups.map(g=>g[0])}
 else if(groups[0][1]===3&&groups[1][1]===2){category=6;tiebreak=groups.map(g=>g[0])}
 else if(flush){category=5}
 else if(straight){category=4;tiebreak=[straight]}
 else if(groups[0][1]===3){category=3;tiebreak=groups.map(g=>g[0])}
 else if(groups[0][1]===2&&groups[1][1]===2){category=2;tiebreak=groups.map(g=>g[0])}
 else if(groups[0][1]===2){category=1;tiebreak=groups.map(g=>g[0])}
 return {category,tiebreak,label:category===8&&straight===14?'Royal flush':POKER_LABELS[category]};
}
/** Evaluate every five-card subset: Hold’em permits zero, one or two hole cards. */
export function bestPokerHand(cards:readonly LearnCard[]):PokerHand{
 validatePoker(cards);let best:PokerHand|null=null;
 for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++){
  const indices=[a,b,c,d,e],candidate={...fiveCards(indices.map(i=>cards[i])),indices};
  if(!best||comparePoker(candidate,best)>0)best=candidate;
 }
 return best!;
}

export type BlackjackHand={total:number;soft:boolean;bust:boolean;natural:boolean;values:number[]};
export function blackjackTotal(ranks:readonly number[]):BlackjackHand{
 if(ranks.some(r=>!Number.isInteger(r)||r<1||r>13))throw new Error('Valor de carta inválido.');
 const values=ranks.map(r=>r===1?1:Math.min(r,10));let total=values.reduce((a,b)=>a+b,0);
 const ace=ranks.indexOf(1),soft=ace>=0&&total+10<=21;
 if(soft){total+=10;values[ace]=11}
 return {total,soft,bust:total>21,natural:ranks.length===2&&total===21,values};
}
export function playDealer(initial:readonly number[],draws:readonly number[],hitSoft17=false){
 const cards=[...initial];let drawn=0,hand=blackjackTotal(cards);
 const shouldBuy=()=>hand.total<17||hand.total===17&&hand.soft&&hitSoft17;
 while(shouldBuy()&&drawn<draws.length){cards.push(draws[drawn++]);hand=blackjackTotal(cards)}
 return {cards,drawn,hand,complete:!shouldBuy()};
}
export type BlackjackOutcome='win'|'lose'|'push';
export function blackjackOutcome(player:readonly number[],dealer:readonly number[]):BlackjackOutcome{
 const p=blackjackTotal(player),d=blackjackTotal(dealer);
 if(p.bust)return 'lose';
 if(p.natural&&d.natural)return 'push';
 if(p.natural)return 'win';
 if(d.natural)return 'lose';
 if(d.bust)return 'win';
 return p.total===d.total?'push':p.total>d.total?'win':'lose';
}

/** One exchange in Five Card Draw. Discarded cards cannot immediately return. */
export function drawFiveCards(hand:readonly LearnCard[],discard:readonly number[],replacement:readonly LearnCard[]){
 if(hand.length!==5)throw new Error('A mão precisa ter cinco cartas.');
 validatePoker(hand);
 if(new Set(discard).size!==discard.length||discard.some(i=>!Number.isInteger(i)||i<0||i>4))throw new Error('Seleção de troca inválida.');
 if(replacement.length<discard.length)throw new Error('Cartas de reposição insuficientes.');
 const incoming=replacement.slice(0,discard.length),all=[...hand,...incoming];
 if(all.some(c=>!Number.isInteger(c.rank)||c.rank<1||c.rank>13||!frenchSuits.has(c.suit))||new Set(all.map(c=>c.rank+c.suit)).size!==all.length)throw new Error('A reposição deve usar outras cartas do baralho.');
 const result=hand.slice();discard.slice().sort((a,b)=>a-b).forEach((index,i)=>{result[index]=incoming[i]});return result;
}
