"use client";

import {useState} from 'react';
import {GAME_IDENTITY} from '@/lib/game-identity';
import {rankName,cardName,type LearnCard} from '@/lib/tutorial-games';
import {bestPokerHand,comparePoker,blackjackTotal,playDealer,blackjackOutcome} from '@/lib/classic-tutorial-games';
import {POKER_EXAMPLES,POKER_DUELS,POKER_RANKS,BLACKJACK_ROUNDS} from '@/lib/classic-tutorial-examples';
import {TutorialShell,Exercise,Feedback,Reset,type TutorialSection} from './learning-ui';
import {LearnPlayingCard,LearnHand} from './tutorial-cards';
import './classic-game-tutorial.css';

type ClassicGame='poker'|'blackjack';
const ranks=(cards:readonly LearnCard[])=>cards.map(c=>c.rank);
const c=(rank:number,suit:LearnCard['suit']):LearnCard=>({rank,suit});
function CardBack({label}:{label:string}){return <span className="learn-card-back learn-hidden-card" role="img" aria-label={label}>MM</span>}

export default function ClassicGameTutorial({game}:{game:ClassicGame}){
 const [section,setSection]=useState<TutorialSection>('practice');
 return <TutorialShell game={game} section={section} onSectionChange={setSection} edition={game==='poker'?'Texas Hold’em · baralho de 52 cartas':'Blackjack · exemplos com regras indicadas'} intro={game==='poker'?'Abra as cartas comunitárias, monte a melhor mão e descubra o que realmente decide um showdown.':'Veja o Ás mudar de valor, experimente comprar ou parar e acompanhe a vez do dealer.'}>
  <div className="learn-content">{section==='practice'?<><div className="learn-start"><span className="learn-live-dot" aria-hidden="true"/><p>{game==='poker'?'Duas cartas são suas. Cinco são da mesa. A melhor combinação usa exatamente cinco.':'Você joga contra o dealer. Os baralhos dos exemplos são preparados para ensinar as regras.'}</p></div>{game==='poker'?<PokerPractice/>:<BlackjackPractice/>}</>:section==='basics'?<ClassicBasics game={game}/>:<ClassicRules game={game}/>}</div>
 </TutorialShell>;
}

