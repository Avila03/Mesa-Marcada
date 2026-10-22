import type {Metadata} from "next";
import CrestEditor from "./crest-editor";
import "./crest-demo.css";

export const metadata:Metadata={
 title:"Editor de Brasões Premium | Mesa Marcada",
 description:"Prévia interativa da criação de brasões de Ligas no estilo Dark Cards."
};
export default function BrasoesDemoPage(){
 return <CrestEditor/>;
}
