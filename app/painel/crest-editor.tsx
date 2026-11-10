"use client";

import {useId,useMemo,useState} from "react";
import type {ReactNode} from "react";

type ShapeId="shield"|"circle"|"hex"|"card";
export type CrestFinish="minimal"|"classic"|"premium";
const FINISHES:{id:CrestFinish;name:string;description:string}[]=[
 {id:"minimal",name:"Minimalista",description:"Chapado, limpo, sem brilho"},
 {id:"classic",name:"Clássico",description:"Ornamentos e tradição"},
 {id:"premium",name:"Premium",description:"Metal e brilho elétrico"}
];
const finishName=(id:CrestFinish)=>FINISHES.find(f=>f.id===id)?.name||"Premium";
type Accent={name:string;hex:string;soft:string};
const COLORS:Accent[]=[
 {name:"Azul elétrico",hex:"#258BFF",soft:"#73BDFF"},
 {name:"Vermelho cassino",hex:"#FF424D",soft:"#FFA2A7"},
 {name:"Dourado",hex:"#D9AB54",soft:"#FFE3A4"},
 {name:"Verde mesa",hex:"#27B781",soft:"#93F0CB"},
 {name:"Roxo real",hex:"#9D72F9",soft:"#D6C2FF"},
 {name:"Prata",hex:"#AAB9D0",soft:"#F1F5FB"}
];
const SHAPES:{id:ShapeId;name:string;path:string;inset:string}[]=[
 {id:"shield",name:"Escudo",path:"M180 20 L326 91 V230 C325 309 270 361 180 399 C90 361 35 309 34 230 V91Z",inset:"M180 43 L304 104 V227 C303 289 258 340 180 374 C102 340 57 289 56 227 V104Z"},
 {id:"circle",name:"Círculo",path:"M180 28 A169 169 0 1 1 179.9 28 Z",inset:"M180 51 A146 146 0 1 1 179.9 51 Z"},
 {id:"hex",name:"Hexágono",path:"M180 23 L323 107 V313 L180 398 L37 313 V107Z",inset:"M180 49 L301 120 V300 L180 372 L59 300 V120Z"},
 {id:"card",name:"Carta",path:"M72 23 H288 Q322 23 322 57 V363 Q322 397 288 397 H72 Q38 397 38 363 V57 Q38 23 72 23Z",inset:"M75 46 H285 Q300 46 300 61 V359 Q300 374 285 374 H75 Q60 374 60 359 V61 Q60 46 75 46Z"}
];
const SYMBOLS=[
 {id:"joker",name:"Coringa",group:"Personagens"},
 {id:"two-jokers",name:"Dois coringas",group:"Personagens"},
 {id:"dealer",name:"Dealer",group:"Personagens"},
 {id:"crown",name:"Coroa real",group:"Personagens"},
 {id:"spade",name:"Espadas",group:"Naipes e cartas"},
 {id:"heart",name:"Copas",group:"Naipes e cartas"},
 {id:"diamond",name:"Ouros",group:"Naipes e cartas"},
 {id:"club",name:"Paus",group:"Naipes e cartas"},
 {id:"ace",name:"Ás",group:"Naipes e cartas"},
 {id:"two-aces",name:"Par de ases",group:"Naipes e cartas"},
 {id:"cards",name:"Cartas",group:"Naipes e cartas"},
 {id:"deck",name:"Baralho",group:"Naipes e cartas"},
 {id:"royal",name:"Royal flush",group:"Jogadas"},
 {id:"straight",name:"Sequência",group:"Jogadas"},
 {id:"flush",name:"Flush",group:"Jogadas"},
 {id:"full-house",name:"Full house",group:"Jogadas"},
 {id:"four-kind",name:"Quadra",group:"Jogadas"},
 {id:"all-in",name:"All-in",group:"Jogadas"},
 {id:"blackjack",name:"Blackjack",group:"Jogadas"},
 {id:"twenty-one",name:"Vinte e um",group:"Jogadas"},
 {id:"chip",name:"Ficha",group:"Cassino"},
 {id:"chip-stack",name:"Fichas empilhadas",group:"Cassino"},
 {id:"die",name:"Dado",group:"Cassino"},
 {id:"dice",name:"Par de dados",group:"Cassino"},
 {id:"roulette",name:"Roleta",group:"Cassino"},
 {id:"roulette-ball",name:"Bola da roleta",group:"Cassino"},
 {id:"poker-table",name:"Mesa de poker",group:"Cassino"}
] as const;
type SymbolId=(typeof SYMBOLS)[number]["id"];
const GROUPS=["Todos","Personagens","Naipes e cartas","Jogadas","Cassino"];
const shapeFor=(id:ShapeId)=>SHAPES.find(shape=>shape.id===id)||SHAPES[0];

