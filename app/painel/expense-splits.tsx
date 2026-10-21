"use client";

import type {ReactNode} from "react";
import type {Expense} from "@/lib/mesa-types";
import {money} from "@/lib/mesa-types";
import {PlayerAvatar} from "./v09-features";

export type ExpenseSplitRow={
  expense_id:string;
  session_id:string;
  user_id:string;
  paid_by:string;
  label:string;
  category:string;
  amount_brl:number;
  share_brl:number;
  joined_at:string;
};
export type ExpenseSettlement={expense_id:string;session_id:string;user_id:string;confirmed_at:string};
export type MyExpenseSplitRow=Omit<ExpenseSplitRow,"joined_at">&{
  event_title:string;
};
const categories:Record<string,string>={food:"Comida",drinks:"Bebidas",materials:"Materiais",other:"Outros"};

export function ExpenseSplitsPanel({
  expenses,shares,settlements,userId,canJoin,canManage,scheduled,busy,
  nameFor,photoUrls,onJoin,onToggleOpen,onDelete,onSettle,createForm
}:{
  expenses:Expense[];
  shares:ExpenseSplitRow[];
  settlements:ExpenseSettlement[];
  userId:string;
  canJoin:boolean;
  canManage:boolean;
  scheduled:boolean;
  busy:boolean;
  nameFor:(id:string)=>string;
  photoUrls:Record<string,string>;
  onJoin:(expenseId:string,join:boolean)=>void;
  onToggleOpen:(expenseId:string,open:boolean)=>void;
  onDelete:(expenseId:string)=>void;
  onSettle:(expenseId:string,memberId:string,settled:boolean)=>void;
  createForm:ReactNode;
}){
  const openCount=expenses.filter(e=>e.split_open).length;
  const joinedCount=shares.filter(row=>row.user_id===userId).length;
  const totalCents=shares.reduce((t,row)=>t+Math.round(Number(row.share_brl)*100),0);
  const settledKeys=new Set(settlements.map(x=>x.expense_id+":"+x.user_id));
  const outstanding=shares.filter(x=>x.user_id!==x.paid_by&&!settledKeys.has(x.expense_id+":"+x.user_id))
    .reduce((sum,x)=>sum+Math.round(Number(x.share_brl)*100),0);
  return <div className="mm-split-view">
    <header className="mm-split-view-header">
      <div><div className="eyebrow">CONTA DA NOITE</div><h2>Gastos e rachas</h2>
        <p>Escolha apenas as despesas que você deseja dividir. Quem não participar de um racha não recebe cobrança.</p></div>
    </header>
    <div className="mm-split-overview">
      <div><small>Gastos cadastrados</small><strong>{expenses.length}</strong></div>
      <div><small>Rachas abertos</small><strong>{openCount}</strong></div>
      <div><small>Você participa</small><strong>{joinedCount}</strong></div>
      <div><small>Valor pendente</small><strong>{money(outstanding/100)}</strong></div>
    </div>
    {createForm}
    <div className="mm-section-title"><h2>Despesas da noite</h2><span className="tag">{expenses.length} registradas</span></div>
    <div className="mm-split-list">
      {expenses.map(expense=>{
        const selected=shares.filter(row=>row.expense_id===expense.id);
        const isJoined=selected.some(row=>row.user_id===userId);
        const ownShare=selected.find(row=>row.user_id===userId);
        const payer=expense.paid_by||expense.created_by;
        const active=Boolean(expense.split_open&&scheduled);
        const totalShare=selected.reduce((sum,row)=>sum+Math.round(Number(row.share_brl)*100),0)/100;
        const whoCanEdit=canManage||expense.created_by===userId;
        return <section className={"mm-split-card "+(!active?"mm-split-card-closed":"")} key={expense.id}>
          <div className="mm-split-card-top">
            <div className="mm-split-card-title">
              <span className="mm-split-category">{categories[expense.category]||"Outros"}</span>
              <h3>{expense.label}</h3>
              <p>Pago por <strong>{nameFor(payer)}</strong></p>
            </div>
            <div className="mm-split-card-price"><small>Gasto total</small><strong>{money(expense.amount_brl)}</strong></div>
          </div>
          <div className="mm-split-card-rate">
            <span>{selected.length} {selected.length===1?"pessoa no racha":"pessoas no racha"}</span>
            <span>{expense.split_open&&scheduled?"● Aberto para dividir":"✓ Racha fechado"}</span>
          </div>
          {selected.length>0?<div className="mm-split-members">
            {selected.map(member=><div className="mm-split-member" key={member.user_id}>
              <PlayerAvatar name={nameFor(member.user_id)} photoUrl={photoUrls[member.user_id]}/>
              <span>{nameFor(member.user_id)}{member.user_id===payer?" · pagou":" "}</span>
              <div className="mm-split-payment">
                <strong>{money(member.share_brl)}</strong>
                {member.user_id!==payer?
                  <small className={settledKeys.has(expense.id+":"+member.user_id)?"mm-v09-good":"mm-v09-pending"}>
                    {settledKeys.has(expense.id+":"+member.user_id)?"✓ Acertado":"● Pendente"}
                  </small>:<small className="mm-v09-good">✓ Pagou a despesa</small>}
                {payer===userId&&member.user_id!==userId&&<button type="button" className="mm-split-settle-btn"
                    disabled={busy} onClick={()=>onSettle(expense.id,member.user_id,!settledKeys.has(expense.id+":"+member.user_id))}>
                    {settledKeys.has(expense.id+":"+member.user_id)?"Reabrir":"Confirmar recebido"}
                  </button>}
              </div>
            </div>)}
          </div>:<p className="mm-split-empty">Ainda ninguém entrou nesse racha. Nenhuma dívida foi criada.</p>}
          {selected.length>0&&<p className="mm-split-sum">Total rateado: {money(totalShare)}. Os centavos são distribuídos para a soma fechar exatamente.</p>}
          {ownShare&&payer!==userId&&<div className="mm-split-own-share">Sua parte: <strong>{money(ownShare.share_brl)}</strong> para {nameFor(payer)}</div>}
          {ownShare&&payer===userId&&<div className="mm-split-own-share">Sua parte neste racha: <strong>{money(ownShare.share_brl)}</strong> (você já pagou a despesa).</div>}
          <div className="mm-split-actions">
            {canJoin&&active&&<button className={"btn "+(isJoined?"mm-split-unjoin":"gold")} type="button"
              disabled={busy} onClick={()=>onJoin(expense.id,!isJoined)}>
              {isJoined?"✓ Estou no racha · Sair":"＋ Participar do racha"}
            </button>}
            {whoCanEdit&&scheduled&&<button className="btn mm-split-manage" type="button"
              disabled={busy} onClick={()=>onToggleOpen(expense.id,!expense.split_open)}>
              {expense.split_open?"Fechar racha":"Reabrir racha"}
            </button>}
            {expense.created_by===userId&&scheduled&&<button className="mm-v09-delete-entry" type="button"
              disabled={busy} onClick={()=>onDelete(expense.id)}>Excluir gasto</button>}
          </div>
          {!canJoin&&expense.split_open&&scheduled&&<p className="mm-formfoot">Confirme presença para escolher participar deste racha.</p>}
        </section>;
      })}
      {!expenses.length&&<div className="panel mm-empty"><h3>Nenhuma despesa cadastrada</h3>
        <p>O Anfitrião ou os participantes podem registrar comida, bebida ou outros gastos. Cada pessoa decide em quais divisões vai entrar.</p>
      </div>}
    </div>
    <p className="mm-formfoot">As divisões e os acertos são registros informativos: quem pagou confirma recebimentos realizados fora do aplicativo. Nenhum dinheiro é transferido pelo Mesa Marcada.</p>
  </div>;
}

