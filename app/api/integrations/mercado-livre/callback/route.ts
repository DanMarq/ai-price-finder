import { NextResponse, type NextRequest } from "next/server"
import { exchangeCodeForToken, PKCE_COOKIE_NAME } from "@/lib/integrations/mercadoLivre"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")
  const codeVerifier = request.cookies.get(PKCE_COOKIE_NAME)?.value

  if (error) {
    return new NextResponse(`Mercado Livre recusou a autorização: ${error}`, { status: 400 })
  }
  if (!code) {
    return new NextResponse("Parâmetro 'code' ausente na URL de callback.", { status: 400 })
  }
  if (!codeVerifier) {
    return new NextResponse(
      "Sessão de autorização expirada ou cookie bloqueado (code_verifier ausente). Acesse /api/integrations/mercado-livre/authorize de novo e conclua o fluxo na mesma aba, sem demorar mais de 10 minutos.",
      { status: 400 },
    )
  }

  try {
    await exchangeCodeForToken(code, codeVerifier)
    const response = new NextResponse(
      "Mercado Livre conectado com sucesso! Pode fechar esta aba — a busca já vai usar essa conta, e o token se renova sozinho.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )
    response.cookies.delete(PKCE_COOKIE_NAME)
    return response
  } catch (err) {
    console.error("[mercado-livre/callback] falha ao trocar code por token:", err)
    return new NextResponse(
      "Falha ao conectar com o Mercado Livre. Confira MERCADO_LIVRE_CLIENT_ID/SECRET e os logs do servidor.",
      { status: 500 },
    )
  }
}