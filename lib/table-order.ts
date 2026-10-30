export type TableOrder={session_id:string;dealer_id:string|null;starter_id:string|null;direction:1|-1;distribution:number;revision:number};
export type TableOrderSnapshot={order:TableOrder|null;locked:boolean;fixed_dealer_id?:string|null;eligible_players?:string[]};
export type TableOrderRequest={p_request_id:string;p_event_id:string;p_revision:number;p_action:'configure'|'advance';p_dealer:string|null;p_starter:string|null;p_direction:number};
export async function submitTableOrder(db:{rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{message:string;code?:string}|null}>},request:TableOrderRequest){
 const {data,error}=await db.rpc('table_order_command',request);if(error)throw Object.assign(new Error(error.message),{code:error.code});if(typeof data!=='string')throw new Error('Não foi possível confirmar a ordem. Reenvie a mesma tentativa.');return data;
}
