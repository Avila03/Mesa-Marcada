"use client";

import {useState} from 'react';
import {GAME_META,GAME_RULES,VARIANT_NAMES,TRUCO_STAKES,defaultVariant,type Game} from '@/lib/games';
import {GAME_IDENTITY} from '@/lib/game-identity';
import {TRUCO_ORDER,rankName,cardName,compareTruco,envido,canFinishCanastra,canastraScore,pontinhoBalance,pontinhoValue,canPlayUno,unoName,unoValue,pifeGroups,SUIT_NAMES,type LearnCard,type Suit,type UnoCard} from '@/lib/tutorial-games';
import {TutorialShell,Exercise,Feedback,Reset,type TutorialSection} from './learning-ui';
import {LearnPlayingCard,LearnHand,LearnUnoCard} from './tutorial-cards';
import './game-tutorial.css';

const c=(rank:number,suit:Suit):LearnCard=>({rank,suit});
const HEART_RUN=[3,4,5,6,7,8,9].map(rank=>c(rank,'hearts'));
const PIFE_HAND=[c(7,'hearts'),c(8,'hearts'),c(9,'hearts'),c(13,'clubs'),c(13,'diamonds'),c(13,'spades'),c(4,'spades'),c(5,'spades'),c(12,'diamonds')];
const format=(value:number)=>value.toLocaleString('pt-BR');

export default function GameTutorial({game,variant:initial}:{game:Game;variant?:string|null}){
 const [choice,setChoice]=useState(initial||defaultVariant(game)||'');
 const [section,setSection]=useState<TutorialSection>('practice');
 const variant=GAME_META[game].variants.includes(choice)?choice:defaultVariant(game)||'';
 const intro=game==='truco'?'Do Espadão à vira: aprenda jogando os exemplos, na variante que a sua turma escolheu.':game==='canastra'?'Monte uma canastra, descubra se pode bater e veja a conta da rodada acontecer.':game==='pontinho'?'Veja quanto cada carta custa e descubra como continuar na mesa.':game==='uno'?'Toque nas cartas para testar jogadas e descobrir o valor de uma rodada.':'Compre, escolha o descarte e veja as nove cartas se encaixarem.';
 return <TutorialShell game={game} intro={intro} edition={VARIANT_NAMES[variant]} section={section} onSectionChange={setSection} variantControl={GAME_META[game].variants.length>1?<label className="learn-variant">Aprendendo a jogar<select aria-label="Variante do tutorial" value={variant} onChange={e=>setChoice(e.target.value)}>{GAME_META[game].variants.map(v=><option key={v} value={v}>{VARIANT_NAMES[v]}</option>)}</select></label>:undefined}>
  <div key={variant} className="learn-content">
   {section==='practice'?<>
    <div className="learn-start"><span className="learn-live-dot" aria-hidden="true"/><p>{game==='truco'?'Escolha quem ganha a vaza. Depois experimente os tentos.':game==='canastra'?'Uma sequência na mesa. O que muda quando entra um curinga?':game==='pontinho'?'Toque nas cartas que sobraram para montar a sua conta.':game==='uno'?'O descarte está aberto. Qual carta da sua mão pode entrar?':'Você já tem dois jogos prontos. Falta completar o terceiro.'}</p></div>
    {game==='truco'?<TrucoPractice variant={variant}/>:game==='canastra'?<CanastraPractice variant={variant}/>:game==='pontinho'?<PontinhoPractice/>:game==='uno'?<UnoPractice/>:<PifePractice/>}
   </>:section==='basics'?<Basics game={game} variant={variant}/>:<Rules game={game} variant={variant}/>}
  </div>
 </TutorialShell>;
}

