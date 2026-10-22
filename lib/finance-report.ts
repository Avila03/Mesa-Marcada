/**
 * Motor financeiro puro do Mesa Marcada.
 *
 * Todas as operações são feitas em centavos inteiros. Não transfere dinheiro.
 * O caixa de fichas forma um jogo de soma zero; em cada racha, só as parcelas
 * de terceiros geram reembolso ao responsável que pagou.
 */
export type GuestInput={user_id:string};
export type PurchaseInput={user_id:string;amount_brl:number};
export type CashoutInput={user_id:string;final_brl:number};
export type ExpenseInput={id:string;label:string;amount_brl:number;created_by:string;paid_by:string|null};
export type ShareInput={expense_id:string;user_id:string;paid_by:string;share_brl:number};
export type FinanceInput={
 guests:GuestInput[];
 purchases:PurchaseInput[];
 cashouts:CashoutInput[];
 expenses:ExpenseInput[];
 shares:ShareInput[];
 finished:boolean;
};
export type FinanceRow={
 userId:string;
 purchasedCents:number;
 returnedCents:number;
 hasCashout:boolean;
 gameNetCents:number;
 splitShareCents:number;
 owedToOthersCents:number;
 owedByOthersCents:number;
 splitNetCents:number;
 combinedNetCents:number;
};
export type FinanceTransfer={from:string;to:string;amountCents:number};
export type FinanceReport={
 totalPurchasesCents:number;
 totalReturnedCents:number;
 totalExpensesCents:number;
 totalSplitCents:number;
 reimbursableCents:number;
 gameReconciled:boolean;
 settlementReady:boolean;
 warnings:string[];
 rows:FinanceRow[];
 transfers:FinanceTransfer[];
};
export function toCents(value:number):number{
 if(!Number.isFinite(value)||value<0)throw new Error("Valor financeiro inválido");
 const scaled=Math.round(value*100);
 if(!Number.isSafeInteger(scaled))throw new Error("Valor financeiro fora do limite");
 return scaled;
}
export function asMoney(cents:number):string{
 const val=(Math.abs(cents)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 return cents<0?"−"+val:val;
}
export function signedMoney(cents:number):string{
 return (cents>0?"+":"")+asMoney(cents);
}
export function calculateFinance(input:FinanceInput):FinanceReport{
 const ids=new Set(input.guests.map(g=>g.user_id));
 for(const p of input.purchases)ids.add(p.user_id);
 for(const c of input.cashouts)ids.add(c.user_id);
 for(const e of input.expenses)ids.add(e.paid_by||e.created_by);
 for(const r of input.shares){ids.add(r.user_id);ids.add(r.paid_by);}
 const totals=new Map<string,FinanceRow>();
 for(const id of ids)totals.set(id,{
  userId:id,purchasedCents:0,returnedCents:0,hasCashout:false,
  gameNetCents:0,splitShareCents:0,owedToOthersCents:0,owedByOthersCents:0,
  splitNetCents:0,combinedNetCents:0
 });
 const get=(id:string)=>{const row=totals.get(id);if(!row)throw new Error("Participante ausente");return row;};
 let totalPurchasesCents=0,totalReturnedCents=0,totalExpensesCents=0,totalSplitCents=0;
 let reimbursableCents=0;
 for(const p of input.purchases){
  const value=toCents(p.amount_brl);
  get(p.user_id).purchasedCents+=value; totalPurchasesCents+=value;
 }
 for(const c of input.cashouts){
  const value=toCents(c.final_brl),row=get(c.user_id);
  row.returnedCents+=value;row.hasCashout=true;totalReturnedCents+=value;
 }
 for(const e of input.expenses)totalExpensesCents+=toCents(e.amount_brl);
 const expenseMap=new Map(input.expenses.map(e=>[e.id,e]));
 for(const share of input.shares){
  // Não considerar parcelas órfãs de despesas removidas ou de outro evento.
  const expense=expenseMap.get(share.expense_id);
  if(!expense)continue;
  const payer=expense.paid_by||expense.created_by;
  const amount=toCents(share.share_brl);
  get(share.user_id).splitShareCents+=amount;
  totalSplitCents+=amount;
  if(payer!==share.user_id){
   get(share.user_id).owedToOthersCents+=amount;
   get(payer).owedByOthersCents+=amount;
   reimbursableCents+=amount;
  }
 }
 const cashIds=new Set(input.cashouts.map(c=>c.user_id));
 const allGuestsHaveResult=input.guests.every(g=>cashIds.has(g.user_id));
 const unmatchedCashouts=input.cashouts.some(c=>!input.guests.some(g=>g.user_id===c.user_id));
 const noChips=input.purchases.length===0&&input.cashouts.length===0;
 const gameReconciled=noChips||
   (input.guests.length>0&&allGuestsHaveResult&&!unmatchedCashouts&&
    cashIds.size===input.cashouts.length&&totalPurchasesCents===totalReturnedCents);
 const settlementReady=input.finished&&gameReconciled;
 const warnings:string[]=[];
 if(!input.finished)warnings.push("Os acertos finais serão gerados após o encerramento da partida.");
 if(!gameReconciled)warnings.push("O total de fichas não está conciliado ou faltam valores finais de jogadores.");
 // Alertar despesas sem racha; não cobrá-las de participantes arbitrários.
 const allocated=new Set(input.shares.map(r=>r.expense_id));
 if(input.expenses.some(e=>!allocated.has(e.id)))
  warnings.push("Despesas sem participantes no racha não entram nas transferências sugeridas.");
 for(const row of totals.values()){
  row.gameNetCents=row.returnedCents-row.purchasedCents;
  row.splitNetCents=row.owedByOthersCents-row.owedToOthersCents;
  row.combinedNetCents=row.gameNetCents+row.splitNetCents;
 }
 const rows=[...totals.values()].sort((a,b)=>a.userId.localeCompare(b.userId));
 const transfers:FinanceTransfer[]=[];
 if(settlementReady){
  const credits=rows.filter(r=>r.combinedNetCents>0)
    .map(r=>({id:r.userId,left:r.combinedNetCents}))
    .sort((a,b)=>b.left-a.left||a.id.localeCompare(b.id));
  const debts=rows.filter(r=>r.combinedNetCents<0)
    .map(r=>({id:r.userId,left:-r.combinedNetCents}))
    .sort((a,b)=>b.left-a.left||a.id.localeCompare(b.id));
  let i=0,j=0;
  while(i<debts.length&&j<credits.length){
   const amount=Math.min(debts[i].left,credits[j].left);
   if(amount>0)transfers.push({from:debts[i].id,to:credits[j].id,amountCents:amount});
   debts[i].left-=amount;credits[j].left-=amount;
   if(debts[i].left===0)i++;
   if(credits[j].left===0)j++;
  }
  if(i!==debts.length||j!==credits.length)
   warnings.push("Saldos não fecham; revise o registro antes de compartilhar.");
 }
 return {
  totalPurchasesCents,totalReturnedCents,totalExpensesCents,totalSplitCents,reimbursableCents,
  gameReconciled,settlementReady: settlementReady&&
   rows.reduce((sum,row)=>sum+row.combinedNetCents,0)===0,
  warnings,rows,transfers
 };
}
