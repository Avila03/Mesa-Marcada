import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa Marcada — Clube de Jogos",
  description: "Organize suas salas, sessões, valores e gastos compartilhados.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
