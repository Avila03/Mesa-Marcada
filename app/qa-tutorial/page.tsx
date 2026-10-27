'use client';
import {useEffect,useState} from 'react';
import '../v05-theme.css';
import '../painel/duo-theme.css';
import GameChoices from '../painel/game-choices';
import GameTutorial from '../painel/game-tutorial';
import TableTutorial from '../painel/table-tutorial';
import type {Game} from '@/lib/games';
export default function Review(){
 const [game,setGame]=useState<Game|null>(null),[embedded,setEmbedded]=useState<boolean|null>(null),[width,setWidth]=useState(393);
 useEffect(()=>{setEmbedded(new URLSearchParams(window.location.search).has('frame'))},[]);
 if(embedded===null)return null;
 if(!embedded)return <main style={{padding:16}}><h1>Revisão de interface</h1><div style={{display:'flex',gap:12,marginBottom:15}}>{[320,393,768,1280].map(w=><button type="button" className="btn" key={w} onClick={()=>setWidth(w)}>{w}px</button>)}</div><iframe title="Mesa Marcada · revisão" src="/qa-tutorial?frame=1" width={width} height={1000} style={{border:'1px solid #33465d',maxWidth:'none'}}/></main>;
 return <main style={{maxWidth:1100,margin:'auto',padding:'24px 16px 50px'}}><header style={{display:'flex',justifyContent:'space-between',gap:15,marginBottom:24}}><strong>Mesa Marcada</strong>{game&&<button type="button" className="btn" onClick={()=>{setGame(null);window.scrollTo(0,0)}}>Voltar às mesas</button>}</header>{game?(game==='poker'||game==='blackjack'?<TableTutorial game={game}/>:<GameTutorial key={game} game={game}/>):<GameChoices onGame={g=>{setGame(g);window.scrollTo(0,0)}} onTables={()=>setGame('truco')}/>}</main>
}
