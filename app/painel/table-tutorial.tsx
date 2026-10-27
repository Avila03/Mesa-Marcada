"use client";

import {isChipGame} from "@/lib/games";
import dynamic from "next/dynamic";
import {useMemo,useState} from "react";
import type {Game} from "@/lib/mesa-types";
const GameTutorial=dynamic(()=>import('./game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});

/** Tutoriais migrados do HTML original v0.5 para React, sem iframe ou dados fictícios. */
type Card = readonly [string,string];
const ranks: {name:string;desc:string;cards:Card[]}[]=[
  {name:"Royal flush",desc:"A, K, Q, J e 10 do mesmo naipe.",cards:[["A","♠"],["K","♠"],["Q","♠"],["J","♠"],["10","♠"]]},
  {name:"Straight flush",desc:"Cinco cartas seguidas do mesmo naipe.",cards:[["9","♥"],["8","♥"],["7","♥"],["6","♥"],["5","♥"]]},
  {name:"Quadra",desc:"Quatro cartas do mesmo valor.",cards:[["K","♠"],["K","♥"],["K","♦"],["K","♣"],["3","♠"]]},
  {name:"Full house",desc:"Uma trinca e um par.",cards:[["Q","♠"],["Q","♥"],["Q","♦"],["8","♣"],["8","♥"]]},
  {name:"Flush",desc:"Cinco cartas do mesmo naipe, sem sequência.",cards:[["A","♦"],["J","♦"],["8","♦"],["6","♦"],["2","♦"]]},
  {name:"Sequência (straight)",desc:"Cinco valores consecutivos, naipes livres.",cards:[["9","♣"],["8","♠"],["7","♥"],["6","♦"],["5","♣"]]},
  {name:"Trinca",desc:"Três cartas do mesmo valor.",cards:[["7","♠"],["7","♥"],["7","♣"],["K","♦"],["2","♠"]]},
  {name:"Dois pares",desc:"Dois pares de valores distintos.",cards:[["J","♠"],["J","♦"],["4","♣"],["4","♥"],["A","♠"]]},
  {name:"Um par",desc:"Duas cartas do mesmo valor.",cards:[["A","♠"],["A","♥"],["10","♦"],["7","♣"],["2","♠"]]},
  {name:"Carta alta",desc:"Nenhuma das combinações anteriores.",cards:[["A","♠"],["J","♦"],["9","♥"],["5","♣"],["2","♦"]]}
];

function PlayingCards({cards}:{cards:readonly Card[]}){
  return <div className="playingcards" aria-label={cards.map(c=>c.join("")).join(" ")}>
    {cards.map(([rank,suit],i)=><span className={"playingcard "+(["♥","♦"].includes(suit)?"red":"")} key={i} title={rank+" "+suit}>{rank}{suit}</span>)}
  </div>;
}

function QuickStep({number,title,children}:{number:number;title:string;children:React.ReactNode}){
  return <div className="tut-step"><span className="num">{number}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}

function Panel({label,title,children}:{label:string;title:string;children:React.ReactNode}){
  return <section className="tut-panel"><div className="tut-label">{label}</div><h3>{title}</h3>{children}</section>;
}

function Calculator(){
  const [cards,setCards]=useState<string[]>(["A","K"]);
  const values=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const total=useMemo(()=>{
    const aces=cards.filter(c=>c==="A").length;
    let count=cards.reduce((n,c)=>n+(c==="A"?1:["K","Q","J"].includes(c)?10:Number(c)),0);
    let soft=false;
    if(aces>0&&count+10<=21){count+=10;soft=true;}
    return {sum:count,soft,bust:count>21,natural:cards.length===2&&count===21};
  },[cards]);
  return <Panel label="FERRAMENTA INTERATIVA" title="Quanto vale minha mão?">
    <p>Escolha as cartas para ver o total. O Ás vale 1 ou 11 automaticamente, conforme o melhor resultado.</p>
    <div className="bj-calc-controls">
      {cards.map((card,i)=><select aria-label={"Carta "+(i+1)} key={i} value={card} onChange={e=>setCards(old=>old.map((v,k)=>k===i?e.target.value:v))}>
        {values.map(v=><option key={v} value={v}>{v}</option>)}
      </select>)}
    </div>
    <div className="bj-total" aria-live="polite">{total.sum}</div>
    <div className="bj-status" aria-live="polite">
      {total.bust?"Estourou! Sua mão passou de 21.":total.natural?"Blackjack natural!":total.soft?"Mão suave: um Ás vale 11.":"Mão dura: nenhum Ás vale 11."}
    </div>
    <div className="tut-actions">
      <button className="btn small" type="button" disabled={cards.length>=12} onClick={()=>setCards(v=>[...v,"2"])}>＋ Carta</button>
      <button className="btn small" type="button" disabled={cards.length<=2} onClick={()=>setCards(v=>v.slice(0,-1))}>− Carta</button>
      <button className="btn small" type="button" onClick={()=>setCards(["A","K"])}>Reiniciar</button>
    </div>
  </Panel>;
}

function BlackjackTutorial(){
  return <div className="tut-layout">
    <div className="tut-stack">
      <Panel label="COMECE AQUI" title="Objetivo do Blackjack">
        <p>Ter uma mão que some <b>mais que a do dealer, sem passar de 21</b>. Você joga contra o dealer, não contra os outros participantes. Passou de 21, estourou.</p>
        <div className="tut-grid" style={{marginTop:16}}>
          <div className="tut-tile"><strong>2 a 10</strong><span>Valem o número mostrado.</span></div>
          <div className="tut-tile"><strong>J · Q · K</strong><span>Valem 10 pontos cada.</span></div>
          <div className="tut-tile"><strong>Ás (A)</strong><span>Vale 1 ou 11 conforme a mão.</span></div>
          <div className="tut-tile"><strong>Blackjack</strong><span>Ás + carta de valor 10 nas duas primeiras.</span></div>
        </div>
        <div className="tut-alert" style={{marginTop:15}}>Uma mão que chega a 21 com três ou mais cartas <b>não é um blackjack natural</b>.</div>
      </Panel>
      <Panel label="PASSO A PASSO" title="Como funciona uma rodada">
        <div className="tut-steps">
          <QuickStep number={1} title="Distribuição">Os jogadores recebem duas cartas. Em geral o dealer mostra uma carta e mantém outra oculta.</QuickStep>
          <QuickStep number={2} title="Sua vez">Você decide comprar outra carta, parar ou usar alguma ação especial permitida.</QuickStep>
          <QuickStep number={3} title="Vez do dealer">O dealer revela suas cartas e segue a regra fixa da mesa. Normalmente compra até alcançar 17; a regra do 17 suave varia.</QuickStep>
          <QuickStep number={4} title="Resultado">Ganha o maior total sem passar de 21. Totais iguais normalmente empatam (<i>push</i>).</QuickStep>
        </div>
      </Panel>
      <Panel label="SUAS ESCOLHAS" title="Comandos durante a mão">
        <ul className="tut-rulelist">
          <li><b>Hit / Comprar:</b> receber mais uma carta.</li>
          <li><b>Stand / Parar:</b> encerrar a compra mantendo seu total.</li>
          <li><b>Double / Dobrar:</b> quando permitido, dobrar a aposta e receber apenas mais uma carta.</li>
          <li><b>Split / Dividir:</b> separar duas cartas de mesmo valor em duas mãos, conforme as regras.</li>
          <li><b>Surrender / Desistir:</b> opcional em algumas mesas, encerrar com perda parcial.</li>
          <li><b>Insurance / Seguro:</b> aposta lateral oferecida em algumas regras quando o dealer mostra Ás.</li>
        </ul>
      </Panel>
      <Panel label="DÚVIDAS FREQUENTES" title="Perguntas sobre Blackjack">
        <details><summary>Quando o Ás vale 1 ou 11?</summary><p>Vale 11 se não ultrapassar 21; caso contrário, vale 1. Ex.: A + A + 8 = 20.</p></details>
        <details><summary>O dealer escolhe quando parar?</summary><p>Não. Ele segue uma regra definida antes do jogo. Em algumas versões compra no 17 suave; em outras, para.</p></details>
        <details><summary>21 com três cartas também é blackjack?</summary><p>Não. Blackjack natural é Ás mais uma carta de valor 10 nas duas primeiras cartas.</p></details>
        <details><summary>E se o dealer tiver o mesmo total?</summary><p>Geralmente é empate. Blackjack natural pode ter tratamento especial diante de um 21 comum.</p></details>
        <details><summary>Se o dealer estourar, todos ganham?</summary><p>Apenas as mãos que não estouraram. Quem passou de 21 já perdeu.</p></details>
      </Panel>
    </div>
    <aside className="tut-stack">
      <Calculator/>
      <Panel label="EXEMPLOS VISUAIS" title="Aprenda com as cartas">
        {[
          {cards:[["A","♠"],["K","♥"]],name:"21 — Blackjack natural",text:"Ás + carta de 10 nas duas primeiras."},
          {cards:[["A","♣"],["6","♦"]],name:"17 suave",text:"O Ás vale 11."},
          {cards:[["A","♣"],["6","♦"],["9","♠"]],name:"16 duro",text:"O Ás passou a valer 1."},
          {cards:[["10","♠"],["8","♣"],["5","♥"]],name:"23 — Estourou",text:"Acima de 21."}
        ].map((ex,i)=><div className="rankrow" key={i}>
          <PlayingCards cards={ex.cards.map(([value,suit])=>[value,suit] as Card)}/>
          <div className="rankdesc"><strong>{ex.name}</strong><small>{ex.text}</small></div>
        </div>)}
      </Panel>
      <Panel label="ANTES DE JOGAR" title="Regras da casa">
        <p>Combinem antecipadamente o que fazer em 17 suave, como tratar empates e quais ações especiais serão permitidas.</p>
        <div className="tut-side-note">Este guia explica o formato mais comum. A regra acordada entre os participantes é a referência de cada encontro.</div>
      </Panel>
    </aside>
  </div>;
}

function PokerTutorial(){
  return <div className="tut-layout">
    <div className="tut-stack">
      <Panel label="TEXAS HOLD’EM" title="Objetivo do Poker">
        <p>Formar a <b>melhor combinação de cinco cartas</b> ou vencer quando os demais jogadores desistirem. Este guia trata de Texas Hold’em.</p>
        <div className="tut-grid" style={{marginTop:15}}>
          <div className="tut-tile"><strong>2 cartas</strong><span>Privativas para cada jogador.</span></div>
          <div className="tut-tile"><strong>5 cartas</strong><span>Comunitárias, abertas ao longo da mão.</span></div>
          <div className="tut-tile"><strong>Melhores 5</strong><span>Qualquer combinação das sete cartas.</span></div>
          <div className="tut-tile"><strong>A → 2</strong><span>Ás é alto, mas também serve em A-2-3-4-5.</span></div>
        </div>
        <div className="tut-alert" style={{marginTop:15}}>Você pode usar <b>zero, uma ou duas</b> cartas privativas para montar sua melhor mão.</div>
      </Panel>
      <Panel label="ORDEM DO JOGO" title="Etapas de uma mão">
        <div className="tut-steps">
          <QuickStep number={1} title="Blinds e cartas">Dois jogadores colocam small blind e big blind; todos recebem duas cartas fechadas.</QuickStep>
          <QuickStep number={2} title="Pré-flop">Primeira rodada de decisões, antes de abrir as cartas comunitárias.</QuickStep>
          <QuickStep number={3} title="Flop">Três cartas comunitárias são reveladas, seguidas de outra rodada de decisões.</QuickStep>
          <QuickStep number={4} title="Turn">Abre a quarta carta comunitária e acontece outra rodada.</QuickStep>
          <QuickStep number={5} title="River e showdown">Abre a quinta carta; depois da última rodada, as mãos restantes são comparadas.</QuickStep>
        </div>
      </Panel>
      <Panel label="DECISÕES" title="O que significam os comandos?">
        <ul className="tut-rulelist">
          <li><b>Check / Passar:</b> seguir sem apostar quando não há valor pendente.</li>
          <li><b>Bet / Apostar:</b> iniciar uma aposta na rodada.</li>
          <li><b>Call / Pagar:</b> igualar a aposta vigente.</li>
          <li><b>Raise / Aumentar:</b> aumentar a aposta atual.</li>
          <li><b>Fold / Desistir:</b> abandonar a mão atual.</li>
          <li><b>All-in:</b> usar todas as fichas disponíveis, podendo criar potes paralelos.</li>
        </ul>
        <p className="tut-learn-more">Combinem antes a estrutura de apostas (no-limit, pot-limit ou limit) e o valor dos blinds.</p>
      </Panel>
      <Panel label="DÚVIDAS FREQUENTES" title="Perguntas sobre Poker">
        <details><summary>Qual é a ordem das cartas?</summary><p>Da maior para menor: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2. O Ás pode ser baixo em A-2-3-4-5.</p></details>
        <details><summary>Flush vence sequência?</summary><p>Sim. Um flush vence uma sequência de naipes diferentes. Straight flush é mais forte que ambos.</p></details>
        <details><summary>Se ambos têm um par, quem ganha?</summary><p>O par mais alto vence. Se iguais, são comparados os kickers relevantes.</p></details>
        <details><summary>Os naipes desempataram?</summary><p>Não. No Texas Hold’em padrão todos os naipes possuem a mesma força.</p></details>
        <details><summary>Preciso usar minhas duas cartas?</summary><p>Não. Pode usar nenhuma, uma ou as duas cartas privativas.</p></details>
        <details><summary>Como funciona um empate?</summary><p>Se as melhores cinco cartas têm exatamente a mesma força, o pote correspondente é dividido.</p></details>
      </Panel>
    </div>
    <aside className="tut-stack">
      <Panel label="CONSULTA RÁPIDA" title="Ranking das mãos">
        <p>Da combinação <b>mais forte</b> à mais fraca.</p>
        {ranks.map((item,i)=><div className="rankrow" key={item.name}>
          <div className="ranknum">{String(i+1).padStart(2,"0")}</div>
          <div className="rankdesc"><strong>{item.name}</strong><small>{item.desc}</small></div>
          <div className="rankcards"><PlayingCards cards={item.cards}/></div>
        </div>)}
        <div className="tut-mini">Royal flush é o caso mais alto de straight flush.</div>
      </Panel>
      <Panel label="EXEMPLO PRÁTICO" title="Qual é a melhor mão?">
        <p><b>Suas cartas:</b></p>
        <PlayingCards cards={[["A","♠"],["K","♠"]]}/>
        <p style={{marginTop:13}}><b>Cartas comunitárias:</b></p>
        <PlayingCards cards={[["Q","♠"],["J","♠"],["10","♠"],["4","♦"],["2","♣"]]}/>
        <div className="tut-alert" style={{marginTop:14}}><b>Resultado: Royal flush.</b> A, K, Q, J e 10 de espadas são a mão mais forte possível.</div>
      </Panel>
      <Panel label="LEMBRETE" title="Como desempatar?">
        <p>Compare a categoria, depois as cartas que formam a combinação e, por último, os kickers relevantes.</p>
        <div className="tut-side-note">A-2-3-4-5 é menor que 2-3-4-5-6. Os naipes não possuem hierarquia no Texas Hold’em padrão.</div>
      </Panel>
    </aside>
  </div>;
}

export default function TableTutorial({game}:{game:Game}){
  if(!isChipGame(game))return <GameTutorial game={game}/>;
  return <div className="mm-table-guide">
    <div className={"tutorial-lead "+(game==="blackjack"?"mm-tutorial-blackjack":"")}>
      <div><div className="tut-label">GUIA COMPLETO</div>
        <h2>{game==="poker"?"Aprenda Texas Hold’em":"Aprenda Blackjack"}</h2>
        <p>{game==="poker"?"Do pré-flop ao royal flush, entenda cada etapa e consulte as combinações.":"Aprenda o jogo do 21, os comandos e calcule o valor das suas cartas."}</p>
      </div>
      <div className="deco" aria-hidden="true">{game==="poker"?"♠ ♣":"♦ ♥"}</div>
    </div>
    {game==="poker"?<PokerTutorial/>:<BlackjackTutorial/>}
    <p className="tut-learn-more" style={{marginTop:18}}>Conteúdo educativo para partidas presenciais. As regras específicas de cada encontro podem variar.</p>
  </div>;
}
