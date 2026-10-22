import type {FinanceReport,ExpenseInput,ShareInput} from "@/lib/finance-report";
import {asMoney,signedMoney} from "@/lib/finance-report";

export type ExportArgs={
 title:string;
 venue:string;
 when:string;
 game:string;
 report:FinanceReport;
 expenses:ExpenseInput[];
 shares:ShareInput[];
 nameFor:(id:string)=>string;
};
const escapeHtml=(text:string)=>text.replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]||c));
const shortDate=(value:string)=>{
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"":date.toLocaleString("pt-BR",{dateStyle:"medium",timeStyle:"short"});
};
export function makeReportText(args:ExportArgs):string{
 const {report:r}=args;
 const lines=[
 "🂡 MESA MARCADA · RESUMO DA NOITE",
 args.title, [args.game,shortDate(args.when)].filter(Boolean).join(" · "),
 "",
 "Compras em fichas: "+asMoney(r.totalPurchasesCents),
 "Valores finais: "+asMoney(r.totalReturnedCents),
 "Despesas cadastradas: "+asMoney(r.totalExpensesCents),
 "Total rateado: "+asMoney(r.totalSplitCents),
 "",
 "RESULTADO POR PARTICIPANTE",
 ...r.rows.map(row=>args.nameFor(row.userId)+": fichas "+
  signedMoney(row.gameNetCents)+" · rachas "+signedMoney(row.splitNetCents)+
  " · saldo "+signedMoney(row.combinedNetCents)),
 "",
 "ACERTOS SUGERIDOS",
 ...(r.transfers.length?r.transfers.map(row=>args.nameFor(row.from)+" → "+
 args.nameFor(row.to)+": "+asMoney(row.amountCents)):["Nenhum repasse necessário"]),
 "",
 "Registro informativo: pagamentos são feitos fora do Mesa Marcada."
 ];
 return lines.join("\n");
}

