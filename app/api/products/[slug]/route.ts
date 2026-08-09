import { NextResponse } from "next/server";
import { getProductDetail } from "@/lib/products/getProductDetail";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductDetail(slug);

  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  return NextResponse.json(product);
}
