import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const js=ts.transpileModule(read("lib/mutations.ts"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {runMutation}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const receipts=new Map();let writes=0,lost=true;const requests=[];
const db={rpc:async(_kind,args)=>{
 const id=args.p_request_id;requests.push(id);
 if(!receipts.has(id))receipts.set(id,"row-"+(++writes));
 if(lost){lost=false;return {data:null,error:{message:"Resposta perdida após commit"}}}
 return {data:receipts.get(id),error:null};
}};
await assert.rejects(runMutation(db,"user-a","record_chip_purchase_once",{event:"a",quantities:[20,0,0,0,0]}));
assert.equal(await runMutation(db,"user-a","record_chip_purchase_once",{event:"a",quantities:[20,0,0,0,0]}),"row-1");
assert.equal(requests[0],requests[1]);assert.equal(writes,1);
await runMutation(db,"user-a","record_chip_purchase_once",{event:"a",quantities:[20,0,0,0,0]});assert.equal(writes,2,"A new confirmed purchase must remain possible");
const source=read("app/painel/mobile-first.tsx"),ast=ts.createSourceFile("page.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let after;
const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==="afterSaved")after=n;ts.forEachChild(n,visit)};visit(ast);
const messages=[];
const afterJs=ts.transpileModule("const check=("+after.getText(ast)+");check",{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const afterSaved=vm.runInNewContext(afterJs,{setMessage:m=>messages.push(m),refreshScope:async()=>{throw new Error("offline")}});
await afterSaved("chips","Compra registrada!");assert.ok(messages.at(-1).includes("não repita"));
assert.ok(source.includes('db.rpc("get_event_snapshot"')&&source.includes('db.rpc("get_club_catalog"'));
assert.ok(!source.includes('fullDataRequested.current=true'));
assert.ok(read("app/painel/use-club-realtime.ts").includes('results[i].status==="rejected"'));
for(const route of ["recuperar-senha","redefinir-senha"])assert.ok(read("app/"+route+"/page.tsx").includes("getSupabase"));
console.log("✓ Lost-response idempotency, committed-write feedback, atomic snapshots and recovery routes");
