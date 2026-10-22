"use client";

import {useState} from "react";
import type {Expense,Buy} from "@/lib/mesa-types";
import type {ExpenseSplitRow} from "./expense-splits";
import {asMoney,calculateFinance,signedMoney} from "@/lib/finance-report";
import {makeReportText,printFinancialReport,saveFinancialImage} from "./night-report-export";
import type {ExportArgs} from "./night-report-export";
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
 startsAt:string;
 location:string;
 game:string;
};

export default function NightSummary({
 guests,buys,cashouts,expenses,shares,hostId,currentUserId,nameFor,
 eventFinished,title,startsAt,location,game
}:Props){
 const [feedback,setFeedback]=useState("");
 const report=calculateFinance({
  guests,purchases:buys,cashouts,expenses,shares,finished:eventFinished
 });
 const me=report.rows.find(row=>row.userId===currentUserId);
 const ready=report.settlementReady;
 const reportArgs:ExportArgs={title,when:startsAt,venue:location,game,report,expenses,shares,nameFor};
 async function shareReport(){
  if(!ready)return;
  const body=makeReportText(reportArgs);
  try{
   if(navigator.share){
    await navigator.share({title:"Mesa Marcada · "+title,text:body});
    setFeedback("Resumo preparado para compartilhar.");
   }else if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(body);
    setFeedback("Resumo copiado! Cole no WhatsApp ou onde preferir.");
   }else{
    window.prompt("Copie o relatório para compartilhar:",body);
    setFeedback("Resumo disponível para copiar.");
   }
  }catch(e){
   if(e instanceof Error&&e.name==="AbortError")return;
   setFeedback("Não foi possível compartilhar. Você pode salvar o relatório em PDF ou PNG.");
  }
 }
 function exportPdf(){
  if(!ready)return;
  try{
   if(!printFinancialReport(reportArgs))setFeedback("Permita pop-ups para salvar o PDF. A nova aba abre a opção Imprimir.");
   else setFeedback("Na janela de impressão, selecione «Salvar como PDF».");
  }catch{setFeedback("Não foi possível abrir o relatório. Verifique as permissões do navegador.");}
 }
 function exportPng(){
  if(!ready)return;
  try{saveFinancialImage(reportArgs);setFeedback("Imagem do resumo criada.");}
  catch(e){setFeedback(e instanceof Error?e.message:"Não foi possível gerar a imagem.");}
 }
 const playerName=(userId:string)=>nameFor(userId)+(userId===hostId?" · Anfitrião":"");
 return <div className="mm-night-summary">
  <section className="panel mm-night-hero">
   <div className="mm-night-kicker">{ready?"FECHAMENTO CONCILIADO":"RESUMO FINANCEIRO"}</div>
   <h2>{eventFinished?"Resumo da noite":"Resumo do evento"}</h2>
   <p>{title}. Resultados das fichas, despesas e divisão dos rachas em um só lugar.</p>
   <div className="mm-night-metrics">
    <div><small>Compras de fichas</small><strong>{asMoney(report.totalPurchasesCents)}</strong></div>
    <div><small>Valores finais</small><strong>{asMoney(report.totalReturnedCents)}</strong></div>
    <div><small>Despesas cadastradas</small><strong>{asMoney(report.totalExpensesCents)}</strong></div>
    <div><small>Valores rateados</small><strong>{asMoney(report.totalSplitCents)}</strong></div>
   </div>
   {ready&&<p className="mm-night-reconcile">✓ Caixa conciliado. Os acertos sugeridos compensam fichas e rachas sem duplicar cobranças.</p>}
   {!ready&&<div className="mm-night-warning" role="status">
     Os valores finais ainda não estão conciliados. Nenhum pagamento será sugerido até concluir a conferência.
   </div>}
   <div className="mm-night-export">
    <button type="button" className="btn gold" disabled={!ready} onClick={()=>void shareReport()}>Compartilhar resumo</button>
    <button type="button" className="btn" disabled={!ready} onClick={exportPdf}>Salvar PDF</button>
    <button type="button" className="btn" disabled={!ready} onClick={exportPng}>Salvar imagem PNG</button>
   </div>
   {feedback&&<p className="mm-night-feedback" role="status">{feedback}</p>}
   <p className="mm-night-footnote">Arquivos criados no seu navegador. O Mesa Marcada não movimenta dinheiro.</p>
  </section>

  {me&&<section className="panel mm-night-personal">
   <div className="mm-night-kicker">MEU ACERTO</div>
   <h3>{nameFor(currentUserId)}</h3>
   <div className="mm-night-personal-grid">
    <div><small>Lucro / prejuízo em fichas</small>
     <strong className={me.gameNetCents>=0?"is-positive":"is-negative"}>{signedMoney(me.gameNetCents)}</strong></div>
    <div><small>Rachas: saldo de terceiros</small>
     <strong className={me.splitNetCents>=0?"is-positive":"is-negative"}>{signedMoney(me.splitNetCents)}</strong></div>
    <div className="mm-night-total"><small>Saldo combinado</small>
     <strong className={me.combinedNetCents>=0?"is-positive":"is-negative"}>{ready?signedMoney(me.combinedNetCents):"A conciliar"}</strong></div>
   </div>
   <p>Fichas: comprou <b>{asMoney(me.purchasedCents)}</b> e terminou com <b>{asMoney(me.returnedCents)}</b>.
     Nos rachas, sua parte paga por outras pessoas é <b>{asMoney(me.owedToOthersCents)}</b>
     {me.owedByOthersCents>0&&<>; os outros participantes devem dividir <b>{asMoney(me.owedByOthersCents)}</b> de despesas que você pagou</>}.
   </p>
  </section>}

  <section className="panel mm-night-settle">
   <div className="panelhead"><h2>Acerto inteligente</h2><span className="tag">{report.transfers.length} repasses</span></div>
   <p className="mm-night-subtitle">Quem paga quem, depois de compensar os ganhos ou perdas nas fichas com os rachas.</p>
   {!ready?<p className="mm-night-warning">Fechamento incompleto. Revise o caixa para liberar os repasses.</p>:
    report.transfers.length? <div className="mm-night-transfers">
      {report.transfers.map((tr,i)=><div className="mm-night-transfer" key={tr.from+":"+tr.to+":"+i}>
       <div className="mm-night-transfer-users">
        <span className="mm-night-from">{nameFor(tr.from)} <small>paga para</small></span>
        <span className="mm-night-arrow">→</span>
        <span className="mm-night-to">{nameFor(tr.to)}</span>
       </div>
       <strong>{asMoney(tr.amountCents)}</strong>
      </div>)}
     </div>:<p className="mm-night-empty">Nenhum repasse necessário. Os saldos estão equilibrados.</p>}
   <p className="mm-night-footnote">Transferências sugeridas, sem confirmação de recebimento. Podem combinar valores de Poker/Blackjack e despesas para reduzir a quantidade de acertos.</p>
  </section>

  <section className="panel">
   <div className="panelhead"><h2>Resultado por jogador</h2><span className="tag">{report.rows.length}</span></div>
   <div className="mm-night-players">
    {report.rows.map(row=><div className="mm-night-player" key={row.userId}>
      <div>
       <strong>{playerName(row.userId)}</strong>
       <small>Comprou {asMoney(row.purchasedCents)} · terminou com {row.hasCashout?asMoney(row.returnedCents):"valor não informado"}</small>
       <small>Fichas {signedMoney(row.gameNetCents)} · Rachas {signedMoney(row.splitNetCents)} · Parte nos rachas {asMoney(row.splitShareCents)}</small>
      </div>
      <span className={row.combinedNetCents>=0?"is-positive":"is-negative"}>{ready?signedMoney(row.combinedNetCents):"—"}</span>
    </div>)}
    {!report.rows.length&&<p>Nenhum participante registrado.</p>}
   </div>
  </section>

  <section className="panel">
   <div className="panelhead"><h2>Despesas e rachas</h2><span className="tag">{expenses.length}</span></div>
   {expenses.length?expenses.map(e=>{
    const members=shares.filter(sh=>sh.expense_id===e.id);
    const payer=e.paid_by||e.created_by;
    return <div className="mm-night-expense" key={e.id}>
     <div><strong>{e.label}</strong><small>Pago por {nameFor(payer)} · {members.length} no racha</small>
      {members.length>0&&<small>{members.map(sh=>nameFor(sh.user_id)+": "+asMoney(Math.round(Number(sh.share_brl)*100))).join(" · ")}</small>}
     </div><strong>{asMoney(Math.round(Number(e.amount_brl)*100))}</strong>
    </div>;
   }):<p className="mm-night-empty">Nenhuma despesa registrada neste evento.</p>}
   {report.warnings.map((w,i)=><p className="mm-night-footnote" key={i}>{w}</p>)}
   <p className="mm-night-footnote">A parte que cada pagador consumiu não gera um pagamento para ele mesmo. Despesas sem racha não geram cobranças.</p>
  </section>
 </div>;
}
