import type {ReactNode} from "react";
import PainelPage from "../painel/mobile-first";
// Este layout permanece montado durante a navegação e mantém o estado compartilhado.
export default function ClubLayout({children}:{children:ReactNode}){
 return <><PainelPage/>{children}</>;
}
