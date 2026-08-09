import { NextResponse } from "next/server";
import { buildMercadoLivreAuthorizeUrl } from "@/lib/integrations/mercadoLivre";

/**
 * Passo manual e único de setup: acesse
 * /api/integrations/mercado-livre/authorize?secret=SEU_ADMIN_SETUP_SECRET
 * logado com a conta Mercado Livre que deve ficar associada ao app. Depois disso o token
 * é renovado sozinho (ver lib/integrations/mercadoLivre.ts) e você não precisa repetir isso.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!process.env.ADMIN_SETUP_SECRET || secret !== process.env.ADMIN_SETUP_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    return NextResponse.redirect(buildMercadoLivreAuthorizeUrl());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
