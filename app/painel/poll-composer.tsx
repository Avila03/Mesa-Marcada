"use client";

import {FormEvent,useState} from "react";
import UiIcon from "./ui-icon";
import {errText} from "@/lib/mesa-types";
import "./poll-composer.css";

const MAX_OPTIONS=41;

export default function PollComposer({onCreate,disabled=false}:{
 onCreate:(question:string,options:string[])=>Promise<void>;
 disabled?:boolean;
}){
 const [open,setOpen]=useState(false);
 const [question,setQuestion]=useState("");
 const [options,setOptions]=useState<string[]>([]);
 const [draft,setDraft]=useState("");
 const [error,setError]=useState("");
 const [saving,setSaving]=useState(false);

 function addOption(){
  const option=draft.trim().replace(/\s+/g," ");
  if(!option){setError("Digite uma opção para adicionar.");return;}
  if(option.length>80){setError("Cada opção pode ter até 80 caracteres.");return;}
  if(options.length>=MAX_OPTIONS){setError("Limite de 41 opções por enquete.");return;}
  if(options.some(item=>item.toLocaleLowerCase("pt-BR")===option.toLocaleLowerCase("pt-BR"))){
   setError("Essa opção já foi adicionada.");return;
  }
  setOptions(current=>[...current,option]);
  setDraft("");setError("");
 }
 function removeOption(index:number){
  setOptions(current=>current.filter((_,position)=>position!==index));
  setError("");
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(disabled||saving)return;
  if(question.trim().length<2){setError("Escreva uma pergunta com pelo menos 2 caracteres.");return;}
  if(draft.trim()){setError("Adicione a última opção digitada antes de criar a enquete.");return;}
  if(options.length<2){setError("Adicione pelo menos duas opções.");return;}
  setSaving(true);setError("");
  try{
   await onCreate(question.trim(),options);
   setQuestion("");setOptions([]);setDraft("");setOpen(false);
  }catch(e){setError(errText(e));}
  finally{setSaving(false);}
 }

 return <div className="mm-poll-composer">
  <button className="btn mm-poll-composer-toggle" type="button" disabled={disabled||saving}
   aria-expanded={open} aria-controls="mm-poll-composer-editor"
   onClick={()=>{setOpen(value=>!value);setError("");}}>
   <UiIcon name={open?"close":"plus"} size={17}/>
   {open?"Fechar formulário":"Criar enquete"}
  </button>
  {open&&<div id="mm-poll-composer-editor" className="mm-poll-composer-editor">
   <div className="mm-poll-composer-heading">
    <strong>Nova enquete</strong>
    <span>Uma resposta por participante, com possibilidade de alterar o voto.</span>
   </div>
   <form className="mm-form-stack" onSubmit={e=>void submit(e)}>
    <label className="mm-field">Pergunta
     <input type="text" minLength={2} maxLength={200} required
      placeholder="Ex.: O que vamos comer?" value={question}
      onChange={e=>{setQuestion(e.target.value);setError("");}}/>
    </label>
    <div className="mm-poll-composer-options">
     <div className="mm-poll-composer-options-title">
      <strong>Opções</strong>
      <small>{options.length} {options.length===1?"opção adicionada":"opções adicionadas"}</small>
     </div>
     {options.length>0&&<ol className="mm-poll-composer-list">
      {options.map((option,index)=><li key={index} className="mm-poll-composer-item">
       <span className="mm-poll-composer-index">{String(index+1).padStart(2,"0")}</span>
       <span className="mm-poll-composer-label">{option}</span>
       <button type="button" className="mm-poll-composer-remove" disabled={saving}
        onClick={()=>removeOption(index)} aria-label={"Remover opção "+option}>
        <UiIcon name="close" size={15}/>
       </button>
      </li>)}
     </ol>}
     <div className="mm-poll-composer-add">
      <input type="text" value={draft} maxLength={80}
       aria-label="Nova opção de enquete" placeholder="Digite uma nova opção..."
       onChange={e=>{setDraft(e.target.value);setError("");}}
       onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();if(!saving)addOption();}}}/>
      <button type="button" className="btn" disabled={saving||options.length>=MAX_OPTIONS}
       onClick={addOption}><UiIcon name="plus" size={16}/> Adicionar opção</button>
     </div>
     <small className="mm-poll-composer-note">Mínimo de 2 opções. Você pode remover qualquer item antes de publicar.</small>
    </div>
    {error&&<p className="mm-poll-composer-error" role="alert">{error}</p>}
    <div className="mm-poll-composer-footer">
     <button className="btn gold" type="submit" disabled={saving||disabled||options.length<2}>
      {saving?"Criando...":"Criar enquete"}
     </button>
    </div>
   </form>
  </div>}
 </div>;
}