export function printFinancialReport(args:ExportArgs):boolean{
 const tab=window.open("","_blank");
 if(!tab)return false;
 const {report:r}=args;
 const esc=(value:string)=>escapeHtml(value);
 const playerRows=r.rows.map(row=>`<tr><td>${esc(args.nameFor(row.userId))}</td>
 <td>${asMoney(row.purchasedCents)}</td><td>${asMoney(row.returnedCents)}</td>
 <td>${signedMoney(row.gameNetCents)}</td>
 <td>${signedMoney(row.splitNetCents)}</td>
 <td class="${row.combinedNetCents>=0?"plus":"minus"}">${signedMoney(row.combinedNetCents)}</td></tr>`).join("");
 const transferRows=r.transfers.map(tr=>`<tr><td>${esc(args.nameFor(tr.from))}</td>
 <td>${esc(args.nameFor(tr.to))}</td><td>${asMoney(tr.amountCents)}</td></tr>`).join("");
 const expenses=args.expenses.map(e=>{
   const payer=e.paid_by||e.created_by;
   const rows=args.shares.filter(s=>s.expense_id===e.id);
   return `<tr><td>${esc(e.label)}</td><td>${esc(args.nameFor(payer))}</td>
     <td>${asMoney(Math.round(Number(e.amount_brl)*100))}</td>
     <td>${rows.length?esc(rows.map(row=>args.nameFor(row.user_id)+": "+
       asMoney(Math.round(Number(row.share_brl)*100))).join(" · ")):"Sem racha"}</td></tr>`;
 }).join("");
 const html=`<!DOCTYPE html><html lang="pt-BR"><head>
 <meta charset="UTF-8"/><title>${esc("Mesa Marcada · "+args.title)}</title>
 <style>
 @page{size:A4;margin:16mm}
 *{box-sizing:border-box}
 body{font:12px Arial,Helvetica,sans-serif;color:#172436;margin:0}
 header{background:#080a0e;color:#f1f5fb;padding:20px 22px;border-bottom:5px solid #258bff}
 h1{margin:8px 0;font-size:26px;line-height:1.15}
 .brand{font-weight:800;letter-spacing:2px;font-size:11px}
 .brand .blue{color:#258bff}.brand .red{color:#ff424d}
 .meta{color:#c4d8ea;font-size:11px}
 h2{font-size:16px;margin:24px 0 8px;color:#12314d;page-break-after:avoid}
 .totals{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
 .totals>div{background:#edf4fa;padding:12px 9px;border:1px solid #d5e2ef}
 .totals small{display:block;color:#607488;margin-bottom:8px;font-size:10px}
 .totals strong{font-size:15px}
 table{width:100%;border-collapse:collapse;table-layout:fixed}
 th,td{border-bottom:1px solid #d9e4ed;padding:8px 5px;text-align:left;overflow-wrap:anywhere}
 th{font-size:10px;background:#edf4fb;color:#315471}
 td{font-size:10px}
 tr{page-break-inside:avoid}
 .plus{color:#158052;font-weight:bold}.minus{color:#c53848;font-weight:bold}
 .note{background:#eef5fc;border-left:3px solid #258bff;padding:11px;font-size:11px;line-height:1.6}
 footer{font-size:10px;color:#6a7e91;padding:20px 0;margin-top:14px;border-top:1px solid #d6e1ec}
 @media screen{body{max-width:900px;margin:25px auto;box-shadow:0 10px 45px #0002}
 .print{position:fixed;top:15px;right:18px;border:0;background:#258bff;color:white;
 border-radius:8px;font-weight:700;padding:10px 16px;cursor:pointer}}
 @media print{.print{display:none!important}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body>
 <button class="print" onclick="window.print()">Imprimir / Salvar como PDF</button>
 <header><div class="brand">MESA <span class="blue">MAR</span><span class="red">CADA</span></div>
 <h1>${esc(args.title)}</h1>
 <div class="meta">${esc(args.game)} · ${esc(shortDate(args.when))} · ${esc(args.venue)}</div></header>
 <div class="totals">
 <div><small>Fichas compradas</small><strong>${asMoney(r.totalPurchasesCents)}</strong></div>
 <div><small>Valor final</small><strong>${asMoney(r.totalReturnedCents)}</strong></div>
 <div><small>Despesas totais</small><strong>${asMoney(r.totalExpensesCents)}</strong></div>
 <div><small>Rachas distribuídos</small><strong>${asMoney(r.totalSplitCents)}</strong></div></div>
 <h2>Resultado individual</h2>
 <table><thead><tr><th>Jogador</th><th>Comprou</th><th>Terminou</th><th>Fichas</th><th>Rachas</th><th>Saldo</th></tr></thead>
 <tbody>${playerRows}</tbody></table>
 <h2>Acerto inteligente: quem paga quem</h2>
 ${r.transfers.length?`<table><thead><tr><th>De</th><th>Para</th><th>Valor</th></tr></thead><tbody>${transferRows}</tbody></table>`:
 '<p class="note">Nenhuma transferência necessária.</p>'}
 <h2>Detalhamento das despesas</h2>
 ${args.expenses.length?`<table><thead><tr><th>Despesa</th><th>Quem pagou</th><th>Valor</th><th>Divisão</th></tr></thead><tbody>${expenses}</tbody></table>`:
 '<p class="note">Nenhuma despesa registrada.</p>'}
 <footer>Documento gerado pelo Mesa Marcada. Valores informativos; nenhum pagamento é
 realizado ou confirmado pelo aplicativo. Fichas e rachas foram compensados
 para evitar cobranças duplicadas.</footer>
 </body></html>`;
 tab.document.open();tab.document.write(html);tab.document.close();
 tab.focus();
 // O botão de imprimir fica disponível caso o navegador bloqueie o disparo.
 tab.setTimeout(()=>tab.print(),350);
 return true;
}

