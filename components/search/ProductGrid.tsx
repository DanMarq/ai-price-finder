import type { EnrichedProductResult } from "@/lib/search/orchestrator";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: EnrichedProductResult[] }) {
  if (products.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((result) => (
        <ProductCard key={result.product.id} {...result} />
      ))}
    </div>
  );
}
