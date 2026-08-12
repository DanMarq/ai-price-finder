import { pickBestSpecs, type ProductDetailOffer } from "@/lib/products/getProductDetail"
import { Card } from "@/components/ui/Card"

interface TechSpecsCardProps {
  offers: ProductDetailOffer[]
}

/** Algumas lojas mandam o nome do campo em snake_case cru (ex: "tipo_de_montagem") — só cosmético. */
function formatLabel(label: string): string {
  const withSpaces = label.replace(/_/g, " ").trim()
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1)
}

export function TechSpecsCard({ offers }: TechSpecsCardProps) {
  const best = pickBestSpecs(offers)
  if (!best) return null

  const entries = Object.entries(best.specs)

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Ficha técnica</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Conforme informado por {best.storeName}</p>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-border pb-2 text-sm">
            <dt className="text-muted-foreground">{formatLabel(label)}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}