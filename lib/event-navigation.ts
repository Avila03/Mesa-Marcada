import type {DetailTab,Event} from './mesa-types';
export type EventFilter='abertos'|'ao-vivo'|'encerrados'|'todos';
export function eventStatus(event:Pick<Event,'status'|'starts_at'>,live:boolean,now=Date.now()){
 if(event.status==='finished')return 'Encerrado';
 if(event.status==='cancelled')return 'Cancelado';
 if(live)return 'Ao vivo';
 return Date.parse(event.starts_at)<now?'Aguardando início':'Agendado';
}
export function eventDestination(event:Pick<Event,'status'>,live:boolean):DetailTab{
 return event.status==='finished'?'resumo-evento':event.status==='scheduled'&&live?'ao-vivo':'visao';
}
export function filterEvents(events:readonly Event[],liveIds:ReadonlySet<string>,filter:EventFilter,now=Date.now()){
 const priority=(event:Event)=>event.status!=='scheduled'?3:liveIds.has(event.id)?0:Date.parse(event.starts_at)>=now?1:2;
 return events.filter(e=>filter==='todos'||(filter==='ao-vivo'?e.status==='scheduled'&&liveIds.has(e.id):filter==='abertos'?e.status==='scheduled':e.status!=='scheduled'))
  .sort((a,b)=>priority(a)-priority(b)||(priority(a)===1?Date.parse(a.starts_at)-Date.parse(b.starts_at):Date.parse(b.starts_at)-Date.parse(a.starts_at)));
}
