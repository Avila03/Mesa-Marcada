import type {MetadataRoute} from "next";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:"Mesa Marcada",
    short_name:"Mesa Marcada",
    description:"Poker, Blackjack, encontros, fichas e rachas da galera.",
    id:"/painel",
    start_url:"/painel",
    scope:"/",
    display:"standalone",
    background_color:"#080A0E",
    theme_color:"#080A0E",
    orientation:"portrait-primary",
    lang:"pt-BR",
    icons:[
      {src:"/icons/mesa-192.svg",sizes:"192x192",type:"image/svg+xml",purpose:"any"},
      {src:"/icons/mesa-512.svg",sizes:"512x512",type:"image/svg+xml",purpose:"maskable"},
      {src:"/mesa-marcada-logo.webp",sizes:"96x96",type:"image/webp",purpose:"any"}
    ],
    shortcuts:[
      {name:"Eventos",short_name:"Eventos",url:"/painel"},
      {name:"Mesa Marcada",short_name:"Mesa",url:"/painel"}
    ]
  };
}
