"use client";
import dynamic from 'next/dynamic';
import type {Game} from '@/lib/mesa-types';
const GameTutorial=dynamic(()=>import('./game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});
const ClassicGameTutorial=dynamic(()=>import('./classic-game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});

export default function TableTutorial({game}:{game:Game}){
 if(game==='poker'||game==='blackjack')return <ClassicGameTutorial key={game} game={game}/>;
 return <GameTutorial key={game} game={game}/>;
}
