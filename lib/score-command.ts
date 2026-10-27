import type {SupabaseClient} from '@supabase/supabase-js';
export type ScoreRequest={p_request_id:string;p_event_id:string;p_expected_revision:number;p_action:string;p_payload:Record<string,unknown>};
export function scoreRequest(eventId:string,revision:number,action:string,payload:Record<string,unknown>):ScoreRequest{return {p_request_id:crypto.randomUUID(),p_event_id:eventId,p_expected_revision:revision,p_action:action,p_payload:payload}}
/** The caller persists this exact request until a response confirms commit or rollback. */
export async function submitScoreRequest(db:Pick<SupabaseClient,'rpc'>,request:ScoreRequest){
 const {data,error}=await db.rpc('score_game_command',request);
 if(error)throw Object.assign(new Error(error.message),{code:error.code||null});
 if(typeof data!=='string')throw new Error('A resposta não confirmou o lançamento. Reenvie a mesma tentativa.');
 return data;
}
