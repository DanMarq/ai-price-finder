import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProductDetail } from "@/lib/products/getProductDetail";
import { PriceComparisonTable } from "@/components/product/PriceComparisonTable";
import { PriceChart } from "@/components/product/PriceChart";
import { AlertButton } from "@/components/product/AlertButton";
import { formatBRL } from "@/lib/utils/money";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  return { title: product ? `${product.canonicalTitle} | BuscaPreço IA` : "Produto não encontrado" };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [product, session] = await Promise.all([getProductDetail(slug), auth()]);

  if (!product) notFound();

  const existingAlert = session?.user?.id
    ? await prisma.priceAlert.findUnique({
        where: { userId_productId: { userId: session.user.id, productId: product.id } },
      })
    : null;

  const cheapest = product.offers[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 sm:grid-cols-[240px_1fr]">
        <Card className="aspect-square w-full overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.canonicalTitle}
              className="h-full w-full object-contain p-4"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem imagem
            </div>
          )}
        </Card>

        <div>
          <div className="flex flex-wrap gap-2">
            {product.brand && <Badge tone="gray">{product.brand}</Badge>}
            {product.category && <Badge tone="blue">{product.category}</Badge>}
          </div>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            {product.canonicalTitle}
          </h1>

          {cheapest ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                Melhor preço em {product.offers.length} loja(s)
              </p>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {formatBRL(cheapest.totalPrice)}
              </p>
              <p className="text-sm text-muted-foreground">na {cheapest.storeName}</p>
              {product.lowestPriceEver !== null && cheapest.price <= product.lowestPriceEver && (
                <span className="mt-2 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                  Menor preço já visto
                </span>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma oferta ativa no momento.</p>
          )}

          <div className="mt-5">
            <AlertButton
              productId={product.id}
              slug={product.slug}
              isAuthenticated={Boolean(session?.user)}
              existingAlert={
                existingAlert
                  ? {
                      targetPrice: existingAlert.targetPrice ? Number(existingAlert.targetPrice) : null,
                      alertOnAnyDrop: existingAlert.alertOnAnyDrop,
                    }
                  : null
              }
            />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Comparar preços</h2>
        <div className="mt-3">
          <PriceComparisonTable offers={product.offers} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground">Histórico de preços</h2>
        <div className="mt-3">
          <PriceChart offers={product.offers} />
        </div>
      </section>
    </div>
  );
}
