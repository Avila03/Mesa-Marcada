"use client";
import dynamic from 'next/dynamic';
import type {Game} from '@/lib/mesa-types';
const GameTutorial=dynamic(()=>import('./game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});
const ClassicGameTutorial=dynamic(()=>import('./classic-game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});

export default function TableTutorial({game,variant}:{game:Game;variant?:string|null}){
 if(game==='poker'||game==='blackjack')return <ClassicGameTutorial key={game+":"+variant} game={game} variant={variant}/>;
 return <GameTutorial key={game+":"+variant} game={game} variant={variant}/>;
}
