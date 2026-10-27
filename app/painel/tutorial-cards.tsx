import {cardName,rankName,SUIT_SIGNS,unoName,UNO_ACTIONS,type LearnCard,type UnoCard} from '@/lib/tutorial-games';

function SpanishSuit({suit}:{suit:LearnCard['suit']}){
 return <svg viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {suit==='swords'?<><path d="m11 29 13-25 1 9-10 18M7 25l13 6M12 30l-4 7"/><path d="m14 23 7-14" opacity=".5"/></>:
   suit==='bastos'?<><path d="m10 34 9-27 5-3 2 4-12 28z"/><path d="m16 13 5 3M12 24l5 2M12 34l3 1"/></>:
   suit==='cups'?<><path d="M7 7h18v8c0 7-18 7-18 0zM11 31h10M16 21v10M9 35h14M7 10H4v5c0 4 4 4 6 4M25 10h3v5c0 4-4 4-6 4"/></>:
   <><ellipse cx="16" cy="20" rx="11" ry="14"/><ellipse cx="16" cy="20" rx="7" ry="10"/><path d="M16 14v12M13 17h6M13 23h6"/></>}
 </svg>;
}
export function LearnPlayingCard({card,selected=false,muted=false,onClick,label}:{card:LearnCard;selected?:boolean;muted?:boolean;onClick?:()=>void;label?:string}){
 const spanish=['swords','bastos','cups','coins'].includes(card.suit);
 const className='learn-card '+(['hearts','diamonds','cups','coins'].includes(card.suit)?'red ':'')+(selected?'selected ':'')+(muted?'muted':'');
 const content=<><span className="learn-card-corner">{rankName(card.rank,spanish)}<small>{SUIT_SIGNS[card.suit]}</small></span><span className="learn-card-suit">{spanish?<SpanishSuit suit={card.suit}/>:SUIT_SIGNS[card.suit]}</span><span className="learn-card-foot">{rankName(card.rank,spanish)}</span></>;
 return onClick?<button type="button" className={className} aria-label={label||cardName(card)} aria-pressed={selected} onClick={onClick}>{content}</button>:<span className={className} role="img" aria-label={cardName(card)}>{content}</span>;
}
export function LearnHand({cards}:{cards:readonly LearnCard[]}){return <div className="learn-hand">{cards.map((card,i)=><LearnPlayingCard card={card} key={i}/>)}</div>}
export function LearnUnoCard({card,selected=false,onClick,label}:{card:UnoCard;selected?:boolean;onClick?:()=>void;label?:string}){
 const value=({reverse:'↻',skip:'⊘',wild:'✦'} as Record<string,string>)[card.value]||card.value;
 const content=<><small>{UNO_ACTIONS[card.value]||UNO_COLORS_LABEL[card.color]}</small><strong>{value}</strong><span>{card.color==='wild'?'4 cores':UNO_COLORS_LABEL[card.color]}</span></>;
 const className='learn-uno-card '+card.color+(selected?' selected':'');
 return onClick?<button type="button" className={className} aria-label={label||unoName(card)} aria-pressed={selected} onClick={onClick}>{content}</button>:<span className={className} role="img" aria-label={unoName(card)}>{content}</span>;
}
const UNO_COLORS_LABEL={blue:'Azul',red:'Vermelho',green:'Verde',yellow:'Amarelo',wild:'Curinga'};
