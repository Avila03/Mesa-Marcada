import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';

const require=Module.createRequire(import.meta.url),resolve=Module._resolveFilename,root=new URL('../',import.meta.url).pathname;
Module._resolveFilename=function(request,parent,...args){if(request.startsWith('@/'))request=root+request.slice(2);return resolve.call(this,request,parent,...args)};
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {leagueCardModes,leagueFinalCard,leagueCardMetrics,leagueCardDate,rankScorePlayers,rankFinancialPlayers}=require('../lib/league-final-card.ts');
const {makeLeagueFinalImage}=require('../app/painel/league-final-card-image.ts');
const {GAME_META}=require('../lib/games.ts');
const scorePlayers=[{user_id:'a',name:'Bruno',played:18,wins:12},{user_id:'b',name:'Rafael',played:18,wins:10},{user_id:'c',name:'Pedro',played:18,wins:9}];
const financialPlayers=scorePlayers.map((p,i)=>({user_id:p.user_id,name:p.name,played:6,net_chips:987654-i*1000000}));
const summary={version:3,league_name:'Liga dos Amigos',started_at:'2026-01-01',finished_at:'2026-11-01T01:00:00Z',members:6,events_total:20,events_finished:18,events_cancelled:2,events:[],
 games:{poker:{events:6,ranking:financialPlayers},blackjack:{events:6,ranking:financialPlayers}},
 score_games:Object.entries(GAME_META).filter(([game])=>!['poker','blackjack'].includes(game)).flatMap(([game,meta])=>meta.variants.map(variant=>({game,variant,ranking:scorePlayers})))
};
const before=JSON.stringify(summary),modes=leagueCardModes(summary);
assert.equal(modes.length,11,'Every archived game and score variant has its own card');
assert.equal(JSON.stringify(summary),before,'Preparing a card never changes the archive');
const truco=modes.find(m=>m.id==='truco:gauderio');
assert.deepEqual(leagueCardMetrics(leagueFinalCard(summary,truco)),[{value:'18',label:'PARTIDAS'},{value:'12',label:'VITÓRIAS'},{value:'67%',label:'APROVEITAMENTO'}]);
assert.deepEqual(leagueCardMetrics(leagueFinalCard(summary,modes[0])),[{value:'6',label:'RESULTADOS'},{value:'3',label:'JOGADORES'},{value:'6',label:'EVENTOS'}]);
assert.ok(!JSON.stringify(leagueFinalCard(summary,modes[0])).includes('987654'),'Financial values do not enter the image model');
assert.ok(leagueCardDate(summary.finished_at).includes('31'),'The closing date uses Sao Paulo time');
assert.deepEqual(leagueCardModes({...summary,finished_at:''}),[]);
assert.deepEqual(leagueCardModes({...summary,games:{poker:{ranking:[]},blackjack:{ranking:[]}},score_games:[]}),[],'A league without results has no fabricated champion');
assert.equal(leagueCardModes({...summary,version:1,score_games:undefined}).length,2,'Historical financial archives remain supported');
assert.deepEqual(leagueCardModes({...summary,games:{},score_games:[{game:'pife',variant:'pife',ranking:[{user_id:'a',name:'Bruno',played:0,wins:0}]}]}),[]);
assert.deepEqual(leagueCardModes({...summary,games:{},score_games:[{game:'pife',variant:'pife',ranking:[{user_id:'a',name:'Bruno',played:3,wins:0}]}]}),[],'No victory means no score-game champion');
assert.deepEqual(rankScorePlayers([{...scorePlayers[0],played:24},{...scorePlayers[1],wins:12,played:18},scorePlayers[2]]).map(p=>p.user_id),['b','a','c'],'Win rate is the second criterion');
assert.deepEqual(rankFinancialPlayers([{...financialPlayers[0],played:2},{...financialPlayers[1],net_chips:987654,played:3}]).map(p=>p.user_id),['b','a'],'Financial ties use the archived participation criterion');
const tiedSummary={...summary,games:{},score_games:[{game:'truco',variant:'gauderio',ranking:[scorePlayers[0],{...scorePlayers[0],user_id:'b',name:'Rafael'},scorePlayers[2]]}]};
const tied=leagueCardModes(tiedSummary)[0];assert.deepEqual(tied.players.map(p=>p.rank),[1,1,3]);
const selected=leagueFinalCard(tiedSummary,tied,'b');assert.equal(selected.championsCount,2);assert.equal(selected.featured.name,'Rafael');
assert.throws(()=>leagueFinalCard(tiedSummary,tied,'c'),/campeões/,'Only an actual champion may be featured');

const traces=[];let canvas,drawn=[];
const gradient={addColorStop(){}};
const ctx=new Proxy({measureText:s=>({width:Array.from(s).length*14}),createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,fillText:(...args)=>traces.push(args),drawImage:img=>drawn.push(img.src)},{get:(target,p)=>target[p]||(()=>{})});
globalThis.document={createElement:()=>canvas={getContext:()=>ctx,toBlob:cb=>cb(new Blob(['png'],{type:'image/png'}))}};
globalThis.Image=class{async decode(){}};
const crest='<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
for(const mode of modes)for(const format of ['compact','story']){
 traces.length=0;drawn=[];
 const card=leagueFinalCard(summary,mode),blob=await makeLeagueFinalImage(card,format,crest);
 assert.equal(blob.type,'image/png');assert.equal(canvas.width,1080);assert.equal(canvas.height,format==='story'?1920:1350);
 assert.ok(traces.some(t=>t[0]==='BRUNO'));assert.ok(traces.some(t=>t[0]==='LIGA DOS AMIGOS'));
 assert.ok(traces.some(t=>t[0]==='CLASSIFICAÇÃO FINAL ARQUIVADA'));
 assert.ok(traces.every(t=>!String(t[0]).includes('R$')&&!String(t[0]).includes('987654')));
 const footer=traces.find(t=>t[0]==='CLASSIFICAÇÃO FINAL ARQUIVADA');assert.ok(footer[2]>0&&footer[2]<canvas.height,'The archive footer stays inside the image');
 assert.ok(drawn.includes('/icons/monogram.svg'));assert.ok(drawn.some(src=>src.includes(encodeURIComponent(crest))),'Use the exact league crest');
}
traces.length=0;await makeLeagueFinalImage(selected,'compact',crest);
assert.ok(traces.some(t=>t[0]==='RAFAEL'));assert.ok(traces.some(t=>t[0]==='COCAMPEÃO DA LIGA'));
assert.ok(traces.some(t=>t[0]==='TÍTULO COMPARTILHADO · 2 JOGADORES'));
const sixTied={...selected,championsCount:6,players:Array.from({length:6},(_,i)=>({...selected.featured,id:String(i),name:'Campeão '+i,rank:1}))};
traces.length=0;await makeLeagueFinalImage(sixTied,'compact',crest);
assert.ok(traces.some(t=>String(t[0]).includes('+3 jogador(es) empatado(s)')),'A cropped podium must disclose the other tied players');
const {shareCardImage}=require('../lib/share-card-image.ts');let invoked=false;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:({title})=>{invoked=true;assert.equal(title,'Mesa Marcada · encerramento da liga');return Promise.resolve()}}});
const sharing=shareCardImage(new File(['png'],'liga.png'),'Mesa Marcada · encerramento da liga');
assert.equal(invoked,true,'League sharing preserves user activation');assert.equal(await sharing,'shared');
console.log('✓ League cards: 11 archived modes × 2 formats, actual stats/crest, historical and empty archives, tiebreakers/shared titles, privacy and native sharing');
