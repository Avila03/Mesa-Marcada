import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa Marcada | Suas noites de jogo",
  description: "Organize eventos, mesas, enquetes e resultados com seus amigos.",
};
export const viewport: Viewport = {
  width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#080a0e"
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="pt-BR"><body>{children}</body></html>;
}
