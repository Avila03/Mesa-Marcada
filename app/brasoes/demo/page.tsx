import type {Metadata} from "next";
import CrestEditor from "./crest-editor";
import "./crest-demo.css";

export const metadata:Metadata={
 title:"Editor de Brasões | Mesa Marcada",
 description:"Crie brasões de Ligas com acabamentos Minimalista, Clássico e Premium no Mesa Marcada."
};
export default function BrasoesDemoPage(){
 return <CrestEditor/>;
}