const DUELS:Record<string,readonly [LearnCard,LearnCard][]>={
 gauderio:[[c(1,'swords'),c(1,'bastos')],[c(7,'coins'),c(3,'cups')],[c(3,'cups'),c(3,'bastos')],[c(2,'coins'),c(12,'cups')]],
 paulista:[[c(11,'clubs'),c(3,'spades')],[c(11,'hearts'),c(11,'spades')],[c(3,'diamonds'),c(3,'clubs')],[c(1,'spades'),c(2,'diamonds')]],
 mineiro:[[c(4,'clubs'),c(7,'hearts')],[c(7,'diamonds'),c(1,'spades')],[c(3,'clubs'),c(2,'hearts')],[c(13,'diamonds'),c(13,'clubs')]]
};
function TrucoPractice({variant}:{variant:string}){
 const [duel,setDuel]=useState(0),[answer,setAnswer]=useState<number|null>(null),[vira,setVira]=useState(12),[level,setLevel]=useState(1);
 const cards=DUELS[variant][duel%DUELS[variant].length];const result=compareTruco(cards[0],cards[1],variant,vira);const correct=result>0?0:result<0?1:2;
 const manilha=TRUCO_ORDER[(TRUCO_ORDER.indexOf(vira as typeof TRUCO_ORDER[number])+1)%TRUCO_ORDER.length];
 const stakes=TRUCO_STAKES[variant],stake=stakes[level],previous=stakes[Math.max(0,level-1)];
 return <div className="learn-practice-grid"><Exercise number="01" title="Quem leva esta vaza?" hint="Uma vaza é uma disputa de cartas. Toque no lado vencedor ou escolha empate.">
  {variant==='paulista'?<div className="learn-vira"><LearnPlayingCard card={c(vira,'diamonds')}/><label>Vira da mão<select aria-label="Vira da mão" value={vira} onChange={e=>{setVira(Number(e.target.value));setAnswer(null)}}>{TRUCO_ORDER.map(r=><option key={r} value={r}>{rankName(r)}</option>)}</select><small>Manilhas: todos os {rankName(manilha)}.</small></label></div>:<p className="learn-table-note">{variant==='gauderio'?'Baralho espanhol · sem vira · manilhas fixas':'Baralho francês · sem vira · manilhas fixas'}</p>}
  <div className="learn-duel">{cards.map((card,i)=><div key={i}><span>Equipe {i===0?'Azul':'Vermelha'}</span><LearnPlayingCard card={card} selected={answer===i} onClick={()=>setAnswer(i)} label={'Vence '+cardName(card)}/><small>{cardName(card)}</small></div>)}<span className="learn-versus" aria-hidden="true">×</span></div>
  <button type="button" className="learn-choice" aria-pressed={answer===2} onClick={()=>setAnswer(2)}>As cartas empatam</button>
  <Feedback good={answer===null?null:answer===correct}>{answer===null?'Compare a força das cartas antes de escolher.':<><strong>{correct===2?'Empate nesta vaza.':`${cardName(cards[correct])} vence.`}</strong><p>{correct===2?'Fora das manilhas, o naipe não desempata cartas do mesmo valor.':variant==='gauderio'?'No Gaudério: 1 de espadas > 1 de bastos > 7 de espadas > 7 de ouros. Depois vêm os 3, os 2 e os demais ases.':variant==='paulista'?`A vira ${rankName(vira)} torna ${rankName(manilha)} a manilha. Entre manilhas: paus, copas, espadas, ouros. Sem manilha, vale a ordem das cartas.`:'No Mineiro: 4 de paus > 7 de copas > Ás de espadas > 7 de ouros. Essas cartas vencem as comuns.'}</p>{answer!==correct&&<small>Experimente a outra opção para conferir.</small>}</>}</Feedback>
  <Reset label="Outro duelo" onClick={()=>{setDuel(n=>n+1);setAnswer(null)}}/>
 </Exercise><Exercise number="02" title="Pediu aumento. E agora?" hint="Escolha uma proposta. Aceitar e correr produzem resultados diferentes.">
  <div className="learn-stakes">{stakes.slice(1).map((n,i)=><button type="button" key={n} aria-pressed={level===i+1} onClick={()=>setLevel(i+1)}><small>{variant==='gauderio'?['Truco','Retruco','Vale quatro'][i]:i===0?'Truco':'Pedir '+n}</small><strong>{n}</strong></button>)}</div>
  <div className="learn-score-split"><div><span>Se aceitar</span><strong>{stake}</strong><small>tentos em disputa</small></div><div><span>Se correr</span><strong>{previous}</strong><small>para quem propôs</small></div></div>
  <p className="learn-table-note">A recusa mantém o valor anterior. O vencedor só recebe o aumento se a proposta tiver sido aceita.</p>
  <div className="learn-facts"><span>Base <b>{stakes[0]}</b></span><span>Meta <b>{variant==='gauderio'?24:12}</b></span></div>
 </Exercise>{variant==='gauderio'?<EnvidoLab/>:<section className="learn-callout"><span className="learn-eyebrow">ATENÇÃO À RETA FINAL</span><h3>{variant==='paulista'?'Mão de onze':'Mão de dez'}</h3><p>{variant==='paulista'?'Com uma equipe em 11, aceitar a mão vale 3; recusar dá 1 ao adversário. Não se pede aumento.':'Com uma equipe em 10, aceitar a mão vale 4; recusar dá 2 ao adversário. Não se pede aumento.'} Com as duas equipes nessa situação, confiram a regra de mão de ferro antes de jogar.</p></section>}</div>;
}
function EnvidoLab(){
 const [cards,setCards]=useState<LearnCard[]>([c(5,'swords'),c(7,'swords'),c(12,'bastos')]);const result=envido(cards);
 const update=(index:number,patch:Partial<LearnCard>)=>setCards(old=>old.map((card,i)=>i===index?{...card,...patch}:card));
 const duplicate=cards.some((card,i)=>cards.some((other,j)=>j<i&&other.rank===card.rank&&other.suit===card.suit));
 return <Exercise number="03" title="Quanto você tem de envido?" hint="Troque valores e naipes. Veja quando a mão também forma uma flor."><div className="learn-envido-cards">{cards.map((card,i)=><div key={i}><LearnPlayingCard card={card}/><div><label>Carta {i+1}<select aria-label={'Valor da carta '+(i+1)} value={card.rank} onChange={e=>update(i,{rank:Number(e.target.value)})}>{[1,2,3,4,5,6,7,10,11,12].map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>Naipe<select aria-label={'Naipe da carta '+(i+1)} value={card.suit} onChange={e=>update(i,{suit:e.target.value as Suit})}>{(['swords','bastos','cups','coins'] as const).map(s=><option key={s} value={s}>{SUIT_NAMES[s]}</option>)}</select></label></div></div>)}</div>
  {duplicate?<Feedback good={false}>A mesma carta não pode aparecer duas vezes nesse baralho. Troque um valor ou naipe.</Feedback>:<div className="learn-result" aria-live="polite"><div><small>{result.flor===null?'Valor da sua mão de envido':'Flor · três cartas do mesmo naipe'}</small><strong>{result.flor??result.points}</strong></div><p>{result.flor===null?'Melhor par do mesmo naipe +20. Sem par de naipe, vale a maior carta. Figuras 10, 11 e 12 valem zero nessa conta.':'Some as três cartas e acrescente 20; figuras valem zero. A flor tem prioridade sobre o envido.'}</p></div>}
  <p className="learn-table-note">O valor da mão não é o prêmio: envido simples aceito vale 2 tentos; flor simples, 3. Propostas maiores e recusas são conferidas separadamente.</p>
 </Exercise>;
}

function CanastraPractice({variant}:{variant:string}){
 const [dirty,setDirty]=useState(false),[morto,setMorto]=useState(false),[checked,setChecked]=useState(false),[cards,setCards]=useState(320),[hands,setHands]=useState(40);
 const valid=canFinishCanastra(variant,dirty?0:1,dirty?1:0,morto);
 const total=canastraScore({cards,clean:dirty?0:1,dirty:dirty?1:0,hands,morto,batida:checked&&valid});
 return <div className="learn-practice-grid"><Exercise number="01" title="Sete cartas: limpa ou suja?" hint="Troque uma carta pela carta 2 usada como curinga e compare.">
  <div className="learn-canastra-hand">{HEART_RUN.map((card,i)=><LearnPlayingCard key={i} card={dirty&&i===4?c(2,'clubs'):card} selected={dirty&&i===4}/> )}</div>
  <div className={'learn-combination '+(dirty?'dirty':'clean')}><strong>Canastra {dirty?'suja':'limpa'}</strong><span>+{dirty?100:200} de bônus</span></div>
  <button type="button" className="learn-choice" aria-pressed={dirty} onClick={()=>{setDirty(!dirty);setChecked(false)}}>{dirty?'Devolver o 7 de copas':'Usar o 2 de paus no lugar do 7'}</button>
  <p className="learn-table-note">O 2 de paus está substituindo o 7 de copas. Por isso a canastra fica suja. As cartas baixadas também são contadas além desse bônus.</p>
  <label className="learn-toggle"><input type="checkbox" checked={morto} onChange={e=>{setMorto(e.target.checked);setChecked(false)}}/><span>Minha equipe já pegou o morto</span></label>
  <button type="button" className="btn gold" onClick={()=>setChecked(true)}>Conferir se posso bater</button>
  {checked&&<Feedback good={valid}><strong>{valid?'Pode bater nesta variante.':'Ainda não pode bater.'}</strong><p>{!morto?'O morto precisa ter sido pego antes da batida final.':!valid?'Canastra e Buraco aberto exigem pelo menos uma canastra limpa.':variant==='buraco_fechado'&&dirty?'O Buraco fechado desta mesa aceita uma canastra suja na batida final.':'Morto pego e canastra limpa: os requisitos deste exemplo foram atendidos.'}</p></Feedback>}
 </Exercise><Exercise number="02" title="Feche a conta da rodada" hint="Mude os valores. A fórmula acompanha as cartas e as decisões do exemplo ao lado.">
  <details className="learn-count-help"><summary>Como somar o valor das cartas?</summary><p>3 a 7 valem 5 cada. O 2 e as cartas de 8 a K valem 10 cada. Ás vale 15. Curinga impresso, quando usado na variante, vale 20.</p><p>Some as cartas de todos os jogos da equipe; depois acrescente os bônus abaixo.</p></details>
  <div className="learn-number-fields"><label>Pontos das cartas baixadas<input type="number" min={0} max={10000} step={5} value={cards} onChange={e=>setCards(Math.max(0,Math.min(10000,Number(e.target.value))))}/></label><label>Pontos nas mãos da equipe<input type="number" min={0} max={10000} step={5} value={hands} onChange={e=>setHands(Math.max(0,Math.min(10000,Number(e.target.value))))}/></label></div>
  <dl className="learn-equation"><div><dt>Cartas baixadas</dt><dd>+{format(cards)}</dd></div><div><dt>Canastra {dirty?'suja':'limpa'}</dt><dd>+{dirty?100:200}</dd></div><div><dt>Batida {checked&&valid?'conferida':'ainda não confirmada'}</dt><dd>+{checked&&valid?100:0}</dd></div><div><dt>Cartas nas mãos</dt><dd>−{format(hands)}</dd></div><div><dt>Morto {morto?'pego':'não pego'}</dt><dd>{morto?'0':'−100'}</dd></div></dl>
  <div className="learn-result" aria-live="polite"><div><small>Total da equipe nesta rodada</small><strong>{format(total)}</strong></div><p>O placar acumula rodadas até a meta do evento. As duas equipes fazem sua contagem.</p></div>
  <Reset onClick={()=>{setDirty(false);setMorto(false);setChecked(false);setCards(320);setHands(40)}}/>
 </Exercise></div>;
}

const REMAINING=[c(13,'spades'),c(1,'hearts'),c(7,'diamonds'),c(3,'clubs'),c(12,'hearts')];
function PontinhoPractice(){
 const [selected,setSelected]=useState([0,1,2]),[balance,setBalance]=useState(25),[winner,setWinner]=useState(false),[dealer,setDealer]=useState(0);
 const result=pontinhoBalance(balance,REMAINING.filter((_,i)=>selected.includes(i)),winner);const names=['Ana','Bruno','Clara','Diego'];
 return <div className="learn-practice-grid"><Exercise number="01" title="O que sobrou na sua mão?" hint="Toque para incluir ou retirar cartas. As cartas marcadas entram na conta.">
  <div className="learn-hand learn-hand-select">{REMAINING.map((card,i)=><div key={i}><LearnPlayingCard card={card} selected={selected.includes(i)} onClick={()=>setSelected(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i])} label={cardName(card)+' · '+pontinhoValue(card)+' pontos'}/><small>{pontinhoValue(card)} pts</small></div>)}</div>
  <label className="learn-range">Saldo antes da rodada <strong>{balance}</strong><input aria-label="Saldo antes da rodada" type="range" min={5} max={100} step={5} value={balance} onChange={e=>setBalance(Number(e.target.value))}/></label>
  <label className="learn-toggle"><input type="checkbox" checked={winner} onChange={e=>setWinner(e.target.checked)}/><span>Fui quem bateu nesta rodada</span></label>
  <div className="learn-balance" aria-live="polite"><span>{balance}</span><span>−</span><span>{result.loss}</span><span>=</span><strong className={result.eliminated?'out':''}>{result.balance}</strong></div>
  <Feedback good={!result.eliminated}><strong>{winner?'Quem bate não perde saldo.':result.eliminated?'Estourou: zero ou menos.':'Continua na mesa.'}</strong><p>{winner?'As cartas marcadas não geram desconto para o vencedor da rodada.':result.eliminated?'Nesta base sem reentrada, o jogador sai. Vence o último com saldo positivo.':`As cartas restantes custaram ${result.loss} pontos. O saldo segue para a próxima rodada.`}</p></Feedback>
 </Exercise><Exercise number="02" title="A vez de distribuir também gira" hint="Avance o distribuidor para visualizar o rodízio da mesa.">
  <div className="learn-dealer-ring">{names.map((name,i)=><div key={name} className={dealer%4===i?'active':''}><span>{name[0]}</span><strong>{name}</strong><small>{dealer%4===i?'Distribui agora':'Aguarda'}</small></div>)}</div>
  <button type="button" className="learn-choice" onClick={()=>setDealer(n=>n+1)}>Próxima distribuição <span aria-hidden="true">→</span></button>
  <p className="learn-table-note">Distribua nove cartas por pessoa, de três em três. O rodízio deste exemplo segue o sentido horário.</p>
  <div className="learn-callout compact"><strong>Não confunda valor e quantidade.</strong><p>Um Ás sozinho custa 15 pontos; um Rei custa 10. Perder três cartas não significa perder três pontos.</p></div>
 </Exercise></div>;
}