function PokerPractice(){return <div className="learn-practice-grid"><PokerStreets/><PokerFive/><PokerShowdown/></div>}
const STREETS=['Pré-flop','Flop','Turn','River'];
const OPEN_CARDS=[0,3,4,5];
function PokerStreets(){
 const [stage,setStage]=useState(0),[example,setExample]=useState(0);const deal=POKER_EXAMPLES[example];
 const shown=[...deal.hole,...deal.board.slice(0,OPEN_CARDS[stage])],hand=shown.length>=5?bestPokerHand(shown):null;
 return <Exercise number="01" title="Abra a mesa, carta por carta" hint="Avance as etapas e veja como as cartas comunitárias mudam o seu jogo.">
  <div className="learn-streets" aria-label="Etapas da mão">{STREETS.map((name,i)=><button type="button" key={name} aria-pressed={stage===i} onClick={()=>setStage(i)}><span>{i+1}</span>{name}</button>)}</div>
  <span className="learn-table-label">SUAS DUAS CARTAS</span><LearnHand cards={deal.hole}/>
  <span className="learn-table-label">CARTAS COMUNITÁRIAS</span><div className="learn-poker-board">{deal.board.map((card,i)=>i<OPEN_CARDS[stage]?<LearnPlayingCard key={i} card={card}/>:<CardBack key={i} label={'Carta comunitária '+(i+1)+' ainda fechada'}/>)}</div>
  <div className="learn-made-hand" aria-live="polite"><small>{STREETS[stage]} · {OPEN_CARDS[stage]} cartas abertas</small><strong>{hand?.label||'O jogo ainda vai abrir'}</strong><p>{deal.notes[stage]}</p></div>
  <div className="learn-inline-actions"><button type="button" className="btn gold" disabled={stage===3} onClick={()=>setStage(n=>n+1)}>{stage<3?'Abrir '+STREETS[stage+1]:'Mesa completa'}</button><Reset label="Outra distribuição" onClick={()=>{setExample(n=>(n+1)%POKER_EXAMPLES.length);setStage(0)}}/></div>
 </Exercise>;
}
function PokerFive(){
 const [example,setExample]=useState(0),[selected,setSelected]=useState<number[]>([]),[checked,setChecked]=useState(false),[hint,setHint]=useState('');
 const deal=POKER_EXAMPLES[example],cards=[...deal.hole,...deal.board],best=bestPokerHand(cards);
 const chosen=selected.length===5?bestPokerHand(selected.map(i=>cards[i])):null;
 const optimal=chosen?comparePoker(chosen,best)===0:false;
 function choose(index:number){
  if(!selected.includes(index)&&selected.length===5){setHint('Retire uma das cinco cartas antes de escolher outra.');return}
  setSelected(old=>old.includes(index)?old.filter(i=>i!==index):[...old,index]);setChecked(false);setHint('');
 }
 return <Exercise number="02" title="Escolha as cinco melhores" hint="Toque em cinco cartas. Você pode usar zero, uma ou duas cartas privadas.">
  <p className="learn-table-note">Exemplo: {deal.title}.</p>
  <span className="learn-table-label">SUAS CARTAS</span><div className="learn-hand">{deal.hole.map((card,i)=><LearnPlayingCard key={i} card={card} selected={selected.includes(i)} onClick={()=>choose(i)} label={'Selecionar '+cardName(card)}/>)}</div>
  <span className="learn-table-label">MESA</span><div className="learn-poker-board">{deal.board.map((card,i)=><LearnPlayingCard key={i} card={card} selected={selected.includes(i+2)} onClick={()=>choose(i+2)} label={'Selecionar '+cardName(card)}/>)}</div>
  <div className="learn-selection-count" role="status">{selected.length} de 5 cartas selecionadas{hint&&<span>{hint}</span>}</div>
  <button type="button" className="btn gold" disabled={selected.length!==5} onClick={()=>setChecked(true)}>Conferir minha combinação</button>
  {checked&&chosen&&<Feedback good={optimal}><strong>{optimal?'Essa é uma das melhores seleções!':'Dá para formar uma mão mais forte.'}</strong><p>Você montou {chosen.label.toLowerCase()}. {optimal?`Usou ${selected.filter(i=>i<2).length} carta(s) privada(s).`:`A melhor combinação disponível é ${best.label.toLowerCase()}.`}</p></Feedback>}
  <div className="learn-inline-actions"><button type="button" className="learn-reset" onClick={()=>{setSelected(best.indices);setChecked(true);setHint('')}}>Mostrar as cinco mais fortes</button><Reset label="Outro encaixe" onClick={()=>{setExample(n=>(n+1)%POKER_EXAMPLES.length);setSelected([]);setChecked(false);setHint('')}}/></div>
 </Exercise>;
}
function PokerShowdown(){
 const [example,setExample]=useState(0),[answer,setAnswer]=useState<number|null>(null);const deal=POKER_DUELS[example];
 const a=bestPokerHand([...deal.a,...deal.board]),b=bestPokerHand([...deal.b,...deal.board]),comparison=comparePoker(a,b),winner=comparison>0?0:comparison<0?1:2;
 return <Exercise number="03" title="Quem leva o showdown?" hint="Compare as melhores cinco cartas. Uma carta na mão, sozinha, não decide o resultado.">
  <p className="learn-table-note">{deal.title}</p><span className="learn-table-label">MESA COMPARTILHADA</span><div className="learn-poker-board"><LearnHand cards={deal.board}/></div>
  <div className="learn-showdown-sides">{[deal.a,deal.b].map((hand,i)=><div key={i}><span>Jogador {i===0?'Azul':'Vermelho'}</span><LearnHand cards={hand}/><button type="button" className="learn-choice" aria-pressed={answer===i} onClick={()=>setAnswer(i)}>Vence o {i===0?'Azul':'Vermelho'}</button></div>)}</div>
  <button type="button" className="learn-choice" aria-pressed={answer===2} onClick={()=>setAnswer(2)}>As melhores mãos empatam</button>
  <Feedback good={answer===null?null:answer===winner}>{answer===null?'Compare categoria, valores e kickers. Naipes não desempatam.':<><strong>{winner===2?'Empate: o pote correspondente é dividido.':`O jogador ${winner===0?'Azul':'Vermelho'} tem a melhor mão.`}</strong><p>{deal.why}</p><small>Azul: {a.label} · Vermelho: {b.label}</small></>}</Feedback>
  <Reset label="Outro confronto" onClick={()=>{setExample(n=>(n+1)%POKER_DUELS.length);setAnswer(null)}}/>
 </Exercise>;
}

