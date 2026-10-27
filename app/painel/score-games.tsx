"use client";
import dynamic from 'next/dynamic';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {getSupabase} from '@/lib/supabase/browser';
import {runMutation} from '@/lib/mutations';
import {scoreRequest,submitScoreRequest,type ScoreRequest} from '@/lib/score-command';
import {GAME_META,VARIANT_NAMES,TRUCO_STAKES,defaultVariant,pairedGame,type Game} from '@/lib/games';
import type {Attendance,Event,TableSeat} from '@/lib/mesa-types';
import './score-games.css';
const GameTutorial=dynamic(()=>import('./game-tutorial'),{loading:()=> <p role="status">Preparando as cartas do tutorial…</p>});
export type ScoreMatch={session_id:string;game:Game;variant:string;target:number;players:string[];teams:number[];state:{scores:number[];round:number;envite_recorded:boolean};revision:number;status:'live'|'complete';winner_ids:string[]};
type ScoreAction={id:string;actor_id:string;action:string;payload:Record<string,unknown>;revision:number;undone_at:string|null;created_at:string};
type ScoreSnapshot={match:ScoreMatch|null;actions:ScoreAction[]};
const errorText=(e:unknown)=>e instanceof Error?e.message:'Não foi possível atualizar o placar.';
const number=(n:number)=>new Intl.NumberFormat('pt-BR').format(n);
const actionName:Record<string,string>={truco_hand:'Mão de truco',truco_envite:'Envite',canastra_round:'Rodada de Canastra/Buraco',pontinho_round:'Rodada de Pontinho',uno_round:'Rodada de UNO',pife_round:'Batida de Pife',undo:'Último lançamento desfeito',finish:'Evento encerrado'};
const enviteName:Record<string,string>={envido_recusado:'Envido / real isolado recusado · 1',envido_envido:'Envido + envido · 4',envido_envido_real:'Envido + envido + real · 7',envite_conferido:'Outro envite · valor conferido na mesa',envido:'Envido simples · 2',real:'Real envido isolado · 3',envido_real:'Envido + real envido · 5',flor:'Flor simples · 3',contra_flor:'Contra-flor · 6',falta:'Falta envido · diferença para a meta',contra_flor_resto:'Contra-flor e o resto · diferença para a meta'};
export default function ScoreGamePanel({event,game,guests,seats,userId,canManage,nameFor,onChanged}:{event:Event;game:Game;guests:Attendance[];seats:TableSeat[];userId:string;canManage:boolean;nameFor:(id:string)=>string;onChanged:()=>Promise<void>}){
 const [snapshot,setSnapshot]=useState<ScoreSnapshot>({match:null,actions:[]});const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [teams,setTeams]=useState<Record<string,number>>({});const [enviteKind,setEnviteKind]=useState('envido');
 const [winner,setWinner]=useState(0),[handValue,setHandValue]=useState(0),[showRules,setShowRules]=useState(false);
 const [pending,setPending]=useState<ScoreRequest|null>(null);const pendingRef=useRef<ScoreRequest|null>(null),busyRef=useRef(false),active=useRef(true),flight=useRef<Promise<void>|null>(null);
 const storageKey='mm-score-request:'+userId+':'+event.id;
 const match=snapshot.match;
 const refresh=useCallback(async()=>{
  if(flight.current)return flight.current;
  const task=(async()=>{const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');const {data,error}=await db.rpc('get_score_game',{p_event_id:event.id});if(error)throw new Error(error.message);if(!active.current)return;const incoming=data as ScoreSnapshot;setSnapshot(old=>old.match&&incoming.match&&old.match.revision>incoming.match.revision?old:incoming)})();
  flight.current=task;try{await task}finally{if(flight.current===task)flight.current=null}
 },[event.id]);
 useEffect(()=>{
  active.current=true;const db=getSupabase();
  try{const r=JSON.parse(sessionStorage.getItem(storageKey)||'null');if(r&&r.p_event_id===event.id&&typeof r.p_request_id==='string'&&typeof r.p_expected_revision==='number'){pendingRef.current=r;setPending(r)}}catch{}
  const pull=()=>{if(document.visibilityState==='hidden')return;void refresh().catch(e=>{if(active.current)setError(errorText(e))}).finally(()=>{if(active.current)setLoading(false)})};pull();
  const channel=db?.channel('mm-score-'+event.id).on('postgres_changes',{event:'*',schema:'public',table:'session_score_matches',filter:'session_id=eq.'+event.id},pull).subscribe();
  const timer=setInterval(pull,45000);window.addEventListener('online',pull);document.addEventListener('visibilitychange',pull);
  return()=>{active.current=false;clearInterval(timer);window.removeEventListener('online',pull);document.removeEventListener('visibilitychange',pull);if(db&&channel)void db.removeChannel(channel)};
 },[event.id,storageKey,refresh]);
 const participants=guests.slice().sort((a,b)=>(seats.find(s=>s.user_id===a.user_id)?.seat_no||99)-(seats.find(s=>s.user_id===b.user_id)?.seat_no||99)||a.user_id.localeCompare(b.user_id));
 const paired=pairedGame(game),variant=match?.variant||event.game_variant||defaultVariant(game)||'';
 const labels=match?(paired?[0,1].map(side=>match.players.filter((_,i)=>match.teams[i]===side).map(nameFor).join(' & ')):match.players.map(nameFor)):[];
 const locked=busy||!!pending||event.status!=='scheduled'||match?.status==='complete';
 const remember=(request:ScoreRequest|null)=>{pendingRef.current=request;setPending(request);try{if(request)sessionStorage.setItem(storageKey,JSON.stringify(request));else sessionStorage.removeItem(storageKey)}catch{}};
 async function save(action:string,payload:Record<string,unknown>={}){
  if(busyRef.current||!match||!canManage)return;
  busyRef.current=true;setBusy(true);setError('');setNotice('');
  const request=pendingRef.current||scoreRequest(event.id,match.revision,action,payload);remember(request);
  try{
   const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');
   await submitScoreRequest(db,request);remember(null);setNotice(action==='finish'?'Evento encerrado. Resultado preservado no histórico.':'Lançamento confirmado.');
   try{await refresh();await onChanged()}catch{setNotice('Lançamento confirmado. A atualização da tela está pendente; não repita com novos valores.')}
  }catch(e){if((e as {code?:string}).code)remember(null);setError(errorText(e));void refresh().catch(()=>{});}
  finally{busyRef.current=false;setBusy(false)}
 }
 async function start(){
  if(busyRef.current||!canManage)return;busyRef.current=true;setBusy(true);setError('');
  try{const db=getSupabase();if(!db)throw new Error('Conexão indisponível.');await runMutation(db,userId,'start_score_game',{p_event_id:event.id,p_players:participants.map(p=>p.user_id),p_teams:participants.map((p,i)=>paired?(teams[p.user_id]??i%2):i)});setNotice('Partida iniciada. Os participantes ficam fixos até o encerramento.');try{await refresh();await onChanged()}catch{setNotice('Partida iniciada. Atualização da tela pendente.')}}catch(e){setError(errorText(e));void refresh().catch(()=>{})}finally{busyRef.current=false;setBusy(false)}
 }
 function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!match||locked)return;const data=new FormData(e.currentTarget);const read=(key:string)=>Number(data.get(key)||0);
  if(game==='truco')void save('truco_hand',{side:winner,points:read('points')});
  else if(game==='canastra')void save('canastra_round',{winner:read('batida'),cards:[read('cards0'),read('cards1')],hands:[read('hands0'),read('hands1')],clean:[read('clean0'),read('clean1')],dirty:[read('dirty0'),read('dirty1')],dead:[data.has('dead0')?1:0,data.has('dead1')?1:0]});
  else if(game==='pife')void save('pife_round',{winner});
  else void save(game+'_round',{winner,losses:match.players.map((_,i)=>i===winner||game==='pontinho'&&match.state.scores[i]<=0?0:read('loss'+i))});
 }
 const stakes=TRUCO_STAKES[variant]||[1];const special=variant==='paulista'&&match?.state.scores.includes(11)?[1,3]:variant==='mineiro'&&match?.state.scores.includes(10)?[2,4]:stakes;
 const availableWinner=match&&game==='pontinho'&&match.state.scores[winner]<=0?match.state.scores.findIndex(n=>n>0):winner;
 // A restored or eliminated winner is reset before the next entry.
 useEffect(()=>{if(availableWinner!==winner)setWinner(availableWinner)},[availableWinner,winner]);
 return <section className="mm-score-module" aria-label={'Placar de '+GAME_META[game].name}>
  <div className="panel"><div className="panelhead"><div><span className="eyebrow">{VARIANT_NAMES[variant]}</span><h2>{GAME_META[game].name} · {game==='pontinho'?'Saldo por jogador':'Placar da partida'}</h2></div><button type="button" className="btn" onClick={()=>setShowRules(!showRules)}>{showRules?'Fechar regras':'Como jogar'}</button></div>
  <p className="mm-formfoot">{game==='pontinho'?'Saldo inicial':game==='pife'?'Meta de vitórias':'Meta'}: {event.score_target||match?.target} {game==='truco'?'tentos':game==='pife'?'vitórias':'pontos'}. {match?'Rodada '+match.state.round+' · revisão '+match.revision:'Escolham os lugares antes de iniciar.'}</p>
  {error&&<p className="mm-message error" role="alert">{error} <button type="button" className="btn" onClick={()=>{setError('');void refresh().catch(e=>setError(errorText(e)))}}>Atualizar placar</button></p>}
  {notice&&<p className="mm-message" role="status">{notice}</p>}
  {pending&&<div className="mm-message" role="status"><strong>Há uma confirmação pendente.</strong><p>Reenvie a mesma tentativa para confirmar se ela foi gravada. A identificação é preservada para evitar duplicação.</p><button type="button" className="btn gold" disabled={busy} onClick={()=>void save(pending.p_action,pending.p_payload)}>Confirmar mesma tentativa</button></div>}
  {loading?<p role="status">Carregando placar…</p>:!match?<>
   <p className="mm-formfoot">{paired?'Confira as equipes. Cada lado precisa ter a mesma quantidade de jogadores.':'Confira os jogadores que participarão de todas as rodadas.'}</p>
   <div className="mm-score-roster">{participants.map((p,i)=><label className="mm-field" key={p.user_id}>{nameFor(p.user_id)}{paired?<select disabled={!canManage||busy} value={teams[p.user_id]??i%2} onChange={e=>setTeams({...teams,[p.user_id]:Number(e.target.value)})}><option value={0}>Equipe Azul</option><option value={1}>Equipe Vermelha</option></select>:<span>Jogador {i+1}</span>}</label>)}</div>
   {!participants.length&&<p>Os participantes aparecem aqui depois de escolherem seus assentos.</p>}
   {canManage&&event.status==='scheduled'?<button type="button" className="btn gold" disabled={busy||participants.length<(game==='pontinho'?3:2)} onClick={()=>void start()}>{busy?'Iniciando…':'Conferir participantes e iniciar'}</button>:<p>Aguarde o anfitrião iniciar a partida.</p>}
  </>:<>
   <div className={'mm-score-board '+(paired?'paired':'individual')}>{match.state.scores.map((value,i)=><div className={'mm-score-cell side-'+i} key={i}><small>{paired?'Equipe '+(i===0?'Azul':'Vermelha'):game==='pontinho'&&value<=0?'Eliminado':'Jogador'}</small><h3>{labels[i]}</h3><strong>{number(value)}</strong><span>{game==='pife'?'vitórias':game==='truco'?'tentos':game==='pontinho'?'de saldo':'pontos'}</span></div>)}</div>
   {match.status==='complete'&&<div className="mm-score-winner" role="status"><strong>Resultado definido: {match.winner_ids.map(nameFor).join(' & ')}</strong><p>{event.status==='finished'?'Evento encerrado e resultado disponível no ranking.':'Confira o histórico e encerre o evento para publicar o resultado no ranking.'}</p></div>}
   {canManage&&event.status==='scheduled'&&<>
    {match.status==='live'&&<form className="mm-form-stack mm-score-form" onSubmit={submit}>
     {game!=='canastra'&&<label className="mm-field">{paired?'Equipe vencedora':'Quem bateu?'}<select value={availableWinner} disabled={locked} onChange={e=>setWinner(Number(e.target.value))}>{labels.map((name,i)=><option key={i} value={i} disabled={game==='pontinho'&&match.state.scores[i]<=0}>{name}</option>)}</select></label>}
     {game==='truco'&&<><label className="mm-field">Valor conferido da mão<select name="points" value={special.includes(handValue)?handValue:special[0]} onChange={e=>setHandValue(Number(e.target.value))} disabled={locked}>{special.map(p=><option key={p} value={p}>{p} {p===1?'tento':'tentos'}</option>)}</select></label><p className="mm-formfoot">Registre o valor devido após a disputa presencial, incluindo o valor anterior se houve recusa. Mão de onze/dez segue as regras da variante.</p></>}
     {game==='canastra'&&<CanastraInputs disabled={locked} labels={labels}/>}
     {(game==='pontinho'||game==='uno')&&<><p className="mm-formfoot">{game==='uno'?'Some as cartas de cada adversário: números pelo valor; ações 20; curinga/comprar quatro 50. O vencedor recebe a soma.':'Informe o valor das cartas restantes, não sua quantidade. Quem bate não perde saldo.'}</p><div className="mm-score-inputs">{match.players.map((id,i)=><label key={id} className="mm-field">{nameFor(id)} · cartas restantes<input type="number" name={'loss'+i} min={0} max={game==='uno'?10000:500} step={1} required defaultValue={0} disabled={locked||i===availableWinner||game==='pontinho'&&match.state.scores[i]<=0}/></label>)}</div></>}
     <button type="submit" className="btn gold" disabled={locked}>{busy?'Registrando…':game==='pife'?'Confirmar batida':'Confirmar resultado da rodada'}</button>
    </form>}
    {game==='truco'&&variant==='gauderio'&&match.status==='live'&&<form className="mm-form-stack mm-score-envite" onSubmit={e=>{e.preventDefault();if(locked)return;const d=new FormData(e.currentTarget);void save('truco_envite',{kind:d.get('kind'),side:Number(d.get('side')),points:Number(d.get('envite_points')||0)})}}><h3>Envido e flor</h3><p className="mm-formfoot">Disputa já resolvida presencialmente, antes de concluir a mão. Um lançamento de envite por mão; propostas encadeadas são conferidas juntas.</p><div className="mm-score-inputs"><label className="mm-field">Disputa aceita<select name="kind" value={enviteKind} onChange={e=>setEnviteKind(e.target.value)} disabled={locked||match.state.envite_recorded}>{Object.entries(enviteName).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><label className="mm-field">Equipe vencedora do envite<select name="side" disabled={locked||match.state.envite_recorded}>{labels.map((name,i)=><option value={i} key={i}>{name}</option>)}</select></label></div>{enviteKind==='envite_conferido'&&<label className="mm-field">Tentos conferidos (proposta aceita ou recusa)<input name="envite_points" type="number" min={1} max={match.target} required step={1} defaultValue={1} disabled={locked||match.state.envite_recorded}/></label>}<button className="btn" disabled={locked||match.state.envite_recorded}>{match.state.envite_recorded?'Envite já registrado':'Confirmar envite'}</button></form>}
    <div className="mm-score-actions"><button type="button" className="btn" disabled={busy||!!pending||!snapshot.actions.some(a=>a.action!=='undo'&&a.action!=='finish'&&!a.undone_at)} onClick={()=>{if(window.confirm('Desfazer o último lançamento válido desta partida? A ação ficará no histórico.'))void save('undo')}}>Desfazer último lançamento</button>{match.status==='complete'&&<button type="button" className="btn gold" disabled={busy||!!pending} onClick={()=>{if(window.confirm('Encerrar a partida com o resultado conferido? O histórico ficará imutável.'))void save('finish')}}>Encerrar evento e publicar resultado</button>}</div>
   </>}
   <details className="mm-score-history" open><summary>Histórico da partida · {snapshot.actions.length} registros recentes</summary>{snapshot.actions.length?<ol>{snapshot.actions.map(a=><li key={a.id}><strong>{actionName[a.action]||a.action}{a.action==='truco_envite'?' · '+(enviteName[String(a.payload.kind)]||''):''}</strong>{a.undone_at&&<span> · desfeito</span>}<small>{nameFor(a.actor_id)} · {new Date(a.created_at).toLocaleString('pt-BR')} · #{a.revision}</small></li>)}</ol>:<p>Nenhuma rodada registrada.</p>}</details>
  </>}
  </div>{showRules&&<GameTutorial game={game} variant={variant}/>}
 </section>;
}
function CanastraInputs({disabled,labels}:{disabled:boolean;labels:string[]}){
 const [winner,setWinner]=useState('0'),[values,setValues]=useState<Record<string,number>>({});
 const field=(key:string,name:string,max:number)=> <label className="mm-field">{name}<input type="number" name={key} min={0} max={max} required step={1} value={values[key]||0} disabled={disabled} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>;
 return <><label className="mm-field">Quem deu a batida final?<select name="batida" value={winner} onChange={e=>setWinner(e.target.value)} disabled={disabled}><option value={-1}>Sem batida · monte esgotado</option>{labels.map((l,i)=><option key={i} value={i}>{l}</option>)}</select></label><div className="mm-score-inputs">{[0,1].map(i=><fieldset key={i} className="mm-score-close"><legend>{labels[i]}</legend>{field('cards'+i,'Pontos das cartas baixadas',10000)}{field('clean'+i,'Canastras limpas · +200 cada',30)}{field('dirty'+i,'Canastras sujas · +100 cada',30)}{field('hands'+i,'Pontos restantes nas mãos',10000)}<label className="mm-score-check"><input type="checkbox" name={'dead'+i} checked={values['dead'+i]===1} disabled={disabled} onChange={e=>setValues({...values,['dead'+i]:e.target.checked?1:0})}/>Não pegou o morto · −100</label><p>Resultado: <b>{number((values['cards'+i]||0)+200*(values['clean'+i]||0)+100*(values['dirty'+i]||0)-(values['hands'+i]||0)-100*(values['dead'+i]||0)+(winner===String(i)?100:0))}</b></p></fieldset>)}</div></>;
}
