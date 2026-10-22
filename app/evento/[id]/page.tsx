import {redirect} from "next/navigation";
export default async function SharedEvent({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id)) redirect("/eventos");
 redirect("/eventos/"+encodeURIComponent(id));
}
