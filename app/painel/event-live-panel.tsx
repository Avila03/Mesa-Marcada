"use client";

import UiIcon from "./ui-icon";
import "../event-live.css";
import type {UiIconName} from "./ui-icon";
import {fullDate} from "@/lib/mesa-types";

export type LiveState={session_id:string;started_at:string;started_by:string};
export type LiveActivity={
  id:number;session_id:string;
  kind:"started"|"attendance_confirmed"|"attendance_cancelled"|
    "chips_purchased"|"chips_purchase_removed"|"payment_received"|"payment_reopened"|
    "final_chips_recorded"|"review_approved"|"review_reopened"|"finished"|"cancelled";
  actor_id:string|null;
  subject_id:string|null;
  occurred_at:string;
};

const kindInfo:Record<LiveActivity["kind"],{title:string;icon:UiIconName;note:string}>={
  started:{title:"Partida iniciada",icon:"spade",note:"Início confirmado pelo Anfitrião"},
  attendance_confirmed:{title:"Presença confirmada",icon:"user",note:"Jogador entrou na lista"},
  attendance_cancelled:{title:"Presença cancelada",icon:"user",note:"Jogador saiu da lista"},
  chips_purchased:{title:"Compra ou recompra registrada",icon:"cards",note:"Fichas adicionadas ao controle"},
  chips_purchase_removed:{title:"Compra de fichas removida",icon:"cards",note:"Lançamento corrigido"},
  payment_received:{title:"Pagamento de fichas recebido",icon:"check",note:"Recebimento confirmado"},
  payment_reopened:{title:"Pagamento voltou a pendente",icon:"credit-card",note:"Recebimento reaberto"},
  final_chips_recorded:{title:"Fichas finais registradas",icon:"cards",note:"Resultado atualizado"},
  review_approved:{title:"Fichas conferidas",icon:"check",note:"Resultado aprovado pelo responsável"},
  review_reopened:{title:"Conferência reaberta",icon:"clipboard",note:"Resultado novamente pendente"},
  finished:{title:"Partida encerrada",icon:"trophy",note:"Conferência concluída"},
  cancelled:{title:"Evento cancelado",icon:"close",note:"Registros anteriores foram preservados"}
};

const time=(value:string)=>new Date(value).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const relativeTag=(startedAt:string,status:string)=>{
  if(status==="finished")return "Encerrado";
  if(status==="cancelled")return "Cancelado";
  return startedAt?"Em andamento":"Aguardando início";
};

