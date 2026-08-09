import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types";

interface VtexCommertialOffer {
  Price: number;
  AvailableQuantity: number;
}

interface VtexSeller {
  commertialOffer: VtexCommertialOffer;
}

interface VtexItem {
  images?: Array<{ imageUrl: string }>;
  sellers: VtexSeller[];
}

interface VtexProduct {
  productId: string;
  productName: string;
  link: string;
  items: VtexItem[];
}

interface VtexSearchResponse {
  products: VtexProduct[];
}

interface VtexIntelligentSearchConfig {
  key: string;
  displayName: string;
  storeSlug: string;
  /** Ex: "https://www.pbkids.com.br" — sem barra final. */
  siteBaseUrl: string;
}

function pickBestOffer(product: VtexProduct): { item: VtexItem; seller: VtexSeller } | null {
  for (const item of product.items) {
    const availableSeller = item.sellers
      .filter((s) => s.commertialOffer && s.commertialOffer.Price > 0)
      .sort((a, b) => a.commertialOffer.Price - b.commertialOffer.Price)[0];
    if (availableSeller) return { item, seller: availableSeller };
  }
  return null;
}

/**
 * Factory para lojas VTEX que migraram para a "Intelligent Search" (VTEX IO / biggy-search) —
 * várias lojas mantêm o endpoint legado (`catalog_system/pub/products/search`) no ar mas com
 * preço zerado, e só esta API mais nova retorna o preço real. Mesmo princípio do provider VTEX
 * legado: JSON público, sem headless browser, mas com paginação (`page`, 1-based) e resposta
 * envelopada em `{ products: [...] }` em vez de array simples.
 */
export function createVtexIntelligentSearchProvider(config: VtexIntelligentSearchConfig): PriceProvider {
  return {
    key: config.key,
    displayName: config.displayName,

    async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
      const count = opts?.limit ?? 20;
      const url = `${config.siteBaseUrl}/api/io/_v/api/intelligent-search/product_search/${encodeURIComponent(query)}?query=${encodeURIComponent(query)}&page=1&count=${count}`;

      try {
        const response = await fetch(url, {
          signal: opts?.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          console.warn(`[${config.key}] HTTP ${response.status} ao buscar "${query}"`);
          return [];
        }

        const data = (await response.json()) as VtexSearchResponse;
        const fetchedAt = new Date().toISOString();

        return data.products
          .map((product): RawOffer | null => {
            const best = pickBestOffer(product);
            if (!best) return null;

            return {
              providerKey: config.key,
              storeSlug: config.storeSlug,
              storeName: config.displayName,
              title: product.productName,
              price: best.seller.commertialOffer.Price,
              shippingCost: null,
              availability: best.seller.commertialOffer.AvailableQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
              productUrl: `${config.siteBaseUrl}${product.link}`,
              imageUrl: best.item.images?.[0]?.imageUrl ?? null,
              externalId: product.productId,
              rating: null,
              reviewsCount: null,
              fetchedAt,
            };
          })
          .filter((offer): offer is RawOffer => offer !== null);
      } catch (error) {
        console.warn(`[${config.key}] falha ao buscar "${query}":`, error);
        return [];
      }
    },
  };
}
