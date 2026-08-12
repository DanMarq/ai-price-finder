import { getProductInsight } from "@/lib/ai/productAssistant";
import type { ProductDetail } from "@/lib/products/getProductDetail";
import type { ProductInsight } from "@/lib/ai/schemas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const ASSESSMENT: Record<ProductInsight["priceAssessment"], { label: string; tone: "green" | "gray" | "amber" }> = {
  GOOD_DEAL: { label: "Preço bom", tone: "green" },
  TYPICAL: { label: "Preço normal", tone: "gray" },
  ABOVE_AVERAGE: { label: "Acima do normal", tone: "amber" },
  INSUFFICIENT_DATA: { label: "Sem histórico suficiente", tone: "gray" },
}

interface ProductAssistantCardProps {
  apiKey: string;
  product: ProductDetail;
}

/**
 * Server Component assíncrono de propósito: fica dentro de um <Suspense> na página do produto
 * (ver app/produto/[slug]/page.tsx) para que a chamada de IA nunca atrase o resto da página —
 * se demorar ou falhar, o resto do produto já está na tela.
 */
export async function ProductAssistantCard({ apiKey, product }: ProductAssistantCardProps) {
  const insight = await getProductInsight(apiKey, product);
  if (!insight) return null;

  const assessment = ASSESSMENT[insight.priceAssessment];

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Assistente de compra</span>
        <Badge tone={assessment.tone}>{assessment.label}</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{insight.tip}</p>
      {insight.specHighlight && (
        <p className="mt-2 border-t border-border pt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Da ficha técnica: </span>
          {insight.specHighlight}
        </p>
      )}
    </Card>
  )
}