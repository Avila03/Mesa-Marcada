'use client';
import {useState} from 'react';
import '../v05-theme.css';
import '../painel/duo-theme.css';
import GameChoices from '../painel/game-choices';
import GameTutorial from '../painel/game-tutorial';
import TableTutorial from '../painel/table-tutorial';
import type {Game} from '@/lib/games';
export default function Review(){
 const [game,setGame]=useState<Game|null>(null);
 return <main style={{maxWidth:1100,margin:'auto',padding:'24px 16px 50px'}}><header style={{display:'flex',justifyContent:'space-between',gap:15,marginBottom:24}}><strong>Mesa Marcada</strong>{game&&<button type="button" className="btn" onClick={()=>setGame(null)}>Voltar às mesas</button>}</header>{game?(game==='poker'||game==='blackjack'?<TableTutorial game={game}/>:<GameTutorial key={game} game={game}/>):<GameChoices onGame={setGame} onTables={()=>setGame('truco')}/>}</main>
}
