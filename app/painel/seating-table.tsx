"use client";

import type {Game} from "@/lib/mesa-types";
import "./seating-table.css";

export type TableSeat={session_id:string;user_id:string;seat_no:number;chosen_at:string};

type Props={
 game:Game;
 capacity:number;
 seats:TableSeat[];
 myId:string;
 confirmed:boolean;
 canChange:boolean;
 busy:boolean;
 nameFor:(id:string)=>string;
 onChoose:(seat:number|null)=>void;
};

function initials(name:string){
 return name.trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase()||"?";
}

export default function SeatingTable({game,capacity,seats,myId,confirmed,canChange,busy,nameFor,onChoose}:Props){
 const blackjack=game==="blackjack";
 const maxPlayers=blackjack?Math.max(0,Math.min(9,capacity-1)):Math.max(0,Math.min(10,capacity));
 const slots=Array.from({length:maxPlayers},(_,i)=>i+1);
 const mine=seats.find(s=>s.user_id===myId);
 const dealer=seats.find(s=>s.seat_no===0);
 const occupied=seats.length;
 const select=(n:number)=>{
   if(!canChange||!confirmed||busy)return;
   if(seats.some(s=>s.seat_no===n&&s.user_id!==myId))return;
   onChoose(mine?.seat_no===n?null:n);
 };
 return <section className={"mm-seat-shell "+(blackjack?"is-blackjack":"is-poker")} aria-label={"Assentos da mesa de "+(blackjack?"Blackjack":"Poker")}>
   <div className="mm-seat-topline">
     <div>
       <span className="mm-seat-eyebrow">{blackjack?"♦ BLACKJACK · 21":"♠ POKER · TEXAS HOLD’EM"}</span>
       <h2>Escolha seu lugar à mesa</h2>
       <p>{canChange?"Clique numa cadeira livre para sentar ou trocar de posição.":"Posições da mesa. As cadeiras ficam bloqueadas depois que a partida começa."}</p>
     </div>
     <span className="mm-seat-counter">{occupied} / {maxPlayers+(blackjack?1:0)} ocupados</span>
   </div>
   <div className="mm-seat-layout">
     <div className="mm-seat-stage">
       <div className="mm-seat-table" aria-hidden="true">
         <div className="mm-seat-table-surface">
           <span className="mm-seat-table-glyph">{blackjack?"♦":"♠"}</span>
           <strong>{blackjack?"BLACKJACK":"POKER"}</strong>
           <small>{blackjack?"CRUPIÊ · 21":"MESA MARCADA"}</small>
         </div>
       </div>
       {blackjack&&<button
         type="button"
         className={"mm-seat-chair mm-seat-dealer "+(dealer?(dealer.user_id===myId?"is-mine":"is-taken"):"is-free")}
         style={{left:"50%",top:"11%"}}
         disabled={!canChange||!confirmed||busy||Boolean(dealer&&dealer.user_id!==myId)}
         aria-label={dealer?"Crupiê: "+nameFor(dealer.user_id):"Ocupar a cadeira do crupiê"}
         title={dealer?nameFor(dealer.user_id):"Sentar como crupiê"}
         aria-pressed={dealer?.user_id===myId}
         onClick={()=>select(0)}>
         <span className="mm-seat-chair-circle">{dealer?initials(nameFor(dealer.user_id)):"♛"}</span>
         <span className="mm-seat-chair-caption">CRUPIÊ</span>
       </button>}
       {slots.map((n,i)=>{
         const seat=seats.find(s=>s.seat_no===n);
         const mineHere=seat?.user_id===myId;
         const theta=blackjack?(slots.length===1?Math.PI/2:Math.PI-(i/(slots.length-1))*Math.PI):(-Math.PI/2)+(i/slots.length)*Math.PI*2;
         const x=blackjack?50+42*Math.cos(theta):50+42*Math.cos(theta);
         const y=blackjack?54+32*Math.sin(theta):51+40*Math.sin(theta);
         return <button key={n} type="button"
           className={"mm-seat-chair "+(mineHere?"is-mine":seat?"is-taken":"is-free")}
           style={{left:x+"%",top:y+"%"}}
           disabled={!canChange||!confirmed||busy||Boolean(seat&&!mineHere)}
           aria-label={seat?"Cadeira "+n+": "+nameFor(seat.user_id):"Ocupar cadeira "+n}
           title={seat?nameFor(seat.user_id):"Cadeira "+n}
           aria-pressed={mineHere}
           onClick={()=>select(n)}>
           <span className="mm-seat-chair-circle">{seat?initials(nameFor(seat.user_id)):"+"}</span>
           <span className="mm-seat-chair-caption">{mineHere?"VOCÊ":seat?nameFor(seat.user_id):"CADEIRA "+n}</span>
         </button>;
       })}
     </div>
     <aside className="mm-seat-detail">
       <span className="mm-seat-eyebrow">ORGANIZAÇÃO DA MESA</span>
       <h3>{blackjack?"Mesa de Blackjack":"Mesa de Poker"}</h3>
       <div className="mm-seat-fact"><span>Assentos ocupados</span><strong>{occupied} de {maxPlayers+(blackjack?1:0)}</strong></div>
       <div className="mm-seat-fact"><span>Seu lugar</span><strong>{mine?(mine.seat_no===0?"Crupiê":"Cadeira "+mine.seat_no):"Não selecionado"}</strong></div>
       {blackjack&&<div className="mm-seat-fact"><span>Crupiê</span><strong>{dealer?nameFor(dealer.user_id):"Não definido"}</strong></div>}
       {blackjack&&!dealer&&<p className="mm-seat-warning">É necessário alguém ocupar a cadeira dourada para iniciar o Blackjack.</p>}
       {!confirmed&&<p className="mm-seat-note">Confirme presença no evento para escolher uma cadeira.</p>}
       {capacity>10&&<p className="mm-seat-note">Esta visualização apresenta até 10 assentos. Os demais convidados continuam confirmados no evento.</p>}
       {mine&&canChange&&<button className="mm-seat-stand" type="button" disabled={busy} onClick={()=>onChoose(null)}>Levantar da cadeira</button>}
       <p className="mm-seat-note">Os lugares são reservados para os participantes confirmados. A distribuição fica travada quando a partida começa.</p>
       <div className="mm-seat-legend"><span><i className="free"/> Livre</span><span><i className="taken"/> Ocupada</span><span><i className="mine"/> Você</span>{blackjack&&<span><i className="dealer"/> Crupiê</span>}</div>
     </aside>
   </div>
 </section>;
}
