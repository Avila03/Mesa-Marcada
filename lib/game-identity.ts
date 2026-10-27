import type {Game} from './games';

/** A recognizable detail from each game, inside the shared Dark Cards identity. */
export const GAME_IDENTITY:Record<Game,{detail:string;signature:string;lesson:string;facts:readonly [string,string,string]}>={
 poker:{detail:'Texas Hold’em · a melhor mão de cinco',signature:'A força da sua mão',lesson:'Das primeiras cartas ao showdown',facts:['2 cartas na mão','5 na mesa','Melhores 5']},
 blackjack:{detail:'Ás + dez · o caminho até 21',signature:'O valor de cada decisão',lesson:'Chegue perto de 21',facts:['Contra o dealer','Ás vale 1 ou 11','Sem passar de 21']},
 truco:{detail:'Espadão, manilhas e o peso de cada tento',signature:'Carta forte. Voz firme.',lesson:'Conheça a força antes de pedir truco',facts:['3 cartas por jogador','Até 3 vazas','3 variantes']},
 canastra:{detail:'Sete cartas. Uma canastra. A parceria decide.',signature:'A sétima carta muda tudo',lesson:'Da primeira sequência à batida final',facts:['11 cartas na mão','Morto de 11','Limpa ou suja']},
 pontinho:{detail:'Cada carta que sobra pesa no seu saldo',signature:'Quem fica, vence',lesson:'Forme jogos e proteja seus pontos',facts:['9 cartas na mão','Saldo inicial 100','Sem reentrada']},
 uno:{detail:'Cores, reviravoltas e uma última carta',signature:'Uma carta muda a rodada',lesson:'Combine a carta e escolha sua jogada',facts:['7 cartas na mão','2 a 10 jogadores','Meta padrão 500']},
 pife:{detail:'Trincas e sequências até a batida',signature:'Nove cartas. Tudo encaixado.',lesson:'Encontre a carta que completa sua mão',facts:['9 cartas na mão','Sem curinga','Trincas e sequências']}
};