function CardShape({x=0,y=0,r=0,label="A",suit="♠"}:{x?:number;y?:number;r?:number;label?:string;suit?:string}){
 return <g transform={"translate("+x+" "+y+") rotate("+r+")"}>
  <rect x="-24" y="-39" width="48" height="78" rx="6" fill="#0C1420" stroke="currentColor" strokeWidth="3"/>
  <text x="-15" y="-15" fontSize="19" fontWeight="900" fill="currentColor" stroke="none">{label}</text>
  <text x="1" y="17" textAnchor="middle" fontSize="27" fill="currentColor" stroke="none">{suit}</text>
 </g>;
}
function Chip({x=0,y=0,r=41,accent}:{x?:number;y?:number;r?:number;accent:string}){
 return <g transform={"translate("+x+" "+y+")"}>
  <circle r={r} fill="#111A27" stroke="currentColor" strokeWidth="5"/>
  <circle r={r-8} fill="none" stroke={accent} strokeWidth="8" strokeDasharray="14 9"/>
  <circle r={r-20} fill="#151C28" stroke="currentColor" strokeWidth="2"/>
  <path d="M-10 0H10M0-10V10" stroke={accent} strokeWidth="4" strokeLinecap="round"/>
 </g>;
}
function Die({x=0,y=0,r=0}:{x?:number;y?:number;r?:number}){
 return <g transform={"translate("+x+" "+y+") rotate("+r+")"}>
  <rect x="-31" y="-31" width="62" height="62" rx="11" fill="#152134" stroke="currentColor" strokeWidth="4"/>
  {[[-17,-17],[17,-17],[0,0],[-17,17],[17,17]].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="5.2" fill="currentColor"/>)}
 </g>;
}
function Joker({accent,double=false}:{accent:string;double?:boolean}){
 return <g transform={double?"scale(.73)":"scale(1)"}>
   <path d="M-69-24 Q-72-88-36-68 Q-15-60 0-29 Q16-72 49-68 Q75-64 70-16 L53-19 Q45-42 25-33 L8-14 Q-7-38-30-39 Q-50-42-48-18Z" fill={accent} stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/>
   <circle cx="-66" cy="-22" r="10" fill="#F1F5FB"/><circle cx="69" cy="-15" r="10" fill="#F1F5FB"/>
   <path d="M-47-17 L0-3 L47-17 L40 43 L0 65 L-40 43Z" fill="#F1F5FB" stroke="#111927" strokeWidth="4"/>
   <path d="M0-2L47-17 40 43 0 65Z" fill={accent} opacity=".83"/>
   <path d="M-35 11L-7 20 -24 29ZM35 11L7 20 24 29Z" fill="#07101B"/>
   <path d="M-20 40Q0 55 20 40L12 51Q0 61-12 51Z" fill="#09131F"/>
   <path d="M0-4V56" stroke="#0B1421" strokeWidth="3" opacity=".35"/>
 </g>;
}
function SymbolArt({id,accent}:{id:SymbolId;accent:string}):ReactNode{
 const suits:{[key:string]:string}={spade:"♠",heart:"♥",diamond:"♦",club:"♣"};
 if(id==="joker")return <Joker accent={accent}/>;
 if(id==="two-jokers")return <><g transform="translate(-32 3) rotate(-15)"><Joker accent={accent} double/></g><g transform="translate(32 3) rotate(15)"><Joker accent={accent} double/></g></>;
 if(id==="dealer")return <><path d="M-55 49L-43-2 -20-28 0-13 20-28 43-2 55 49Z" fill="#172436" stroke="currentColor" strokeWidth="4"/><circle cy="-41" r="29" fill="#E8EEF9"/><path d="M-35-44Q-23-86 0-72Q33-87 35-44Q0-56-35-44Z" fill={accent}/><path d="M-19-17L0-2 19-17M0-2V28" stroke={accent} strokeWidth="5"/></>;
 if(id==="crown")return <><path d="M-65-40L-41 2 -13-57 0-12 32-60 45 1 66-40 52 46H-52Z" fill="#152237" stroke="currentColor" strokeWidth="5" strokeLinejoin="round"/><path d="M-49 23H49" stroke={accent} strokeWidth="8"/><circle cx="-13" cy="-18" r="5" fill={accent}/><circle cx="32" cy="-19" r="5" fill={accent}/></>;
 if(suits[id])return <text y="42" textAnchor="middle" fontSize="143" fontFamily="Georgia,serif" fontWeight="900" fill={accent} stroke="#E5EEF9" strokeWidth="1.4">{suits[id]}</text>;
 if(id==="ace")return <><CardShape label="A" suit="♠"/><text x="0" y="52" textAnchor="middle" fontSize="26" fill={accent} stroke="none">ACE</text></>;
 if(id==="two-aces")return <><CardShape x={-27} y={4} r={-13} label="A" suit="♠"/><CardShape x={27} y={4} r={13} label="A" suit="♥"/></>;
 if(id==="cards")return <><CardShape x={-31} y={7} r={-20} label="K" suit="♠"/><CardShape x={4} y={-4} r={0} label="Q" suit="♥"/><CardShape x={37} y={7} r={20} label="J" suit="♦"/></>;
 if(id==="deck")return <><rect x="-45" y="-38" width="83" height="100" rx="7" fill="#132035" stroke="currentColor" strokeWidth="3"/><rect x="-32" y="-50" width="83" height="100" rx="7" fill="#09131E" stroke={accent} strokeWidth="3"/><path d="M9-24L29 0 9 24-11 0Z" fill={accent}/></>;
 if(["royal","straight","flush","full-house","four-kind"].includes(id)){
  const decks:{[key:string]:string[]}={royal:["10","J","Q","K","A"],straight:["5","6","7","8","9"],flush:["2","5","8","J","K"],"full-house":["Q","Q","Q","A","A"],"four-kind":["K","K","K","K","3"]};
  return <>{(decks[id]||[]).map((label,i)=><g key={i} transform={"translate("+((i-2)*25)+" "+(i%2===0?2:-5)+") scale(.76)"}><CardShape label={label} suit={id==="flush"||id==="royal"?"♠":["♠","♥","♦","♣"][i%4]}/></g>)}</>;
 }
 if(id==="all-in")return <><Chip x={-33} y={13} r={27} accent={accent}/><Chip x={27} y={13} r={27} accent={accent}/><Chip x={0} y={-28} r={29} accent={accent}/><text y="64" textAnchor="middle" fontSize="22" fontWeight="900" fill="currentColor" stroke="none">ALL IN</text></>;
 if(id==="blackjack")return <><CardShape x={-19} r={-14} label="A" suit="♠"/><CardShape x={29} r={14} label="K" suit="♥"/><text x="0" y="67" textAnchor="middle" fontWeight="900" fontSize="28" fill={accent} stroke="none">21</text></>;
 if(id==="twenty-one")return <><circle r="58" fill="#132033" stroke="currentColor" strokeWidth="4"/><text x="0" y="22" textAnchor="middle" fontSize="73" fontWeight="900" fill={accent} stroke="none">21</text></>;
 if(id==="chip")return <Chip accent={accent} r={56}/>;
 if(id==="chip-stack")return <><ellipse cx="-12" cy="34" rx="52" ry="20" fill="#121D2D" stroke="currentColor" strokeWidth="4"/>{[15,-4,-23].map((y,i)=><g key={i}><rect x="-64" y={y} width="104" height="24" rx="5" fill="#12243A" stroke={accent} strokeWidth="3"/><ellipse cx="-12" cy={y} rx="52" ry="18" fill="#162638" stroke="currentColor" strokeWidth="3"/></g>)}</>;
 if(id==="die")return <Die/>;
 if(id==="dice")return <><Die x={-27} y={-15} r={-18}/><Die x={31} y={22} r={14}/></>;
 if(id==="roulette"||id==="roulette-ball")return <><circle r="58" fill="#111E30" stroke="currentColor" strokeWidth="5"/><circle r="43" fill="none" stroke={accent} strokeWidth="15" strokeDasharray="19 12"/><circle r="27" fill="#0D1726" stroke="currentColor" strokeWidth="4"/><path d="M0-27V27M-27 0H27" stroke={accent} strokeWidth="3"/><circle r="8" fill="#E8F3FF"/>{id==="roulette-ball"&&<circle cx="47" cy="-39" r="12" fill="#F1F5FB" stroke={accent} strokeWidth="4"/>}</>;
 if(id==="poker-table")return <><ellipse rx="68" ry="40" fill="#103F32" stroke="currentColor" strokeWidth="6"/><ellipse rx="50" ry="27" fill="none" stroke={accent} strokeWidth="3"/><Chip x={-19} y={0} r={12} accent={accent}/><Chip x={22} y={6} r={12} accent={accent}/></>;
 return null;
}
function CrestSvg({shape,symbol,accent,initials,year,withYear,finish,svgRef}:{
 shape:ShapeId;symbol:SymbolId;accent:Accent;initials:string;year:string;withYear:boolean;
 finish:CrestFinish;svgRef?:React.Ref<SVGSVGElement>;
}){
 const path=shapeFor(shape);
 const uid=useId().replace(/:/g,"");
 const url=(name:string)=>"url(#"+uid+"-"+name+")";
 const size=initials.length===4?51:initials.length===3?61:initials.length===2?75:84;
 const premium=finish==="premium",classic=finish==="classic";
 return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 420" role="img"
  aria-label={"Brasão "+finishName(finish)+", "+shapeFor(shape).name+", símbolo "+SYMBOLS.find(item=>item.id===symbol)?.name+", sigla "+initials}>
  <defs>
   <linearGradient id={uid+"-metal"} x1="0" x2="1" y1="0" y2="1">
    <stop offset="0%" stopColor="#F1F5FB"/><stop offset="20%" stopColor="#879CB3"/>
    <stop offset="40%" stopColor="#F5FAFF"/><stop offset="69%" stopColor="#52677F"/><stop offset="100%" stopColor="#DFEBF7"/>
   </linearGradient>
   <linearGradient id={uid+"-body"} x1="0" x2="1" y1="0" y2="1">
    <stop offset="0%" stopColor="#1B2637"/><stop offset="42%" stopColor="#060A11"/>
    <stop offset="100%" stopColor="#12243A"/>
   </linearGradient>
   <linearGradient id={uid+"-glint"} x1="0" x2="1" y1="0" y2="1">
    <stop offset="0%" stopColor={accent.soft}/><stop offset="52%" stopColor={accent.hex}/><stop offset="100%" stopColor="#F1F5FB"/>
   </linearGradient>
   <filter id={uid+"-shadow"} x="-35%" y="-35%" width="170%" height="180%">
    <feGaussianBlur stdDeviation="9"/>
   </filter>
   <filter id={uid+"-spark"} x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur stdDeviation="4"/>
   </filter>
   <clipPath id={uid+"-clip"}><path d={path.inset}/></clipPath>
  </defs>
  {premium&&<path d={path.path} fill={accent.hex} opacity=".3" transform="translate(0 8)" filter={url("shadow")}/>}
  <path d={path.path} fill={premium?url("body"):classic?"#11161C":"#0C121B"}
   stroke={premium?url("metal"):classic?"#D6BD8D":accent.hex} strokeWidth={premium?9:classic?5.5:4}/>
  <path d={path.inset} fill="none" stroke={accent.hex} strokeWidth={premium?4.5:classic?3:2.5}/>
  {premium&&<path d={path.inset} fill="none" stroke={accent.soft} strokeWidth="1" transform="translate(0 -2)" opacity=".68"/>}
  {premium&&<g clipPath={url("clip")}>
   <path d="M0 65L360 245V420H0Z" fill={accent.hex} opacity=".043"/>
   <path d="M0 120L360 310" stroke="white" strokeWidth="16" opacity=".035"/>
   <path d="M0 170L360 360" stroke="white" strokeWidth="4" opacity=".03"/>
   <path d="M65 154H295M65 312H295" stroke={accent.hex} strokeWidth="1" opacity=".42"/>
   <path d="M80 151H280" stroke="#F1F5FB" strokeWidth=".7" opacity=".29"/>
  </g>}
  {classic&&<g fill="none" stroke="#C9B58E" strokeWidth="2.3" opacity=".85">
   <path d="M73 181Q94 155 114 180Q94 183 93 204Q84 197 73 181Z"/>
   <path d="M287 181Q266 155 246 180Q266 183 267 204Q276 197 287 181Z"/>
   <path d="M128 309Q152 325 180 317Q208 325 232 309M160 312Q180 344 200 312"/>
   <path d="M106 151L125 156 113 167M254 151L235 156 247 167"/>
  </g>}
  {(premium||classic)&&<path d="M180 33L191 53 180 63 169 53Z"
   fill={premium?accent.hex:"#D6BD8D"} stroke={premium?"#E8F3FF":"#463826"} strokeWidth="1.3"/>}
  <text x="180" y="142" textAnchor="middle"
   fontFamily={classic?"Georgia,serif":"Arial,Helvetica,sans-serif"} fontSize={size}
   fontWeight={classic?700:900} letterSpacing={initials.length>2?"-3":"-5"}
   stroke={premium?"#DCE9F8":"none"} strokeWidth={premium?1.1:0}
   paintOrder="stroke" fill={premium?url("metal"):classic?"#E9D5AF":"#F1F5FB"}>{initials||"MM"}</text>
  <g transform="translate(180 241)" stroke="currentColor"
   strokeWidth={premium?3.4:classic?3:2.7} strokeLinecap="round" strokeLinejoin="round"
   color={classic?"#E8D7B8":"#EBF3FC"}>
   <SymbolArt id={symbol} accent={accent.hex}/>
  </g>
  {(premium||classic)&&<g fill={premium?accent.hex:"#D6BD8D"} stroke={premium?"#E7F2FF":"#443623"} strokeWidth="1">
   <path d="M78 192L84 205 97 211 84 217 78 230 72 217 59 211 72 205Z"/>
   <path d="M282 192L288 205 301 211 288 217 282 230 276 217 263 211 276 205Z"/>
  </g>}
  {withYear&&<text x="180" y="354" textAnchor="middle" fontFamily="Arial,Helvetica,sans-serif"
   fontSize="23" fontWeight="700" letterSpacing="5" fill={classic?"#E9D5AF":"#EAF4FF"}>{year}</text>}
  <path d="M159 369H201" stroke={classic?"#D6BD8D":accent.hex} strokeWidth={premium?4:2.5} strokeLinecap="round"/>
  {premium&&<path d={path.path} fill="none" stroke={url("glint")} strokeWidth="1.5" opacity=".64"/>}
  {premium&&<circle cx="180" cy="33" r="5" fill={accent.soft} opacity=".85" filter={url("spark")}/>}
 </svg>;
}

