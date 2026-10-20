import { redirect } from "next/navigation";

export default function Home() {
  // A versão 0.6 é o fluxo principal. A demonstração v0.5 permanece
  // disponível apenas em /demo.html, sem mascarar configuração ausente.
  redirect("/painel");
}
