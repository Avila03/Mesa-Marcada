"use client";
import {useEffect,useRef,useState} from "react";
import type {Profile} from "@/lib/mesa-types";
import {getSupabase} from "@/lib/supabase/browser";
export function useProfilePhotos(profiles:Profile[]){
 const [urls,setUrls]=useState<Record<string,string>>({});
 const cache=useRef(new Map<string,{url:string;until:number}>());
 const paths=profiles.filter(p=>p.avatar_path).map(p=>p.id+":"+p.avatar_path).sort().join("|");
 useEffect(()=>{
  let active=true;
  const photos=profiles.filter(p=>p.avatar_path);
  const refresh=async()=>{
   if(document.visibilityState==="hidden")return;
   const db=getSupabase();if(!db)return;
   const missing=photos.filter(p=>(cache.current.get(p.avatar_path!)?.until||0)<Date.now()+300000);
   if(missing.length){
    const {data,error}=await db.storage.from("player-avatars").createSignedUrls(missing.map(p=>p.avatar_path!),3600);
    if(!active)return;
    if(!error)data?.forEach((item,i)=>{if(item.signedUrl)cache.current.set(missing[i].avatar_path!,{url:item.signedUrl,until:Date.now()+3500000})});
   }
   if(active)setUrls(Object.fromEntries(photos.flatMap(p=>{
    const cached=cache.current.get(p.avatar_path!);return cached?[[p.id,cached.url]]:[];
   })));
  };
  void refresh().catch(()=>{});
  const visible=()=>{void refresh().catch(()=>{})};
  document.addEventListener("visibilitychange",visible);
  const timer=setInterval(visible,240000);
  return()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",visible)};
 // The stable signature prevents resigning unchanged paths after each catalog sync.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[paths]);
 return urls;
}
