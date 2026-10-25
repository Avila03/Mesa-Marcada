"use client";
import {useId} from "react";
import FounderArtwork from "./founder-artwork";

/** Five bespoke, scalable transparent frame artworks for Mesa Marcada.
 * No emojis, raster placeholders or stock borders; the center stays clear for the profile photo.
 */
export type FrameId="safira"|"dupla-coroa"|"rei-sequencia"|"high-roller"|"conclave"|"fundador";
export type FrameVariant="original"|"ciano"|"noturno";

const COLORS:Record<Exclude<FrameId,"fundador">,{metal:string;light:string;accent:string;dark:string}>={
 safira:{metal:"#bddbea",light:"#f7ffff",accent:"#258bff",dark:"#102444"},
 "dupla-coroa":{metal:"#e9b75e",light:"#fff0b6",accent:"#ed5156",dark:"#493016"},
 "rei-sequencia":{metal:"#deb15e",light:"#fff0a0",accent:"#258bff",dark:"#45301a"},
 "high-roller":{metal:"#d8a55c",light:"#ffe2a0",accent:"#ff424d",dark:"#512f20"},
 conclave:{metal:"#9aa6b8",light:"#f1f2ff",accent:"#a96eff",dark:"#1c2032"}
};
function Diamond({x,y,r=15,primary="#258bff",light="#f1ffff"}:{x:number;y:number;r?:number;primary?:string;light?:string}){
 return <g transform={"translate("+x+" "+y+")"}>
  <path d={"M0 "+(-r-4)+" L"+(r+3)+" 0 0 "+(r+5)+" "+(-r-3)+" 0Z"} fill="#070f1d" stroke={light} strokeWidth="2.4"/>
  <path d={"M0 "+(-r)+" L"+r+" 0 0 "+(r+1)+" "+(-r)+" 0Z"} fill={primary} stroke={light} strokeWidth=".85"/>
  <path d={"M0 "+(-r)+" L"+r+" 0 0 0Z"} fill="#e8ffff" opacity=".9"/>
  <path d={"M0 "+(-r)+" L0 0 "+(-r)+" 0Z"} fill="#4edfff" opacity=".78"/>
  <path d={"M0 0 L"+r+" 0 0 "+(r+1)+"Z"} fill="#1553b3" opacity=".85"/>
  <path d={"M0 0 L0 "+(r+1)+" "+(-r)+" 0Z"} fill="#061d4b" opacity=".75"/>
  <path d={"M0 "+(-r)+" L0 "+(r+1)+" M"+(-r)+" 0 L"+r+" 0"} stroke={light} strokeWidth=".65" opacity=".75"/>
  <circle cx={-r-1} cy="0" r="1.65" fill="white"/>
  <circle cx={r+1} cy="0" r="1.65" fill="white"/>
 </g>;
}
function Crown({x=130,y=26,scale=1,leftColor="#258bff",rightColor="#ff424d"}:{x?:number;y?:number;scale?:number;leftColor?:string;rightColor?:string}){
 return <g transform={"translate("+x+" "+y+") scale("+scale+")"} strokeLinejoin="round">
  <path d="M-36 7 L-43 -23 -20 -11 0 -35 20 -11 43 -23 36 7 31 22 -31 22Z" fill="#8b571f" stroke="#f9d481" strokeWidth="3"/>
  <path d="M-35 6 L-37 -15 -17 -4 0 -28 19 -4 37 -15 34 6Z" fill="#c89345" stroke="#fff4bd" strokeWidth="1.4"/>
  <path d="M-32 4 L-18 -2 -1 -25 0 6Z" fill={leftColor} opacity=".75"/>
  <path d="M0 6 L1 -25 18 -2 33 4Z" fill={rightColor} opacity=".8"/>
  <path d="M-31 15 L31 15" stroke="#fff6c8" strokeWidth="6" strokeLinecap="round"/>
  <path d="M-31 17 L31 17" stroke="#63411b" strokeWidth="2"/>
  {[-29,-14,0,14,29].map((cx,i)=><circle key={cx} cx={cx} cy="14.5" r={i===2?5:3} fill={i%2?leftColor:rightColor} stroke="#fff8c8" strokeWidth="1.1"/>)}
  <circle cx="-43" cy="-23" r="4" fill="#ffeeb3"/><circle cx="43" cy="-23" r="4" fill="#ffeeb3"/>
  <circle cx="0" cy="-35" r="5" fill="#ffeeb3"/>
 </g>;
}
function Leaves({side="left",gold=false}:{side?:"left"|"right";gold?:boolean}){
 const transform=side==="left"?"":"translate(260,0) scale(-1,1)";
 const fill=gold?"#dbac58":"#a9c5db",shine=gold?"#ffedb4":"#f3fdff",shadow=gold?"#6f471d":"#345671";
 return <g transform={transform}>
  <path d="M112 245 Q-15 202 35 105" fill="none" stroke={shine} strokeWidth="3" opacity=".63"/>
  {Array.from({length:8},(_,i)=>{
   const angle=(i*10-37)*Math.PI/180;
   const x=55+23*Math.sin(angle)+i*5.5;
   const y=215-i*19;
   const rot=-50+i*13;
   return <g key={i} transform={"translate("+x+" "+y+") rotate("+rot+")"}>
    <path d="M0 0 Q-26 -17 -6 -36 Q14 -31 0 0Z" fill={shadow} stroke={shine} strokeWidth="1.8"/>
    <path d="M0 0 Q-16 -20 -6 -34 Q8 -21 0 0Z" fill={fill}/>
    <path d="M0 -2 L-5 -29" stroke={shine} strokeWidth="1.3" opacity=".8"/>
    <path d="M0 0 Q17 -12 25 -34 Q2 -30 0 0Z" fill={shadow} stroke={shine} strokeWidth="1.5"/>
    <path d="M0 0 Q10 -16 22 -32 Q3 -23 0 0Z" fill={fill}/>
   </g>;
  })}
 </g>;
}
function Wing({side="left",blue=true}:{side?:"left"|"right";blue?:boolean}){
 const transform=side==="left"?"":"translate(260,0) scale(-1,1)";
 return <g transform={transform}>
 {Array.from({length:6},(_,i)=>{
  const y=83+i*16,x=18+i*4;
  return <g key={i}>
   <path d={"M"+(x+65)+" "+(y+12)+" Q"+(x+3)+" "+(y-26)+" "+(x-1)+" "+(y-47)+" Q"+(x+23)+" "+(y-30)+" "+(x+64)+" "+(y+2)+"Z"} fill={blue?"#164f93":"#80501b"} stroke={blue?"#78d4ff":"#f8d085"} strokeWidth="2.2"/>
   <path d={"M"+(x+59)+" "+(y+4)+" L"+(x+4)+" "+(y-42)+" Q"+(x+20)+" "+(y-25)+" "+(x+46)+" "+(y+4)+"Z"} fill={blue?"#3da4ed":"#efba5a"} opacity=".8"/>
   <path d={"M"+(x+60)+" "+(y+5)+" L"+(x+5)+" "+(y-39)} stroke="#efffff" opacity=".72" strokeWidth="1.1"/>
  </g>;
 })}
 </g>;
}
function ChipStack({x,y,blue=false}:{x:number;y:number;blue?:boolean}){
 const base=blue?"#258bff":"#dc3549",dark=blue?"#10386b":"#651e28";
 return <g transform={"translate("+x+" "+y+")"}>
  {[0,8,16,24].map((dy,i)=><g key={dy} transform={"translate(0 "+(-dy)+")"}>
   <rect x="-16" y="-1" width="32" height="9" rx="3" fill={dark} stroke="#e4d4a0" strokeWidth="1.1"/>
   <ellipse cx="0" cy="-1" rx="16" ry="6" fill={base} stroke="#fff3bb" strokeWidth="1.4"/>
   <ellipse cx="0" cy="-1" rx="10" ry="3.5" fill="#14212c" stroke="#fef0b0" strokeWidth=".8"/>
   <path d="M-11 -5 L-7 -7 M11 -5 L7 -7" stroke="white" strokeWidth="1.5"/>
  </g>)}
 </g>;
}
function Card({x,y,rotation,suit,color}:{x:number;y:number;rotation:number;suit:string;color:string}){
 return <g transform={"translate("+x+" "+y+") rotate("+rotation+")"}>
  <rect x="-17" y="-24" width="34" height="48" rx="4" fill="#fff9e8" stroke="#f5ba5e" strokeWidth="3"/>
  <rect x="-13" y="-20" width="26" height="40" rx="2" fill="none" stroke="#afb3bb" strokeWidth="1"/>
  <text x="-10" y="-9" fontSize="10" fontWeight="900" fill={color}>A</text>
  <text x="0" y="9" textAnchor="middle" fontSize="24" fill={color}>{suit}</text>
 </g>;
}
export default function FrameArtwork({id,variant="original",className}:{
 id:FrameId;variant?:FrameVariant;className?:string;
}){
 const uniq=useId().replace(/:/g,"");
 if(id==="fundador")return <FounderArtwork className={className}/>;
 const theme=COLORS[id];
 const accent=id==="safira"?(variant==="ciano"?"#4be4fa":variant==="noturno"?"#7768ff":"#258bff"):theme.accent;
 const gold=id==="dupla-coroa"||id==="rei-sequencia"||id==="high-roller";
 const idMetal=uniq+"metal",idCore=uniq+"core",idBlue=uniq+"blue",idSpark=uniq+"spark",idAperture=uniq+"aperture";
 return <svg aria-hidden="true" className={className||"mm-frame-artwork"} viewBox="-28 -28 316 316" xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id={idMetal} x1="0" x2="1" y1=".85" y2=".2">
    <stop offset="0" stopColor={theme.dark}/><stop offset=".15" stopColor={theme.metal}/>
    <stop offset=".28" stopColor="#151b25"/><stop offset=".46" stopColor={theme.light}/>
    <stop offset=".58" stopColor={theme.metal}/><stop offset=".71" stopColor={theme.dark}/>
    <stop offset=".85" stopColor={theme.light}/><stop offset="1" stopColor={theme.metal}/>
   </linearGradient>
   <linearGradient id={idCore} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#020710"/><stop offset=".34" stopColor={theme.dark}/>
    <stop offset=".48" stopColor={theme.metal}/><stop offset=".55" stopColor="#020711"/>
    <stop offset=".83" stopColor={theme.metal}/><stop offset="1" stopColor="#09111f"/>
   </linearGradient>
   <radialGradient id={idBlue}>
    <stop offset="0" stopColor={theme.light}/><stop offset=".2" stopColor={accent}/>
    <stop offset=".6" stopColor={accent} stopOpacity=".5"/><stop offset="1" stopColor={accent} stopOpacity="0"/>
   </radialGradient>
   <filter id={idSpark} x="-60%" y="-60%" width="220%" height="220%">
    <feGaussianBlur stdDeviation="3"/>
   </filter>
   {/* Cut the full center from EVERY decoration: zero overlap with photos. */}
   <mask id={idAperture} maskUnits="userSpaceOnUse" x="-28" y="-28" width="316" height="316">
    <rect x="-28" y="-28" width="316" height="316" fill="white"/>
    <circle cx="130" cy="130" r="96" fill="black"/>
   </mask>
  </defs>
  <g mask={"url(#"+idAperture+")"}>
  {/* Central photo aperture remains fully transparent. */}
  <circle cx="130" cy="130" r="114" fill="none" stroke={accent} opacity=".55" strokeWidth="2.2" filter={"url(#"+idSpark+")"}/>
  <circle cx="130" cy="130" r="110.5" fill="none" stroke={"url(#"+idCore+")"} strokeWidth="16"/>
  <circle cx="130" cy="130" r="108" fill="none" stroke={"url(#"+idMetal+")"} strokeWidth="4.3"/>
  <circle cx="130" cy="130" r="101" fill="none" stroke={theme.dark} strokeWidth="2.5"/>
  <circle cx="130" cy="130" r="96" fill="none" stroke={accent} strokeWidth="2.6" opacity=".84"/>
  <circle cx="130" cy="130" r="91" fill="none" stroke={theme.light} strokeWidth=".95" opacity=".75"/>
  {Array.from({length:28},(_,i)=>{
   const angle=(i/28)*Math.PI*2;const x=130+111*Math.cos(angle),y=130+111*Math.sin(angle);
   return <g key={i} transform={"translate("+x+" "+y+") rotate("+(i*360/28+90)+")"}>
    <path d="M-2.2 0 L0 -5 L2.2 0" stroke={i%2?theme.metal:accent} strokeWidth="1.2" fill="none" opacity=".7"/>
   </g>;
  })}
  {id==="safira"&&<>
   <Leaves side="left"/><Leaves side="right"/>
   <Wing side="left"/><Wing side="right"/>
   {[["130","15"],["130","246"],["20","130"],["240","130"]].map(([x,y],i)=>
    <Diamond key={i} x={Number(x)} y={Number(y)} r={i%2===0?17:14} primary={accent}/>)}
   {[35,63,197,225].map((n,i)=><circle key={i} cx={i<2?n:n} cy={i%2?65:195} r="3" fill="#fff" opacity=".84"/>)}
  </>}
  {id==="dupla-coroa"&&<>
   <Leaves side="left" gold/><Leaves side="right" gold/>
   <Wing side="left" blue/><Wing side="right" blue={false}/>
   <Crown x={101} y={25} scale={.7} leftColor="#258bff" rightColor="#258bff"/>
   <Crown x={161} y={25} scale={.7} leftColor="#ff424d" rightColor="#ff424d"/>
   <Diamond x={130} y={239} r={15} primary="#ff424d" light="#ffe9a0"/>
   <Diamond x={23} y={133} r={10} primary="#258bff"/>
   <Diamond x={237} y={133} r={10} primary="#ff424d"/>
   <path d="M98 232 Q130 249 162 232" fill="none" stroke="#f9d47a" strokeWidth="8"/>
   <text x="115" y="237" fontSize="17" fill="#ecf4ff">♠</text><text x="138" y="237" fontSize="17" fill="#f84b52">♦</text>
  </>}
  {id==="rei-sequencia"&&<>
   <Wing side="left" blue={false}/><Wing side="right"/>
   <Leaves side="left" gold/><Leaves side="right" gold/>
   <Crown x={130} y={25} scale={1.08}/>
   {Array.from({length:6},(_,i)=>{
    const a=(-157+i*63)*Math.PI/180;return <Diamond key={i} x={130+116*Math.cos(a)} y={130+116*Math.sin(a)} r={7} primary={i%2?"#258bff":"#ffcc64"}/>;
   })}
   <path d="M80 224 Q130 257 180 224" fill="none" stroke="#edca79" strokeWidth="7"/>
   <Diamond x={130} y={239} r={12} primary="#258bff"/>
  </>}
  {id==="high-roller"&&<>
   <Leaves side="left" gold/><Leaves side="right" gold/>
   <Crown x={130} y={17} scale={.68} leftColor="#f0ae57" rightColor="#ff424d"/>
   <Card x={30} y={104} rotation={-20} suit="♠" color="#20242b"/>
   <Card x={230} y={104} rotation={20} suit="♥" color="#cb2e41"/>
   <ChipStack x={37} y={200}/><ChipStack x={222} y={200} blue/>
   <Diamond x={130} y={237} r={18} primary="#ec404b" light="#ffe7a0"/>
   <Diamond x={27} y={154} r={9} primary="#ff424d" light="#f7cc7c"/>
   <Diamond x={233} y={154} r={9} primary="#ff424d" light="#f7cc7c"/>
   <path d="M89 237 Q130 259 171 237" fill="none" stroke="#e8bd69" strokeWidth="5"/>
  </>}
  {id==="conclave"&&<>
   <Wing side="left"/><Wing side="right"/>
   <Leaves side="left"/><Leaves side="right"/>
   <path d="M102 22 L130 -1 158 22 130 44Z" fill="#1e2038" stroke="#deb36d" strokeWidth="3"/>
   <text x="130" y="31" textAnchor="middle" fontSize="25" fill="#d7b772">♠</text>
   <Card x={31} y={153} rotation={-28} suit="♣" color="#191c2f"/>
   <Card x={229} y={153} rotation={28} suit="♦" color="#c9364c"/>
   <Diamond x={130} y={237} r={14} primary="#ad6afa" light="#eacaff"/>
   <Diamond x={24} y={96} r={10} primary="#ff424d" light="#edd8a7"/>
   <Diamond x={236} y={96} r={10} primary="#ad6afa" light="#edd8a7"/>
  </>}
  {Array.from({length:10},(_,i)=>{
   const a=(i*36+12)*Math.PI/180;
   const x=130+124*Math.cos(a),y=130+124*Math.sin(a);
   return <g key={i}>
    <circle cx={x} cy={y} r={i%3===0?3:1.4} fill={i%2===0?accent:theme.light} opacity=".5" filter={"url(#"+idSpark+")"}/>
    <circle cx={x} cy={y} r={i%3===0?1.5:.8} fill="#fff7d6" opacity=".95"/>
   </g>;
  })}
  </g>
 </svg>;
}
