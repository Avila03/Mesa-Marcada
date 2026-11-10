"use client";
import {useEffect,useRef,type MouseEvent} from 'react';
/** state marca a fase do encontro (etapas); secondary agrupa tarefas paralelas, como Despesas. */
export type TaskLink={id:string;label:string;href:string;onSelect:()=>void;state?:'done'|'now'|'next';secondary?:boolean};
export default function TaskNavigation({label,items,active}:{label:string;items:TaskLink[];active:string}){
 const navigation=useRef<HTMLElement>(null);
 useEffect(()=>{
  const nav=navigation.current,link=nav?.querySelector<HTMLElement>('[aria-current="page"]');
  if(!nav||!link)return;
  const left=link.offsetLeft-nav.offsetLeft,right=left+link.offsetWidth;
  if(left<nav.scrollLeft)nav.scrollLeft=left;
  else if(right>nav.scrollLeft+nav.clientWidth)nav.scrollLeft=right-nav.clientWidth;
 },[active]);
 function follow(event:MouseEvent<HTMLAnchorElement>,select:()=>void){
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();select();window.scrollTo({top:0,behavior:'auto'});
 }
 const steps=items.filter(item=>item.state&&!item.secondary);
 if(!steps.length)return <nav ref={navigation} className="mm-task-nav" aria-label={label}>{items.map(item=><a href={item.href} key={item.id} aria-current={item.id===active?'page':undefined} onClick={event=>follow(event,item.onSelect)}>{item.label}</a>)}</nav>;
 const extras=items.filter(item=>!steps.includes(item));
 const phase={done:'concluída',now:'fase atual',next:'próxima'} as const;
 return <nav ref={navigation} className="mm-task-steps" aria-label={label}>
  <ol className="mm-steps" style={{gridTemplateColumns:'repeat('+steps.length+',minmax(0,1fr))'}}>
   {steps.map((item,i)=><li key={item.id} className={'mm-step is-'+item.state}>
    <a href={item.href} aria-current={item.id===active?'page':undefined} onClick={event=>follow(event,item.onSelect)}>
     <span className="mm-step-dot" aria-hidden="true">{item.state==='done'?'✓':i+1}</span>
     <span className="mm-step-label">{item.label}</span>
     <span className="mm-visually-hidden"> ({phase[item.state||'next']})</span>
    </a>
   </li>)}
  </ol>
  {extras.length>0&&<div className="mm-task-extras">{extras.map(item=><a href={item.href} key={item.id} aria-current={item.id===active?'page':undefined} onClick={event=>follow(event,item.onSelect)}>{item.label}</a>)}</div>}
 </nav>;
}
