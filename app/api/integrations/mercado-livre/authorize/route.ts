import { NextResponse } from "next/server"
import {
  buildMercadoLivreAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  PKCE_COOKIE_NAME,
} from "@/lib/integrations/mercadoLivre"

/**
 * Passo manual e único de setup: acesse
 * /api/integrations/mercado-livre/authorize?secret=SEU_ADMIN_SETUP_SECRET
 * logado com a conta Mercado Livre que deve ficar associada ao app. Depois disso o token
 * é renovado sozinho (ver lib/integrations/mercadoLivre.ts) e você não precisa repetir isso.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get("secret")

  if (!process.env.ADMIN_SETUP_SECRET || secret !== process.env.ADMIN_SETUP_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const response = NextResponse.redirect(buildMercadoLivreAuthorizeUrl(codeChallenge))
    // O Mercado Livre exige PKCE: o verifier precisa sobreviver até o /callback sem viajar pela
    // URL (isso anularia a proteção do PKCE) — um cookie httpOnly de curta duração resolve.
    response.cookies.set(PKCE_COOKIE_NAME, codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/api/integrations/mercado-livre",
    })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}