const UNO_TOP:UnoCard={color:'blue',value:'7'};
const UNO_HANDS:readonly UnoCard[][]=[
 [{color:'red',value:'7'},{color:'blue',value:'2'},{color:'green',value:'9'},{color:'yellow',value:'reverse'},{color:'wild',value:'wild'},{color:'wild',value:'+4'}],
 [{color:'red',value:'7'},{color:'red',value:'+2'},{color:'green',value:'9'},{color:'yellow',value:'reverse'},{color:'wild',value:'wild'},{color:'wild',value:'+4'}]
];
const UNO_LEFT:UnoCard[]=[{color:'red',value:'9'},{color:'blue',value:'+2'},{color:'wild',value:'wild'}];
function UnoPractice(){
 const [scenario,setScenario]=useState(0),[chosen,setChosen]=useState<number|null>(null),[left,setLeft]=useState([0,1,2]);const hand=UNO_HANDS[scenario];const card=chosen===null?null:hand[chosen];const legal=card?canPlayUno(card,UNO_TOP,hand):null;
 const sum=UNO_LEFT.reduce((n,c,i)=>n+(left.includes(i)?unoValue(c):0),0);
 return <div className="learn-practice-grid"><Exercise number="01" title="Qual carta você jogaria?" hint="Toque em uma carta da sua mão. O descarte é um 7 azul.">
  <div className="learn-uno-table"><div className="learn-deck" aria-hidden="true"><span>MM</span></div><div><span className="learn-table-label">DESCARTE</span><LearnUnoCard card={UNO_TOP}/></div></div>
  <span className="learn-table-label">SUA MÃO</span><div className="learn-uno-hand">{hand.map((item,i)=><LearnUnoCard card={item} key={i} selected={chosen===i} onClick={()=>setChosen(i)} label={'Jogar '+unoName(item)}/>)}</div>
  <Feedback good={legal}>{!card?'Pode combinar cor, número ou símbolo. Observe também os curingas.':<><strong>{legal?'Essa carta pode entrar.':'Essa jogada não vale aqui.'}</strong><p>{card.value==='+4'?legal?'Você não tem carta azul. O comprar quatro pode ser usado, mesmo havendo um 7 de outra cor.':'Você tem uma carta azul na mão. No UNO clássico, isso impede usar o comprar quatro.':card.color==='wild'?'O curinga comum permite escolher a próxima cor, mesmo havendo outra carta jogável.':card.color==='blue'?'Azul combina com a cor do descarte.':card.value==='7'?'O número 7 combina, mesmo com uma cor diferente.':'Esta carta não combina com o azul nem com o número 7.'}</p></>}</Feedback>
  <Reset label={scenario===0?'Testar uma mão sem cartas azuis':'Voltar à mão com carta azul'} onClick={()=>{setScenario(n=>1-n);setChosen(null)}}/>
 </Exercise><Exercise number="02" title="Quanto vale a rodada?" hint="Estas cartas sobraram com os adversários. Toque para mudar a soma.">
  <div className="learn-uno-hand">{UNO_LEFT.map((item,i)=><div key={i}><LearnUnoCard card={item} selected={left.includes(i)} onClick={()=>setLeft(old=>old.includes(i)?old.filter(n=>n!==i):[...old,i])} label={unoName(item)+' · '+unoValue(item)+' pontos'}/><small>{unoValue(item)} pontos</small></div>)}</div>
  <div className="learn-result" aria-live="polite"><div><small>Pontos para quem venceu a rodada</small><strong>+{sum}</strong></div><p>Número vale a face, ação vale 20, curinga vale 50. A meta padrão do evento é 500.</p></div>
  <div className="learn-callout compact"><strong>Sem empilhar +2 e +4.</strong><p>Nesta mesa clássica, quem recebe a penalidade compra e perde a vez. Comprar quatro tem regra de uso e pode ser desafiado.</p></div>
 </Exercise></div>;
}