function BlackjackPractice(){return <div className="learn-practice-grid"><BlackjackCalculator/><BlackjackRound/></div>}
function BlackjackCalculator(){
 const [cards,setCards]=useState([1,6]);const total=blackjackTotal(cards);
 const suits=['spades','diamonds','clubs','hearts'] as const;
 return <Exercise number="01" title="O Ás vale quanto agora?" hint="Escolha as cartas, acrescente outra e veja o total se ajustar automaticamente.">
  <div className="learn-bj-editor">{cards.map((rank,i)=><label key={i}><LearnPlayingCard card={c(rank,suits[i%4])}/><span>Carta {i+1}</span><select aria-label={'Valor da carta '+(i+1)} value={rank} onChange={e=>setCards(old=>old.map((r,k)=>k===i?Number(e.target.value):r))}>{Array.from({length:13},(_,i)=>i+1).map(r=><option key={r} value={r}>{rankName(r)}</option>)}</select><small>Vale {total.values[i]}</small></label>)}</div>
  <div className={'learn-bj-total '+(total.bust?'bust':'')} aria-live="polite"><strong>{total.total}</strong><div><b>{total.bust?'Estourou':total.natural?'Blackjack natural':total.soft?'Mão suave':'Mão dura'}</b><p>{total.bust?'O total passou de 21.':total.natural?'Ás + carta de valor 10 nas duas primeiras.':total.soft?'Um Ás está valendo 11; os demais, se houver, valem 1.':'Nenhum Ás está valendo 11 nesta soma.'}</p></div></div>
  <div className="learn-inline-actions"><button type="button" className="btn" disabled={cards.length>=12} onClick={()=>setCards(old=>[...old,2])}>Adicionar carta</button><button type="button" className="btn" disabled={cards.length<=2} onClick={()=>setCards(old=>old.slice(0,-1))}>Retirar última</button></div>
  <div className="learn-presets" aria-label="Exemplos de mãos"><button type="button" onClick={()=>setCards([1,13])}>Natural · A + K</button><button type="button" onClick={()=>setCards([1,6,9])}>Ás se ajusta</button><button type="button" onClick={()=>setCards([1,1,8])}>Dois ases</button></div>
  <Reset onClick={()=>setCards([1,6])}/>
 </Exercise>;
}
function BlackjackRound(){
 const [example,setExample]=useState(0),[draws,setDraws]=useState(0),[stopped,setStopped]=useState(false),[hitSoft17,setHitSoft17]=useState(false);
 const deal=BLACKJACK_ROUNDS[example],cards=[...deal.player,...deal.playerDraws.slice(0,draws)],player=blackjackTotal(ranks(cards));
 const dealerNatural=blackjackTotal(ranks(deal.dealer)).natural,finished=stopped||player.total>=21||dealerNatural;
 const dealer=finished&&!player.bust?playDealer(ranks(deal.dealer),ranks(deal.dealerDraws),hitSoft17):null;
 const dealerCards=dealer?[...deal.dealer,...deal.dealerDraws.slice(0,dealer.drawn)]:deal.dealer;
 const result=finished?blackjackOutcome(ranks(cards),dealer?.cards||ranks(deal.dealer)):null;
 const next=()=>{setExample(n=>(n+1)%BLACKJACK_ROUNDS.length);setDraws(0);setStopped(false)};
 return <Exercise number="02" title="Sua vez: comprar ou parar?" hint="Uma rodada guiada, com cartas preparadas. Experimente as ações e acompanhe o resultado.">
  <p className="learn-table-note">{example+1}/{BLACKJACK_ROUNDS.length} · {deal.title}</p>
  <label className="learn-dealer-policy">Regra do dealer neste exercício<select value={hitSoft17?'hit':'stand'} onChange={e=>setHitSoft17(e.target.value==='hit')}><option value="stand">Para no 17 suave · S17</option><option value="hit">Compra no 17 suave · H17</option></select></label>
  <div className="learn-bj-table"><div><span className="learn-table-label">DEALER {dealer?'· '+dealer.hand.total:''}</span><div className="learn-hand">{dealer?dealerCards.map((card,i)=><LearnPlayingCard key={i} card={card}/>):<><LearnPlayingCard card={deal.dealer[0]}/><CardBack label="Segunda carta do dealer oculta"/></>}</div></div><div><span className="learn-table-label">SUA MÃO · {player.total}{player.soft?' SUAVE':''}</span><LearnHand cards={cards}/></div></div>
  <div className="learn-inline-actions"><button type="button" className="btn gold" disabled={finished||draws>=deal.playerDraws.length} onClick={()=>setDraws(n=>n+1)}>Comprar uma carta</button><button type="button" className="btn" disabled={finished} onClick={()=>setStopped(true)}>Parar com {player.total}</button></div>
  <Feedback good={result===null?null:result==='win'?true:result==='lose'?false:null}>{!finished?<><strong>Você decide como seguir.</strong><p>Comprar acrescenta uma carta. Parar mantém o total e passa a vez ao dealer. As cartas deste exemplo não preveem uma partida real.</p></>:<><strong>{result==='win'?'Sua mão venceu.':result==='push'?'Empate · push.':'Sua mão perdeu.'}</strong><p>{player.bust?'Você passou de 21. Sua mão já perdeu, mesmo se o dealer viesse a estourar depois.':player.natural&&dealer?.hand.natural?'Os dois têm blackjack natural: empate.':player.natural?'Seu natural é um 21 nas duas cartas iniciais.':dealer?.hand.natural?'O natural do dealer supera um 21 comum.':dealer?.hand.bust?`O dealer comprou e chegou a ${dealer.hand.total}. Sua mão continuou válida.`:`Você: ${player.total}. Dealer: ${dealer?.hand.total}. ${result==='push'?'Totais iguais empatam.':'Vence o maior total até 21.'}`}</p></>}</Feedback>
  {dealer&&dealer.drawn>0&&<p className="learn-table-note">O dealer revelou suas duas cartas e comprou {dealer.drawn} carta(s), seguindo a regra {hitSoft17?'H17':'S17'}.</p>}
  <div className="learn-inline-actions"><Reset label="Repetir esta rodada" onClick={()=>{setDraws(0);setStopped(false)}}/><Reset label="Outra situação" onClick={next}/></div>
 </Exercise>;
}