export default function EventLivePanel({
  title,status,startedAt,requiresStart,canSee,host,admin,
  busy,loading,guestCount,paidCount,purchaseCount,checkedCount,
  canFinish,activities,nameFor,onStart,onFinish,onRefresh,onFichas
}:{
  title:string;
  status:"scheduled"|"finished"|"cancelled";
  startedAt:string|null;
  requiresStart:boolean;
  canSee:boolean;host:boolean;admin:boolean;
  busy:boolean;loading:boolean;
  guestCount:number;paidCount:number;purchaseCount:number;checkedCount:number;
  canFinish:boolean;
  activities:LiveActivity[];
  nameFor:(userId:string)=>string;
  onStart:()=>void;onFinish:()=>void;onRefresh:()=>void;onFichas:()=>void;
}){
  if(!canSee){
    return <section className="mm-live-panel mm-live-private">
      <div className="mm-live-lock"><UiIcon name="users" size={30}/></div>
      <h2>Linha do tempo reservada</h2>
      <p>Confirme presença neste evento para acompanhar os acontecimentos da partida.
        O Anfitrião e o Administrador também têm acesso.</p>
    </section>;
  }
  const active=Boolean(startedAt&&status==="scheduled");
  const completed=guestCount>0&&paidCount===purchaseCount&&checkedCount===guestCount&&purchaseCount>0;
  const timeline=[...activities].sort((a,b)=>
    new Date(b.occurred_at).getTime()-new Date(a.occurred_at).getTime()||b.id-a.id);
  return <div className="mm-live">
    <section className={"mm-live-panel "+(active?"mm-live-is-active":"")}>
      <div className="mm-live-topline">
        <span className="eyebrow">MESA MARCADA · EVENTO AO VIVO</span>
        <span className={"mm-live-status "+(active?"active":"")}>
          <span className="mm-live-dot"/>{relativeTag(startedAt||"",status)}
        </span>
      </div>
      <h2>{title}</h2>
      {startedAt?
        <p className="mm-live-started"><UiIcon name="clock" size={16}/> Iniciado em {fullDate(startedAt)}</p>:
        <p>O evento começa quando o Anfitrião tocar em <strong>Iniciar partida</strong>.
          A linha do tempo será formada automaticamente pelos registros feitos na mesa.</p>}
      {status==="scheduled"&&!startedAt&&host&&
        <button type="button" className="btn gold mm-live-primary"
          disabled={busy} onClick={onStart}>
          <UiIcon name="spade" size={20}/> Iniciar partida
        </button>}
      {status==="scheduled"&&!startedAt&&!host&&
        <div className="mm-live-awaiting"><UiIcon name="clock" size={19}/>
          Aguardando o Anfitrião iniciar a partida</div>}
      {status==="scheduled"&&startedAt&&
        <p className="mm-live-note">A partida está acontecendo. Fichas e pagamentos são registrados na aba <strong>Fichas</strong>; despesas e rachas ficam em <strong>Gastos</strong>.</p>}
      {status==="finished"&&<p className="mm-live-good">Partida encerrada após conferência financeira das fichas.</p>}
      {status==="cancelled"&&<p className="mm-live-note">Evento cancelado. Os registros existentes continuam preservados.</p>}
    </section>

    {(active||status==="finished"&&Boolean(startedAt))&&
      <section className="mm-live-review">
        <div className="mm-live-review-title">
          <h3>Conferência das fichas</h3>
          <span className="tag">{canFinish||status==="finished"?"Pronto":"Em revisão"}</span>
        </div>
        <p>Somente fichas e pagamentos de fichas contam para o encerramento da partida.</p>
        <div className="mm-live-steps">
          <div className={guestCount>0?"done":"todo"}>
            <UiIcon name={guestCount>0?"check":"users"} size={18}/>
            <span><strong>Participantes</strong><small>{guestCount} confirmados</small></span>
          </div>
          <div className={purchaseCount>0&&paidCount===purchaseCount?"done":"todo"}>
            <UiIcon name={purchaseCount>0&&paidCount===purchaseCount?"check":"credit-card"} size={18}/>
            <span><strong>Pagamentos de fichas</strong><small>{paidCount} de {purchaseCount} compras recebidas</small></span>
          </div>
          <div className={guestCount>0&&checkedCount===guestCount?"done":"todo"}>
            <UiIcon name={guestCount>0&&checkedCount===guestCount?"check":"clipboard"} size={18}/>
            <span><strong>Conferência final</strong><small>{checkedCount} de {guestCount} resultados aprovados</small></span>
          </div>
        </div>
        <div className="mm-live-actions">
          <button type="button" className="btn" onClick={onFichas}>
            <UiIcon name="cards" size={17}/> Conferir fichas
          </button>
          {active&&(host||admin)&&<button type="button" className="btn gold"
            disabled={busy||!canFinish||!completed} onClick={onFinish}>
            <UiIcon name="check" size={18}/> Encerrar partida
          </button>}
        </div>
        <p className="mm-live-expense-note">Os rachas opcionais de comida e bebida são independentes e <strong>não bloqueiam</strong> o encerramento.</p>
      </section>}

    <section className="mm-live-timeline" aria-label="Linha do tempo da partida">
      <div className="mm-live-timeline-head">
        <div><h3>Linha do tempo</h3><p>Atualizações automáticas enquanto esta aba estiver aberta.</p></div>
        <button className="btn mm-live-refresh" type="button" disabled={busy||loading}
          onClick={onRefresh} title="Atualizar linha do tempo">
          <UiIcon name="clock" size={17}/> Atualizar
        </button>
      </div>
      {loading&&<p className="mm-live-note" role="status">Consultando registros da partida...</p>}
      {timeline.length>0?<ol className="mm-live-timeline-list">
        {timeline.map(entry=>{
          const info=kindInfo[entry.kind];
          if(!info)return null;
          const subject=entry.subject_id?nameFor(entry.subject_id):null;
          const actor=entry.actor_id?nameFor(entry.actor_id):null;
          return <li className="mm-live-activity" key={entry.id}>
            <span className="mm-live-activity-icon"><UiIcon name={info.icon} size={19}/></span>
            <div className="mm-live-activity-copy">
              <strong>{info.title}</strong>
              <span>{subject?subject+(actor&&actor!==subject?" · por "+actor:""):actor||info.note}</span>
            </div>
            <time dateTime={entry.occurred_at}>{time(entry.occurred_at)}</time>
          </li>;
        })}
      </ol>:<div className="mm-live-empty">
        <UiIcon name="clock" size={28}/>
        <strong>Sem movimentações ainda</strong>
        <p>{startedAt?"As compras, os pagamentos e as conferências aparecerão aqui.":"A linha do tempo começará quando o Anfitrião iniciar a partida."}</p>
      </div>}
      <p className="mm-live-privacy">Somente participantes confirmados, Anfitrião e Administrador podem visualizar estes registros. Os valores dos rachas não aparecem aqui.</p>
    </section>
  </div>;
}