function PifePractice(){
 const [draw,setDraw]=useState<LearnCard|null>(null),[discard,setDiscard]=useState<number|null>(null);
 const full=draw?[...PIFE_HAND,draw]:PIFE_HAND;
 const hand=discard===null?full:full.filter((_,i)=>i!==discard);
 const groups=pifeGroups(hand);
 const reset=()=>{setDraw(null);setDiscard(null)};
 return <div className="learn-practice-grid"><Exercise number="01" title="Falta uma carta para encaixar" hint="Você tem duas combinações prontas. Escolha de onde vem a sua compra.">
  <div className="learn-meld-examples"><div><span>Sequência</span><LearnHand cards={PIFE_HAND.slice(0,3)}/></div><div><span>Trinca</span><LearnHand cards={PIFE_HAND.slice(3,6)}/></div></div>
  <div className="learn-hand"><LearnHand cards={PIFE_HAND.slice(6)}/></div>
  <p className="learn-table-note">4 e 5 de espadas estão esperando uma carta. A Dama de ouros ainda está solta.</p>
  <div className="learn-draw-options"><button type="button" disabled={draw!==null} onClick={()=>setDraw(c(6,'spades'))}><LearnPlayingCard card={c(6,'spades')}/><span>Pegar o descarte</span></button><button type="button" disabled={draw!==null} onClick={()=>setDraw(c(2,'hearts'))}><span className="learn-card-back" aria-hidden="true">MM</span><span>Comprar do monte</span><small>Revela 2 de copas neste exemplo</small></button></div>
  {draw&&<Feedback good={draw.rank===6}>Você comprou {cardName(draw)}. {draw.rank===6?'Agora complete a sequência e descarte a carta solta.':'A carta não completou o jogo. Veja como fica a mão antes de tentar outra compra.'}</Feedback>}
  <Reset onClick={reset}/>
 </Exercise><Exercise number="02" title="Qual carta vai para o lixo?" hint="Depois de comprar, toque na carta que deseja descartar.">
  <div className="learn-pife-hand">{hand.map((card,i)=><LearnPlayingCard key={i+'-'+card.rank+card.suit} card={card} selected={Boolean(groups)} onClick={draw&&discard===null?()=>setDiscard(i):undefined} label={draw&&discard===null?'Descartar '+cardName(card):undefined}/>)}</div>
  <Feedback good={!draw?null:discard===null?null:Boolean(groups)}>{!draw?'Compre uma carta no primeiro exemplo para liberar o descarte.':discard===null?'Você está com dez cartas. Qual delas não ajuda a formar seus três jogos?':groups?<><strong>Bateu! As nove cartas estão combinadas.</strong><p>7–8–9 de copas, três Reis de naipes diferentes e 4–5–6 de espadas. Cada carta pertence a um único jogo.</p></>:<><strong>Ainda há cartas sem combinação.</strong><p>{draw.rank===6?'A Dama de ouros é o descarte que permite fechar os três jogos. Recomece e experimente.':'O 2 de copas não completou o 4–5 de espadas. Recomece e observe o descarte aberto.'}</p></>}</Feedback>
  {discard!==null&&<Reset label="Tentar outra decisão" onClick={()=>setDiscard(null)}/>}
  <div className="learn-callout compact"><strong>Batida vale uma vitória no aplicativo.</strong><p>A meta de vitórias é combinada no evento. Este exercício ensina a batida com nove cartas e sem curinga.</p></div>
 </Exercise></div>;
}

