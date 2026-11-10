"use client";
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import type {CrestConfig} from '@/app/painel/crest-editor';
import {leagueCardModes,leagueFinalCard} from '@/lib/league-final-card';
import type {LeagueFinalSummary} from '@/lib/league-final-summary';
import {cardDimensions,type CardFormat} from '@/lib/post-game-card';
import {shareCardImage} from '@/lib/share-card-image';
import './league-final-share.css';

type PreparedImage={url:string;file:File};

export default function LeagueFinalShare({summary,emblem}:{summary:LeagueFinalSummary;emblem:CrestConfig}){
 const modes=useMemo(()=>leagueCardModes(summary),[summary]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [modeId,setModeId]=useState(''),[featuredId,setFeaturedId]=useState(''),[format,setFormat]=useState<CardFormat>('compact');
 const [prepared,setPrepared]=useState<PreparedImage|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const generation=useRef(0),objectUrl=useRef(''),crestSvg=useRef('');
 const controlsId=useId();
 const mode=modes.find(m=>m.id===modeId)||modes[0];
 const champions=mode?.players.filter(p=>p.rank===1)||[];
 const featured=champions.find(p=>p.id===featuredId)||champions[0];
 useEffect(()=>()=>{generation.current++;if(objectUrl.current)URL.revokeObjectURL(objectUrl.current)},[]);

 async function prepare(nextModeId=mode?.id,nextFormat:CardFormat=format,nextFeaturedId=featured?.id){
  const nextMode=modes.find(m=>m.id===nextModeId);if(!nextMode)return;
  const nextFeatured=nextMode.players.find(p=>p.rank===1&&p.id===nextFeaturedId)||nextMode.players[0];
  const run=++generation.current;
  setModeId(nextMode.id);setFeaturedId(nextFeatured.id);setFormat(nextFormat);
  setBusy(true);setError('');setNotice('');setPrepared(null);
  if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current=''}
  try{
   const [{makeLeagueFinalImage},{renderCardCrest}]=await Promise.all([import('./league-final-card-image'),import('./post-game-crest')]);
   if(run!==generation.current)return;
   if(!crestSvg.current)crestSvg.current=renderCardCrest(emblem);
   const card=leagueFinalCard(summary,nextMode,nextFeatured.id);
   const blob=await makeLeagueFinalImage(card,nextFormat,crestSvg.current);
   if(run!==generation.current)return;
   const url=URL.createObjectURL(blob);objectUrl.current=url;
   setPrepared({url,file:new File([blob],`mesa-marcada-liga-${nextMode.id.replace(':','-')}-${nextFormat}.png`,{type:'image/png'})});
  }catch(e){if(run===generation.current)setError(e instanceof Error?e.message:'Não foi possível preparar o card.')}
  finally{if(run===generation.current)setBusy(false)}
 }
 function download(){
  if(!prepared)return;
  const anchor=document.createElement('a');anchor.href=prepared.url;anchor.download=prepared.file.name;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setNotice('Card pronto para salvar. No iPhone, escolha o destino oferecido pelo navegador.');
 }
 async function share(){
  if(!prepared)return;setError('');setNotice('');
  // The File already exists when the user clicks, preserving iPhone activation.
  try{
   const result=await shareCardImage(prepared.file,'Mesa Marcada · encerramento da liga');
   if(result==='unsupported')download();
   else if(result==='shared')setNotice('Compartilhamento concluído.');
  }catch{setError('Não foi possível compartilhar. Use Salvar PNG para guardar a mesma imagem.')}
 }
 if(!mode)return <section className="mm-league-share" aria-label="Card de encerramento da liga">
  <h3>Card de encerramento</h3><p>Esta liga não tem resultados válidos para gerar um card de campeão.</p>
 </section>;
 return <section className="mm-league-share" aria-label="Card de encerramento da liga">
  <div className="mm-league-share-head"><div><small>A LIGA VIROU HISTÓRIA</small><h3>Card de encerramento</h3></div>
   <button className="btn" type="button" aria-expanded={open} aria-controls={controlsId} onClick={()=>{setOpen(!open);if(!open&&!prepared)void prepare()}}>{open?'Recolher card':'Preparar card da liga'}</button>
  </div>
  <p>Campeão, campanha e pódio de cada modalidade em uma imagem para guardar ou compartilhar.</p>
  {open&&<div id={controlsId}>
   <div className="mm-league-share-options">
    <label>Modalidade<select value={mode.id} disabled={busy} onChange={e=>void prepare(e.target.value,format,'')}>
     {modes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    {champions.length>1&&<label>Campeão em destaque<select value={featured.id} disabled={busy} onChange={e=>void prepare(mode.id,format,e.target.value)}>
     {champions.map(player=><option value={player.id} key={player.id}>{player.name}</option>)}
    </select></label>}
   </div>
   {champions.length>1&&<p className="mm-league-share-context">Há {champions.length} campeões empatados. Escolha quem destacar; o card informa que o título é compartilhado.</p>}
   <div className="mm-league-share-formats" role="group" aria-label="Formato do card da liga">
    <button className="btn" type="button" aria-pressed={format==='compact'} disabled={busy} onClick={()=>void prepare(mode.id,'compact')}>Compacto · 4:5</button>
    <button className="btn" type="button" aria-pressed={format==='story'} disabled={busy} onClick={()=>void prepare(mode.id,'story')}>Stories · 9:16</button>
   </div>
   {busy&&<p role="status">Preparando o card da liga…</p>}
   {error&&<p className="mm-message error" role="alert">{error} {!prepared&&<button className="btn" type="button" disabled={busy} onClick={()=>void prepare()}>Tentar novamente</button>}</p>}
   {prepared&&<div className="mm-league-share-preview">
    <img src={prepared.url} width={1080} height={cardDimensions(format).height} alt={`Card de ${summary.league_name}: ${featured.name}, ${champions.length>1?'cocampeão':'campeão'} de ${mode.label}, com campanha e pódio final`}/>
    <div><strong>Confira antes de compartilhar.</strong>
     <p>Esta é a imagem que será salva ou compartilhada, com o brasão da liga e os resultados do encerramento.</p>
     <p>{mode.game==='poker'||mode.game==='blackjack'?'As posições seguem o saldo e a quantidade de resultados do arquivo. A imagem exibe participações, jogadores e eventos, sem valores financeiros.':'As posições seguem vitórias, aproveitamento e quantidade de partidas. Cada integrante de uma equipe vencedora tem sua própria campanha.'}</p>
     {mode.game==='poker'&&<p>O arquivo da liga reúne as variantes no ranking de Poker.</p>}
     <div className="mm-league-share-actions"><button className="btn gold" type="button" onClick={()=>void share()}>Compartilhar imagem</button><button className="btn" type="button" onClick={download}>Salvar PNG</button></div>
    </div>
   </div>}
   {notice&&<p role="status">{notice}</p>}
  </div>}
 </section>;
}
