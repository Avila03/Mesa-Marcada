"use client";
import {useId} from "react";

/** Eixo Fundação · Edição Origem Dual.
 * A hand-designed scalable black-piano frame. All elements are masked out of the
 * central aperture so the portrait never gets obscured — even on seats.
 */
export default function FounderArtwork({className}: {className?:string}){
 const uid=useId().replace(/:/g,"");
 const glass=uid+"black",metal=uid+"metal",gloss=uid+"gloss";
 const blue=uid+"blue",red=uid+"red",mask=uid+"hole",glow=uid+"glow";
 return <svg className={className||"mm-frame-artwork"} aria-hidden="true"
  xmlns="http://www.w3.org/2000/svg" viewBox="-28 -28 316 316">
  <defs>
   <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#505766"/><stop offset=".11" stopColor="#0a0f18"/>
    <stop offset=".27" stopColor="#050609"/><stop offset=".42" stopColor="#2b313c"/>
    <stop offset=".54" stopColor="#020408"/><stop offset=".73" stopColor="#111823"/>
    <stop offset=".89" stopColor="#080b11"/><stop offset="1" stopColor="#798390"/>
   </linearGradient>
   <linearGradient id={metal} x1="0" y1="1" x2="1" y2="0">
    <stop stopColor="#171c27"/><stop offset=".18" stopColor="#8896a9"/>
    <stop offset=".26" stopColor="#e3ebf6"/><stop offset=".36" stopColor="#28313f"/>
    <stop offset=".68" stopColor="#060b14"/><stop offset=".83" stopColor="#d0d6dd"/>
    <stop offset="1" stopColor="#121925"/>
   </linearGradient>
   <linearGradient id={gloss} x1="0" y1="0" x2="1" y2=".85">
    <stop stopColor="#f8fcff" stopOpacity=".9"/><stop offset=".17" stopColor="#fff" stopOpacity=".08"/>
    <stop offset=".5" stopColor="#fff" stopOpacity="0"/><stop offset=".78" stopColor="#bcd8ff" stopOpacity=".23"/>
    <stop offset="1" stopColor="#f1f6ff" stopOpacity=".62"/>
   </linearGradient>
   <linearGradient id={blue} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#8de8ff"/><stop offset=".5" stopColor="#258bff"/><stop offset="1" stopColor="#0a3a9c"/>
   </linearGradient>
   <linearGradient id={red} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#ffb7c0"/><stop offset=".42" stopColor="#ff424d"/><stop offset="1" stopColor="#8b102a"/>
   </linearGradient>
   <filter id={glow} x="-90%" y="-90%" width="280%" height="280%">
    <feGaussianBlur stdDeviation="3.5"/>
   </filter>
   <mask id={mask} maskUnits="userSpaceOnUse" x="-28" y="-28" width="316" height="316">
    <rect x="-28" y="-28" width="316" height="316" fill="white"/>
    <circle cx="130" cy="130" r="96" fill="black"/>
   </mask>
  </defs>
  <g mask={"url(#"+mask+")"} strokeLinejoin="round">
   {/* The glossy double-walled black piano housing */}
   <circle cx="130" cy="130" r="109" fill="none" stroke="#0b111b" strokeWidth="28"/>
   <circle cx="130" cy="130" r="111" fill="none" stroke={"url(#"+glass+")"} strokeWidth="23"/>
   <circle cx="130" cy="130" r="118" fill="none" stroke={"url(#"+metal+")"} strokeWidth="3.5"/>
   <circle cx="130" cy="130" r="116" fill="none" stroke={"url(#"+gloss+")"} strokeWidth="1.7"/>
   <circle cx="130" cy="130" r="101" fill="none" stroke="#010407" strokeWidth="4"/>
   <circle cx="130" cy="130" r="98" fill="none" stroke="#8c9caf" strokeWidth="1.4"/>
   <circle cx="130" cy="130" r="115" fill="none" stroke="#0a69ef" strokeWidth="2.8"
    strokeDasharray="170 560" strokeDashoffset="-350" filter={"url(#"+glow+")"}/>
   <circle cx="130" cy="130" r="115" fill="none" stroke="#ff3248" strokeWidth="3"
    strokeDasharray="150 575" strokeDashoffset="12" filter={"url(#"+glow+")"}/>
   {/* Separate red / blue circuits, precisely two halves */}
   <path d="M126 17 A113 113 0 0 0 126 243" fill="none" stroke={"url(#"+blue+")"} strokeWidth="3.6"/>
   <path d="M134 17 A113 113 0 0 1 134 243" fill="none" stroke={"url(#"+red+")"} strokeWidth="3.6"/>
   <path d="M124 22 A108 108 0 0 0 124 238" fill="none" stroke="#7acafa" strokeWidth=".9" opacity=".8"/>
   <path d="M136 22 A108 108 0 0 1 136 238" fill="none" stroke="#ffb6ba" strokeWidth=".9" opacity=".8"/>
   {/* Four angular floating black-piano corner members. */}
   {[
    {x:-5,y:-7,rot:0,color:"#258bff"},
    {x:218,y:-7,rot:90,color:"#ff424d"},
    {x:218,y:224,rot:180,color:"#ff424d"},
    {x:-5,y:224,rot:270,color:"#258bff"}
   ].map((part,i)=><g key={i} transform={"translate("+part.x+" "+part.y+") rotate("+part.rot+" 23 21)"}>
    <path d="M2 42 L2 16 17 1 44 1 34 9 17 9 10 18 10 35Z"
     fill={"url(#"+glass+")"} stroke={"url(#"+metal+")"} strokeWidth="2"/>
    <path d="M6 34 L6 18 20 5 36 5" stroke={part.color} strokeWidth="3" fill="none"/>
    <path d="M8 18 L20 8 32 8" stroke="#edf6ff" strokeWidth=".8" fill="none" opacity=".8"/>
    <path d="M14 36 L23 24 33 24" fill="none" stroke={part.color} strokeWidth="1.5" opacity=".8"/>
   </g>)}
   {/* Floating plates for Poker and Blackjack. */}
   <g transform="translate(9 119)">
    <path d="M-13 -26 L-1 -34 22 -19 23 20 0 32 -14 21Z"
     fill={"url(#"+glass+")"} stroke={"url(#"+metal+")"} strokeWidth="3"/>
    <path d="M-10 -23 L-1 -28 18 -15 18 17 0 26 -9 17Z" fill="#070d18"
     stroke="#258bff" strokeWidth="1.5"/>
    <text x="4" y="12" fontSize="32" textAnchor="middle" fill="#c5d6e8" fontFamily="Georgia,serif">♠</text>
    <path d="M-4 -19 L13 -13" stroke="#99e9ff" strokeWidth="1" opacity=".7"/>
   </g>
   <g transform="translate(251 119)">
    <path d="M13 -26 L1 -34 -22 -19 -23 20 0 32 14 21Z"
     fill={"url(#"+glass+")"} stroke={"url(#"+metal+")"} strokeWidth="3"/>
    <path d="M10 -23 L1 -28 -18 -15 -18 17 0 26 9 17Z" fill="#15080f"
     stroke="#ff424d" strokeWidth="1.5"/>
    <text x="-4" y="7" fontSize="21" textAnchor="middle" fill="#ff5b69"
     fontFamily="Inter,Arial,sans-serif" fontWeight="900">21</text>
    <path d="M4 -19 L-13 -13" stroke="#ffd5d9" strokeWidth="1" opacity=".7"/>
   </g>
   {/* Two geometric jokers, exclusive mark in place of ordinary crowns. */}
   <g transform="translate(130 -1)">
    <path d="M-25 16 L-24 1 -16 -10 -6 -2 0 -18 7 -2 17 -10 25 1 24 16Z"
     fill={"url(#"+glass+")"} stroke="#c3ccd9" strokeWidth="2.5"/>
    <path d="M-23 -2 L-13 -14 -5 -7 -3 5 -19 9Z" fill={"url(#"+red+")"}/>
    <path d="M23 -2 L13 -14 5 -7 3 5 19 9Z" fill={"url(#"+blue+")"}/>
    <path d="M-7 8 Q0 -1 7 8 L5 18 -5 18Z" fill="#e7edf5"/>
    <path d="M-5 12 L-2 10 M5 12 L2 10" stroke="#121722" strokeWidth="2.3" strokeLinecap="round"/>
    <circle cx="-16" cy="-14" r="3.2" fill="#ff424d" stroke="#fff" strokeWidth=".8"/>
    <circle cx="16" cy="-14" r="3.2" fill="#258bff" stroke="#fff" strokeWidth=".8"/>
    <path d="M-29 18 L29 18" stroke="#394759" strokeWidth="3"/>
   </g>
   {/* FOUNDADOR: the exact approved plaque, below the portrait. */}
   <g transform="translate(130 249)">
    <rect x="-55" y="-14" width="110" height="29" rx="5" fill="#020408" stroke="#03060e" strokeWidth="3"/>
    <path d="M-52 -13 L52 -13 55 -8 55 10 49 15 -49 15 -55 10 -55 -8Z"
     fill={"url(#"+glass+")"} stroke={"url(#"+metal+")"} strokeWidth="2.4"/>
    <rect x="-48" y="-9" width="96" height="19" rx="2.5" fill="#0d121c" stroke="#7e8b9b" strokeWidth="1"/>
    <path d="M-46 -8 H46" stroke="#a9bbcd" strokeWidth=".8" opacity=".7"/>
    <text x="0" y="5" textAnchor="middle" fontFamily="Inter,Arial,sans-serif"
     fontWeight="900" fontSize="14.5" letterSpacing="1.4" fill="#f1f5fb">FUNDADOR</text>
    <path d="M-48 11 H-6" stroke="#258bff" strokeWidth="1.5"/>
    <path d="M6 11 H48" stroke="#ff424d" strokeWidth="1.5"/>
   </g>
   {[-1,1].map((s,i)=><g key={i} transform={"translate("+(130+s*121)+" 130)"}>
    <path d="M0 -8 L5 0 0 8 -5 0Z" fill={i?"#ff424d":"#258bff"} stroke="#ecf5ff" strokeWidth="1"/>
    <circle r="11" fill="none" stroke={i?"#ff424d":"#258bff"} strokeWidth=".8" opacity=".4"/>
   </g>)}
  </g>
 </svg>;
}
