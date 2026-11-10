"use client";
import type {Buy,BuyItem} from "@/lib/mesa-types";

const VALUES=[1,5,10,25,50] as const;
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);

type Guest={user_id:string};
type Props={
 guests:Guest[];
 buys:Buy[];
 items:BuyItem[];
 available:number[];
 busy:boolean;
 nameFor:(id:string)=>string;
 onRebuy:(userId:string,quantities:number[])=>Promise<boolean>;
};

/** Repete, com um toque, a última compra de cada jogador (uso do anfitrião no ao vivo). */
export default function QuickRebuy({guests,buys,items,available,busy,nameFor,onRebuy}:Props){
 const created=(b:Buy)=>Date.parse((b as Buy&{created_at?:string}).created_at||"")||0;
 const options=guests.flatMap(guest=>{
  const last=buys.filter(b=>b.user_id===guest.user_id).sort((a,b)=>created(b)-created(a))[0];
  if(!last)return [];
  const quantities=VALUES.map(value=>items.filter(i=>i.purchase_id===last.id&&i.chip_value===value).reduce((n,i)=>n+i.quantity,0));
  if(!quantities.some(q=>q>0))return [];
  const fits=quantities.every((q,i)=>q<=available[i]);
  return [{userId:guest.user_id,quantities,amount:Number(last.amount_brl),fits}];
 });
 if(!options.length)return null;
 return <section className="mm-quick-rebuy" aria-label="Recompra rápida">
  <header><h3>Recompra rápida</h3><p>Repete a última compra do jogador com um toque.</p></header>
  <div className="mm-quick-rebuy-grid">
   {options.map(o=><button key={o.userId} type="button" disabled={busy||!o.fits}
     title={o.fits?undefined:"Fichas insuficientes no estoque para repetir esta compra"}
     onClick={()=>{if(window.confirm("Registrar "+money(o.amount)+" em fichas para "+nameFor(o.userId)+"?"))void onRebuy(o.userId,o.quantities)}}>
     <strong>+ {money(o.amount)}</strong><span>{nameFor(o.userId)}</span>
   </button>)}
  </div>
 </section>;
}