export function MySplitsSummary({
  splits,settlements,userId,nameFor,onOpenEvent,onSettle
}:{
  splits:MyExpenseSplitRow[];
  settlements:ExpenseSettlement[];
  userId:string;
  nameFor:(id:string)=>string;
  onOpenEvent:(eventId:string)=>void;
  onSettle:(expenseId:string,memberId:string,settled:boolean)=>void;
}){
  const settledKeys=new Set(settlements.map(x=>x.expense_id+":"+x.user_id));
  const toPay=splits.filter(row=>row.user_id===userId&&row.paid_by!==userId
    &&!settledKeys.has(row.expense_id+":"+row.user_id));
  const receivable=splits.filter(row=>row.paid_by===userId&&row.user_id!==userId
    &&!settledKeys.has(row.expense_id+":"+row.user_id));
  const settledCount=splits.filter(row=>row.user_id!==row.paid_by
    &&settledKeys.has(row.expense_id+":"+row.user_id)).length;
  const payCents=toPay.reduce((sum,row)=>sum+Math.round(Number(row.share_brl)*100),0);
  const receiveCents=receivable.reduce((sum,row)=>sum+Math.round(Number(row.share_brl)*100),0);
  const peopleOwed=new Set(toPay.map(row=>row.paid_by)).size;
  return <section className="mm-profile-debts">
    <div className="mm-section-title"><h2>Meus rachas</h2></div>
    <p className="mm-formfoot">Pendências de comida, bebidas e demais gastos dos quais você escolheu participar. Quem pagou confirma o recebimento para dar baixa.</p>
    {settledCount>0&&<p className="mm-split-ok">✓ {settledCount} {settledCount===1?"parcela já acertada":"parcelas já acertadas"} não entram nos valores pendentes.</p>
    <div className="mm-split-overview mm-profile-split-summary">
      <div><small>Você deve a outras pessoas</small><strong>{money(payCents/100)}</strong>
        <span>{peopleOwed} {peopleOwed===1?"pessoa":"pessoas"}</span></div>
      <div><small>Outros devem a você</small><strong>{money(receiveCents/100)}</strong>
        <span>Gastos que você pagou</span></div>
    </div>
    <div className="mm-profile-debt-columns">
      <section className="panel">
        <h3>A pagar</h3>
        {toPay.length>0?toPay.map(row=><button type="button" className="mm-profile-debt-line" key={row.expense_id}
          onClick={()=>onOpenEvent(row.session_id)}>
          <span><strong>{row.label}</strong><small>{row.event_title} · para {nameFor(row.paid_by)}</small></span>
          <strong className="mm-v09-pending">{money(row.share_brl)}</strong>
        </button>):<p className="mm-formfoot">Você não entrou em nenhum racha que precisa acertar com outra pessoa.</p>}
      </section>
      <section className="panel">
        <h3>A receber</h3>
        {receivable.length>0?receivable.map(row=><div className="mm-profile-debt-settle" key={row.expense_id+row.user_id}>
          <button type="button" className="mm-profile-debt-line" onClick={()=>onOpenEvent(row.session_id)}>
            <span><strong>{row.label}</strong><small>{row.event_title} · de {nameFor(row.user_id)}</small></span>
            <strong className="mm-v09-pending">{money(row.share_brl)}</strong>
          </button>
          <button type="button" className="btn mm-split-settle-btn"
            onClick={()=>onSettle(row.expense_id,row.user_id,true)}>✓ Confirmar recebimento</button>
        </div>):<p className="mm-formfoot">Não há valores pendentes de outras pessoas.</p>}
      </section>
    </div>
    <p className="mm-formfoot">Apenas a pessoa que pagou pode confirmar o acerto. Alterar os participantes de um racha reabre as confirmações anteriores para manter os valores corretos.</p>
  </section>;
}
