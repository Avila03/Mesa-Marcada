import type {Game} from '@/lib/games';
import UiIcon from './ui-icon';
import './game-identity.css';

/** Original vector marks, drawn from the games rather than a generic stack icon. */
export function GameEmblem({game}:{game:Game}){
 if(game==='poker'||game==='blackjack')return <UiIcon name={game==='poker'?'spade':'diamond'} size={32}/>;
 return <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {game==='truco'?<><path d="m13 36 20-25 1 9-14 18M11 31l11 9M15 37l-3 4"/><path d="m13 10 23 29M11 9l4-1 3 5-3 3-4-3zM30 33l6-4" stroke="#FF5964"/><path d="M27 7h10M37 7v10"/></>:
   game==='canastra'?<><path d="M6 14v21h36V14"/><path d="M11 12v17M17 9v20M23 7v22M29 9v20M35 12v17"/><path d="m18 38 5 4 8-8" stroke="#FF5964"/></>:
   game==='pontinho'?<><path d="M8 9h32M8 22h32M8 35h18" opacity=".4"/>{[10,20,30,40].map(x=><circle key={x} cx={x} cy={10} r="2.6" fill="currentColor" stroke="none"/>)}{[10,20,30].map(x=><circle key={x} cx={x} cy={23} r="2.6" fill="currentColor" stroke="none"/>)}<circle cx="10" cy="36" r="2.6" fill="#FF5964" stroke="none"/><path d="m32 33 5 6 5-6M37 39V27" stroke="#FF5964"/></>:
   game==='uno'?<><path d="M34 10a16 16 0 0 1 4 25l-4 4M14 38A16 16 0 0 1 10 13l4-4"/><path d="m34 30 .5 9 9-.5M14 18l-.5-9-9 .5" stroke="#FF5964"/><path d="m23 15-4 4m4-4v18M18 34h10"/></>:
   <><rect x="5" y="12" width="11" height="26" rx="3"/><rect x="19" y="7" width="11" height="31" rx="3"/><rect x="33" y="12" width="11" height="26" rx="3"/><path d="m9 25 2 2 2-2M23 22l2 2 2-2M37 25l2 2 2-2" stroke="#FF5964"/><path d="M10 43h29"/></>}
 </svg>;
}

function ArtCard({x,y,angle=0,rank,suit,color='#258BFF'}:{x:number;y:number;angle?:number;rank:string;suit?:string;color?:string}){
 return <g transform={`translate(${x} ${y}) rotate(${angle} 27 37)`}>
  <rect width="54" height="76" rx="7" fill="#101923" stroke={color} strokeOpacity=".75"/>
  <text x="8" y="18" fill="#F1F5FB" fontSize="13" fontWeight="750">{rank}</text>
  {suit==='sword'?<g stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M24 53 35 29l1 8-9 19M20 48l13 6M25 53l-4 8"/></g>:
   <text x="27" y="51" textAnchor="middle" fill={color} fontSize={suit?'26':'24'} fontWeight="700">{suit||rank}</text>}
  <path d="M39 65h7" stroke={color} opacity=".6"/>
 </g>;
}

export default function GameArtwork({game,className=''}:{game:Game;className?:string}){
 return <svg viewBox="0 0 240 120" className={'mm-game-art '+className} fill="none" aria-hidden="true" focusable="false">
  {game==='truco'?<><path d="M28 99h180M43 105h150" stroke="#258BFF" opacity=".2"/><ArtCard x={69} y={22} angle={-17} rank="1" suit="♣" color="#FF5964"/><ArtCard x={115} y={13} angle={12} rank="1" suit="sword"/><path d="m177 35 12-12M187 45l14-2" stroke="#FF5964" strokeWidth="2"/></>:
   game==='canastra'?<>{[0,1,2,3,4,5,6].map((n)=><ArtCard key={n} x={19+n*25} y={23+Math.abs(n-3)*3} angle={(n-3)*4} rank={String(n+3)} suit="♥" color={n===6?'#FF5964':'#258BFF'}/>)}<path d="M30 108h174" stroke="#6FB7FF" strokeOpacity=".5"/><circle cx="210" cy="105" r="3" fill="#FF5964"/></>:
   game==='pontinho'?<><g stroke="#258BFF" strokeOpacity=".2"><path d="M35 27h170M35 59h170M35 92h170"/>{[0,1,2,3,4].map(n=><circle key={n} cx={52+n*33} cy="27" r="5" fill="#258BFF"/>)}{[0,1,2].map(n=><circle key={n} cx={52+n*33} cy="59" r="5" fill="#258BFF" opacity=".65"/>)}<circle cx="52" cy="92" r="5" fill="#FF5964"/></g><text x="146" y="99" fill="#F1F5FB" fontSize="26" fontWeight="750">−32</text><path d="m183 47 12 15 12-15M195 62V34" stroke="#FF5964" strokeWidth="2"/></>:
   game==='uno'?<>{['#56A4FF','#FF5964','#76B59B','#D8B16D'].map((c,i)=><g key={c} transform={`translate(${41+i*37} ${23+Math.abs(i-1.5)*5}) rotate(${(i-1.5)*9} 25 34)`}><rect width="52" height="73" rx="8" fill="#101923" stroke={c}/><ellipse cx="26" cy="37" rx="18" ry="27" transform="rotate(25 26 37)" fill={c} fillOpacity=".2" stroke={c} strokeOpacity=".5"/><text x="26" y="45" textAnchor="middle" fill={c} fontSize="27" fontWeight="800">{['7','↻','+2','1'][i]}</text></g>)}</>:
   game==='pife'?<><ArtCard x={49} y={28} angle={-12} rank="7" suit="♥" color="#FF5964"/><ArtCard x={96} y={16} rank="8" suit="♥" color="#FF5964"/><ArtCard x={143} y={28} angle={12} rank="9" suit="♥" color="#FF5964"/><path d="M76 108h91M89 114h65" stroke="#258BFF" strokeOpacity=".6"/></>:
   game==='poker'?<><ArtCard x={66} y={25} angle={-12} rank="A" suit="♠"/><ArtCard x={116} y={19} angle={12} rank="K" suit="♠"/></>:
   <><ArtCard x={67} y={25} angle={-12} rank="A" suit="♦" color="#FF5964"/><ArtCard x={116} y={19} angle={12} rank="K" suit="♥" color="#FF5964"/></>}
 </svg>;
}
