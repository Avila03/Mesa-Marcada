import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/tutorial-games.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const rules=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const c=(rank,suit)=>({rank,suit});

assert.equal(rules.compareTruco(c(1,'swords'),c(1,'bastos'),'gauderio'),1);
assert.equal(rules.compareTruco(c(3,'cups'),c(3,'bastos'),'gauderio'),0);
assert.equal(rules.compareTruco(c(4,'clubs'),c(7,'hearts'),'mineiro'),1);
assert.equal(rules.compareTruco(c(7,'diamonds'),c(1,'spades'),'mineiro'),-1);
// The very same duel changes outcome when the vira changes.
assert.equal(rules.compareTruco(c(11,'clubs'),c(3,'spades'),'paulista',12),1);
assert.equal(rules.compareTruco(c(11,'clubs'),c(3,'spades'),'paulista',4),-1);
assert.equal(rules.compareTruco(c(4,'clubs'),c(4,'hearts'),'paulista',3),1);
assert.deepEqual(rules.envido([c(5,'swords'),c(7,'swords'),c(12,'bastos')]),{points:32,flor:null});
assert.deepEqual(rules.envido([c(5,'swords'),c(7,'swords'),c(12,'swords')]),{points:32,flor:32});
assert.equal(rules.envido([c(7,'cups'),c(12,'bastos'),c(11,'coins')]).points,7);

assert.equal(rules.canFinishCanastra('buraco_aberto',0,1,true),false);
assert.equal(rules.canFinishCanastra('buraco_fechado',0,1,true),true);
assert.equal(rules.canFinishCanastra('canastra',1,0,false),false);
assert.equal(rules.canastraScore({cards:320,clean:1,dirty:0,hands:40,morto:true,batida:true}),580);
assert.equal(rules.canastraScore({cards:320,clean:0,dirty:1,hands:40,morto:false,batida:false}),280);
const remaining=[c(13,'spades'),c(1,'hearts'),c(7,'diamonds')];
assert.deepEqual(rules.pontinhoBalance(25,remaining),{loss:32,balance:-7,eliminated:true});
assert.deepEqual(rules.pontinhoBalance(25,remaining,true),{loss:0,balance:25,eliminated:false});
assert.equal(rules.pontinhoBalance(32,remaining).eliminated,true);

const top={color:'blue',value:'7'},four={color:'wild',value:'+4'},blue={color:'blue',value:'2'},red={color:'red',value:'7'};
assert.equal(rules.canPlayUno(four,top,[four,blue,red]),false);
assert.equal(rules.canPlayUno(four,top,[four,red]),true);
assert.equal(rules.canPlayUno(red,top,[red]),true);
assert.equal(rules.canPlayUno({color:'green',value:'9'},top,[]),false);
assert.equal(rules.canPlayUno({color:'wild',value:'wild'},top,[blue]),true);
assert.equal(rules.unoValue(four),50);assert.equal(rules.unoValue({color:'blue',value:'reverse'}),20);

const hand=[c(7,'hearts'),c(8,'hearts'),c(9,'hearts'),c(13,'clubs'),c(13,'diamonds'),c(13,'spades'),c(4,'spades'),c(5,'spades'),c(12,'diamonds')];
assert.equal(rules.pifeGroups(hand),null);
const won=[...hand.slice(0,8),c(6,'spades')];const groups=rules.pifeGroups(won);
assert.equal(groups.length,3);assert.equal(new Set(groups.flat()).size,9);
assert.equal(rules.pifeGroups([...hand,c(6,'spades')]),null);
assert.equal(rules.pifeGroups([...hand.slice(1),c(6,'spades')]),null);
assert.equal(rules.isMeld([c(12,'hearts'),c(13,'hearts'),c(1,'hearts')]),true);
assert.equal(rules.isMeld([c(13,'hearts'),c(1,'hearts'),c(2,'hearts')]),false);
assert.equal(rules.isMeld([c(7,'spades'),c(7,'spades'),c(7,'hearts')]),false);
console.log('✓ Tutorial rules: vira and fixed manilhas, envido/flor, clean/dirty closing, elimination, UNO +4 and exact Pife combinations');
