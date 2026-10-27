import type {LearnCard,Suit} from './tutorial-games';
const c=(rank:number,suit:Suit):LearnCard=>({rank,suit});

export const POKER_EXAMPLES=[
 {title:'Duas cartas da sua mão',hole:[c(1,'spades'),c(12,'spades')],board:[c(10,'spades'),c(7,'diamonds'),c(13,'spades'),c(3,'hearts'),c(11,'spades')],notes:['Duas cartas privadas: ainda não há uma combinação de cinco.','Quatro espadas ainda não formam flush. Falta a quinta.','O 3 de copas não completa o jogo. A carta do river ainda pode mudar a mão.','O Valete de espadas completa A–K–Q–J–10 do mesmo naipe.']},
 {title:'Só uma carta da sua mão',hole:[c(1,'clubs'),c(2,'diamonds')],board:[c(1,'hearts'),c(1,'diamonds'),c(13,'clubs'),c(13,'spades'),c(9,'hearts')],notes:['Você tem um Ás. Observe como as cartas comunitárias vão ajudar.','Os dois ases do flop formam uma trinca com o seu.','O segundo Rei permite formar um full house.','O full house usa só seu Ás: A–A–A–K–K. O 2 fica fora.']},
 {title:'A mesa joga para todos',hole:[c(2,'clubs'),c(3,'diamonds')],board:[c(1,'spades'),c(13,'spades'),c(12,'spades'),c(11,'spades'),c(10,'spades')],notes:['Suas cartas são baixas. Ainda assim, observe o que a mesa pode formar.','Três cartas comunitárias estão abertas.','O Valete deixa quatro cartas da mesma sequência na mesa.','A mesa inteira forma royal flush. Todos os jogadores ainda na mão empatam.']}
];
export const POKER_DUELS=[
 {title:'O kicker decide',a:[c(13,'spades'),c(12,'clubs')],b:[c(11,'spades'),c(10,'clubs')],board:[c(1,'diamonds'),c(1,'hearts'),c(9,'spades'),c(5,'clubs'),c(2,'diamonds')],why:'Os dois têm um par de ases. O Rei é o primeiro kicker e supera o Valete.'},
 {title:'Royal flush na mesa',a:[c(2,'clubs'),c(3,'diamonds')],b:[c(9,'clubs'),c(9,'hearts')],board:[c(1,'spades'),c(13,'spades'),c(12,'spades'),c(11,'spades'),c(10,'spades')],why:'As mesmas cinco cartas comunitárias são a melhor mão dos dois. O par de noves particular não melhora o royal flush.'},
 {title:'O Ás pode ser baixo',a:[c(1,'diamonds'),c(9,'hearts')],b:[c(6,'diamonds'),c(12,'hearts')],board:[c(2,'clubs'),c(3,'diamonds'),c(4,'hearts'),c(5,'spades'),c(13,'clubs')],why:'A–2–3–4–5 é sequência até o 5. A sequência 2–3–4–5–6 é maior.'},
 {title:'Full house ou flush?',a:[c(13,'spades'),c(8,'clubs')],b:[c(1,'hearts'),c(12,'hearts')],board:[c(13,'hearts'),c(13,'diamonds'),c(8,'hearts'),c(7,'hearts'),c(2,'clubs')],why:'Full house supera flush, mesmo quando o flush tem um Ás.'}
];
export const POKER_RANKS=[
 {name:'Royal flush',desc:'A, K, Q, J e 10 do mesmo naipe.',cards:[c(1,'spades'),c(13,'spades'),c(12,'spades'),c(11,'spades'),c(10,'spades')]},
 {name:'Straight flush',desc:'Cinco cartas seguidas do mesmo naipe.',cards:[c(9,'hearts'),c(8,'hearts'),c(7,'hearts'),c(6,'hearts'),c(5,'hearts')]},
 {name:'Quadra',desc:'Quatro cartas do mesmo valor.',cards:[c(13,'spades'),c(13,'hearts'),c(13,'diamonds'),c(13,'clubs'),c(3,'spades')]},
 {name:'Full house',desc:'Uma trinca e um par.',cards:[c(12,'spades'),c(12,'hearts'),c(12,'diamonds'),c(8,'clubs'),c(8,'hearts')]},
 {name:'Flush',desc:'Cinco cartas do mesmo naipe, sem sequência.',cards:[c(1,'diamonds'),c(11,'diamonds'),c(8,'diamonds'),c(6,'diamonds'),c(2,'diamonds')]},
 {name:'Sequência',desc:'Cinco valores consecutivos, naipes livres.',cards:[c(9,'clubs'),c(8,'spades'),c(7,'hearts'),c(6,'diamonds'),c(5,'clubs')]},
 {name:'Trinca',desc:'Três cartas do mesmo valor.',cards:[c(7,'spades'),c(7,'hearts'),c(7,'clubs'),c(13,'diamonds'),c(2,'spades')]},
 {name:'Dois pares',desc:'Dois pares de valores distintos.',cards:[c(11,'spades'),c(11,'diamonds'),c(4,'clubs'),c(4,'hearts'),c(1,'spades')]},
 {name:'Um par',desc:'Duas cartas do mesmo valor.',cards:[c(1,'spades'),c(1,'hearts'),c(10,'diamonds'),c(7,'clubs'),c(2,'spades')]},
 {name:'Carta alta',desc:'Nenhuma das combinações anteriores.',cards:[c(1,'spades'),c(11,'diamonds'),c(9,'hearts'),c(5,'clubs'),c(2,'diamonds')]}
];
export const BLACKJACK_ROUNDS=[
 {title:'Uma compra muda o total',player:[c(10,'spades'),c(6,'diamonds')],dealer:[c(10,'hearts'),c(7,'clubs')],playerDraws:[c(5,'diamonds')],dealerDraws:[] as LearnCard[]},
 {title:'O Ás muda de valor',player:[c(1,'clubs'),c(6,'diamonds')],dealer:[c(9,'hearts'),c(7,'clubs')],playerDraws:[c(9,'spades'),c(5,'diamonds')],dealerDraws:[c(5,'spades')]},
 {title:'Estourar primeiro encerra sua mão',player:[c(10,'diamonds'),c(8,'clubs')],dealer:[c(10,'spades'),c(6,'hearts')],playerDraws:[c(5,'clubs')],dealerDraws:[c(8,'diamonds')]},
 {title:'O 17 suave do dealer',player:[c(10,'spades'),c(8,'diamonds')],dealer:[c(1,'hearts'),c(6,'clubs')],playerDraws:[c(5,'diamonds')],dealerDraws:[c(4,'spades')]},
 {title:'Natural contra natural',player:[c(1,'spades'),c(13,'diamonds')],dealer:[c(1,'hearts'),c(12,'clubs')],playerDraws:[] as LearnCard[],dealerDraws:[] as LearnCard[]}
];
