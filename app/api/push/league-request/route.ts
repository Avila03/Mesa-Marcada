import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import webPush from "web-push";
export const runtime="nodejs";

/** Apenas o autor de uma solicitação recente pode disparar um aviso ao dono. */
export async function POST(req:NextRequest){
 const bearer=req.headers.get("authorization")||"";
 if(!/^Bearer \S+$/.test(bearer))return NextResponse.json({error:"Autenticação obrigatória"},{status:401});
 const pub=process.env.WEB_PUSH_PUBLIC_KEY,priv=process.env.WEB_PUSH_PRIVATE_KEY;
 const secret=process.env.PUSH_SERVER_SECRET,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!pub||!priv||!secret||!url||!key)return NextResponse.json({error:"Push não configurado"},{status:503});
 try{
  const {leagueId}=await req.json();
  if(typeof leagueId!=="string"||!/^[0-9a-f-]{36}$/i.test(leagueId))
   return NextResponse.json({error:"Liga inválida"},{status:400});
  const token=bearer.slice(7);
  const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{
   persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
  }});
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return NextResponse.json({error:"Sessão inválida"},{status:401});
  const {data:targets,error:claimError}=await db.rpc("claim_league_join_push_targets",{
   p_league_id:leagueId,p_server_secret:secret
  });
  if(claimError)return NextResponse.json({error:"Notificação indisponível"},{status:403});
  webPush.setVapidDetails("https://mesa-marcada.vercel.app",pub,priv);
  const payload=JSON.stringify({title:"Mesa Marcada · Solicitação de entrada",
   body:"Você recebeu um novo pedido para participar de uma liga.",
   url:"/ligas/"+leagueId+"/gerenciar"});
  const outcomes=await Promise.allSettled(
   ((targets||[]) as {endpoint:string;p256dh:string;auth_key:string}[]).map(target=>
    webPush.sendNotification({endpoint:target.endpoint,
     keys:{p256dh:target.p256dh,auth:target.auth_key}},payload,{TTL:3600})
   )
  );
  return NextResponse.json({sent:outcomes.filter(x=>x.status==="fulfilled").length},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Não foi possível enviar o aviso"},{status:500})}
}
