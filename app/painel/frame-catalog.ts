export type FrameId="safira"|"dupla-coroa"|"rei-sequencia"|"high-roller"|"conclave"|"fundador";
export type FrameVariant="original"|"ciano"|"noturno";
export type FrameRarity="Rara"|"Épica"|"Lendária"|"Exclusiva";
export type FrameInfo={id:FrameId;name:string;rarity:FrameRarity;title:string;requirement:string;goal:number;unit:string;accent:string;variations:boolean};
export const FRAMES:FrameInfo[]=[
 {id:"safira",name:"Horizonte de Safira",rarity:"Rara",title:"Identidade impecável",
  requirement:"Complete foto, biografia, modalidade favorita, medalha principal e três troféus destacados no perfil.",
  goal:5,unit:"requisitos do perfil",accent:"#258bff",variations:true},
 {id:"dupla-coroa",name:"Dupla Coroa",rarity:"Lendária",title:"Reinado em duas modalidades",
  requirement:"Seja campeão do ranking final de Poker e Blackjack na mesma Liga encerrada, com saldo positivo nos dois jogos.",
  goal:1,unit:"Ligas com dupla liderança",accent:"#e6bf78",variations:false},
 {id:"rei-sequencia",name:"Rei da Sequência",rarity:"Lendária",title:"Liderança incontestável",
  requirement:"Mantenha o 1º lugar isolado do ranking acumulado de uma Liga na mesma modalidade após 6 eventos válidos consecutivos, participando de pelo menos 4 deles.",
  goal:6,unit:"eventos consecutivos",accent:"#e5b46b",variations:false},
 {id:"high-roller",name:"High Roller",rarity:"Épica",title:"Maior contribuição nas noites",
  requirement:"Seja o maior pagador de despesas compartilhadas quitadas em 5 eventos consecutivos dos quais participou, sem empates. Compras de fichas não contam.",
  goal:5,unit:"eventos consecutivos",accent:"#f58453",variations:false},
 {id:"conclave",name:"Conclave Escuro",rarity:"Épica",title:"Entre diferentes mesas",
  requirement:"Participe de ao menos um evento concluído e válido em 3 Ligas diferentes.",
  goal:3,unit:"Ligas distintas",accent:"#bb8bff",variations:false}
];
/** Not in FRAMES: exclusive recognition never contributes to earnable progression. */
export const FOUNDER_FRAME:FrameInfo={
 id:"fundador",name:"Eixo Fundação",rarity:"Exclusiva",title:"O início de tudo",
 requirement:"Concessão manual do administrador principal aos membros fundadores. Não pode ser obtida por partidas, rankings, compras ou conquistas.",
 goal:0,unit:"concessão administrativa",accent:"#258bff",variations:false
};
export const FRAME_IDS=FRAMES.map(f=>f.id);
