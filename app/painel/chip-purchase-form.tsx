"use client";

import {useEffect,useMemo,useState} from "react";
import type {FormEvent} from "react";

const chips=[
  {value:1,outer:"#e0e6ed",inner:"#b2bece"},
  {value:5,outer:"#da384e",inner:"#9c1e35"},
  {value:10,outer:"#258ff2",inner:"#16549b"},
  {value:25,outer:"#23a18b",inner:"#126c5f"},
  {value:50,outer:"#2e3b54",inner:"#161f30"}
] as const;
const MAX_QTY=2000;
const MAX_PIECES=5000;
const fmtMoney=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const fmt=(value:number)=>new Intl.NumberFormat("pt-BR").format(value);

function CasinoChip({value,outer,inner}:{value:number;outer:string;inner:string}){
  return <svg viewBox="0 0 50 50" width="46" height="46" aria-hidden="true" className="mm-chip-token">
    <circle cx="25" cy="25" r="23" fill={outer} stroke="#a7b5c9" strokeWidth="1.2"/>
    {[0,60,120,180,240,300].map(a=><rect key={a} x="22" y="2" width="6" height="8"
      fill="#f1f7ff" rx="1" transform={"rotate("+a+" 25 25)"}/>)}
    <circle cx="25" cy="25" r="15.5" fill={inner} stroke="#f2f8ff" strokeWidth="1.2" strokeDasharray="3 2"/>
    <text x="25" y="29.5" fontSize={value>=10?12:15} textAnchor="middle" fontWeight="800" fill="#fff">{value}</text>
  </svg>;
}

/** Valores de cada ficha são preços, não o número impresso em pontos. */
export default function ChipPurchaseForm({
  eventId,prices,special,locked,disabled,busy,minToComplete,entryMinimum,onSave
}:{
  eventId:string;
  prices:readonly number[];
  special:boolean;
  locked:boolean;
  disabled:boolean;
  busy:boolean;
  minToComplete:number;
  entryMinimum:number;
  onSave:(quantities:number[])=>Promise<boolean>;
}){
  const [quantities,setQuantities]=useState<number[]>([0,0,0,0,0]);
  const [working,setWorking]=useState(false);
  const [status,setStatus]=useState("");
  useEffect(()=>{setQuantities([0,0,0,0,0]);setStatus("");},[eventId]);
  const data=useMemo(()=>{
    const physical=quantities.reduce((sum,q)=>sum+q,0);
    const points=quantities.reduce((sum,q,i)=>sum+q*chips[i].value,0);
    const cents=quantities.reduce((sum,q,i)=>sum+q*Math.round(Number(prices[i]||0)*100),0);
    return {physical,points,cash:cents/100};
  },[quantities,prices]);
  const canSubmit=!disabled&&!busy&&!working&&data.physical>0&&data.physical<=MAX_PIECES&&Math.round(data.cash*100)>=Math.round(minToComplete*100);
  function setQuantity(index:number,value:number){
    if(!Number.isSafeInteger(value)||value<0||value>MAX_QTY)return;
    setStatus("");
    setQuantities(current=>current.map((q,i)=>{
      if(i!==index)return q;
      const other=current.reduce((sum,x,j)=>j===index?sum:sum+x,0);
      return Math.min(value,MAX_PIECES-other);
    }));
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!canSubmit)return;
    setWorking(true);setStatus("");
    try{
      const ok=await onSave([...quantities]);
      if(ok){setQuantities([0,0,0,0,0]);setStatus("Compra registrada com sucesso!");}
    }finally{setWorking(false);}
  }
  return <section className="mm-denom-purchase">
    <div className="mm-denom-heading">
      <div><h2>Compra ou recompra</h2><p>Selecione a quantidade de cada ficha.</p></div>
      <span className="tag poker">♠ Fichas</span>
    </div>
    {special&&<div className="mm-denom-special">★ Evento especial — preços personalizados nesta noite.</div>}
    {!special&&<p className="mm-denom-standard">Tabela padrão do Mesa Marcada</p>}
    {minToComplete>0?<div className="mm-message mm-v1-min-entry">Entrada mínima: <strong>{fmtMoney(entryMinimum)}</strong>. {minToComplete<entryMinimum?"Faltam":"Selecione pelo menos"} <strong>{fmtMoney(minToComplete)}</strong> em fichas para completar sua entrada.</div>:
      <p className="mm-v1-rebuy-hint">✓ Entrada mínima atendida. Recompras de qualquer valor positivo estão liberadas.</p>}
    <form onSubmit={e=>void submit(e)}>
      <div className="mm-denom-rows">
        {chips.map((chip,i)=><div className="mm-denom-row" key={chip.value}>
          <div className="mm-denom-info">
            <CasinoChip {...chip}/>
            <div className="mm-denom-name"><strong>Ficha {chip.value}</strong>
              <small>{fmtMoney(Number(prices[i]||0))} cada</small></div>
          </div>
          <div className="mm-denom-controls" aria-label={"Quantidade de fichas de "+chip.value}>
            <button type="button" className="mm-denom-step" aria-label={"Retirar ficha de "+chip.value}
              onClick={()=>setQuantity(i,quantities[i]-1)} disabled={busy||working||disabled||quantities[i]===0}>−</button>
            <output className="mm-denom-number" aria-live="off" aria-label={String(quantities[i])+" fichas"}>{fmt(quantities[i])}</output>
            <button type="button" className="mm-denom-step" aria-label={"Adicionar ficha de "+chip.value}
              onClick={()=>setQuantity(i,quantities[i]+1)} disabled={busy||working||disabled||quantities[i]>=MAX_QTY||data.physical>=MAX_PIECES}>＋</button>
          </div>
        </div>)}
      </div>
      <div className="mm-denom-summary">
        <div><small>Valor total</small><strong>{fmtMoney(data.cash)}</strong></div>
        <div><small>Pontos em fichas</small><strong>{fmt(data.points)}</strong></div>
      </div>
      <div className="mm-denom-summary-foot">
        <span>{fmt(data.physical)} {data.physical===1?"ficha física selecionada":"fichas físicas selecionadas"}</span>
        <button type="button" disabled={busy||working||data.physical===0}
          onClick={()=>{setQuantities([0,0,0,0,0]);setStatus("");}}>Limpar</button>
      </div>
      {status&&<p className="mm-denom-feedback" role="status">{status}</p>}
      {data.physical>0&&data.cash<minToComplete&&<p className="mm-denom-feedback mm-v1-min-warning" role="status">
        Adicione mais {fmtMoney(minToComplete-data.cash)} em fichas para liberar sua compra.
      </p>}
      <button type="submit" className="btn gold mm-denom-save" disabled={!canSubmit}>
        {busy||working?"Salvando...":"Salvar compra"}
      </button>
    </form>
    <p className="mm-denom-hint">As fichas representam pontos no jogo; o valor acima é o preço de compra. {locked?"Preços deste evento bloqueados após a primeira compra.":"Os preços ficam fixos após a primeira compra."}</p>
  </section>;
}
