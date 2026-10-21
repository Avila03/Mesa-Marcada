import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Confirmação de e-mail no fluxo PKCE do Supabase Auth.
 * Recebe apenas `code` do Supabase e troca por sessão usando cookies HTTP.
 * O redirecionamento é FIXO para evitar open redirect.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const errorRedirect = () => NextResponse.redirect(new URL("/login?auth_error=confirmation", url.origin));

  if (!code) return errorRedirect();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return errorRedirect();

  const requestedNext=url.searchParams.get("next");
  const safeDestination=requestedNext&&/^\/painel\?evento=[0-9a-f-]{36}$/i.test(requestedNext)
    ?requestedNext:"/painel";
  const response = NextResponse.redirect(new URL(safeDestination, url.origin));
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: {
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: "strict" | "lax" | "none" | boolean;
        maxAge?: number;
        expires?: Date;
        priority?: "low" | "medium" | "high";
      } }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return errorRedirect();

  return response;
}
