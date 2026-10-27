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

const importTs=async path=>{
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const classic=await importTs('lib/classic-tutorial-games.ts');
const examples=await importTs('lib/classic-tutorial-examples.ts');
const categories=[8,8,7,6,5,4,3,2,1,0];
const hands=examples.POKER_RANKS.map((r,i)=>{const h=classic.bestPokerHand(r.cards);assert.equal(h.category,categories[i]);assert.equal(h.label,r.name);return h});
for(let i=0;i<hands.length-1;i++)assert.equal(classic.comparePoker(hands[i],hands[i+1]),1);
assert.equal(classic.bestPokerHand([c(1,'spades'),c(2,'hearts'),c(3,'diamonds'),c(4,'clubs'),c(5,'hearts')]).tiebreak[0],5);
assert.equal(classic.bestPokerHand([c(13,'spades'),c(1,'hearts'),c(2,'diamonds'),c(3,'clubs'),c(4,'hearts')]).category,0);
const twoTrips=classic.bestPokerHand([c(1,'spades'),c(1,'hearts'),c(1,'diamonds'),c(13,'spades'),c(13,'hearts'),c(13,'diamonds'),c(2,'clubs')]);assert.equal(twoTrips.category,6);assert.deepEqual(twoTrips.tiebreak,[14,13]);
const threePairs=classic.bestPokerHand([c(1,'spades'),c(1,'hearts'),c(13,'spades'),c(13,'hearts'),c(12,'spades'),c(12,'hearts'),c(2,'clubs')]);assert.deepEqual(threePairs.tiebreak,[14,13,12]);
const sixFlush=classic.bestPokerHand([c(1,'hearts'),c(13,'hearts'),c(9,'hearts'),c(5,'hearts'),c(4,'hearts'),c(2,'hearts'),c(3,'clubs')]);assert.equal(sixFlush.category,5);assert.deepEqual(sixFlush.tiebreak,[14,13,9,5,4]);
for(const [i,example] of examples.POKER_EXAMPLES.entries()){
 const best=classic.bestPokerHand([...example.hole,...example.board]);assert.equal(best.indices.filter(n=>n<2).length,[2,1,0][i]);assert.equal(new Set(best.indices).size,5);
}
for(const [i,duel] of examples.POKER_DUELS.entries())assert.equal(classic.comparePoker(classic.bestPokerHand([...duel.a,...duel.board]),classic.bestPokerHand([...duel.b,...duel.board])),[1,0,-1,1][i]);
assert.throws(()=>classic.bestPokerHand([c(1,'spades')]));assert.throws(()=>classic.bestPokerHand(Array(5).fill(c(1,'spades'))));
assert.throws(()=>classic.bestPokerHand([c(1,'swords'),c(2,'hearts'),c(3,'diamonds'),c(4,'clubs'),c(5,'hearts')]));
// Adding cards cannot weaken the best five; order cannot change hand strength.
const deck=['spades','hearts','diamonds','clubs'].flatMap(suit=>Array.from({length:13},(_,i)=>c(i+1,suit)));let seed=19;
for(let run=0;run<75;run++){
 const indices=new Set();while(indices.size<7){seed=(seed*1664525+1013904223)>>>0;indices.add(seed%52)}
 const seven=[...indices].map(i=>deck[i]),best=classic.bestPokerHand(seven);
 assert.ok(classic.comparePoker(best,classic.bestPokerHand(seven.slice(0,5)))>=0);assert.equal(classic.comparePoker(best,classic.bestPokerHand(seven.slice().reverse())),0);
}
assert.equal(classic.blackjackTotal([1,6]).total,17);assert.equal(classic.blackjackTotal([1,6]).soft,true);
assert.equal(classic.blackjackTotal([1,6,9]).total,16);assert.equal(classic.blackjackTotal([1,6,9]).soft,false);
assert.equal(classic.blackjackTotal([1,1,8]).total,20);assert.equal(classic.blackjackTotal([1,1,10]).total,12);
assert.equal(classic.blackjackTotal([1,13]).natural,true);assert.equal(classic.blackjackTotal([7,7,7]).natural,false);
assert.equal(classic.blackjackTotal(Array(12).fill(1)).total,12);assert.equal(classic.blackjackTotal([13,12,2]).bust,true);
assert.throws(()=>classic.blackjackTotal([0]));assert.throws(()=>classic.blackjackTotal([14]));
assert.equal(classic.blackjackOutcome([10,10,2],[10,10,5]),'lose');assert.equal(classic.blackjackOutcome([1,13],[7,7,7]),'win');
assert.equal(classic.blackjackOutcome([7,7,7],[1,13]),'lose');assert.equal(classic.blackjackOutcome([1,13],[1,12]),'push');
assert.equal(classic.blackjackOutcome([10,8],[10,8]),'push');assert.equal(classic.blackjackOutcome([10,8],[10,6,8]),'win');
assert.equal(classic.playDealer([1,6],[4],false).hand.total,17);assert.equal(classic.playDealer([1,6],[4],true).hand.total,21);
assert.equal(classic.playDealer([1,6],[10,5],true).drawn,1);assert.equal(classic.playDealer([10,6],[],false).complete,false);
for(const example of examples.BLACKJACK_ROUNDS)for(const soft of [true,false])assert.ok(classic.playDealer(example.dealer.map(c=>c.rank),example.dealerDraws.map(c=>c.rank),soft).complete,'Every guided dealer has enough cards');
console.log('✓ Poker: ten categories, best five, zero/one/two hole cards, kickers, split pots and order invariance');
console.log('✓ Blackjack: multiple aces, naturals, bust priority and dealer S17/H17');
