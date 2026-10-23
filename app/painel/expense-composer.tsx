"use client";
import {FormEvent,useState} from "react";
import UiIcon from "./ui-icon";
import {errText} from "@/lib/mesa-types";
import "./poll-composer.css";
import "./expense-composer.css";

type ExpenseDraft={label:string;amount:number;category:string;paidBy:string};
export default function ExpenseComposer({onCreate,userId,organizer,attendees,nameFor,disabled=false}:{
 onCreate:(details:ExpenseDraft)=>Promise<void>;
 userId:string;organizer:boolean;attendees:string[];
 nameFor:(id:string)=>string;disabled?:boolean;
}){
 const [open,setOpen]=useState(false);
 const [label,setLabel]=useState("");
 const [amount,setAmount]=useState("");
 const [category,setCategory]=useState("food");
 const [paidBy,setPaidBy]=useState(userId);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const validPayer=organizer&&attendees.includes(paidBy)?paidBy:userId;

 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(saving||disabled)return;
  const parsed=Number(amount);
  if(label.trim().length<2){setError("Informe uma descrição com pelo menos 2 caracteres.");return;}
  if(!Number.isFinite(parsed)||parsed<=0){setError("Informe um valor maior que zero.");return;}
  setSaving(true);setError("");
  try{
   await onCreate({label:label.trim(),amount:parsed,category,paidBy:validPayer});
   setLabel("");setAmount("");setCategory("food");setPaidBy(userId);
   setOpen(false);
  }catch(e){setError(errText(e));}
  finally{setSaving(false);}
 }
 return <div className="mm-poll-composer mm-expense-composer">
  <button type="button" className="btn mm-poll-composer-toggle"
   disabled={saving||disabled} aria-expanded={open}
   onClick={()=>{setOpen(v=>!v);setError("");}}>
   <UiIcon name={open?"close":"plus"} size={17}/>
   {open?"Fechar formulário":"Adicionar despesa"}
  </button>
  {open&&<div className="mm-poll-composer-editor">
   <div className="mm-poll-composer-heading">
    <strong>Adicionar despesa</strong>
    <span>Comidas, bebidas e materiais da noite. Cada participante decide se entra no racha.</span>
   </div>
   <form className="mm-form-stack" onSubmit={e=>void submit(e)}>
    <label className="mm-field">Descrição
     <input required minLength={2} maxLength={180} value={label}
      placeholder="Ex.: Pizza e bebidas" onChange={e=>setLabel(e.target.value)}/>
    </label>
    <div className="mm-form-grid">
     <label className="mm-field">Valor (R$)
      <input type="number" min="0.01" step="0.01" required value={amount}
       onChange={e=>setAmount(e.target.value)}/>
     </label>
     <label className="mm-field">Categoria
      <select value={category} onChange={e=>setCategory(e.target.value)}>
       <option value="food">Comida</option>
       <option value="drinks">Bebidas</option>
       <option value="materials">Materiais</option>
       <option value="other">Outros</option>
      </select>
     </label>
    </div>
    <label className="mm-field">Quem pagou?
     {organizer?
      <select value={validPayer} onChange={e=>setPaidBy(e.target.value)}>
       {Array.from(new Set([userId,...attendees])).map(id=>
        <option key={id} value={id}>{nameFor(id)}{id===userId?" (eu)":""}</option>)}
      </select>
      :<input readOnly disabled value={nameFor(userId)+" (eu)"}/>}
    </label>
    {error&&<p role="alert" className="mm-poll-composer-error">{error}</p>}
    <div className="mm-poll-composer-footer">
     <button type="submit" className="btn gold" disabled={saving||disabled}>
      {saving?"Salvando...":"Salvar despesa"}
     </button>
    </div>
   </form>
  </div>}
 </div>;
}
