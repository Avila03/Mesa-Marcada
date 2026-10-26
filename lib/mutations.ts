import type {SupabaseClient} from "@supabase/supabase-js";

const pending=new Map<string,{payload:string;id:string}>();
/** Keep the same command identity after a lost response, including a page reload. */
export async function runMutation(db:Pick<SupabaseClient,"rpc">,userId:string,kind:string,args:Record<string,unknown>):Promise<string>{
 const payload=JSON.stringify(args),key="mm-command:"+userId+":"+kind+":"+payload;
 let command=pending.get(key);
 if(!command&&typeof window!=="undefined"){
  try{const stored=JSON.parse(sessionStorage.getItem(key)||"null");
   if(stored?.payload===payload&&/^[0-9a-f-]{36}$/i.test(stored.id))command=stored;
  }catch{/* Storage may be unavailable in private browsing. */}
 }
 if(!command)command={payload,id:crypto.randomUUID()};
 pending.set(key,command);
 if(typeof window!=="undefined")try{sessionStorage.setItem(key,JSON.stringify(command))}catch{}
 const {data,error}=await db.rpc(kind,{...args,p_request_id:command.id});
 if(error)throw new Error(error.message);
 if(typeof data!=="string")throw new Error("Não foi possível confirmar o lançamento. Tente novamente.");
 pending.delete(key);
 if(typeof window!=="undefined")try{sessionStorage.removeItem(key)}catch{}
 return data;
}
