import type { Metadata, Viewport } from "next";
import "./globals.css";
import {Outfit,Tilt_Neon} from "next/font/google";

const tiltNeon=Tilt_Neon({subsets:["latin"],weight:"400",variable:"--font-tilt-neon",display:"swap"});
const outfit=Outfit({subsets:["latin"],variable:"--font-outfit",display:"swap"});

export const metadata: Metadata = {
  metadataBase: new URL("https://mesa-marcada.vercel.app"),
  title: "Mesa Marcada | Suas noites de jogo",
  description: "Organize eventos, mesas, enquetes e resultados com seus amigos.",
  applicationName: "Mesa Marcada",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,title:"Mesa Marcada",statusBarStyle:"black-translucent"},
  icons: {
    icon: [{url:"/icon",type:"image/png",sizes:"512x512"}],
    shortcut:"/icon",
    apple: [{url:"/apple-icon",type:"image/png",sizes:"180x180"}]
  },
  openGraph:{
    title:"Mesa Marcada",
    description:"Poker, Blackjack e encontros entre amigos.",
    images:[{url:"/icon",width:512,height:512}]
  },
};
export const viewport: Viewport = {
  width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#080a0e"
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="pt-BR" className={tiltNeon.variable+" "+outfit.variable}><body>{children}</body></html>;
}