const POKER_ACTIONS=[
 {name:'Check · passar',text:'Seguir sem colocar novas fichas, quando não há aposta pendente para igualar.',example:'Ninguém apostou nesta rodada: você pode passar a ação.'},
 {name:'Bet · apostar',text:'Abrir uma aposta quando ninguém apostou na rodada.',example:'Depois do flop, você inicia a ação com uma aposta.'},
 {name:'Call · pagar',text:'Igualar a aposta vigente para continuar na mão.',example:'Faltam 10 fichas didáticas para igualar: o call completa essa diferença.'},
 {name:'Raise · aumentar',text:'Elevar a aposta vigente, respeitando o mínimo e a estrutura da mesa.',example:'Além de igualar, você propõe uma aposta maior aos demais.'},
 {name:'Fold · desistir',text:'Abandonar a disputa desta mão. As cartas deixam de concorrer ao pote.',example:'Você desiste diante de uma aposta e espera a próxima mão.'},
 {name:'All-in',text:'Colocar todas as fichas disponíveis. Pode criar potes paralelos.',example:'Cada jogador só disputa a parte do pote coberta pela sua contribuição.'}
];
const BLACKJACK_ACTIONS=[
 {name:'Hit · comprar',text:'Receber mais uma carta. O Ás se ajusta quando possível.',example:'A + 6 = 17 suave. Ao comprar 9, o Ás passa a 1 e o total vira 16.'},
 {name:'Stand · parar',text:'Encerrar suas compras e manter a mão atual.',example:'Com 18, você para e aguarda o dealer seguir a regra combinada.'},
 {name:'Double · dobrar',text:'Quando permitido, dobrar a aposta, receber uma única carta e parar.',example:'É uma ação específica da regra da mesa; o exercício de rodada usa apenas comprar e parar.'},
 {name:'Split · dividir',text:'Quando permitido, separar duas cartas de mesmo valor em duas mãos.',example:'8 + 8 pode virar duas mãos, cada uma começando com um 8. Restrições para ases variam.'},
 {name:'Surrender · desistir',text:'Opcional em algumas regras: encerrar a mão com perda parcial.',example:'A disponibilidade e o momento de desistir precisam ser combinados antes.'},
 {name:'Insurance · seguro',text:'Aposta lateral, normalmente oferecida se o dealer mostra Ás.',example:'O resultado do seguro é separado do resultado da sua mão principal.'}
];
function Actions({game}:{game:ClassicGame}){
 const [selected,setSelected]=useState(0),actions=game==='poker'?POKER_ACTIONS:BLACKJACK_ACTIONS,action=actions[selected];
 return <section className="learn-exercise"><span className="learn-eyebrow">OS COMANDOS DA MESA</span><h3>Toque para entender a ação</h3><div className="learn-action-picker">{actions.map((a,i)=><button type="button" key={a.name} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{a.name}</button>)}</div><div className="learn-action-detail" aria-live="polite"><strong>{action.name}</strong><p>{action.text}</p><small>{action.example}</small></div></section>;
}
function PokerRanking(){
 const [selected,setSelected]=useState(0),hand=POKER_RANKS[selected];
 return <section className="learn-exercise"><span className="learn-eyebrow">DA MAIS FORTE À MAIS FRACA</span><h3>Explore o ranking das mãos</h3><div className="learn-ranking-picker">{POKER_RANKS.map((r,i)=><button type="button" key={r.name} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span>{String(i+1).padStart(2,'0')}</span>{r.name}</button>)}</div><div className="learn-ranking-example" aria-live="polite"><strong>{hand.name}</strong><LearnHand cards={hand.cards}/><p>{hand.desc}</p></div><p className="learn-table-note">Royal flush é o straight flush mais alto. Naipes não têm hierarquia no Texas Hold’em.</p></section>;
}
function ClassicBasics({game}:{game:ClassicGame}){
 const poker=game==='poker';const steps=poker?[
  {title:'Button, blinds e duas cartas',text:'O botão identifica a posição do distribuidor. Small blind e big blind são colocados antes das duas cartas privadas. Combinem os valores e a estrutura.',cards:POKER_EXAMPLES[0].hole},
  {title:'Pré-flop: as primeiras decisões',text:'Antes da mesa abrir, cada jogador decide como responder aos blinds e à ação anterior. A ordem de fala começa à esquerda do big blind.',cards:undefined},
  {title:'Flop: três cartas comunitárias',text:'As três cartas ficam disponíveis para todos que continuam na mão. Outra rodada de decisões acontece.',cards:POKER_EXAMPLES[0].board.slice(0,3)},
  {title:'Turn e river: mais uma por vez',text:'A quarta carta abre no turn e a quinta no river. Cada abertura é seguida por decisões. Um jogo incompleto ainda não vale como sequência ou flush.',cards:POKER_EXAMPLES[0].board.slice(3)},
  {title:'Showdown: compare as melhores cinco',text:'Se mais de um jogador continuar, compare a melhor mão de cinco de cada um. Se todos os adversários desistirem antes, a mão termina sem showdown.',cards:POKER_RANKS[0].cards}
 ]:[
  {title:'Duas cartas para começar',text:'O jogador recebe duas cartas e enfrenta o dealer. Neste formato, uma carta do dealer aparece e outra fica fechada.',cards:[c(1,'spades'),c(6,'diamonds')]},
  {title:'Conte sem passar de 21',text:'Números valem a face; J, Q e K valem 10. O Ás vale 11 quando isso não estoura a mão; caso contrário, vale 1.',cards:[c(1,'spades'),c(6,'diamonds'),c(9,'clubs')]},
  {title:'Comprar ou parar',text:'Comprar acrescenta uma carta; parar mantém seu total. Double, split e outras ações dependem das regras combinadas.',cards:undefined},
  {title:'A vez do dealer e o resultado',text:'O dealer revela a carta fechada e segue uma regra fixa. Neste guia você pode testar parar ou comprar no 17 suave. Compare os totais válidos.',cards:[c(10,'hearts'),c(7,'clubs')]}
 ];
 return <div className="learn-basics"><div className="learn-fact-grid">{GAME_IDENTITY[game].facts.map(f=><span key={f}>{f}</span>)}</div><ol>{steps.map((step,i)=><li key={step.title}><div className="learn-step-number">0{i+1}</div><div><h3>{step.title}</h3><p>{step.text}</p>{step.cards&&<LearnHand cards={step.cards}/>}</div></li>)}</ol><div className="learn-classic-actions"><Actions game={game}/></div></div>;
}
const POKER_FAQ=[
 ['Preciso usar minhas duas cartas?','Não. A melhor mão pode usar zero, uma ou duas cartas privadas. O exercício de seleção mostra as três situações.'],
 ['Flush vence sequência?','Sim. Full house vence flush; flush vence sequência. Compare primeiro a categoria.'],
 ['O que é um kicker?','É uma carta de desempate fora do grupo principal. Com o mesmo par, compare os outros valores em ordem.'],
 ['O naipe desempata?','Não no Texas Hold’em. Se as melhores cinco cartas tiverem a mesma força, há empate.'],
 ['O Ás pode ficar no meio da sequência?','Não. A–2–3–4–5 é válida, assim como 10–J–Q–K–A. Q–K–A–2–3 não é sequência.'],
 ['E as estruturas de aposta?','No-limit, pot-limit e limit têm limites diferentes para as ações. Confiram a estrutura, os blinds e o aumento mínimo antes da partida.']
];
const BLACKJACK_FAQ=[
 ['21 com três cartas também é natural?','Não. Natural é Ás + carta de valor 10 nas duas cartas iniciais. Um 21 comum não é natural. Regras de mãos divididas devem ser combinadas.'],
 ['Como dois ases são contados?','No máximo um Ás vale 11. Em A + A + 8, a soma é 20: 11 + 1 + 8.'],
 ['O dealer escolhe a melhor ação?','Não. Ele segue a regra da mesa. A diferença entre comprar e parar no 17 suave muda algumas rodadas.'],
 ['Se eu e o dealer estourarmos, empatamos?','Não. Sua mão perde ao passar de 21, antes de depender do resultado posterior do dealer.'],
 ['O que significa push?','Empate. Totais iguais normalmente empatam; dois naturais também. Natural e 21 comum não têm a mesma força.'],
 ['Quais regras preciso combinar?','17 suave, pagamentos do natural, limites de double e split, seguro e desistência. O guia simula apenas a comparação das mãos.']
];
function ClassicRules({game}:{game:ClassicGame}){
 const poker=game==='poker';
 return <div className="learn-classic-rules"><div className="learn-rules-grid">{poker?<PokerRanking/>:<section className="learn-exercise"><span className="learn-eyebrow">CONSULTA RÁPIDA</span><h3>Valor das cartas</h3><div className="learn-point-chart"><span>2 a 10 <b>Face</b></span><span>J / Q / K <b>10</b></span><span>Ás <b>1 / 11</b></span></div><div className="learn-bj-examples">{[{cards:[c(1,'spades'),c(13,'hearts')],text:'21 · natural nas duas primeiras'},{cards:[c(1,'clubs'),c(6,'diamonds')],text:'17 suave · Ás vale 11'},{cards:[c(1,'clubs'),c(6,'diamonds'),c(9,'spades')],text:'16 duro · Ás passou a 1'},{cards:[c(10,'spades'),c(8,'clubs'),c(5,'hearts')],text:'23 · estourou'}].map(ex=><div key={ex.text}><LearnHand cards={ex.cards}/><span>{ex.text}</span></div>)}</div></section>}
  <section className="learn-exercise"><span className="learn-eyebrow">DÚVIDAS NA MESA</span><h3>O detalhe que muda a mão</h3>{(poker?POKER_FAQ:BLACKJACK_FAQ).map(([q,a])=><details key={q} className="learn-faq"><summary>{q}</summary><p>{a}</p></details>)}<a className="learn-source" href={poker?'https://www.pokerstars.com/poker/games/texas-holdem/':'https://bicyclecards.com/how-to-play/blackjack'} target="_blank" rel="noopener noreferrer">{poker?'Referência · Texas Hold’em':'Referência · Bicycle Cards'} <span aria-hidden="true">↗</span></a></section></div><Actions game={game}/></div>;
}
