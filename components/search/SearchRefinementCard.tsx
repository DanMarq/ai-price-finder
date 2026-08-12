import { getSearchRefinement } from "@/lib/ai/searchAssistant"
import type { EnrichedProductResult } from "@/lib/search/orchestrator"
import { RefinementChips } from "./RefinementChips"
import { Card } from "@/components/ui/Card"

interface SearchRefinementCardProps {
  apiKey: string
  query: string
  products: EnrichedProductResult[]
}

/**
 * Server Component assíncrono dentro de <Suspense> em app/buscar/page.tsx — mesmo padrão do
 * ProductAssistantCard: a chamada de IA nunca atrasa a grade de resultados principal, que já
 * está na tela independente deste card aparecer ou não.
 */
export async function SearchRefinementCard({ apiKey, query, products }: SearchRefinementCardProps) {
  const refinement = await getSearchRefinement(apiKey, query, products)
  if (!refinement) return null

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-foreground">{refinement.question}</p>
      <RefinementChips query={query} options={refinement.options} />
    </Card>
  )
}