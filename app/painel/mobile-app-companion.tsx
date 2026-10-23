"use client";

import {useEffect,useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import UiIcon from "./ui-icon";

type InstallEvent=Event&{
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:"accepted"|"dismissed";platform:string}>;
};

type EventSnapshot={id:string;title:string;starts_at:string;status:string;location:string};

function installed(){
  if(typeof window==="undefined")return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    ||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}
function isIphone(){return typeof navigator!=="undefined"&&/iphone|ipad|ipod/i.test(navigator.userAgent);}

export default function MobileAppCompanion({onUpdate,visible}:{onUpdate:()=>Promise<void>;visible:boolean}){
  const [installPrompt,setInstallPrompt]=useState<InstallEvent|null>(null);
  const [appInstalled,setInstalled]=useState(false);
  const [notice,setNotice]=useState("");
  const [notifyEnabled,setNotifyEnabled]=useState(false);
  const [iphone,setIphone]=useState(false);
  const [alerts,setAlerts]=useState<string[]>([]);
  const baseline=useRef<Map<string,string>|null>(null);
  const onUpdateRef=useRef(onUpdate);
  useEffect(()=>{onUpdateRef.current=onUpdate},[onUpdate]);

  useEffect(()=>{
    setInstalled(installed());
    setIphone(isIphone());
    setNotifyEnabled(localStorage.getItem("mm-realtime-alerts")==="yes");
    if("serviceWorker" in navigator){
      void navigator.serviceWorker.ready.then(async(reg)=>{
        const subscription=await reg.pushManager?.getSubscription();
        setNotifyEnabled(Boolean(subscription));
      }).catch(()=>{});
    }
    if("serviceWorker" in navigator&&window.isSecureContext){
      void navigator.serviceWorker.register("/sw.js").catch(()=>{/* PWA remains optional */});
    }
    const promptHandler=(event:Event)=>{
      event.preventDefault();
      setInstallPrompt(event as InstallEvent);
    };
    const installedHandler=()=>{setInstalled(true);setInstallPrompt(null);setNotice("Mesa Marcada instalado!");};
    window.addEventListener("beforeinstallprompt",promptHandler);
    window.addEventListener("appinstalled",installedHandler);
    return()=>{
      window.removeEventListener("beforeinstallprompt",promptHandler);
      window.removeEventListener("appinstalled",installedHandler);
    };
  },[]);

  useEffect(()=>{
    if(!visible)return;
    let active=true;
    async function checkEvents(){
      if(document.visibilityState==="hidden")return;
      const db=getSupabase();
      if(!db)return;
      const {data,error}=await db.from("sessions").select("id,title,starts_at,status,location")
        .order("starts_at",{ascending:true}).limit(100);
      if(error||!active)return;
      const next=new Map<string,string>();
      for(const event of (data||[]) as EventSnapshot[]){
        next.set(event.id,JSON.stringify([event.title,event.starts_at,event.status,event.location]));
      }
      if(baseline.current){
        const changes=(data||[]).filter(event=>{
          const old=baseline.current?.get(event.id);
          return !old||old!==next.get(event.id);
        });
        if(changes.length){
          const labels=changes.slice(0,3).map(event=>{
            const isNew=!baseline.current?.has(event.id);
            return isNew?"Novo evento: "+event.title:"Evento atualizado: "+event.title;
          });
          setAlerts(labels);
          try{await onUpdateRef.current()}catch{/* Sincronização volta na próxima consulta */}
          // Push em segundo plano é responsabilidade do service worker.
        }
      }
      baseline.current=next;
    }
    void checkEvents();
    const polling=window.setInterval(()=>void checkEvents(),90000);
    return()=>{active=false;window.clearInterval(polling)};
  },[visible]);

  async function install(){
    if(!installPrompt)return;
    await installPrompt.prompt();
    const result=await installPrompt.userChoice;
    if(result.outcome==="accepted")setNotice("Instalação iniciada. Confira sua tela inicial.");
    setInstallPrompt(null);
  }
  // O pedido de permissão ocorre no clique do usuário, exigido pelo Safari.
  async function enableAlerts(){
    if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){
      setNotice("Este navegador não oferece Web Push. No iPhone, instale o Mesa Marcada pela Tela de Início.");
      return;
    }
    if(isIphone()&&!installed()){
      setNotice("No iPhone, primeiro use Compartilhar → Adicionar à Tela de Início. Abra o aplicativo instalado e ative as notificações.");
      return;
    }
    try{
      const permission=await Notification.requestPermission();
      if(permission!=="granted"){setNotice("Permissão negada. Você pode alterá-la nas configurações do aparelho.");return;}
      const db=getSupabase();if(!db)throw new Error("Conexão indisponível");
      const {data:{user}}=await db.auth.getUser();
      if(!user)throw new Error("Entre na sua conta para receber notificações");
      const response=await fetch("/api/push/key",{cache:"no-store"});
      const {key}=await response.json();
      if(!key)throw new Error("As notificações ainda não estão configuradas no servidor");
      const registration=await navigator.serviceWorker.ready;
      const base64=key.replace(/-/g,"+").replace(/_/g,"/");
      const binary=atob(base64.padEnd(Math.ceil(base64.length/4)*4,"="));
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const existing=await registration.pushManager.getSubscription();
      const subscription=existing||await registration.pushManager.subscribe({
        userVisibleOnly:true,applicationServerKey:bytes
      });
      const details=subscription.toJSON();
      if(!details.endpoint||!details.keys?.p256dh||!details.keys?.auth)
        throw new Error("O navegador não forneceu as chaves para as notificações");
      const {error}=await db.from("push_subscriptions").upsert({
        endpoint:details.endpoint,user_id:user.id,p256dh:details.keys.p256dh,auth_key:details.keys.auth
      },{onConflict:"endpoint"});
      if(error)throw error;
      setNotifyEnabled(true);
      localStorage.setItem("mm-realtime-alerts","yes");
      setNotice("Notificações ativadas! Você receberá avisos mesmo com o app fechado, quando o dispositivo permitir.");
    }catch(e){setNotice(e instanceof Error?e.message:"Não foi possível ativar as notificações");}
  }
  async function disableAlerts(){
    try{
      const registration=await navigator.serviceWorker.ready;
      const sub=await registration.pushManager.getSubscription();
      if(sub){
        const db=getSupabase();
        if(db){const {error}=await db.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);
          if(error)throw error;}
        await sub.unsubscribe();
      }
      localStorage.removeItem("mm-realtime-alerts");setNotifyEnabled(false);
      setNotice("Notificações deste aparelho desativadas.");
    }catch(e){setNotice(e instanceof Error?e.message:"Não foi possível desativar as notificações");}
  }
  if(!visible)return alerts.length>0?<div className="mm-app-live-alerts mm-app-live-compact" role="status">
    <strong>Agenda atualizada</strong>
    {alerts.map((label,i)=><p key={i}>{label}</p>)}
    <button type="button" onClick={()=>setAlerts([])}>Dispensar</button>
  </div>:null;
  return <section className={"mm-app-companion "+(appInstalled?"mm-app-companion-installed":"")} aria-label="Mesa Marcada no smartphone">
    <div className="mm-app-companion-head">
      <div><span className="eyebrow">{appInstalled?"PREFERÊNCIAS DO APLICATIVO":"MESA MARCADA NO CELULAR"}</span>
        <h2>{appInstalled?"Avisos de eventos":"Instalar no seu celular"}</h2>
        {!appInstalled&&<p>Adicione o Mesa Marcada à tela inicial do seu aparelho para ter acesso rápido aos eventos.</p>}
      </div>
      <span className="mm-app-device" aria-hidden="true"><UiIcon name={appInstalled?"bell":"smartphone"} size={27}/></span>
    </div>
    <div className="mm-app-actions">
      {!appInstalled&&(installPrompt?
        <button type="button" className="btn gold" onClick={()=>void install()}>↓ Instalar aplicativo</button>:
        iphone?<div className="mm-app-install-hint">
          <strong>Instalar no iPhone:</strong> no Safari, toque em Compartilhar e escolha
          <strong> Adicionar à Tela de Início</strong>.
        </div>:<div className="mm-app-install-hint">No navegador do Android ou computador, abra o menu e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</div>
      )}
      {appInstalled&&<span className="mm-v09-good mm-app-installed-status"><UiIcon name="check" size={17}/> Já instalado</span>}
      {notifyEnabled?<button className="btn" type="button" onClick={disableAlerts}>Desativar avisos</button>:
        <button className="btn" type="button" onClick={()=>void enableAlerts()}>Ativar notificações push</button>}
    </div>
    {notice&&<p className="mm-app-feedback" role="status">{notice}</p>}
    {alerts.length>0&&<div className="mm-app-live-alerts" role="status">
      <strong>Novidades na agenda</strong>
      {alerts.map((label,i)=><p key={i}>{label}</p>)}
      <button type="button" onClick={()=>setAlerts([])}>Dispensar</button>
    </div>}
    <p className="mm-formfoot">Notificações push são opcionais. No iPhone, exigem instalar o Mesa Marcada na Tela de Início e conceder permissão.</p>
  </section>;
}
