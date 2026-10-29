"use client";
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {CrestMark} from '@/app/brasoes/demo/crest-editor';

/** Reuse the league's exact editor artwork, including its chosen finish. */
export function renderCardCrest(value:unknown):string{
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:360px;height:420px;pointer-events:none';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
 const root=createRoot(host);
 try{flushSync(()=>root.render(<CrestMark value={value}/>));const svg=host.querySelector('svg');if(!svg)throw new Error('Brasão indisponível.');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','360');svg.setAttribute('height','420');return new XMLSerializer().serializeToString(svg)}finally{root.unmount();host.remove()}
}
