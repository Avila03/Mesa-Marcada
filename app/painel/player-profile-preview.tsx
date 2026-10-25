"use client";

import {createPortal} from "react-dom";
import {useCallback,useEffect,useRef,useState} from "react";
import type {CSSProperties,ReactNode} from "react";
import type {Profile} from "@/lib/mesa-types";
import {getSupabase} from "@/lib/supabase/browser";
import {PlayerAvatar} from "./v09-features";
import {MEDALS} from "./medal-catalog";
import "./player-profile-preview.css";

type Medal=typeof MEDALS[number];
type MedalSummary={
  featured:Medal|null;
  featuredLevel:string;
  highlights:Medal[];
  count:number;
  private:boolean;
};
type Props={
  playerId:string;
  profile?:Profile;
  photoUrl?:string;
  fallbackName:string;
  className:string;
  style?:CSSProperties;
  caption?:string;
  children:ReactNode;
  onOpenProfile:()=>void;
  variant?:"seat"|"attendee";
};

const level=(medal:Medal,total:number)=>medal.levels.reduce(
 (current,tier,i)=>total>=tier.threshold?i:current,-1);
const cache=new Map<string,{time:number;promise:Promise<MedalSummary|null>}>();
const CACHE_MS=120000;

async function getMedalSummary(playerId:string):Promise<MedalSummary|null>{
 const db=getSupabase();
 if(!db)return null;
 const [stats,showcase,grants]=await Promise.all([
  db.rpc("get_player_medal_progress",{p_user_id:playerId}),
  db.from("profile_medal_showcase").select("featured_id,pinned_ids,visible").eq("user_id",playerId).maybeSingle(),
  db.from("player_medal_grants").select("medal_id,level_index").eq("user_id",playerId)
 ]);
 if(stats.error||showcase.error||grants.error)return null;
 if(showcase.data?.visible===false)
  return {featured:null,featuredLevel:"",highlights:[],count:0,private:true};
 const rows=(stats.data||{}) as Record<string,number>;
 const awarded=new Map<string,number>();
 for(const entry of grants.data||[])
  awarded.set(entry.medal_id,entry.level_index);
 const tierFor=(m:Medal)=>Math.max(level(m,Number(rows[m.id])||0),awarded.get(m.id)??-1);
 const unlocked=MEDALS.filter(m=>tierFor(m)>=0);
 const featured=unlocked.find(m=>m.id===showcase.data?.featured_id)||unlocked[0]||null;
 const highlights=(showcase.data?.pinned_ids||[])
  .filter((id:string)=>id!==featured?.id)
  .map((id:string)=>unlocked.find(m=>m.id===id))
  .filter((m:Medal|undefined):m is Medal=>Boolean(m)).slice(0,3);
 return {featured,featuredLevel:featured?.levels[tierFor(featured)].name||"",highlights,
  count:unlocked.length,private:false};
}
function fetchSummary(id:string){
 const cached=cache.get(id);
 if(cached&&Date.now()-cached.time<CACHE_MS)return cached.promise;
 const promise=getMedalSummary(id).catch(()=>null);
 cache.set(id,{time:Date.now(),promise});
 return promise;
}

