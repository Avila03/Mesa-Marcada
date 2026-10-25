"use client";

import type {Game,Profile} from "@/lib/mesa-types";
import FrameAvatar from "./frame-avatar";
import PlayerProfileTrigger from "./player-profile-preview";
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
 profiles:Profile[];
 photoUrls:Record<string,string>;
 onOpenProfile:(id:string)=>void;
 onChoose:(seat:number|null)=>void;
};


export default function SeatingTable({game,capacity,seats,myId,confirmed,canChange,busy,nameFor,profiles,photoUrls,onOpenProfile,onChoose}:Props){
 const blackjack=game==="blackjack";
 const maxPlayers=blackjack?Math.max(0,Math.min(9,capacity-1)):Math.max(0,Math.min(10,capacity));
 const slots=Array.from({length:maxPlayers},(_,i)=>i+1);
 const mine=seats.find(s=>s.user_id===myId);
 const dealer=seats.find(s=>s.seat_no===0);
 const occupied=seats.length;
 const select=(n:number)=>{
   if(!canChange||busy)return;
   if(seats.some(s=>s.seat_no===n&&s.user_id!==myId))return;
   onChoose(mine?.seat_no===n?null:n);
 };
 const renderChair=(n:number,left:string,top:string,isDealer=false)=>{
   const occupant=seats.find(s=>s.seat_no===n);
   const mineHere=occupant?.user_id===myId;
   const name=occupant?nameFor(occupant.user_id):"";
   const caption=isDealer?"CRUPIÊ":mineHere?"VOCÊ":occupant?name:"CADEIRA "+n;
   const className="mm-seat-chair "+(isDealer?"mm-seat-dealer ":"")+
     (mineHere?"is-mine":occupant?"is-taken":"is-free");
   const style={left,top};
   const content=<>
     <span className="mm-seat-chair-circle">
       {occupant?
         <FrameAvatar playerId={occupant.user_id} name={name} photoUrl={photoUrls[occupant.user_id]}/>:
         isDealer?"♛":"+"}
     </span>
     <span className="mm-seat-chair-caption">{caption}</span>
   </>;
   if(occupant)return <PlayerProfileTrigger key={n} variant="seat"
      className={className} style={style} playerId={occupant.user_id}
      fallbackName={name} photoUrl={photoUrls[occupant.user_id]}
      profile={profiles.find(p=>p.id===occupant.user_id)}
      caption={(isDealer?"Crupiê":"Cadeira "+n)+": "+name+". Ver prévia do perfil."}
      onOpenProfile={()=>onOpenProfile(occupant.user_id)}>{content}</PlayerProfileTrigger>;
   return <button type="button" key={n} className={className} style={style}
     disabled={!canChange||busy} aria-label={isDealer?"Ocupar a cadeira do crupiê":"Ocupar cadeira "+n}
     onClick={()=>select(n)}>{content}</button>;
 };
 return <section className={"mm-seat-shell "+(blackjack?"is-blackjack":"is-poker")} aria-label={"Assentos da mesa de "+(blackjack?"Blackjack":"Poker")}>
   <div className="mm-seat-topline">
     <div>
       <span className="mm-seat-eyebrow">{blackjack?"♦ BLACKJACK · 21":"♠ POKER · TEXAS HOLD’EM"}</span>
       <h2>Escolha seu lugar à mesa</h2>
       <p>{canChange?"Clique numa cadeira livre para participar do evento. Também é possível trocar de lugar.":"Posições da mesa. As cadeiras ficam bloqueadas depois que a partida começa."}</p>
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
       {blackjack&&renderChair(0,"50%","11%",true)}
       {slots.map((n,i)=>{
         const theta=blackjack?(slots.length===1?Math.PI/2:Math.PI-(i/(slots.length-1))*Math.PI):(-Math.PI/2)+(i/slots.length)*Math.PI*2;
         const x=50+42*Math.cos(theta);
         const y=blackjack?54+32*Math.sin(theta):51+40*Math.sin(theta);
         return renderChair(n,x+"%",y+"%");
       })}
     </div>
     <aside className="mm-seat-detail">
       <span className="mm-seat-eyebrow">ORGANIZAÇÃO DA MESA</span>
       <h3>{blackjack?"Mesa de Blackjack":"Mesa de Poker"}</h3>
       <div className="mm-seat-fact"><span>Assentos ocupados</span><strong>{occupied} de {maxPlayers+(blackjack?1:0)}</strong></div>
       <div className="mm-seat-fact"><span>Seu lugar</span><strong>{mine?(mine.seat_no===0?"Crupiê":"Cadeira "+mine.seat_no):"Não selecionado"}</strong></div>
       {blackjack&&<div className="mm-seat-fact"><span>Crupiê</span><strong>{dealer?nameFor(dealer.user_id):"Não definido"}</strong></div>}
       {blackjack&&!dealer&&<p className="mm-seat-warning">É necessário alguém ocupar a cadeira dourada para iniciar o Blackjack.</p>}
       {!confirmed&&<p className="mm-seat-note">Basta selecionar uma cadeira: sua participação será confirmada automaticamente.</p>}
       {capacity>10&&<p className="mm-seat-note">Esta visualização apresenta até 10 assentos. Os demais convidados continuam confirmados no evento.</p>}
       {mine&&canChange&&<button className="mm-seat-stand" type="button" disabled={busy} onClick={()=>onChoose(null)}>Sair da mesa</button>}
       <p className="mm-seat-note">Escolher uma cadeira confirma a participação. Sair da mesa cancela sua inscrição antes do início da partida.</p>
       <div className="mm-seat-legend"><span><i className="free"/> Livre</span><span><i className="taken"/> Ocupada</span><span><i className="mine"/> Você</span>{blackjack&&<span><i className="dealer"/> Crupiê</span>}</div>
     </aside>
   </div>
 </section>;
}