export function saveFinancialImage(args:ExportArgs):void{
 const report=args.report;
 const width=1200,margin=80;
 const playerCount=report.rows.length;
 const transferCount=report.transfers.length;
 const visibleExpenses=args.expenses.slice(0,35);
 const height=790+playerCount*65+transferCount*66+visibleExpenses.length*47+
   (args.expenses.length>35?48:0);
 const canvas=document.createElement("canvas");
 const scale=2;canvas.width=width*scale;canvas.height=height*scale;
 const ctx=canvas.getContext("2d");
 if(!ctx)throw new Error("O navegador não oferece exportação em imagem.");
 ctx.scale(scale,scale);
 ctx.fillStyle="#080a0e";ctx.fillRect(0,0,width,height);
 const gradient=ctx.createLinearGradient(0,0,width,0);gradient.addColorStop(0,"#258bff");
 gradient.addColorStop(.57,"#258bff");gradient.addColorStop(1,"#ff424d");
 ctx.fillStyle=gradient;ctx.fillRect(0,0,width,8);
 const text=(value:string,x:number,y:number,size=23,color="#e8f2ff",bold=false)=>{
  ctx.fillStyle=color;ctx.font=(bold?"700 ":"500 ")+size+"px Arial, sans-serif";
  ctx.fillText(value,x,y);
 };
 const line=(y:number)=>{ctx.strokeStyle="#314153";ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke()};
 const section=(name:string,y:number)=>{text(name.toUpperCase(),margin,y,17,"#68adff",true)};
 text("MESA MARCADA",margin,77,27,"#8abfff",true);
 text(args.title.slice(0,52),margin,150,47,"#f1f5fb",true);
 text([args.game,shortDate(args.when),args.venue].filter(Boolean).join(" · ").slice(0,100),
  margin,194,21,"#9fb6cc");
 const metric=[["FICHAS",report.totalPurchasesCents],["VALORES FINAIS",report.totalReturnedCents],
  ["DESPESAS",report.totalExpensesCents],["RACHAS",report.totalSplitCents]];
 metric.forEach(([label,amount],idx)=>{
  const x=margin+idx*267;
  ctx.fillStyle="#122135";ctx.fillRect(x,235,250,107);
  text(String(label),x+14,265,14,"#a3bad1",true);
  text(asMoney(Number(amount)),x+14,313,24,"#f1f5fb",true);
 });
 let y=402;section("Resultado individual",y);y+=35;line(y);y+=18;
 for(const row of report.rows){
  text(args.nameFor(row.userId).slice(0,25),margin,y+14,22,"#edf4fc",true);
  text("Fichas "+signedMoney(row.gameNetCents)+"  |  Rachas "+signedMoney(row.splitNetCents),
   margin+340,y+14,17,"#afc1d5");
  text(signedMoney(row.combinedNetCents),width-margin-210,y+14,20,
    row.combinedNetCents>=0?"#6ce1b1":"#ff868f",true);
  y+=65;line(y-15);
 }
 y+=35;section("Acerto inteligente: quem paga quem",y);y+=40;
 if(!report.transfers.length){text("Não há transferências necessárias.",margin,y,21,"#b4c8dc");y+=64;}
 else for(const tr of report.transfers){
  text(args.nameFor(tr.from).slice(0,21)+"  →  "+args.nameFor(tr.to).slice(0,21),margin,y,23,"#f1f5fb");
  text(asMoney(tr.amountCents),width-margin-235,y,23,"#6ce1b1",true);y+=66;
 }
 y+=22;section("Despesas da noite",y);y+=38;
 if(!visibleExpenses.length){text("Nenhuma despesa registrada.",margin,y,21,"#b4c8dc");y+=47;}
 for(const expense of visibleExpenses){
  text(expense.label.slice(0,47),margin,y,20,"#f1f5fb");
  text(asMoney(Math.round(expense.amount_brl*100)),width-margin-225,y,20,"#a9ccf4");
  y+=47;
 }
 if(args.expenses.length>35){text("e mais "+(args.expenses.length-35)+" despesas.",margin,y,18,"#c5d1df");y+=48;}
 line(y+15);
 text("Resumo informativo · Sem cobranças ou transferências pelo aplicativo.",margin,y+54,17,"#92a9bd");
 const link=document.createElement("a");
 link.href=canvas.toDataURL("image/png");
 link.download="mesa-marcada-resumo-"+Date.now()+".png";
 document.body.appendChild(link);link.click();link.remove();
}
