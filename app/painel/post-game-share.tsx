"use client";
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase/browser';
import type {PostGameCard} from '@/lib/post-game-card';
import {makePostGameImage} from './post-game-card-image';
import './post-game-share.css';

export default function PostGameShare({eventId}:{eventId:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const active=useRef(true),flight=useRef(false),objectUrl=useRef('');
 useEffect(()=>{active.current=true;return()=>{active.current=false;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)}},[]);
 async function prepare(){
  if(flight.current||file)return;flight.current=true;setBusy(true);setError('');
  try{
   const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');
   const {data,error}=await db.rpc('get_post_game_card',{p_event_id:eventId});if(error)throw new Error(error.message);
   if(!data)throw new Error('Resultado indisponível.');
   const blob=await makePostGameImage(data as PostGameCard);if(!active.current)return;
   const imageFile=new File([blob],'mesa-marcada-pos-jogo.png',{type:'image/png'});objectUrl.current=URL.createObjectURL(blob);setUrl(objectUrl.current);setFile(imageFile);
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'Não foi possível preparar o card.')}finally{flight.current=false;if(active.current)setBusy(false)}
 }
 function download(){if(!url)return;const a=document.createElement('a');a.href=url;a.download='mesa-marcada-pos-jogo.png';document.body.appendChild(a);a.click();a.remove();setNotice('Card pronto para salvar. No iPhone, escolha o destino oferecido pelo navegador.')}
 async function share(){
  if(!file)return;setError('');setNotice('');
  // File is prepared before this click, preserving the iPhone user activation.
  if(!navigator.share||!navigator.canShare?.({files:[file]})){download();return}
  try{await navigator.share({title:'Mesa Marcada · pós-jogo',files:[file]});if(active.current)setNotice('Compartilhamento concluído.')}catch(e){if(e instanceof Error&&e.name==='AbortError')return;if(active.current)setError('Não foi possível compartilhar. Use Salvar PNG para guardar a mesma imagem.')}
 }
 return <section className="panel mm-post-game"><div className="panelhead"><div><span className="eyebrow">A NOITE VIROU HISTÓRIA</span><h2>Card de pós-jogo</h2></div><button type="button" className="btn" onClick={()=>{setOpen(!open);if(!open)void prepare()}}>{open?'Recolher card':'Preparar card'}</button></div><p>Resultado da partida em uma imagem para guardar ou compartilhar. Confira a prévia antes de enviar.</p>
  {open&&<>{busy&&<p role="status">Preparando sua imagem…</p>}{error&&<p role="alert" className="mm-message error">{error} {!file&&<button type="button" className="btn" disabled={busy} onClick={()=>void prepare()}>Tentar novamente</button>}</p>}{url&&<div className="mm-post-game-preview"><img src={url} width={1080} height={1350} alt="Prévia do card pós-jogo, com título do evento, modalidade e resultado"/><div><strong>Este é o card que será compartilhado.</strong><p>Inclui título, modalidade, data e resultado. O relatório financeiro e o endereço cadastrado ficam de fora.</p><div className="mm-post-game-actions"><button type="button" className="btn gold" disabled={!file} onClick={()=>void share()}>Compartilhar imagem</button><button type="button" className="btn" disabled={!file} onClick={download}>Salvar PNG</button></div></div></div>}{notice&&<p role="status">{notice}</p>}</>}
 </section>;
}
