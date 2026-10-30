import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const require=Module.createRequire(import.meta.url);require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {drawBalancedTeams,rematchForm}=require('../lib/table-setup.ts'),{submitTableOrder}=require('../lib/table-order.ts');
for(const n of [2,4,6]){
 const players=Array.from({length:n},(_,i)=>'user-'+i),before=[...players];
 for(let i=0;i<25;i++){const result=drawBalancedTeams(players);assert.deepEqual(Object.keys(result).sort(),players.slice().sort());assert.equal(Object.values(result).filter(v=>v===0).length,n/2);assert.equal(Object.values(result).filter(v=>v===1).length,n/2)}
 assert.deepEqual(players,before,'Draw does not reorder the seats');
}
assert.throws(()=>drawBalancedTeams(['a','a']),/distintos/);assert.throws(()=>drawBalancedTeams(['a','b','c']),/par/);assert.throws(()=>drawBalancedTeams(['a','b'],()=>7),/inválido/);
const event={id:'old-event',room_id:'room',organizer_id:'old-host',title:'Noite de amigos',starts_at:'2026-01-01',location:'Endereço da mesa',max_participants:4,min_entry_brl:20,league_id:'league',visibility:'public',game_variant:null,score_target:null,chip_pricing_special:true,chip_price_1_brl:2,chip_price_5_brl:10,chip_price_10_brl:.2,chip_price_25_brl:.5,chip_price_50_brl:1};
const independent=rematchForm(event,'poker',[]);assert.equal(independent.starts_at,'');assert.equal(independent.game_variant,'texas_holdem');assert.equal(independent.league_id,'');assert.equal(independent.visibility,'private','An inaccessible source league must not become a public standalone event');assert.equal(independent.chip_price_10_brl,'0.2');assert.ok(!('id' in independent));assert.ok(!('organizer_id' in independent));assert.ok(!('status' in independent));assert.ok(!('participants' in independent));
assert.equal(rematchForm(event,'poker',['league']).league_id,'league');
for(const [game,variant,target] of [['truco','mineiro',12],['canastra','buraco_fechado',3000],['uno','uno_classico',500],['pontinho','pontinho',100],['pife','pife',5],['poker','five_card_draw',null]]){const copy=rematchForm({...event,game_variant:variant,score_target:target},game,['league']);assert.equal(copy.game_variant,variant);assert.equal(copy.score_target,String(target||0))}
const request={p_request_id:'request',p_event_id:'event',p_revision:3,p_action:'advance',p_dealer:null,p_starter:null,p_direction:1};let sent;
await submitTableOrder({rpc:async(name,args)=>{assert.equal(name,'table_order_command');sent=args;return {data:'event',error:null}}},request);assert.equal(sent,request);
await assert.rejects(submitTableOrder({rpc:async()=>({data:null,error:{message:'Mudou em outro aparelho',code:'P0001'}})},request),e=>e.code==='P0001');await assert.rejects(submitTableOrder({rpc:async()=>({data:null,error:null})},request),/mesma tentativa/);
console.log('✓ Table setup: balanced secure draws, unchanged seats, rematch privacy/settings/new date and exact replay payloads');
