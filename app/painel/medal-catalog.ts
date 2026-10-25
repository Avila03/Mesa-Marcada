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
  description:"Vença um evento encerrado com saldo líquido positivo.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#e4b966",unit:"vitórias"},
 {id:"collector",symbol:"🏆",title:"Colecionador",summary:"Vitórias no mesmo jogo",
  description:"Acumule 5, 15, 30 ou 50 vitórias na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#efbf69",unit:"vitórias"},
 {id:"podium",symbol:"🥉",title:"Frequentador do Pódio",summary:"Entre os três melhores",
  description:"Alcance o Top 3 em eventos com pelo menos quatro competidores, na mesma modalidade.",group:"Desempenho",levels:bronze(5,15,30,50),color:"#c89671",unit:"pódios"},
 {id:"shark",symbol:"🦈",title:"Tubarão",summary:"Alto aproveitamento",
  description:"Bronze: pelo menos 60% de vitórias em 10 eventos. Prata: 70% em 20. Ouro: 75% em 40, sempre na mesma modalidade.",group:"Desempenho",levels:bronze(10,20,40),color:"#78bce8",unit:"eventos qualificados"},
 {id:"positive",symbol:"💰",title:"Saldo Positivo",summary:"Mais noites no positivo",
  description:"Encerre 10, 25, 50 ou 100 eventos com saldo positivo em fichas.",group:"Desempenho",levels:bronze(10,25,50,100),color:"#77c89f",unit:"noites positivas"},
 {id:"record",symbol:"💎",title:"Recordista Pessoal",summary:"Superou a própria marca",
  description:"A partir da terceira participação, supere seu recorde pessoal positivo de saldo líquido em uma noite.",group:"Desempenho",levels:[{name:"Especial",threshold:1}],color:"#9badff",unit:"recordes"},
 {id:"veteran",symbol:"🎲",title:"Veterano",summary:"Muitas noites na história",
  description:"Participe de 10, 30, 75 ou 150 eventos com resultados conferidos.",group:"Participação",levels:bronze(10,30,75,150),color:"#bd9cf0",unit:"eventos"},
 {id:"loyal",symbol:"🤝",title:"Fiel à Liga",summary:"Presença na mesma Liga",
  description:"Participe de 10, 25 ou 50 eventos de uma mesma Liga.",group:"Liga",levels:bronze(10,25,50),color:"#88bdc8",unit:"eventos na Liga"},
 {id:"poker",symbol:"♠",title:"Especialista em Poker",summary:"Noites na mesa de Poker",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Poker.",group:"Participação",levels:bronze(10,25,50,100),color:"#7bb7ff",unit:"eventos de Poker"},
 {id:"blackjack",symbol:"♦",title:"Especialista em Blackjack",summary:"Noites na mesa de Blackjack",
  description:"Participe de 10, 25, 50 ou 100 eventos válidos de Blackjack.",group:"Participação",levels:bronze(10,25,50,100),color:"#ff8490",unit:"eventos de Blackjack"},
 {id:"versatile",symbol:"🃏",title:"Jogador Versátil",summary:"Domina duas modalidades",
  description:"Participe de 5, 15 ou 30 eventos em cada modalidade e mantenha saldo acumulado positivo nas duas.",group:"Participação",levels:bronze(5,15,30),color:"#aca1ef",unit:"noites em cada jogo"},
 {id:"champ",symbol:"👑",title:"Campeão da Liga",summary:"Conquistou uma Liga",
  description:"Vença a classificação final de Poker ou Blackjack de uma Liga encerrada, com saldo positivo.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#f3ca74",unit:"títulos"},
 {id:"multi",symbol:"🏆",title:"Multicampeão",summary:"Coleciona títulos de Liga",
  description:"Vença em duas, três ou cinco Ligas distintas já encerradas.",group:"Liga",levels:bronze(2,3,5),color:"#dfb56d",unit:"Ligas campeãs"},
 {id:"pioneer",symbol:"💠",title:"Pioneiro",summary:"Estava no começo da Liga",
  description:"Participe do primeiro evento válido e concluído de uma Liga.",group:"Liga",levels:[{name:"Especial",threshold:1}],color:"#8dbde8",unit:"primeiros eventos"},
 {id:"host",symbol:"🎩",title:"Anfitrião Experiente",summary:"Fez a noite acontecer",
  description:"Organize 5, 15, 30 ou 60 eventos concluídos com pelo menos dois jogadores.",group:"Organização",levels:bronze(5,15,30,60),color:"#c7a4ec",unit:"eventos organizados"}
];
