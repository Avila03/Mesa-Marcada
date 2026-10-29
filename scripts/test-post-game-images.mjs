import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import ts from 'typescript';
const require=Module.createRequire(import.meta.url),resolve=Module._resolveFilename,root=new URL('../',import.meta.url).pathname;
Module._resolveFilename=function(request,parent,...args){if(request.startsWith('@/'))request=root+request.slice(2);return resolve.call(this,request,parent,...args)};
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {shareCardImage}=require('../lib/share-card-image.ts'),{cardText,cardDimensions}=require('../lib/post-game-card.ts'),{makePostGameImage}=require('../app/painel/post-game-card-image.ts');
const file=new File(['png'],'resultado.png',{type:'image/png'});let invoked=false;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{canShare:()=>true,share:({files})=>{invoked=true;assert.equal(files[0],file);return Promise.resolve()}}});
const promise=shareCardImage(file);assert.equal(invoked,true,'Native share must start in the same click before any async work');assert.equal(await promise,'shared');
navigator.canShare=()=>false;assert.equal(await shareCardImage(file),'unsupported');navigator.canShare=()=>true;navigator.share=()=>Promise.reject(new DOMException('Cancelado','AbortError'));assert.equal(await shareCardImage(file),'cancelled');navigator.share=()=>Promise.reject(new Error('Bloqueado'));await assert.rejects(shareCardImage(file),/Bloqueado/);
const traces=[];let canvas;
const ctx=new Proxy({measureText:s=>({width:s.length*12}),createRadialGradient:()=>({addColorStop(){}}),fillText:(...args)=>traces.push(args)}, {get:(target,p)=>target[p]||(()=>{})});
globalThis.document={createElement:()=>canvas={getContext:()=>ctx,toBlob:cb=>cb(new Blob(['png'],{type:'image/png'}))}};
globalThis.Image=class{async decode(){}};
const base={title:'Final dos Amigos',game:'poker',variant:'five_card_draw',starts_at:'2026-10-29T01:00:00Z',participants:4,winner_label:'Destaque em saldo',winner_names:['Bruno'],lines:[],confirmed:true,awards:[],league:null};
assert.ok(cardText(base).date.includes('28'),'Date is rendered in Sao Paulo, not UTC');assert.equal(cardText({...base,winner_names:[],confirmed:false}).winners,'Resultado não disponível');
for(const game of ['poker','blackjack','truco','canastra','pontinho','uno','pife'])for(const format of ['compact','story']){
 traces.length=0;const data={...base,game,lines:game==='poker'||game==='blackjack'?[]:[{label:'Nome longo de participante para conferir o ajuste',value:5,winner:true}],teams:['truco','canastra'].includes(game)?[{label:'Equipe Azul',names:['Bruno','Rafael'],score:24,winner:true},{label:'Equipe Vermelha',names:['Pedro','Lucas'],score:18,winner:false}]:[],awards:[{medal_id:'draw_poker',level_index:0,player_name:'Bruno'}]};
 const png=await makePostGameImage(data,format);assert.equal(png.type,'image/png');assert.equal(canvas.width,cardDimensions(format).width);assert.equal(canvas.height,cardDimensions(format).height);assert.ok(traces.some(t=>String(t[0]).includes('Final'.toUpperCase())));assert.ok(traces.every(t=>!String(t[0]).includes('R$')));
 if(data.teams.length)assert.ok(traces.some(t=>t[0]==='Bruno & Rafael'));
}
console.log('✓ Card render paths: all seven games in both formats; names, teams, date, unavailable results, native activation, cancellation and fallback');
