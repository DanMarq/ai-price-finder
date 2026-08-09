import { formatBRL } from "@/lib/utils/money";
import { Badge } from "@/components/ui/Badge";

const AVAILABILITY_LABEL: Record<string, { label: string; tone: "green" | "red" | "gray" }> = {
  IN_STOCK: { label: "Em estoque", tone: "green" },
  OUT_OF_STOCK: { label: "Indisponível", tone: "red" },
  UNKNOWN: { label: "A confirmar", tone: "gray" },
};

export interface ComparisonOffer {
  id: string;
  storeName: string;
  price: number;
  shippingCost: number | null;
  totalPrice: number;
  availability: string;
  productUrl: string;
}

export function PriceComparisonTable({ offers }: { offers: ComparisonOffer[] }) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma oferta ativa no momento.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-140 text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Loja</th>
            <th className="px-4 py-3 font-medium">Preço</th>
            <th className="px-4 py-3 font-medium">Frete</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Disponibilidade</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {offers.map((offer, index) => {
            const availability = AVAILABILITY_LABEL[offer.availability] ?? AVAILABILITY_LABEL.UNKNOWN;
            return (
              <tr key={offer.id} className={index === 0 ? "bg-emerald-500/5" : undefined}>
                <td className="px-4 py-3 font-medium text-foreground">{offer.storeName}</td>
                <td className="px-4 py-3 text-foreground">{formatBRL(offer.price)}</td>
                <td className="px-4 py-3 text-foreground">
                  {offer.shippingCost === null
                    ? "A calcular"
                    : offer.shippingCost === 0
                      ? "Grátis"
                      : formatBRL(offer.shippingCost)}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">{formatBRL(offer.totalPrice)}</td>
                <td className="px-4 py-3">
                  <Badge tone={availability.tone}>{availability.label}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={offer.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    Ver oferta
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
