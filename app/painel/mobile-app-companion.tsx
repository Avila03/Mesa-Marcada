"use client";

import {useEffect,useRef,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";

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

export default function MobileAppCompanion({onUpdate}:{onUpdate:()=>Promise<void>}){
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
          await onUpdateRef.current();
          if(localStorage.getItem("mm-realtime-alerts")==="yes"&&
            "Notification" in window&&Notification.permission==="granted"&&!document.hasFocus()){
            new Notification("Mesa Marcada",{body:labels[0],icon:"/mesa-marcada-logo.webp"});
          }
        }
      }
      baseline.current=next;
    }
    void checkEvents();
    const polling=window.setInterval(()=>void checkEvents(),60000);
    return()=>{active=false;window.clearInterval(polling)};
  },[]);

  async function install(){
    if(!installPrompt)return;
    await installPrompt.prompt();
    const result=await installPrompt.userChoice;
    if(result.outcome==="accepted")setNotice("Instalação iniciada. Confira sua tela inicial.");
    setInstallPrompt(null);
  }
  async function enableAlerts(){
    if(!("Notification" in window)){
      localStorage.setItem("mm-realtime-alerts","yes");
      setNotifyEnabled(true);
      setNotice("Avisos dentro do aplicativo ativados. Seu aparelho não permite avisos do sistema neste navegador.");
      return;
    }
    let allowed=Notification.permission==="granted";
    if(Notification.permission==="default"){
      try{allowed=(await Notification.requestPermission())==="granted"}
      catch{allowed=false}
    }
    localStorage.setItem("mm-realtime-alerts","yes");
    setNotifyEnabled(true);
    setNotice(allowed?"Avisos ativados enquanto o Mesa Marcada estiver aberto.":
      "Avisos visuais ativados no site. Permissão de notificações do aparelho indisponível.");
  }
  function disableAlerts(){
    localStorage.removeItem("mm-realtime-alerts");
    setNotifyEnabled(false);
    setNotice("Avisos opcionais desativados.");
  }
  return <section className="mm-app-companion" aria-label="Mesa Marcada no smartphone">
    <div className="mm-app-companion-head">
      <div><span className="eyebrow">MESAS SEM COMPLICAÇÃO</span><h2>Seu clube no celular</h2>
        <p>Instale o Mesa Marcada e acompanhe alterações nos eventos enquanto estiver usando o app.</p>
      </div>
      <span className="mm-app-device" aria-hidden="true">▣</span>
    </div>
    <div className="mm-app-actions">
      {!appInstalled&&(installPrompt?
        <button type="button" className="btn gold" onClick={()=>void install()}>↓ Instalar aplicativo</button>:
        iphone?<div className="mm-app-install-hint">
          <strong>Instalar no iPhone:</strong> no Safari, toque em Compartilhar e escolha
          <strong> Adicionar à Tela de Início</strong>.
        </div>:<div className="mm-app-install-hint">No navegador do Android ou computador, abra o menu e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</div>
      )}
      {appInstalled&&<span className="mm-v09-good">✓ Aplicativo instalado neste aparelho</span>}
      {notifyEnabled?<button className="btn" type="button" onClick={disableAlerts}>Desativar avisos</button>:
        <button className="btn" type="button" onClick={()=>void enableAlerts()}>Ativar avisos de eventos</button>}
    </div>
    {notice&&<p className="mm-app-feedback" role="status">{notice}</p>}
    {alerts.length>0&&<div className="mm-app-live-alerts" role="status">
      <strong>Novidades na agenda</strong>
      {alerts.map((label,i)=><p key={i}>{label}</p>)}
      <button type="button" onClick={()=>setAlerts([])}>Dispensar</button>
    </div>}
    <p className="mm-formfoot">Avisos são verificados enquanto o aplicativo está aberto. Notificações push com o app fechado exigirão configuração específica em uma futura atualização.</p>
  </section>;
}
