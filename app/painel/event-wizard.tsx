"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {GAME_META,VARIANT_NAMES,defaultVariant,defaultTarget,isChipGame,targetLabel} from '@/lib/games';
import type {Event,Room} from '@/lib/mesa-types';
import {money} from '@/lib/mesa-types';
import {chipPriceFields,eventCapacity,eventDraftKey,restoreEventDraft,validateEventDraft,type EventDraft} from '@/lib/event-draft';
import GameArtwork from './game-artwork';

type Props={userId:string;initial:EventDraft;event?:Event;rooms:Room[];leagues:{id:string;name:string}[];step:number;onStep:(step:number)=>void;onSave:(draft:EventDraft)=>Promise<boolean>;onExit:()=>void;busy:boolean;pricingLocked:boolean;source?:string};
export default function EventWizard({userId,initial,event,rooms,leagues,step,onStep,onSave,onExit,busy,pricingLocked,source}:Props){
 const key=eventDraftKey(userId,event?.id),loaded=useRef(false),finished=useRef(false),submitting=useRef(false);
 const [form,setForm]=useState<EventDraft>(initial),[ready,setReady]=useState(false),[localError,setLocalError]=useState(''),[draftSaved,setDraftSaved]=useState(false);
 const section=useRef<HTMLDivElement>(null),edit=Boolean(event),room=rooms.find(r=>r.id===form.room_id),game=room?.game;
 useEffect(()=>{
  if(loaded.current)return;loaded.current=true;
  let restored=null;try{restored=restoreEventDraft(sessionStorage.getItem(key))}catch{}
  const value=restored?.form||initial;
  // A game chosen in its own page changes only the game's rules in an existing draft.
  const next=restored&&initial.room_id&&!edit?{...value,room_id:initial.room_id,game_variant:initial.game_variant,score_target:initial.score_target,max_participants:initial.max_participants,min_entry_brl:initial.min_entry_brl,chip_pricing_special:initial.chip_pricing_special}:value;
  const scoped=initial.league_id&&!edit?{...next,league_id:initial.league_id,visibility:"private" as const}:next;
  setForm(scoped);setReady(true);
  const requested=restored&&step===1&&!initial.room_id?restored.step:step;
  const issue=validateEventDraft(scoped,rooms,requested===3?2:1);
  onStep(issue&&requested>1?issue.step:requested);
 },[key,initial,source,edit,step,onStep,rooms]);
 useEffect(()=>{
  if(!ready||finished.current)return;
  try{sessionStorage.setItem(key,JSON.stringify({version:1,form,step}));setDraftSaved(true)}catch{setDraftSaved(false)}
 },[form,step,key,ready]);
 function change(values:Partial<EventDraft>){setLocalError('');setForm(previous=>({...previous,...values}))}
 function advance(){
  const issue=validateEventDraft(form,rooms,step);if(issue){setLocalError(issue.message);return}
  setLocalError('');onStep(Math.min(3,step+1));window.scrollTo({top:0,behavior:'auto'});
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!ready||submitting.current)return;
  if(step<3){advance();return}
  const issue=validateEventDraft(form,rooms);if(issue){setLocalError(issue.message);onStep(issue.step);return}
  if(!edit&&form.league_id&&!leagues.some(l=>l.id===form.league_id)){setLocalError('Esta liga não está disponível para organizar. Escolha outra liga ou um evento independente.');onStep(2);return}
  submitting.current=true;
  try{if(await onSave(form)){finished.current=true;try{sessionStorage.removeItem(key)}catch{}}}finally{submitting.current=false}
 }
 function discard(){try{sessionStorage.removeItem(key)}catch{};finished.current=true;onExit()}
 if(!ready)return <p role="status">Preparando o formulário…</p>;
 const capacity=game?eventCapacity(game,form.game_variant):{min:2,max:10,step:1};
 return <div className="mm-wizard" ref={section}>
  <button className="back" type="button" disabled={busy} onClick={onExit}>← Voltar</button>
  <header className="mm-task-heading"><small>{edit?'AJUSTAR ENCONTRO':'ORGANIZAR UM ENCONTRO'}</small><h1>{edit?'Editar evento':source?'Jogar novamente':'Criar evento'}</h1><p>Um passo de cada vez. {draftSaved?'Rascunho salvo nesta aba do navegador.':'Confira os dados antes de criar.'}</p></header>
  <ol className="mm-wizard-steps" aria-label="Etapas de criação">{['Jogo e regras','Encontro','Conferir'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
  {source&&<p className="mm-message">Baseado em <strong>{source}</strong>. Escolha uma nova data; participantes, resultados e despesas não são copiados.</p>}
  {localError&&<p className="mm-message error" role="alert">{localError}</p>}
  <form className="mm-form-stack panel" onSubmit={e=>void submit(e)} noValidate>
   {step===1&&<>
    <h2>Qual será o jogo?</h2>
    <label className="mm-field">Jogo<select required value={form.room_id} disabled={edit||busy} onChange={e=>{const next=rooms.find(r=>r.id===e.target.value);if(next)change({room_id:next.id,game_variant:defaultVariant(next.game)||'',score_target:String(defaultTarget(next.game,defaultVariant(next.game))),max_participants:String(GAME_META[next.game].capacity),min_entry_brl:'0',chip_pricing_special:false})}}><option value="" disabled>Escolha uma modalidade</option>{rooms.map(r=><option value={r.id} key={r.id}>{GAME_META[r.game].name}</option>)}</select></label>
    {game&&<>
     <div className={'mm-wizard-game '+game}><GameArtwork game={game}/><p>{GAME_META[game].description}</p></div>
     {GAME_META[game].variants.length>0&&<label className="mm-field">Variante<select value={form.game_variant} disabled={edit||busy} onChange={e=>change({game_variant:e.target.value,score_target:String(defaultTarget(game,e.target.value)),max_participants:String(GAME_META[game].capacity)})}>{GAME_META[game].variants.map(v=><option key={v} value={v}>{VARIANT_NAMES[v]}</option>)}</select></label>}
     <div className="mm-form-grid"><label className="mm-field">Quantidade de jogadores<input type="number" inputMode="numeric" min={capacity.min} max={capacity.max} step={capacity.step} value={form.max_participants} disabled={busy} onChange={e=>change({max_participants:e.target.value})}/></label>
      {!isChipGame(game)&&<label className="mm-field">{targetLabel(game)}<input type="number" inputMode="numeric" value={form.score_target} disabled={edit||busy||game==='truco'} onChange={e=>change({score_target:e.target.value})}/></label>}
     </div>
     {isChipGame(game)&&<><label className="mm-field">Entrada mínima (R$)<input type="number" inputMode="decimal" min={0} step="0.01" value={form.min_entry_brl} disabled={busy||pricingLocked} onChange={e=>change({min_entry_brl:e.target.value})}/></label>
      <details className="mm-task-options"><summary>Preços das fichas · opções do evento</summary><label className="mm-score-check"><input type="checkbox" checked={form.chip_pricing_special} disabled={busy||pricingLocked} onChange={e=>change({chip_pricing_special:e.target.checked})}/>Personalizar os preços deste evento</label>{form.chip_pricing_special?<div className="mm-form-grid">{chipPriceFields.map(({value,key:field})=><label className="mm-field" key={field}>Ficha {value} · preço em R$<input type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" value={form[field]} disabled={busy||pricingLocked} onChange={e=>change({[field]:e.target.value})}/></label>)}</div>:<p>Preços padrão: ficha 1 = R$ 1,00 · 5 = R$ 5,00 · 10 = R$ 0,10 · 25 = R$ 0,25 · 50 = R$ 0,50.</p>}<p>Os preços ficam bloqueados após a primeira compra.</p></details>
     </>}
    </>}
   </>}
   {step===2&&<>
    <h2>Quando e onde?</h2>
    <label className="mm-field">Nome do evento<input value={form.name} minLength={2} maxLength={100} autoComplete="off" placeholder="Ex.: Noite com os amigos" disabled={busy} onChange={e=>change({name:e.target.value})}/></label>
    <label className="mm-field">Data e horário<input type="datetime-local" value={form.starts_at} disabled={busy} onChange={e=>change({starts_at:e.target.value})}/></label>
    <label className="mm-field">Local<input value={form.location} minLength={2} maxLength={200} placeholder="Ex.: Casa do Bruno" disabled={busy} onChange={e=>change({location:e.target.value})}/></label>
    <label className="mm-field">Liga (opcional)<select value={form.league_id} disabled={edit||busy} onChange={e=>change({league_id:e.target.value,visibility:e.target.value?'private':'public'})}><option value="">Evento independente · sem liga</option>{leagues.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}{form.league_id&&!leagues.some(l=>l.id===form.league_id)&&<option value={form.league_id}>{edit?'Liga do evento':'Liga indisponível · escolha outra opção'}</option>}</select></label>
    {form.league_id?<p>Apenas membros da liga podem participar deste evento.</p>:<label className="mm-field">Quem pode participar?<select value={form.visibility} disabled={edit||busy} onChange={e=>change({visibility:e.target.value as EventDraft['visibility']})}><option value="public">Jogadores cadastrados · evento público</option><option value="private">Somente convidados · evento privado</option></select></label>}
   </>}
   {step===3&&<>
    <h2>Confira o encontro</h2><dl className="mm-wizard-review"><div><dt>Evento</dt><dd>{form.name}</dd></div><div><dt>Jogo</dt><dd>{game?GAME_META[game].name:''}{form.game_variant?' · '+(VARIANT_NAMES[form.game_variant]||form.game_variant):''}</dd></div><div><dt>Quando</dt><dd>{new Date(form.starts_at).toLocaleString('pt-BR')}</dd></div><div><dt>Local</dt><dd>{form.location}</dd></div><div><dt>Participação</dt><dd>{form.max_participants} jogadores · {form.league_id?'Membros da liga':form.visibility==='private'?'Convidados autorizados':'Jogadores cadastrados'}</dd></div><div><dt>{game&&isChipGame(game)?'Entrada mínima':'Meta da mesa'}</dt><dd>{game&&isChipGame(game)?money(form.min_entry_brl):form.score_target+' '+(game==='pife'?'vitórias':'pontos')}</dd></div>{form.league_id&&<div><dt>Liga</dt><dd>{leagues.find(l=>l.id===form.league_id)?.name||'Liga do evento'}</dd></div>}</dl>
    <p>{edit?'Os participantes serão avisados das alterações.':'Após criar, compartilhe o convite e escolha seu assento para participar.'}</p>
   </>}
   <div className="mm-wizard-actions">{step>1&&<button type="button" className="btn" disabled={busy} onClick={()=>{setLocalError('');onStep(step-1);window.scrollTo({top:0,behavior:'auto'})}}>Voltar</button>}<button type="submit" className="btn gold" disabled={busy||!room}>{busy?'Salvando…':step<3?'Continuar →':edit?'Salvar alterações':'Criar evento'}</button></div>
  </form>
  <button type="button" className="mm-button-text mm-wizard-discard" disabled={busy} onClick={discard}>Descartar rascunho e sair</button>
 </div>;
}
