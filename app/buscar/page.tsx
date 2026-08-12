import type { Metadata } from "next"
import { Suspense } from "react"
import { auth } from "@/auth"
import { searchProducts } from "@/lib/search/orchestrator"
import { resolveGeminiConfig } from "@/lib/ai/resolveApiKey"
import { isGenericSearch } from "@/lib/ai/searchAssistant"
import { ProductGrid } from "@/components/search/ProductGrid"
import { SortSelect, type SortOption } from "@/components/search/SortSelect"
import { SearchRefinementCard } from "@/components/search/SearchRefinementCard"
import { Badge } from "@/components/ui/Badge"

export const metadata: Metadata = { title: "Resultados da busca | BuscaPreço IA" }
interface BuscarPageProps {
  searchParams: Promise<{ q?: string; sort?: string }>;
}

export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const { q, sort } = await searchParams
  const query = q?.trim()
  const sortOption: SortOption = sort === "price_desc" ? "price_desc" : "price_asc"

  if (!query) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">
        Digite algo na busca para comparar preços.
      </div>
    )
  }

  const session = await auth()
  const [result, geminiConfig] = await Promise.all([
    searchProducts(query, { userId: session?.user?.id }),
    resolveGeminiConfig(session?.user?.id),
  ])
  // Já vem ordenado por menor preço do orquestrador — "maior preço" é só inverter a lista.
  const products = sortOption === "price_desc" ? [...result.products].reverse() : result.products
  const showRefinement = Boolean(geminiConfig) && isGenericSearch(result.query, result.products)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">
        Resultados para &ldquo;{result.query}&rdquo;
      </h1>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.products.length} produto{result.products.length === 1 ? "" : "s"} encontrado
          {result.products.length === 1 ? "" : "s"}
        </p>
        {products.length > 1 && <SortSelect value={sortOption} />}
      </div>

      {result.warnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.warnings.map((warning) => (
            <Badge key={warning} tone="amber">
              {warning}
            </Badge>
          ))}
        </div>
      )}

      {showRefinement && geminiConfig && (
        <div className="mt-4">
          {/* Suspense isola a chamada de IA — a grade de produtos abaixo já está na tela
              independente deste card aparecer ou não. */}
          <Suspense fallback={null}>
            <SearchRefinementCard apiKey={geminiConfig.apiKey} query={result.query} products={result.products} />
          </Suspense>
        </div>
      )}

      <div className="mt-6">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="py-16 text-center text-muted-foreground">
            Nenhum produto encontrado. Tente uma busca mais genérica ou monitore este produto para
            recebermos avisos assim que encontrarmos ofertas.
          </p>
        )}
      </div>
    </div>
  )
}