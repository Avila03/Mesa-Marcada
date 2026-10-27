// Shared lightweight catalog used by both gallery and player popovers.
export type Tier={name:string;threshold:number};
export type Medal={
 id:string;symbol:string;title:string;summary:string;description:string;
 group:"Desempenho"|"Participação"|"Liga"|"Organização";
 levels:Tier[];color:string;unit:string;
};
const bronze=(a:number,b:number,c:number,d?:number):Tier[]=>[
 {name:"Bronze",threshold:a},{name:"Prata",threshold:b},{name:"Ouro",threshold:c},
 ...(d?[{name:"Diamante",threshold:d}]:[])
];
export const MEDALS:Medal[]=[
 {id:"first",symbol:"🏅",title:"Primeira Vitória",summary:"Venceu sua primeira noite",
  description:"Vença um evento conferido. Em Poker/Blackjack, exige a liderança com saldo positivo.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#e4b966",unit:"vitórias"},
 {id:"collector",symbol:"🏆",title:"Colecionador",summary:"Vitórias no mesmo jogo",
  description:"Acumule 5, 15, 30 ou 50 vitórias na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#efbf69",unit:"vitórias"},
 {id:"podium",symbol:"🥉",title:"Frequentador do Pódio",summary:"Entre os três melhores",
  description:"Alcance o Top 3 em eventos de Poker ou Blackjack com pelo menos quatro competidores, na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#c89671",unit:"pódios"},
 {id:"shark",symbol:"🦈",title:"Tubarão",summary:"Alto aproveitamento",
  description:"Bronze: pelo menos 60% de vitórias em 10 eventos. Prata: 70% em 20. Ouro: 75% em 40, sempre na mesma modalidade.",group:"Desempenho",levels:bronze(10,20,40),color:"#78bce8",unit:"eventos qualificados"},
 {id:"positive",symbol:"💰",title:"Saldo Positivo",summary:"Mais noites no positivo",
  description:"Encerre 10, 25, 50 ou 100 eventos de Poker ou Blackjack com saldo positivo.",group:"Desempenho",levels:bronze(10,25,50,100),color:"#77c89f",unit:"noites positivas"},
 {id:"record",symbol:"💎",title:"Recordista Pessoal",summary:"Superou a própria marca",
  description:"Em Poker ou Blackjack, a partir da terceira participação, supere seu recorde pessoal positivo de saldo líquido.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#9badff",unit:"recordes"},
 {id:"veteran",symbol:"🎲",title:"Veterano",summary:"Muitas noites na história",
  description:"Participe de 10, 30, 75 ou 150 eventos com resultados conferidos, entre todas as modalidades.",group:"Participação",levels:bronze(10,30,75,150),color:"#bd9cf0",unit:"eventos"},
 {id:"loyal",symbol:"🤝",title:"Fiel à Liga",summary:"Presença na mesma Liga",
  description:"Participe de 10, 25 ou 50 eventos de uma mesma Liga.",group:"Liga",levels:bronze(10,25,50),color:"#88bdc8",unit:"eventos na Liga"},
 {id:"poker",symbol:"♠",title:"Especialista em Poker",summary:"Noites na mesa de Poker",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Poker.",group:"Participação",levels:bronze(10,25,50,100),color:"#7bb7ff",unit:"eventos de Poker"},
 {id:"blackjack",symbol:"♦",title:"Especialista em Blackjack",summary:"Noites na mesa de Blackjack",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Blackjack.",group:"Participação",levels:bronze(10,25,50,100),color:"#ff8490",unit:"eventos de Blackjack"},
 {id:"versatile",symbol:"🃏",title:"Jogador Versátil",summary:"Domina duas modalidades",
  description:"Participe de 5, 15 ou 30 eventos de Poker e também de Blackjack, com saldo acumulado positivo nas duas mesas.",group:"Participação",levels:bronze(5,15,30),color:"#aca1ef",unit:"noites em cada jogo"},
 {id:"champ",symbol:"👑",title:"Campeão da Liga",summary:"Conquistou uma Liga",
  description:"Vença a classificação final de Poker ou Blackjack de uma Liga encerrada, com saldo positivo.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#f3ca74",unit:"títulos"},
 {id:"multi",symbol:"🏆",title:"Multicampeão",summary:"Coleciona títulos de Liga",
  description:"Vença em duas, três ou cinco Ligas distintas já encerradas.",group:"Liga",levels:bronze(2,3,5),color:"#dfb56d",unit:"Ligas campeãs"},
 {id:"pioneer",symbol:"💠",title:"Pioneiro",summary:"Estava no começo da Liga",
  description:"Participe do primeiro evento válido e concluído de uma Liga.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#8dbde8",unit:"primeiros eventos"},
 {id:"host",symbol:"🎩",title:"Anfitrião Experiente",summary:"Fez a noite acontecer",
  description:"Organize 5, 15, 30 ou 60 eventos concluídos com pelo menos dois jogadores.",group:"Organização",levels:bronze(5,15,30,60),color:"#c7a4ec",unit:"eventos organizados"}
 ,...([
  ['truco','Voz da Mesa','Truco','#82bbff'],['canastra','Parceiro de Canastra','Canastra / Buraco','#9fd0ed'],
  ['pontinho','Fôlego de Mesa','Pontinho','#c7b4e8'],['uno','Uma Carta Só','UNO','#ff9caa'],['pife','Mão Bem Feita','Pife','#ff9da8']
 ] as const).map(([game,title,name,color]):Medal=>({id:game,symbol:'♣',title,summary:'Presença em '+name,description:'Conclua 3, 10, 25 ou 50 eventos conferidos de '+name+'.',group:'Participação',levels:bronze(3,10,25,50),color,unit:'eventos'})),
 ...([
  ['truco','Dono do Tento','Truco','#82bbff'],['canastra','Parceria Vitoriosa','Canastra / Buraco','#9fd0ed'],
  ['pontinho','Último de Pé','Pontinho','#c7b4e8'],['uno','Última Carta, Vitória','UNO','#ff9caa'],['pife','Bateu, Levou','Pife','#ff9da8']
 ] as const).map(([game,title,name,color]):Medal=>({id:game+'_wins',symbol:'🏆',title,summary:'Vitórias em '+name,description:'Vença 1, 5, 15 ou 30 partidas encerradas de '+name+'. Em equipes, cada parceiro vencedor recebe o progresso.',group:'Desempenho',levels:bronze(1,5,15,30),color,unit:'vitórias'})),
 {id:"explorer",symbol:"✦",title:"Explorador de Mesas",summary:"Conheça outras modalidades",description:"Conclua eventos válidos em 3, 5 ou nas 7 modalidades do site.",group:"Participação",levels:bronze(3,5,7),color:"#a1c8f7",unit:"modalidades"},
 {id:"truco_routes",symbol:"♣",title:"Três Jeitos de Trucar",summary:"Gaudério, Paulista e Mineiro",description:"Conclua eventos em duas e depois nas três variantes do Truco.",group:"Participação",levels:[{name:"Prata",threshold:2},{name:"Ouro",threshold:3}],color:"#8ec3ff",unit:"variantes"},
 {id:"canastra_routes",symbol:"♦",title:"Caminhos da Canastra",summary:"Canastra e os dois Buracos",description:"Conclua eventos em duas e depois nas três variantes de Canastra/Buraco.",group:"Participação",levels:[{name:"Prata",threshold:2},{name:"Ouro",threshold:3}],color:"#abd8ee",unit:"variantes"},
 {id:"duo_wins",symbol:"🤝",title:"Sintonia de Dupla",summary:"Vitórias em parceria",description:"Vença 3, 10, 25 ou 50 partidas de Truco ou Canastra/Buraco em equipes com pelo menos dois parceiros por lado.",group:"Desempenho",levels:bronze(3,10,25,50),color:"#a3bfff",unit:"vitórias em equipe"},
 {id:"draw_poker",symbol:"↻",title:"Mestre da Troca",summary:"Noites de Five Card Draw",description:"Conclua 1, 5, 15 ou 30 eventos conferidos de Five Card Draw (Poker fechado).",group:"Participação",levels:bronze(1,5,15,30),color:"#83bbff",unit:"eventos de Poker fechado"},
 {id:"league_cards",symbol:"👑",title:"Campeão das Novas Mesas",summary:"Primeiro no fim da Liga",description:"Lidere a classificação arquivada de uma das novas modalidades em 1, 3 ou 5 classificações de Ligas encerradas, com ao menos uma vitória.",group:"Liga",levels:bronze(1,3,5),color:"#e9bf79",unit:"classificações vencidas"}

];
