import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const moduleOf=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const games=await moduleOf('lib/games.ts');
assert.equal(games.ALL_GAMES.length,7);assert.equal(games.ALL_GAMES.filter(g=>g==='truco').length,1);
assert.deepEqual(games.GAME_META.truco.variants,['gauderio','paulista','mineiro']);assert.deepEqual(games.TRUCO_STAKES.mineiro,[2,4,6,10,12]);
for(const game of games.ALL_GAMES.filter(g=>!games.isChipGame(g)))for(const variant of games.GAME_META[game].variants){assert.ok(games.GAME_RULES[variant]?.steps.length>=3);assert.ok(games.defaultTarget(game,variant)>0)}
const {scoreRequest,submitScoreRequest}=await moduleOf('lib/score-command.ts');
const request=scoreRequest('event-id',0,'pife_round',{winner:0}),receipts=new Map();let writes=0,lost=true;
const db={rpc:async(_name,args)=>{assert.equal(args.p_expected_revision,0);if(!receipts.has(args.p_request_id)){receipts.set(args.p_request_id,args.p_request_id);writes++}if(lost){lost=false;return {data:null,error:{message:'Resposta perdida',code:''}}}return {data:receipts.get(args.p_request_id),error:null}}};
await assert.rejects(submitScoreRequest(db,request));
// Reload + a newer background snapshot must not rebuild the pending command.
const restored=JSON.parse(JSON.stringify(request));await submitScoreRequest(db,restored);assert.equal(writes,1);assert.equal(restored.p_request_id,request.p_request_id);
const panel=read('app/painel/score-games.tsx');assert.ok(panel.includes('pendingRef.current||scoreRequest'));assert.ok(panel.includes('remember(null)'));assert.ok(panel.includes('sessionStorage.setItem'));assert.ok(panel.includes('p_expected_revision'));
const main=read('app/painel/mobile-first.tsx');assert.ok(main.includes('selectedPoints&&'));assert.ok(main.includes('!selectedPoints&&'));assert.ok(main.includes('ALL_GAMES.map'));
console.log('✓ Seven tables, variant rules, goal metadata and durable retry across lost response/reload');
