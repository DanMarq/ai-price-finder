import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/integrations/mercadoLivre";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(`Mercado Livre recusou a autorização: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Parâmetro 'code' ausente na URL de callback.", { status: 400 });
  }

  try {
    await exchangeCodeForToken(code);
    return new NextResponse(
      "Mercado Livre conectado com sucesso! Pode fechar esta aba — a busca já vai usar essa conta, e o token se renova sozinho.",
      { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  } catch (err) {
    console.error("[mercado-livre/callback] falha ao trocar code por token:", err);
    return new NextResponse(
      "Falha ao conectar com o Mercado Livre. Confira MERCADO_LIVRE_CLIENT_ID/SECRET e os logs do servidor.",
      { status: 500 },
    );
  }
}
