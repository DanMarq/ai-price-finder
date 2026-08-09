import Link from "next/link";
import type { EnrichedProductResult } from "@/lib/search/orchestrator";
import { formatBRL } from "@/lib/utils/money";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const AVAILABILITY_LABEL: Record<string, { label: string; tone: "green" | "red" | "gray" }> = {
  IN_STOCK: { label: "Disponível", tone: "green" },
  OUT_OF_STOCK: { label: "Indisponível", tone: "red" },
  UNKNOWN: { label: "A confirmar", tone: "gray" },
};

export function ProductCard({ product, offers }: EnrichedProductResult) {
  const cheapest = offers[0];
  const isLowestEver =
    product.lowestPriceEver !== null && cheapest && cheapest.price <= product.lowestPriceEver;
  const availability = AVAILABILITY_LABEL[cheapest?.availability ?? "UNKNOWN"];

  return (
    <Link href={`/produto/${product.slug}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5">
        <div className="relative aspect-square w-full bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- domínio de imagem arbitrário (loja de terceiros)
            <img
              src={product.imageUrl}
              alt={product.canonicalTitle}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain p-4 transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem imagem
            </div>
          )}
          {isLowestEver && (
            <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-md shadow-black/20 ring-1 ring-black/5">
              Menor preço já visto
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-primary">
            {product.canonicalTitle}
          </h3>
          <div className="mt-auto flex flex-col gap-1">
            {cheapest ? (
              <>
                <p className="text-xs text-muted-foreground">
                  A partir de, em {offers.length} loja{offers.length > 1 ? "s" : ""}
                </p>
                <p className="text-xl font-bold text-foreground">{formatBRL(cheapest.totalPrice)}</p>
                <p className="text-xs text-muted-foreground">{cheapest.storeName}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Sem ofertas no momento</p>
            )}
            {availability && (
              <Badge tone={availability.tone} className="mt-1 w-fit">
                {availability.label}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
