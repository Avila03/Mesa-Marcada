"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {getSupabase} from '@/lib/supabase/browser';
import {submitTableOrder,type TableOrderSnapshot,type TableOrderRequest} from '@/lib/table-order';
import type {Game} from '@/lib/games';
import './round-order.css';

export default function RoundOrder({eventId,game,participants,userId,canManage,nameFor}:{eventId:string;game:Game;participants:string[];userId:string;canManage:boolean;nameFor:(id:string)=>string}){
 const [snapshot,setSnapshot]=useState<TableOrderSnapshot>({order:null,locked:true}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[editing,setEditing]=useState(false);
 const [dealer,setDealer]=useState(''),[starter,setStarter]=useState(''),[direction,setDirection]=useState(1),[draftRevision,setDraftRevision]=useState(0),[pending,setPending]=useState<TableOrderRequest|null>(null);
 const active=useRef(true),flight=useRef<Promise<void>|null>(null),busyRef=useRef(false),pendingRef=useRef<TableOrderRequest|null>(null);
 const storageKey='mm-table-order:'+userId+':'+eventId;
 const refresh=useCallback(async()=>{
  if(flight.current)return flight.current;
  const task=(async()=>{const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');const {data,error}=await db.rpc('get_table_order',{p_event_id:eventId});if(error)throw error;if(!data||typeof data.locked!=='boolean')throw new Error('Ordem indisponível. Tente atualizar.');if(active.current)setSnapshot(old=>old.order&&data?.order&&old.order.revision>data.order.revision?old:data as TableOrderSnapshot)})();flight.current=task;try{await task}finally{if(flight.current===task)flight.current=null}
 },[eventId]);
 useEffect(()=>{
  active.current=true;const db=getSupabase();
  try{const stored=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(stored?.p_event_id===eventId&&typeof stored.p_request_id==='string'&&['configure','advance'].includes(stored.p_action)){pendingRef.current=stored;setPending(stored)}}catch{}
  const pull=()=>{if(document.visibilityState==='hidden')return;void refresh().catch(e=>{if(active.current)setError(e.message||'Ordem indisponível.')}).finally(()=>{if(active.current)setLoading(false)})};pull();
  const channel=db?.channel('mm-order-'+eventId).on('postgres_changes',{event:'*',schema:'public',table:'session_table_order',filter:'session_id=eq.'+eventId},pull).on('postgres_changes',{event:'*',schema:'public',table:'session_score_matches',filter:'session_id=eq.'+eventId},pull).on('postgres_changes',{event:'UPDATE',schema:'public',table:'sessions',filter:'id=eq.'+eventId},pull).subscribe();const timer=setInterval(pull,45000);window.addEventListener('online',pull);document.addEventListener('visibilitychange',pull);
  return()=>{active.current=false;clearInterval(timer);window.removeEventListener('online',pull);document.removeEventListener('visibilitychange',pull);if(db&&channel)void db.removeChannel(channel)};
 },[eventId,storageKey,refresh]);
 function remember(request:TableOrderRequest|null){pendingRef.current=request;if(active.current)setPending(request);try{if(request)sessionStorage.setItem(storageKey,JSON.stringify(request));else sessionStorage.removeItem(storageKey)}catch{}}
 const players=(snapshot.eligible_players||participants).filter(id=>participants.includes(id));
 function edit(){const order=snapshot.order;setDealer(order?.dealer_id||snapshot.fixed_dealer_id||players[0]||'');setStarter(order?.starter_id||players[1]||'');setDirection(order?.direction||1);setDraftRevision(order?.revision||0);setEditing(true);setError('')}
 async function save(action:'configure'|'advance'){
  if(busyRef.current||!canManage)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
  const request=pendingRef.current||{p_request_id:crypto.randomUUID(),p_event_id:eventId,p_revision:action==='configure'?draftRevision:snapshot.order?.revision||0,p_action:action,p_dealer:action==='configure'?dealer||null:null,p_starter:action==='configure'?starter||null:null,p_direction:action==='configure'?direction:1};remember(request);
  try{const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');await submitTableOrder(db,request);remember(null);if(active.current){setEditing(false);setNotice('Ordem confirmada.')}try{await refresh()}catch{if(active.current)setNotice('Ordem confirmada. A atualização da tela está pendente.')}}catch(e){const err=e as Error&{code?:string};if(err.code){remember(null);if(active.current)setEditing(false)}if(active.current)setError(err.message||'Não foi possível atualizar a ordem.');void refresh().catch(()=>{})}finally{busyRef.current=false;if(active.current)setBusy(false)}
 }
 const order=snapshot.order,locked=loading||busy||!!pending||snapshot.locked,blackjack=game==='blackjack';
 function submit(e:FormEvent){e.preventDefault();if(!locked)void save('configure')}
 return <section className="panel mm-round-order" aria-label="Ordem da mesa"><div className="panelhead"><div><span className="eyebrow">ORGANIZAÇÃO DA RODADA</span><h2>Quem distribui e quem começa</h2></div>{order&&<span className="tag">Distribuição {order.distribution}</span>}</div>
  {loading?<p role="status">Carregando ordem da mesa…</p>:<div className="mm-round-roles"><div><small>{blackjack?'Croupier fixo':'Quem distribui'}</small><strong>{order?.dealer_id||snapshot.fixed_dealer_id?nameFor((order?.dealer_id||snapshot.fixed_dealer_id)!):'Ainda não definido'}</strong></div><div><small>{blackjack?'Primeiro a receber':game==='poker'?'Primeiro a agir · combinado':'Quem começa'}</small><strong>{order?.starter_id?nameFor(order.starter_id):'Ainda não definido'}</strong></div></div>}
  {error&&<p className="mm-message error" role="alert">{error} <button className="btn" type="button" disabled={busy} onClick={()=>{setError('');void refresh().catch(e=>setError(e.message))}}>Atualizar ordem</button></p>}
  {notice&&<p className="mm-formfoot" role="status">{notice}</p>}
  {pending&&canManage&&<p className="mm-message" role="status">Confirmação pendente. <button type="button" className="btn" disabled={busy} onClick={()=>void save(pending.p_action)}>Confirmar mesma tentativa</button></p>}
  {canManage&&!snapshot.locked&&<div className="mm-round-actions"><button className="btn" type="button" disabled={locked} onClick={edit}>{order?'Ajustar responsáveis':'Definir responsáveis'}</button>{order&&<button className="btn" type="button" disabled={locked} onClick={()=>void save('advance')}>Próxima distribuição</button>}</div>}
  {editing&&canManage&&!snapshot.locked&&<form className="mm-round-form" onSubmit={submit}>
   <label className="mm-field">{blackjack?'Croupier fixo':'Quem distribui'}<select value={dealer} disabled={locked||blackjack} required onChange={e=>{setDealer(e.target.value);if(game!=='poker'&&starter===e.target.value)setStarter('')}}><option value="">Selecione</option>{players.map(id=><option value={id} key={id}>{nameFor(id)}</option>)}</select></label>
   <label className="mm-field">{blackjack?'Primeiro a receber':'Quem começa'}<select value={starter} required disabled={locked} onChange={e=>setStarter(e.target.value)}><option value="">Selecione</option>{players.filter(id=>game==='poker'||id!==dealer).map(id=><option value={id} key={id}>{nameFor(id)}</option>)}</select></label>
   <label className="mm-field">Sentido combinado<select value={direction} disabled={locked} onChange={e=>setDirection(Number(e.target.value))}><option value={1}>Horário</option><option value={-1}>Anti-horário</option></select></label>
   <div className="mm-round-actions"><button className="btn gold" disabled={locked}>Salvar ordem</button><button className="btn" type="button" onClick={()=>setEditing(false)}>Cancelar ajuste</button></div>
  </form>}
  <p className="mm-formfoot">Guia para a partida presencial. Avance ao terminar uma distribuição; os responsáveis passam ao próximo assento no sentido escolhido{blackjack?', mantendo o croupier fixo':''}. Ajuste conforme as regras da mesa. {game==='poker'?'Blinds e ordem pré/pós-flop são conferidos presencialmente.':game==='uno'?'Inverter, pular e compras continuam sendo resolvidos presencialmente.':''}</p>
 </section>;
}
