"use client";
import {useRef,type ReactNode} from 'react';
import {GAME_META,type Game} from '@/lib/games';
import {GAME_IDENTITY} from '@/lib/game-identity';
import GameArtwork from './game-artwork';
import './game-tutorial.css';

export type TutorialSection='practice'|'basics'|'rules';
export function TutorialShell({game,intro,edition,variantControl,section,onSectionChange,children}:{game:Game;intro:string;edition:string;variantControl?:ReactNode;section:TutorialSection;onSectionChange:(section:TutorialSection)=>void;children:ReactNode}){
 const lead=useRef<HTMLElement>(null);
 return <div className={'mm-learn mm-identity-'+game} data-tutorial={game}>
  <header className="learn-hero" ref={lead}><div><span className="learn-eyebrow">ESCOLA DA MESA · {GAME_META[game].name}</span><h2>{GAME_IDENTITY[game].lesson}</h2><p>{intro}</p></div><GameArtwork game={game}/></header>
  <div className="learn-toolbar">{variantControl||<span className="learn-edition">{edition}</span>}<span className="learn-local"><span aria-hidden="true">◌</span> Exemplos livres · sem alterar seu placar</span></div>
  <nav className="learn-nav" aria-label="Conteúdo do tutorial">{([['practice','Na prática'],['basics','Passo a passo'],['rules','Regras e dúvidas']] as const).map(([id,label],i)=><button type="button" key={id} aria-pressed={section===id} onClick={()=>onSectionChange(id)}><span aria-hidden="true">0{i+1}</span>{label}</button>)}</nav>
  {children}
  {section==='practice'&&<div className="learn-next"><div><strong>Quer ver a rodada desde o início?</strong><p>Preparação, decisões e encerramento, em ordem.</p></div><button type="button" className="btn" onClick={()=>{onSectionChange('basics');lead.current?.scrollIntoView?.({block:'start',behavior:'auto'})}}>Ver passo a passo <span aria-hidden="true">→</span></button></div>}
  <footer className="learn-footer">Os exercícios são locais. Na partida presencial, o anfitrião registra os resultados conferidos na mesa.</footer>
 </div>;
}
export function Exercise({number,title,hint,children}:{number:string;title:string;hint:string;children:ReactNode}){
 return <section className="learn-exercise"><div className="learn-exercise-heading"><span className="learn-index">{number}</span><div><h3>{title}</h3><p>{hint}</p></div></div>{children}</section>;
}
export function Feedback({good,children}:{good:boolean|null;children:ReactNode}){return <div className={'learn-feedback '+(good===null?'neutral':good?'good':'retry')} role="status" aria-live="polite"><span aria-hidden="true">{good===null?'→':good?'✓':'↺'}</span><div>{children}</div></div>}
export function Reset({onClick,label='Recomeçar exemplo'}:{onClick:()=>void;label?:string}){return <button type="button" className="learn-reset" onClick={onClick}>{label} <span aria-hidden="true">↻</span></button>}
