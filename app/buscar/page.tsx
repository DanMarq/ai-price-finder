import type { Metadata } from "next";
import { auth } from "@/auth";
import { searchProducts } from "@/lib/search/orchestrator";
import { ProductGrid } from "@/components/search/ProductGrid";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Resultados da busca | BuscaPreço IA" };

interface BuscarPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const { q } = await searchParams;
  const query = q?.trim();

  if (!query) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">
        Digite algo na busca para comparar preços.
      </div>
    );
  }

  const session = await auth();
  const result = await searchProducts(query, { userId: session?.user?.id });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">
        Resultados para &ldquo;{result.query}&rdquo;
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {result.products.length} produto{result.products.length === 1 ? "" : "s"} encontrado
        {result.products.length === 1 ? "" : "s"}
      </p>

      {result.warnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.warnings.map((warning) => (
            <Badge key={warning} tone="amber">
              {warning}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6">
        {result.products.length > 0 ? (
          <ProductGrid products={result.products} />
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            Nenhum produto encontrado. Tente uma busca mais genérica ou monitore este produto para
            recebermos avisos assim que encontrarmos ofertas.
          </p>
        )}
      </div>
    </div>
  );
}
