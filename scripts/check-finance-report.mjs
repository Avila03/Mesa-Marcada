import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import ts from "typescript";

// Exercita a implementação real TypeScript, não uma cópia do algoritmo.
const source=readFileSync(new URL("../lib/finance-report.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {calculateFinance,toCents}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const G=(...ids)=>ids.map(user_id=>({user_id}));
const P=(user_id,amount_brl)=>({user_id,amount_brl});
const C=(user_id,final_brl)=>({user_id,final_brl});
const E=(id,paid_by,amount_brl)=>({id,label:id,created_by:paid_by,paid_by,amount_brl});
const S=(expense_id,user_id,paid_by,share_brl)=>({expense_id,user_id,paid_by,share_brl});
const saldo=(r,id)=>r.rows.find(x=>x.userId===id).combinedNetCents;

// 4 pessoas, fichas conciliadas, racha não cria ou destrói valores.
let r=calculateFinance({
 guests:G("bruno","ana","leo","bia"),
 purchases:[P("bruno",100),P("ana",100),P("leo",100),P("bia",100)],
 cashouts:[C("bruno",140),C("ana",60),C("leo",100),C("bia",100)],
 expenses:[E("pizza","ana",100)],
 shares:[S("pizza","bruno","ana",25),S("pizza","ana","ana",25),S("pizza","leo","ana",25),S("pizza","bia","ana",25)],
 finished:true
});
assert.equal(r.gameReconciled,true);
assert.equal(r.settlementReady,true);
assert.equal(r.totalPurchasesCents,40000);
assert.equal(r.totalSplitCents,10000);
assert.equal(r.reimbursableCents,7500);
assert.equal(saldo(r,"bruno"),1500); // +40 fichas -25 racha
assert.equal(saldo(r,"ana"),3500); // -40 fichas +75 de terceiros
assert.equal(saldo(r,"leo"),-2500);
assert.equal(saldo(r,"bia"),-2500);
assert.equal(r.rows.reduce((n,x)=>n+x.combinedNetCents,0),0);
assert.equal(r.transfers.reduce((n,x)=>n+x.amountCents,0),5000);
assert.equal(r.transfers.length,3);

// Nada que o próprio pagador consumiu gera reembolso para si.
assert.equal(r.rows.find(x=>x.userId==="ana").owedByOthersCents,7500);
assert.equal(r.rows.find(x=>x.userId==="ana").owedToOthersCents,0);

// Repartição com centavos e despesas sem racha (não cobrar ninguém à força).
r=calculateFinance({
 guests:G("a","b","c"),purchases:[],cashouts:[],
 expenses:[E("petisco","a",10),E("individual","b",20)],
 shares:[S("petisco","a","a",3.34),S("petisco","b","a",3.33),S("petisco","c","a",3.33)],
 finished:true
});
assert.equal(saldo(r,"a"),666);
assert.equal(saldo(r,"b"),-333);
assert.equal(saldo(r,"c"),-333);
assert.equal(r.totalExpensesCents,3000);
assert.equal(r.totalSplitCents,1000);
assert.equal(r.reimbursableCents,666);
assert.equal(r.transfers.length,2);
assert.ok(r.warnings.some(x=>x.includes("sem participantes")));

// Não sugerir pagamento antes de ter resultados ou antes de encerrar.
for(const done of [true,false]){
 r=calculateFinance({guests:G("a","b"),purchases:[P("a",12.5),P("b",12.5)],
 cashouts:[C("a",25)],expenses:[],shares:[],finished:done});
 assert.equal(r.settlementReady,false);
 assert.equal(r.transfers.length,0);
}
r=calculateFinance({guests:G("a","b"),purchases:[P("a",12.5),P("b",12.5)],
 cashouts:[C("a",25),C("b",0)],expenses:[],shares:[],finished:false});
assert.equal(r.gameReconciled,true);assert.equal(r.settlementReady,false);

// Excluir despesa órfã do cálculo, evitar perda por float.
r=calculateFinance({guests:G("a"),purchases:[],cashouts:[],expenses:[],
 shares:[S("apagada","a","b",12)],finished:true});
assert.equal(r.totalSplitCents,0);assert.equal(r.transfers.length,0);
assert.equal(toCents(0.1+0.2),30);
assert.throws(()=>toCents(-1),/inválido/);
console.log("✓ Motor financeiro: conciliação, centavos, reembolsos, compensação e bloqueios");
