"use client";
import {useEffect,useRef,useState} from 'react';
import {getSupabase} from '@/lib/supabase/browser';
import {cardDimensions,type CardFormat,type PostGameCard} from '@/lib/post-game-card';
import {shareCardImage} from '@/lib/share-card-image';
import {makePostGameImage} from './post-game-card-image';
import './post-game-share.css';

export default function PostGameShare({eventId}:{eventId:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[url,setUrl]=useState(''),[file,setFile]=useState<File|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [format,setFormat]=useState<CardFormat>('compact');
 const snapshot=useRef<PostGameCard|null>(null),crest=useRef<string|undefined>(undefined);
 const active=useRef(true),flight=useRef(false),objectUrl=useRef('');
 useEffect(()=>{active.current=true;return()=>{active.current=false;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)}},[]);
 async function prepare(nextFormat:CardFormat=format){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');setNotice('');setFile(null);setUrl('');setFormat(nextFormat);
  try{
   if(!snapshot.current){const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');const {data,error}=await db.rpc('get_post_game_card',{p_event_id:eventId});if(error)throw new Error(error.message);if(!data)throw new Error('Resultado indisponível.');snapshot.current=data as PostGameCard;}
   if(snapshot.current.league&&!crest.current){const {renderCardCrest}=await import('./post-game-crest');crest.current=renderCardCrest(snapshot.current.league.emblem)}
   const blob=await makePostGameImage(snapshot.current,nextFormat,crest.current);if(!active.current)return;
   const imageFile=new File([blob],`mesa-marcada-pos-jogo-${nextFormat}.png`,{type:'image/png'});const nextUrl=URL.createObjectURL(blob);if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=nextUrl;setUrl(nextUrl);setFile(imageFile);
  }catch(e){if(active.current)setError(e instanceof Error?e.message:'Não foi possível preparar o card.')}finally{flight.current=false;if(active.current)setBusy(false)}
 }
 function download(){if(!url)return;const a=document.createElement('a');a.href=url;a.download=file?.name||'mesa-marcada-pos-jogo.png';document.body.appendChild(a);a.click();a.remove();setNotice('Card pronto para salvar. No iPhone, escolha o destino oferecido pelo navegador.')}
 async function share(){
  if(!file)return;setError('');setNotice('');
  // File is prepared before this click, preserving the iPhone user activation.
  try{const result=await shareCardImage(file);if(!active.current)return;if(result==='unsupported'){download();return}if(result==='shared')setNotice('Compartilhamento concluído.')}catch(e){if(active.current)setError('Não foi possível compartilhar. Use Salvar PNG para guardar a mesma imagem.')}
 }
 return <section className="panel mm-post-game"><div className="panelhead"><div><span className="eyebrow">A NOITE VIROU HISTÓRIA</span><h2>Card de pós-jogo</h2></div><button type="button" className="btn" onClick={()=>{setOpen(!open);if(!open&&!file)void prepare()}}>{open?'Recolher card':'Preparar card'}</button></div><p>Resultado da partida em uma imagem para guardar ou compartilhar. Confira a prévia antes de enviar.</p>
  {open&&<><div className="mm-post-game-formats" role="group" aria-label="Formato do card"><button type="button" className="btn" aria-pressed={format==='compact'} disabled={busy} onClick={()=>void prepare('compact')}>Compacto · 4:5</button><button type="button" className="btn" aria-pressed={format==='story'} disabled={busy} onClick={()=>void prepare('story')}>Stories · 9:16</button></div>{busy&&<p role="status">Preparando sua imagem…</p>}{error&&<p role="alert" className="mm-message error">{error} {!file&&<button type="button" className="btn" disabled={busy} onClick={()=>void prepare()}>Tentar novamente</button>}</p>}{url&&<div className="mm-post-game-preview"><img src={url} width={1080} height={cardDimensions(format).height} style={{aspectRatio:`1080 / ${cardDimensions(format).height}`}} alt="Prévia do card pós-jogo, com título do evento, modalidade e resultado"/><div><strong>Este é o card que será compartilhado.</strong><p>Inclui título, modalidade, data, resultado e, quando houver, a liga e as novas conquistas da partida. O relatório financeiro e o endereço cadastrado ficam de fora.</p><div className="mm-post-game-actions"><button type="button" className="btn gold" disabled={!file} onClick={()=>void share()}>Compartilhar imagem</button><button type="button" className="btn" disabled={!file} onClick={download}>Salvar PNG</button></div></div></div>}{notice&&<p role="status">{notice}</p>}</>}
 </section>;
}