export type CrestConfig={
 shape:ShapeId;symbol:SymbolId;colorIndex:number;initials:string;withYear:boolean;year:string;finish:CrestFinish;
};
export const DEFAULT_CREST:CrestConfig={shape:"shield",symbol:"joker",colorIndex:0,initials:"MM",withYear:true,year:"2026",finish:"premium"};
export function normalizeCrest(input:unknown):CrestConfig{
 const o=input && typeof input==="object" && !Array.isArray(input)?input as Partial<CrestConfig>:{};
 return {
  shape:SHAPES.some(item=>item.id===o.shape)?o.shape!:"shield",
  symbol:SYMBOLS.some(item=>item.id===o.symbol)?o.symbol!:"joker",
  colorIndex:typeof o.colorIndex==="number" && Number.isInteger(o.colorIndex)&&o.colorIndex>=0&&o.colorIndex<COLORS.length?o.colorIndex:0,
  initials:typeof o.initials==="string"&&/^[A-Z0-9]{1,4}$/.test(o.initials)?o.initials:"MM",
  withYear:typeof o.withYear==="boolean"?o.withYear:true,
  year:typeof o.year==="string" && /^\d{4}$/.test(o.year)?o.year:"2026",
   finish:FINISHES.some(item=>item.id===o.finish)?o.finish!:"premium"
 };
}
export function CrestMark({value,className=""}:{value:unknown;className?:string}){
 const crest=normalizeCrest(value);
 return <span className={className}><CrestSvg shape={crest.shape} symbol={crest.symbol} accent={COLORS[crest.colorIndex]}
 initials={crest.initials} year={crest.year} withYear={crest.withYear} finish={crest.finish}/></span>;
}

