import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa Marcada | Suas noites de jogo",
  description: "Organize eventos, mesas, enquetes e resultados com seus amigos.",
  applicationName: "Mesa Marcada",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true,title:"Mesa Marcada",statusBarStyle:"black-translucent"},
  icons: {
    icon: [{url:"/mesa-marcada-logo.webp",type:"image/webp",sizes:"96x96"}],
    shortcut:"/mesa-marcada-logo.webp",
    apple:"/mesa-marcada-logo.webp"
  },
  openGraph:{
    title:"Mesa Marcada",
    description:"Poker, Blackjack e encontros entre amigos.",
    images:[{url:"/mesa-marcada-logo.webp",width:96,height:96}]
  },
};
export const viewport: Viewport = {
  width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#080a0e"
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="pt-BR"><body>{children}</body></html>;
}
