"use client";

import {money} from "@/lib/mesa-types";
import type {Expense,Buy} from "@/lib/mesa-types";
import type {ExpenseSplitRow} from "./expense-splits";
import "./night-summary.css";

type Guest={user_id:string};
type Cashout={user_id:string;final_brl:number};
type Props={
  guests:Guest[];
  buys:Buy[];
  cashouts:Cashout[];
  expenses:Expense[];
  shares:ExpenseSplitRow[];
  hostId:string;
  currentUserId:string;
  nameFor:(id:string)=>string;
  eventFinished:boolean;
  title:string;
};
const cents=(value:number|string)=>Math.round(Number(value)*100);
const fmtCents=(value:number)=>money(value/100);

export default function NightSummary({guests,buys,cashouts,expenses,shares,hostId,currentUserId,nameFor,eventFinished,title}:Props){
 const totalBought=buys.reduce((n,b)=>n+cents(b.amount_brl),0);
 const totalBack=cashouts.reduce((n,c)=>n+cents(c.final_brl),0);
 const totalExpenses=expenses.reduce((n,e)=>n+cents(e.amount_brl),0);
 const totalSplit=shares.reduce((n,r)=>n+cents(r.share_brl),0);
 const participantStats=guests.map(g=>{
   const spent=buys.filter(b=>b.user_id===g.user_id).reduce((n,b)=>n+cents(b.amount_brl),0);
   const row=cashouts.find(c=>c.user_id===g.user_id);
   const back=row?cents(row.final_brl):0;
   const split=shares.filter(r=>r.user_id===g.user_id).reduce((n,r)=>n+cents(r.share_brl),0);
   const owedToOthers=shares.filter(r=>r.user_id===g.user_id&&r.paid_by!==g.user_id)
     .reduce((n,r)=>n+cents(r.share_brl),0);
   const prepaidByPlayer=shares.filter(r=>r.paid_by===g.user_id&&r.user_id!==g.user_id)
     .reduce((n,r)=>n+cents(r.share_brl),0);
   return {...g,spent,back,split,net:back-spent,owedToOthers,prepaidByPlayer,submitted:Boolean(row)};
 });
 const personal=participantStats.find(p=>p.user_id===currentUserId);
 const hasCompleteCashouts=guests.length>0&&cashouts.length===guests.length&&
    participantStats.every(p=>p.submitted);
 return <div className="mm-night-summary">
   <section className="panel mm-night-hero">
     <div className="mm-night-kicker">{eventFinished?"PARTIDA ENCERRADA":"PARCIAL DA NOITE"}</div>
     <h2>{eventFinished?"Resumo da noite":"Resumo do evento"}</h2>
     <p>{title}. Compras de fichas, resultado financeiro e participação nos rachas, em um só lugar.</p>
     <div className="mm-night-metrics">
       <div><small>Compras de fichas</small><strong>{fmtCents(totalBought)}</strong></div>
       <div><small>Valor final dos jogadores</small><strong>{fmtCents(totalBack)}</strong></div>
       <div><small>Despesas cadastradas</small><strong>{fmtCents(totalExpenses)}</strong></div>
       <div><small>Valor rateado</small><strong>{fmtCents(totalSplit)}</strong></div>
     </div>
     {eventFinished&&hasCompleteCashouts&&totalBack===totalBought&&
       <p className="mm-night-reconcile">Fechamento equilibrado: o total final dos jogadores corresponde às compras.</p>}
     {!eventFinished&&<p className="mm-night-footnote">Os resultados finais só são definitivos depois do encerramento da partida.</p>}
   </section>
   {personal&&<section className="panel mm-night-personal">
     <div className="mm-night-kicker">SEU RESULTADO</div>
     <h3>{nameFor(currentUserId)}</h3>
     <div className="mm-night-personal-grid">
       <div><small>Você comprou</small><strong>{fmtCents(personal.spent)}</strong></div>
       <div><small>Valor final</small><strong>{personal.submitted?fmtCents(personal.back):"A informar"}</strong></div>
       <div><small>Lucro / prejuízo em fichas</small>
         <strong className={personal.net>=0?"is-positive":"is-negative"}>{personal.submitted?(personal.net>0?"+":"")+fmtCents(personal.net):"—"}</strong></div>
       <div><small>Sua participação nos rachas</small><strong>{fmtCents(personal.split)}</strong></div>
     </div>
     <p>Rachas a dividir com quem pagou: <b>{fmtCents(personal.owedToOthers)}</b>.
       Valores de fichas e de despesas são apresentados separadamente para não serem somados duas vezes.</p>
   </section>}
   <section className="panel">
     <div className="panelhead"><h2>Resultado dos jogadores</h2><span className="tag">{participantStats.length}</span></div>
     <div className="mm-night-players">
       {participantStats.map(p=><div className="mm-night-player" key={p.user_id}>
         <div><strong>{nameFor(p.user_id)}</strong><small>{p.user_id===hostId?"Anfitrião · ":""}Comprou {fmtCents(p.spent)} · Terminou com {p.submitted?fmtCents(p.back):"valor pendente"}</small>
           <small>Rachas: {fmtCents(p.split)}{p.owedToOthers>0?" · deve dividir "+fmtCents(p.owedToOthers):""}</small></div>
         <span className={p.net>=0?"is-positive":"is-negative"}>{p.submitted?(p.net>0?"+":"")+fmtCents(p.net):"—"}</span>
       </div>)}
     </div>
   </section>
   <section className="panel">
     <div className="panelhead"><h2>Despesas e rachas</h2><span className="tag">{expenses.length}</span></div>
     {expenses.length?expenses.map(e=>{
       const selected=shares.filter(sh=>sh.expense_id===e.id);
       const payer=e.paid_by||e.created_by;
       return <div className="mm-night-expense" key={e.id}>
         <div><strong>{e.label}</strong><small>Pago por {nameFor(payer)} · {selected.length} no racha</small>
          {selected.length>0&&<small>{selected.map(sh=>nameFor(sh.user_id)+": "+money(sh.share_brl)).join(" · ")}</small>}
         </div>
         <strong>{money(e.amount_brl)}</strong>
       </div>;
     }):<p className="mm-formfoot">Nenhuma despesa registrada neste evento.</p>}
     <p className="mm-night-footnote">Este resumo é informativo. O Mesa Marcada não recebe nem transfere dinheiro, e não confirma pagamentos.</p>
   </section>
 </div>;
}