function FinishSelector({value,onChange,shape,symbol,accent,initials,year,withYear}:{
 value:CrestFinish;onChange:(finish:CrestFinish)=>void;shape:ShapeId;symbol:SymbolId;
 accent:Accent;initials:string;year:string;withYear:boolean;
}){
 return <div className="mm-crest-finishes" role="group" aria-label="Escolher acabamento do brasão">
  {FINISHES.map(item=><button type="button" key={item.id}
   className={"mm-crest-finish-option mm-crest-option-"+item.id+(value===item.id?" selected":"")}
   aria-label={"Acabamento "+item.name} aria-pressed={value===item.id} onClick={()=>onChange(item.id)}>
    <span className="mm-crest-finish-image"><CrestSvg shape={shape} symbol={symbol}
     accent={accent} initials={initials||"MM"} year={year} withYear={withYear} finish={item.id}/></span>
    <strong>{item.name}</strong><small>{item.description}</small>
    <span className="mm-crest-finish-indicator">{value===item.id?"✓ Selecionado":"Selecionar"}</span>
   </button>)}
 </div>;
}
export function CrestCustomizer({value,onChange}:{value:CrestConfig;onChange:(value:CrestConfig)=>void}){
 const [group,setGroup]=useState("Todos");
 const accent=COLORS[value.colorIndex]||COLORS[0];
 const shown=useMemo(()=>SYMBOLS.filter(item=>group==="Todos"||item.group===group),[group]);
 const update=(patch:Partial<CrestConfig>)=>onChange({...value,...patch});
 return <div className={"mm-crest-shell mm-crest-inline mm-crest-finish-"+value.finish}>
  <div className="mm-crest-inline-grid">
   <section className="mm-crest-stage" aria-label="Prévia instantânea do brasão">
    <div className="mm-crest-stage-bar"><span><span className="mm-crest-live-dot"/> PRÉVIA EM TEMPO REAL</span><span>{finishName(value.finish).toUpperCase()}</span></div>
    <div className="mm-crest-display"><CrestSvg shape={value.shape} symbol={value.symbol} accent={accent}
     initials={value.initials} year={value.year} withYear={value.withYear} finish={value.finish}/></div>
    <div className="mm-crest-stage-caption"><div><small>IDENTIDADE DA LIGA</small>
     <strong>{value.initials||"MM"}</strong><span>{accent.name} · {SYMBOLS.find(x=>x.id===value.symbol)?.name}</span></div>
     <span className="mm-crest-premium-tag">{finishName(value.finish)}</span></div>
   </section>
   <div className="mm-crest-controls">
    <div className="mm-crest-step">
     <div className="mm-crest-step-head"><span className="mm-crest-step-no">01</span><div><h3>Formato</h3><p>Selecione a silhueta padronizada.</p></div></div>
     <div className="mm-crest-shapes">{SHAPES.map(item=><button type="button" key={item.id}
       aria-pressed={value.shape===item.id} className={"mm-crest-shape "+(value.shape===item.id?"selected":"")}
       onClick={()=>update({shape:item.id})}>
       <svg viewBox="0 0 360 420" aria-hidden="true"><path d={item.path} fill="#172A44" stroke={value.shape===item.id?accent.hex:"#8190A8"} strokeWidth="11"/></svg><span>{item.name}</span>
      </button>)}</div>
    </div>
    <div className="mm-crest-step">
     <div className="mm-crest-step-head"><span className="mm-crest-step-no">02</span><div><h3>Símbolo principal</h3><p>27 símbolos disponíveis.</p></div></div>
     <div className="mm-crest-groups">{GROUPS.map(item=><button key={item} type="button" aria-pressed={group===item}
      className={group===item?"active":""} onClick={()=>setGroup(item)}>{item}</button>)}</div>
     <div className="mm-crest-symbols">{shown.map(item=><button type="button" key={item.id}
      aria-label={item.name} title={item.name} aria-pressed={value.symbol===item.id}
      className={"mm-crest-symbol "+(value.symbol===item.id?"selected":"")} onClick={()=>update({symbol:item.id})}>
       <svg viewBox="-88 -91 176 185" aria-hidden="true" color="#E8F2FF">
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
         <SymbolArt id={item.id} accent={accent.hex}/>
        </g></svg><span>{item.name}</span></button>)}</div>
    </div>
    <div className="mm-crest-step">
     <div className="mm-crest-step-head"><span className="mm-crest-step-no">03</span><div><h3>Cor de destaque</h3><p>Seis cores aprovadas.</p></div></div>
     <div className="mm-crest-colors">{COLORS.map((item,index)=><button type="button" key={item.name}
      title={item.name} aria-label={item.name} aria-pressed={value.colorIndex===index}
      className={"mm-crest-color "+(value.colorIndex===index?"selected":"")} onClick={()=>update({colorIndex:index})}>
       <span style={{background:item.hex}}/>{value.colorIndex===index&&<b>✓</b>}</button>)}</div>
     <div className="mm-crest-color-name">{accent.name} <span>{accent.hex}</span></div>
    </div>
    <div className="mm-crest-step">
    <div className="mm-crest-step-head"><span className="mm-crest-step-no">04</span><div><h3>Acabamento</h3><p>Três estilos visualmente diferentes.</p></div></div>
    <FinishSelector value={value.finish} onChange={finish=>update({finish})} shape={value.shape}
     symbol={value.symbol} accent={accent} initials={value.initials} year={value.year} withYear={value.withYear}/>
   </div>
   <div className="mm-crest-step">
     <div className="mm-crest-step-head"><span className="mm-crest-step-no">05</span><div><h3>Identificação</h3><p>Uma sigla e um ano opcional.</p></div></div>
     <label className="mm-crest-label" htmlFor="mm-crest-edit-initials">SIGLA · ATÉ 4 CARACTERES</label>
     <input id="mm-crest-edit-initials" required maxLength={4} spellCheck={false} autoCapitalize="characters"
      value={value.initials} onChange={e=>update({initials:e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]/g,"").toUpperCase().slice(0,4)})}/>
     <label className="mm-crest-switch"><input type="checkbox" checked={value.withYear}
      onChange={e=>update({withYear:e.target.checked})}/><span>Exibir ano no brasão</span></label>
     {value.withYear&&<><label htmlFor="mm-crest-edit-year" className="mm-crest-label">ANO (4 DÍGITOS)</label>
      <input id="mm-crest-edit-year" inputMode="numeric" maxLength={4} value={value.year}
      onChange={e=>update({year:e.target.value.replace(/\D/g,"").slice(0,4)})}/></>}
    </div>
    <div className="mm-crest-guidelines"><strong>COMPOSIÇÃO PADRONIZADA</strong><p>Posições e proporções fixas; sem upload, movimentação, rotação ou redimensionamento de elementos.</p></div>
   </div>
  </div>
 </div>;
}
