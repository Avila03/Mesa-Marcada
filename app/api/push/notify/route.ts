import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webPush from "web-push";
export const runtime="nodejs";
const contents={
 poll:{title:"Mesa Marcada · Nova enquete",body:"Há uma nova enquete para você responder."},
 live:{title:"Mesa Marcada · Partida iniciada",body:"A mesa está ao vivo! Confira sua posição e as fichas."},
 summary:{title:"Mesa Marcada · Resumo da noite",body:"A partida foi encerrada. Veja seu resultado e os rachas."}
} as const;
export async function POST(req:NextRequest){
 try{
  const pub=process.env.WEB_PUSH_PUBLIC_KEY;
  const priv=process.env.WEB_PUSH_PRIVATE_KEY;
  const serverSecret=process.env.PUSH_SERVER_SECRET;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!pub||!priv||!serverSecret||!url||!anon)return NextResponse.json({error:"Notificações não configuradas"},{status:503});
  const bearer=req.headers.get("authorization")||"";
  if(!/^Bearer \S+$/.test(bearer))return NextResponse.json({error:"Autenticação obrigatória"},{status:401});
  const token=bearer.slice(7);
  const db=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{
   autoRefreshToken:false,persistSession:false,detectSessionInUrl:false
  }});
  const {data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return NextResponse.json({error:"Sessão inválida"},{status:401});
  const body=await req.json().catch(()=>null);
  const id=body?.eventId;
  const kind=body?.kind as keyof typeof contents;
  if(typeof id!=="string"||!/^[0-9a-f-]{36}$/i.test(id)||!Object.hasOwn(contents,kind))
   return NextResponse.json({error:"Evento ou notificação inválidos"},{status:400});
  const {data:targets,error:rpcError}=await db.rpc("claim_event_push_targets",{p_event_id:id,p_kind:kind,p_server_secret:serverSecret});
  if(rpcError)return NextResponse.json({error:rpcError.message},{status:403});
  const content=contents[kind];
  webPush.setVapidDetails("https://mesa-marcada.vercel.app",pub,priv);
  const payload=JSON.stringify({...content,url:"/eventos/"+id+(kind==="live"?"/ao-vivo":kind==="summary"?"/resumo":"")});
  const outcomes=await Promise.allSettled(((targets||[]) as {endpoint:string;p256dh:string;auth_key:string}[]).map(t=>
   webPush.sendNotification({endpoint:t.endpoint,keys:{p256dh:t.p256dh,auth:t.auth_key}},
      payload,{TTL:3600})
  ));
  return NextResponse.json({sent:outcomes.filter(x=>x.status==="fulfilled").length,
    attempted:outcomes.length},{headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({error:"Não foi possível enviar os avisos"},{status:500});
 }
}
