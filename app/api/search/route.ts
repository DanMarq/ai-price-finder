import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchProducts } from "@/lib/search/orchestrator";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Parâmetro 'q' é obrigatório" }, { status: 400 });
  }

  const session = await auth();
  const bypassCache = searchParams.get("refresh") === "1";

  try {
    const result = await searchProducts(query, {
      userId: session?.user?.id,
      bypassCache,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/search] falha inesperada:", error);
    return NextResponse.json({ error: "Falha ao buscar produtos" }, { status: 500 });
  }
}
