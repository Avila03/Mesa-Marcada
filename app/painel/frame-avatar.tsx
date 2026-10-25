"use client";

import {useCallback,useEffect,useState} from "react";
import {getSupabase} from "@/lib/supabase/browser";
import FrameArtwork from "./frame-artwork";
import type {FrameId,FrameVariant} from "./frame-catalog";
import "./frame-avatar.css";

type Equipped={frame_id:FrameId|null;variant:FrameVariant};
const cached=new Map<string,{expires:number;promise:Promise<Equipped|null>}>();
const TTL=90_000;
async function loadEquipped(userId:string):Promise<Equipped|null>{
 const db=getSupabase();if(!db)return null;
 const {data,error}=await db.from("profile_frame_showcase").select("frame_id,variant").eq("user_id",userId).maybeSingle();
 if(error)return null;
 if(!data)return {frame_id:null,variant:"original"};
 return {frame_id:data.frame_id as FrameId|null,variant:(data.variant||"original") as FrameVariant};
}
function fetchEquipped(userId:string){
 const prior=cached.get(userId);
 if(prior&&prior.expires>Date.now())return prior.promise;
 const promise=loadEquipped(userId).catch(()=>null);
 cached.set(userId,{expires:Date.now()+TTL,promise});
 return promise;
}
export function notifyFrameUpdated(userId:string){
 cached.delete(userId);
 if(typeof window!=="undefined")window.dispatchEvent(
  new CustomEvent("mm-frame-updated",{detail:{userId}})
 );
}
export default function FrameAvatar({playerId,name,photoUrl,large=false,className=""}:{
 playerId:string;name:string;photoUrl?:string;large?:boolean;className?:string;
}){
 const [frame,setFrame]=useState<Equipped|null>(null);
 const [photoFailed,setPhotoFailed]=useState(false);
 const fetchCurrent=useCallback(()=>{
  let active=true;
  void fetchEquipped(playerId).then(data=>{if(active)setFrame(data)});
  return()=>{active=false};
 },[playerId]);
 useEffect(()=>{
  setFrame(null);
  const cancel=fetchCurrent();
  const changed=(event:Event)=>{
   if((event as CustomEvent<{userId:string}>).detail?.userId===playerId){
    cached.delete(playerId);void fetchCurrent();
   }
  };
  window.addEventListener("mm-frame-updated",changed);
  return()=>{cancel();window.removeEventListener("mm-frame-updated",changed)};
 },[fetchCurrent,playerId]);
 useEffect(()=>setPhotoFailed(false),[photoUrl]);
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2)
  .map(part=>part[0].toUpperCase()).join("")||"MM";
 return <span className={"mm-player-avatar mm-prestige-avatar "+(frame?.frame_id?"has-frame ":"")+(large?"large ":"")+className}
  aria-label={"Foto de "+name+(frame?.frame_id?", moldura equipada "+frame.frame_id:"")}>
  <span className="mm-prestige-avatar-portrait">
   {photoUrl&&!photoFailed?<img src={photoUrl} alt="" className="mm-player-photo"
    loading={large?"eager":"lazy"} referrerPolicy="no-referrer" onError={()=>setPhotoFailed(true)}/>:initials}
  </span>
  {frame?.frame_id&&<FrameArtwork id={frame.frame_id} variant={frame.variant} className="mm-frame-artwork"/>}
 </span>;
}
