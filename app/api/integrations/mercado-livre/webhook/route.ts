import { NextResponse } from "next/server";

/**
 * URL exigida pelo cadastro do app no DevCenter do Mercado Livre ("URL de retorno de
 * notificações"). Nosso uso da API é só leitura de catálogo (busca de preços) — não vendemos
 * nem gerenciamos pedidos nessa conta — então só confirmamos o recebimento rapidamente, como a
 * documentação pede, sem processar o payload.
 */
export async function POST() {
  return NextResponse.json({ received: true });
}