function PreviewContent({playerId,profile,photoUrl,fallbackName,onOpenProfile}:{
 playerId:string;profile?:Profile;photoUrl?:string;fallbackName:string;onOpenProfile:()=>void;
}){
 const [summary,setSummary]=useState<MedalSummary|null>(null);
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  void fetchSummary(playerId).then(data=>{
   if(active){setSummary(data);setLoaded(true);}
  });
  return()=>{active=false};
 },[playerId]);
 const name=profile?.display_name||fallbackName;
 return <div className="mm-player-preview-content" aria-label={"Prévia do perfil de "+name}>
  <div className="mm-player-preview-head">
   <PlayerAvatar name={name} photoUrl={photoUrl} large/>
   <div className="mm-player-preview-identity">
    <strong>{name}</strong>
    <small>{profile?.favorite_game==="blackjack"?"♦ Blackjack":"♠ Poker"} · Jogador</small>
   </div>
  </div>
  {profile?.bio&&<p className="mm-player-preview-bio">{profile.bio}</p>}
  {!loaded?<p className="mm-player-preview-note">Consultando conquistas…</p>:
   summary?.private?<p className="mm-player-preview-note">Conquistas privadas.</p>:
   summary?.featured?<div className="mm-player-preview-medals">
    <div className="mm-player-preview-featured" style={{"--preview-color":summary.featured.color} as CSSProperties}>
     <span aria-hidden="true">{summary.featured.symbol}</span>
     <div><strong>{summary.featured.title}</strong><small>{summary.featuredLevel} · {summary.count}/15 conquistadas</small></div>
    </div>
    {summary.highlights.length>0&&<div className="mm-player-preview-highlights" aria-label="Três conquistas em destaque">
     {summary.highlights.map(m=><span key={m.id} title={m.title} aria-label={m.title}>{m.symbol}</span>)}
    </div>}
   </div>:
   <p className="mm-player-preview-note">Nenhuma conquista desbloqueada ainda.</p>}
  <button type="button" className="mm-player-preview-open" onClick={onOpenProfile}>
   Ver perfil completo <span aria-hidden="true">→</span>
  </button>
 </div>;
}

/** A single trigger for occupied seats and participant chips. Fetches medals only when opened. */
export default function PlayerProfileTrigger({
 playerId,profile,photoUrl,fallbackName,className,style,caption,children,onOpenProfile,variant="attendee"
}:Props){
 const [open,setOpen]=useState(false);
 const [coords,setCoords]=useState({top:0,left:0});
 const trigger=useRef<HTMLButtonElement>(null);
 const popup=useRef<HTMLDivElement>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const clear=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
 const close=useCallback(()=>{clear();setOpen(false);},[clear]);
 const openCard=useCallback(()=>{
  clear();
  const rect=trigger.current?.getBoundingClientRect();
  if(rect&&typeof window!=="undefined"){
   const width=300;
   const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left+rect.width/2-width/2));
   const top=rect.bottom+244<window.innerHeight?rect.bottom+9:Math.max(12,rect.top-247);
   setCoords({left,top});
  }
  setOpen(true);
 },[clear]);
 const scheduleClose=()=>{clear();timer.current=setTimeout(()=>setOpen(false),210);};
 useEffect(()=>()=>{
  if(timer.current)clearTimeout(timer.current);
 },[]);
 useEffect(()=>{
  if(!open)return;
  const dismiss=(e:PointerEvent)=>{
   if(e.target instanceof Node
     &&(trigger.current?.contains(e.target)||popup.current?.contains(e.target)))return;
   close();
  };
  const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")close();};
  const scroll=()=>close();
  document.addEventListener("pointerdown",dismiss);
  document.addEventListener("keydown",escape);
  window.addEventListener("scroll",scroll,true);
  return()=>{
   document.removeEventListener("pointerdown",dismiss);
   document.removeEventListener("keydown",escape);
   window.removeEventListener("scroll",scroll,true);
  };
 },[open,close]);
 return <>
  <button ref={trigger} className={className} type="button" style={style}
   aria-label={caption||"Visualizar perfil de "+(profile?.display_name||fallbackName)}
   aria-haspopup="dialog" aria-expanded={open}
   onMouseEnter={openCard} onMouseLeave={scheduleClose}
   onFocus={openCard}
   onClick={openCard}>
   {children}
  </button>
  {open&&typeof document!=="undefined"&&createPortal(
   <div ref={popup} className={"mm-player-preview-popover "+(variant==="seat"?"from-seat":"from-attendee")}
    style={{left:coords.left,top:coords.top}}
    role="dialog" aria-label={"Perfil de "+(profile?.display_name||fallbackName)}
    onMouseEnter={clear} onMouseLeave={scheduleClose}>
    <button className="mm-player-preview-close" type="button" aria-label="Fechar prévia do perfil" onClick={close}>×</button>
    <PreviewContent playerId={playerId} profile={profile} photoUrl={photoUrl}
     fallbackName={fallbackName} onOpenProfile={()=>{close();onOpenProfile();}}/>
   </div>,document.body)}
 </>;
}
