"use client";

import {useMemo,useState} from "react";
import type {Event,Profile,Attendance} from "@/lib/mesa-types";
import {fullDate,money} from "@/lib/mesa-types";
import UiIcon from "./ui-icon";
import FounderAdminControls from "./founder-admin-controls";

export type HiddenEvent={session_id:string;previous_status:string;hidden_at:string;hidden_by:string};
export type AdminAudit={id:number;session_id:string|null;action:string;performed_by:string;occurred_at:string;description:string};
export type AdminFinance={session_id:string;pending:number;total_brl:number};

const statusLabel:Record<string,string>={scheduled:"Agendado",finished:"Encerrado",cancelled:"Cancelado"};
const actionLabel:Record<string,string>={hide:"Excluído da agenda",restore:"Restaurado",cancel:"Cancelado",finish:"Encerrado"};

export default function AdminPanel({
  events,profiles,attendances,finance,hidden,audits,busy,nameFor,onAction,onOpen
}:{
  events:Event[];
  profiles:Profile[];
  attendances:Attendance[];
  finance:AdminFinance[];
  hidden:HiddenEvent[];
  audits:AdminAudit[];
  busy:boolean;
  nameFor:(id:string)=>string;
  onAction:(eventId:string,action:"hide"|"restore"|"cancel"|"finish")=>void;
  onOpen:(eventId:string)=>void;
}){
  const [filter,setFilter]=useState<"ativos"|"todos"|"excluidos">("ativos");
  const [term,setTerm]=useState("");
  const hiddenSet=useMemo(()=>new Set(hidden.map(x=>x.session_id)),[hidden]);
  const rows=useMemo(()=>events.filter(e=>{
    if(filter==="ativos"&&hiddenSet.has(e.id))return false;
    if(filter==="excluidos"&&!hiddenSet.has(e.id))return false;
    return !term.trim()||e.title.toLowerCase().includes(term.trim().toLowerCase())
      ||nameFor(e.organizer_id).toLowerCase().includes(term.trim().toLowerCase());
  }).sort((a,b)=>new Date(b.starts_at).getTime()-new Date(a.starts_at).getTime()),[events,filter,hiddenSet,term,nameFor]);
  const scheduled=events.filter(e=>e.status==="scheduled"&&!hiddenSet.has(e.id)).length;
  const allPending=finance.filter(f=>!hiddenSet.has(f.session_id)).reduce((n,f)=>n+Number(f.pending),0);
  return <div className="mm-admin">
    <div className="heading">
      <div><div className="eyebrow">MESA MARCADA · CONTROLE GERAL</div><h1>Administração</h1>
        <p>Controle geral dos eventos. Exclusões são reversíveis e registradas no histórico.</p>
      </div>
      <span className="mm-admin-privilege"><UiIcon name="settings" size={17}/> Administrador Geral</span>
    </div>
    <div className="mm-admin-kpis">
      <div><small>Jogadores cadastrados</small><strong>{profiles.length}</strong></div>
      <div><small>Eventos agendados</small><strong>{scheduled}</strong></div>
      <div><small>Compras pendentes</small><strong>{allPending}</strong></div>
      <div><small>Eventos excluídos</small><strong>{hidden.length}</strong></div>
    </div>
    <section className="panel mm-admin-list">
      <div className="panelhead"><h2>Gerenciar eventos</h2><span className="tag">{rows.length} encontrados</span></div>
      <div className="mm-admin-filters">
        <input type="search" placeholder="Buscar evento ou Anfitrião" value={term} onChange={e=>setTerm(e.target.value)}
          aria-label="Buscar evento ou Anfitrião"/>
        <div className="mm-admin-filter-buttons">
          {(["ativos","todos","excluidos"] as const).map(f=>
            <button key={f} type="button" className={"filter "+(filter===f?"active":"")}
              onClick={()=>setFilter(f)}>{f==="ativos"?"Visíveis":f==="todos"?"Todos":"Excluídos"}</button>
          )}
        </div>
      </div>
      <div className="mm-admin-event-list">
        {rows.map(e=>{
          const deleted=hiddenSet.has(e.id);
          const people=attendances.filter(a=>a.session_id===e.id).length;
          const summary=finance.find(f=>f.session_id===e.id);
          const pending=Number(summary?.pending||0);
          const amount=Number(summary?.total_brl||0);
          return <article className={"mm-admin-event "+(deleted?"mm-admin-event-hidden":"")} key={e.id}>
            <div className="mm-admin-event-head">
              <div><span className="mm-admin-event-type">{deleted?"Excluído da agenda":statusLabel[e.status]||e.status}</span>
                <h3>{e.title}</h3>
                <p>{fullDate(e.starts_at)}</p>
                <p>Anfitrião: <strong>{nameFor(e.organizer_id)}</strong></p>
              </div>
              <div className="mm-admin-event-numbers">
                <span><strong>{people}</strong><small>confirmados</small></span>
                <span><strong>{pending}</strong><small>compras pendentes</small></span>
                <span><strong>{money(amount)}</strong><small>fichas compradas</small></span>
              </div>
            </div>
            <div className="mm-admin-buttons">
              <button type="button" className="btn" onClick={()=>onOpen(e.id)}>Abrir evento</button>
              {deleted?<button type="button" className="btn gold" disabled={busy}
                onClick={()=>onAction(e.id,"restore")}>↺ Restaurar</button>:
                <>
                  {e.status==="scheduled"&&<button type="button" className="btn" disabled={busy}
                    onClick={()=>onAction(e.id,"cancel")}>Cancelar</button>}
                  <button type="button" className="mm-btn-destructive" disabled={busy}
                    onClick={()=>onAction(e.id,"hide")}>Excluir da agenda</button>
                </>
              }
            </div>
          </article>;
        })}
        {!rows.length&&<p className="mm-empty">Nenhum evento encontrado nesse filtro.</p>}
      </div>
    </section>
    <FounderAdminControls profiles={profiles}/>
    <section className="panel mm-admin-audit">
      <div className="panelhead"><h2>Histórico administrativo</h2></div>
      <p className="mm-formfoot">Ações administrativas ficam registradas para conferência.</p>
      {audits.slice(0,15).map(a=><div className="mm-admin-audit-row" key={a.id}>
        <span><strong>{actionLabel[a.action]||a.action}</strong><small>
          {a.session_id?events.find(e=>e.id===a.session_id)?.title||"Evento antigo":"Evento removido"} · {nameFor(a.performed_by)}
        </small></span>
        <time>{new Date(a.occurred_at).toLocaleDateString("pt-BR")}</time>
      </div>)}
      {!audits.length&&<p className="mm-formfoot">Nenhuma ação administrativa registrada até agora.</p>}
    </section>
  </div>;
}
