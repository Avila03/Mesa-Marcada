import { redirect } from "next/navigation";

export default function Home() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect("/painel");
  }
  return <iframe className="demo-frame" src="/demo.html" title="Mesa Marcada — Demonstração v0.5"/>;
}
