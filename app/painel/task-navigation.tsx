"use client";
import {useEffect,useRef,type MouseEvent} from 'react';
export type TaskLink={id:string;label:string;href:string;onSelect:()=>void};
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
 return <nav ref={navigation} className="mm-task-nav" aria-label={label}>{items.map(item=><a href={item.href} key={item.id} aria-current={item.id===active?'page':undefined} onClick={event=>follow(event,item.onSelect)}>{item.label}</a>)}</nav>;
}
