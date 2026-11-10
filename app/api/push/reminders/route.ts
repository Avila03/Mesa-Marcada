import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webPush from "web-push";
export const runtime="nodejs";
export const dynamic="force-dynamic";

const timeFormat=new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"});

/**
 * Lembrete 2 horas antes, chamado a cada 15 minutos pelo agendador do banco.
 * É seguro chamar a qualquer momento: o banco só libera encontros dentro da
 * janela e nunca repete o lembrete para a mesma pessoa e o mesmo encontro.
 */
async function deliver(){
 const pub=process.env.WEB_PUSH_PUBLIC_KEY;
 const priv=process.env.WEB_PUSH_PRIVATE_KEY;
 const serverSecret=process.env.PUSH_SERVER_SECRET;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!pub||!priv||!serverSecret||!url||!anon)return NextResponse.json({error:"Notificações não configuradas"},{status:503});
 const db=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}});
 const {data,error}=await db.rpc("claim_reminder_push_targets",{p_server_secret:serverSecret});
 if(error)return NextResponse.json({error:"Lembretes indisponíveis"},{status:500});
 webPush.setVapidDetails("https://mesa-marcada.vercel.app",pub,priv);
 const targets=(data||[]) as {endpoint:string;p256dh:string;auth_key:string;session_id:string;title:string;starts_at:string}[];
 const outcomes=await Promise.allSettled(targets.map(t=>webPush.sendNotification(
  {endpoint:t.endpoint,keys:{p256dh:t.p256dh,auth:t.auth_key}},
  JSON.stringify({
   title:"Mesa Marcada · Hoje tem jogo",
   body:(String(t.title).slice(0,60)||"Seu encontro")+" começa às "+timeFormat.format(new Date(t.starts_at))+". Sua cadeira está guardada.",
   url:"/eventos/"+t.session_id+"/preparacao"
  }),{TTL:5400})));
 return NextResponse.json({sent:outcomes.filter(o=>o.status==="fulfilled").length,attempted:outcomes.length},{headers:{"Cache-Control":"no-store"}});
}

export async function GET(){
 try{return await deliver()}catch{return NextResponse.json({error:"Não foi possível enviar os lembretes"},{status:500})}
}
export const POST=GET;