type LessonStep={title:string;text:string;cards?:LearnCard[];detail?:string};
function stepsFor(game:Game,variant:string):LessonStep[]{
 if(game==='truco')return [
  {title:'Prepare a mão',text:variant==='gauderio'?'Use o espanhol de 40 cartas, sem 8 e 9. Cada jogador recebe três. Duplas e trios alternam parceiros na mesa.':'Use 40 cartas, retirando 8, 9, 10 e curingas. Distribua três por jogador.',cards:variant==='gauderio'?[c(1,'swords'),c(7,'coins'),c(3,'cups')]:[c(3,'spades'),c(2,'hearts'),c(13,'clubs')]},
  {title:'Dispute as vazas',text:'Cada pessoa joga uma carta por vaza. Em regra, duas vazas vencidas levam a mão. Empates seguem a regra da variante.',detail:'Vaza = uma disputa. Mão = até três vazas.'},
  {title:'Responda ao aumento',text:variant==='gauderio'?'Truco leva a 2, retruco a 3 e vale quatro a 4. O adversário aceita, aumenta quando permitido ou corre.':'O adversário pode aceitar, aumentar quando permitido ou correr. Se correr, entrega o valor anterior à proposta.',detail:'Na prática, compare aceitar e correr antes de registrar.'},
  {title:'Some os tentos',text:variant==='gauderio'?'Envido e flor são disputas separadas. Some os tentos conferidos e vença ao atingir 24 nesta mesa.':'Some o valor devido da mão à equipe vencedora. A partida termina em 12, respeitando mão de onze/dez.',detail:'No aplicativo, primeiro confira o resultado; depois encerre o evento.'}
 ];
 if(game==='canastra')return [
  {title:'Duplas e mortos',text:'Use dois baralhos e distribua onze cartas por pessoa. Separe dois mortos de onze. Em quatro, os parceiros sentam alternados.',cards:[c(3,'hearts'),c(4,'hearts'),c(5,'hearts')]},
  {title:'Compre, baixe e descarte',text:variant==='buraco_fechado'?'O lixo fechado tem compra justificada. Nesta variante, trincas são permitidas. Confira o regulamento combinado.':'Compre do monte ou o lixo inteiro, baixe sequências do mesmo naipe e descarte para passar a vez.',detail:'A dupla constrói os mesmos jogos na mesa.'},
  {title:'Complete sete cartas',text:'Um jogo de sete ou mais cartas vira canastra. Limpa não usa substituição; suja usa curinga. Nesta base, o 2 pode substituir cartas.',cards:HEART_RUN},
  {title:'Pegue o morto e bata',text:variant==='buraco_fechado'?'Após pegar o morto, a batida final desta mesa aceita uma canastra limpa ou suja. Some as duas equipes.':'A primeira batida pega o morto. Para a batida final, a equipe precisa de uma canastra limpa. Some as duas equipes.',detail:'Meta padrão: 3.000. O evento pode combinar outra meta.'}
 ];
 if(game==='pontinho')return [
  {title:'Comece com saldo',text:'De três a oito pessoas, dois baralhos e nove cartas para cada. Nesta base do site, todos começam com o saldo do evento, sem curinga e sem reentrada.',detail:'Padrão: 100 pontos por jogador.'},
  {title:'Forme os jogos',text:'Compre, organize trincas ou sequências e descarte. Baixe as combinações conforme a dinâmica combinada na mesa.',cards:[c(7,'hearts'),c(8,'hearts'),c(9,'hearts')]},
  {title:'Confira o que ficou',text:'Quando alguém bate, os outros somam suas cartas restantes. O vencedor não perde saldo.',cards:[c(13,'spades'),c(1,'hearts'),c(7,'diamonds')],detail:'Neste exemplo: 10 + 15 + 7 = 32.'},
  {title:'Continue ou estoure',text:'Desconte a soma do seu saldo. Zero ou menos elimina o jogador. O último com saldo positivo vence.',detail:'A meta inicial não é uma pontuação para alcançar; é um saldo para proteger.'}
 ];
 if(game==='uno')return [
  {title:'Abra a rodada',text:'Cada pessoa recebe sete cartas. O restante vira monte; uma carta abre o descarte. Cartas de ação na abertura têm tratamento próprio.',detail:'O exercício usa 7 azul como descarte.'},
  {title:'Combine a próxima carta',text:'Jogue pela cor, número ou símbolo. Curinga comum muda a cor. Comprar quatro só entra se não houver carta da cor atual na sua mão.',detail:'Experimente a diferença com e sem cartas azuis.'},
  {title:'Resolva as ações',text:'Pular tira a vez, inverter troca o sentido e +2 obriga a comprar duas e perder a vez. A base do site não empilha penalidades.',detail:'Em duas pessoas, inverter funciona como pular.'},
  {title:'Avise UNO e pontue',text:'Ao ficar com uma carta, avise UNO. Quem zera a mão recebe a soma dos adversários. Se terminar com compra, resolva a penalidade antes da soma.',detail:'O primeiro a atingir a meta do evento vence; padrão 500.'}
 ];
 return [
  {title:'Distribua nove cartas',text:'Use dois baralhos sem curingas. Cada pessoa recebe nove cartas, e o restante forma o monte de compra.',cards:PIFE_HAND.slice(0,3)},
  {title:'Reconheça os encaixes',text:'Trinca: mesmo valor em três naipes diferentes. Sequência: valores consecutivos do mesmo naipe. O Ás serve em A–2–3 ou Q–K–A, sem dar a volta.',cards:PIFE_HAND.slice(3,6)},
  {title:'Compre e descarte',text:'Na sua vez, compre do monte ou do descarte, reorganize os jogos e descarte. Para bater, confira todas as combinações.',detail:'No exercício: compre 6 de espadas e descarte a Dama de ouros.'},
  {title:'Bateu, confira',text:'As nove cartas precisam estar combinadas. O aplicativo registra a vitória depois da conferência dos jogadores.',detail:'A meta de vitórias do evento é um acordo da turma.'}
 ];
}
function Basics({game,variant}:{game:Game;variant:string}){
 return <div className="learn-basics"><div className="learn-fact-grid">{GAME_IDENTITY[game].facts.map(f=><span key={f}>{f}</span>)}</div><ol>{stepsFor(game,variant).map((step,i)=><li key={step.title}><div className="learn-step-number">0{i+1}</div><div><h3>{step.title}</h3><p>{step.text}</p>{step.cards&&<LearnHand cards={step.cards}/ >}{step.detail&&<div className="learn-step-detail">{step.detail}</div>}</div></li>)}</ol></div>;
}
function Rules({game,variant}:{game:Game;variant:string}){
 const questions:Record<string,readonly [string,string][] >={
 truco:[['Vaza e mão são a mesma coisa?','Não. Uma vaza é a disputa de uma carta por pessoa. A mão reúne até três vazas.'],['O naipe desempata cartas iguais?','Só nas manilhas variáveis do Paulista se usa a ordem de naipes. No Gaudério e no Mineiro, as especiais são fixas. Cartas comuns de mesmo valor empatam.'],['Envido de 32 soma 32 tentos?','Não. 32 é o valor da mão na disputa. Envido simples aceito premia 2 tentos; os aumentos são outra conta.'],['E os empates e a mão de ferro?','Dependem da variante e da situação. Confiram o regulamento antes de começar; o exercício de vaza isolada não decide uma mão inteira.']],
 canastra:[['O que significa pegar o morto?','É receber o lote extra de onze cartas quando a equipe esvazia sua primeira mão. Cada equipe pega um morto.'],['Uma canastra suja permite bater?','Na base do site: Canastra e Buraco aberto exigem limpa. Buraco fechado aceita limpa ou suja, sempre com morto pego.'],['O bônus substitui o valor das cartas?','Não. Conte as cartas baixadas e depois acrescente os bônus. As cartas nas mãos da equipe são descontadas.'],['Há canastras especiais de 500 ou 1.000?','Esses bônus não fazem parte desta base do aplicativo. O placar usa limpa 200, suja 100 e batida 100.']],
 pontinho:[['O saldo inicial precisa ser 100?','100 é o padrão. O anfitrião escolhe o saldo do evento antes de iniciar.'],['Quem bate também perde pontos?','Não. O vencedor da rodada conserva o saldo. Os outros descontam suas cartas restantes.'],['Posso voltar depois de estourar?','A modalidade implementada é sem reentrada. Zero ou saldo negativo elimina.'],['Por que o guia de referência fala em curinga?','Existem variantes regionais. A base cadastrada no site é sem curinga; confirme essa regra com a turma antes da partida.']],
 uno:[['Posso jogar +4 se tenho um 7 de outra cor?','Pode, desde que não tenha carta da cor atual. Número igual, sozinho, não impede o +4.'],['Posso somar outro +2 para passar adiante?','Não nesta base clássica. O próximo compra as cartas e perde a vez.'],['Esqueci de falar UNO. E agora?','Se outro jogador perceber antes de começar a vez seguinte, a penalidade clássica é comprar duas cartas.'],['O que acontece em um desafio do +4?','Se o uso foi ilegal, quem jogou compra quatro. Se era legal, quem desafiou compra seis. Confiram as cartas da mão e as regras de desafio.']],
 pife:[['Posso usar a mesma carta em dois jogos?','Não. Cada carta física entra em uma única combinação. O exercício confere os nove lugares da mão.'],['Três cartas do mesmo naipe são uma trinca?','Trinca exige o mesmo valor e três naipes diferentes. Mesmo naipe com valores seguidos forma uma sequência.'],['K–A–2 é uma sequência?','Não. O Ás pode iniciar A–2–3 ou encerrar Q–K–A, sem ligar as duas pontas.'],['Pife tem meta universal de vitórias?','Não. A meta é uma convenção do evento para organizar o encontro no site; a batida é conferida presencialmente.']]
 };
 const rule=GAME_RULES[variant];
 return <div className="learn-rules-grid"><section className="learn-exercise"><span className="learn-eyebrow">A VARIANTE FAZ DIFERENÇA</span><h3>{VARIANT_NAMES[variant]}</h3><p>{rule.intro}</p>{game==='truco'?<><h4>Da maior para a menor</h4><LearnHand cards={variant==='gauderio'?[c(1,'swords'),c(1,'bastos'),c(7,'swords'),c(7,'coins')]:variant==='mineiro'?[c(4,'clubs'),c(7,'hearts'),c(1,'spades'),c(7,'diamonds')]:[c(11,'clubs'),c(11,'hearts'),c(11,'spades'),c(11,'diamonds')]}/><p className="learn-table-note">{variant==='gauderio'?'Depois das quatro especiais: 3, 2, ases restantes, 12, 11, 10, setes restantes, 6, 5, 4.':variant==='mineiro'?'Depois das quatro especiais: 3, 2, A, K, J, Q, 7, 6, 5, 4, excluindo as manilhas.':'Exemplo com vira Q e manilhas J. Cartas comuns: 3, 2, A, K, J, Q, 7, 6, 5, 4, excluindo a manilha da mão.'}</p></>:game==='pontinho'?<div className="learn-point-chart"><span>2–10 <b>Face</b></span><span>J / Q / K <b>10</b></span><span>Ás <b>15</b></span></div>:game==='uno'?<div className="learn-point-chart"><span>0–9 <b>Face</b></span><span>Ações <b>20</b></span><span>Curingas <b>50</b></span></div>:<LearnHand cards={game==='canastra'?HEART_RUN:PIFE_HAND.slice(0,3)}/>}
  <details className="learn-full-rules"><summary>Consultar a base de regras desta mesa</summary><ol>{rule.steps.map(s=><li key={s}>{s}</li>)}</ol></details><a className="learn-source" href={rule.source} target="_blank" rel="noopener noreferrer">{game==='truco'&&variant==='gauderio'?'Regulamento de referência · MTG':game==='uno'?'Regras de referência · Mattel':'Regras de referência · Copag'} <span aria-hidden="true">↗</span></a></section>
  <section className="learn-exercise"><span className="learn-eyebrow">DÚVIDAS NA MESA</span><h3>Antes da próxima rodada</h3>{questions[game].filter((_,i)=>game!=='truco'||variant==='gauderio'||i!==2).map(([q,a])=><details className="learn-faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</section></div>;
}
