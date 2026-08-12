import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types";

interface VtexCommertialOffer {
  Price: number;
  AvailableQuantity: number;
}

interface VtexSeller {
  sellerId: string;
  commertialOffer: VtexCommertialOffer;
}

interface VtexItem {
  itemId: string;
  images?: Array<{ imageUrl: string }>;
  sellers: VtexSeller[];
}

interface VtexProduct {
  productId: string;
  productName: string;
  brand?: string;
  linkText: string;
  items: VtexItem[];
  // Lista os NOMES dos campos de ficha técnica — cada nome também existe como chave solta no
  // próprio objeto (ex: `allSpecifications: ["Voltagem"]` e `product.Voltagem: ["220V"]`).
  allSpecifications?: string[];
  [key: string]: unknown;
}

/** Lê a ficha técnica a partir de `allSpecifications` — cada nome listado é uma chave solta no produto. */
function extractSpecs(product: VtexProduct): Record<string, string> | null {
  if (!product.allSpecifications?.length) return null;

  const specs: Record<string, string> = {};
  for (const name of product.allSpecifications) {
    const value = product[name];
    if (Array.isArray(value) && value.length > 0) {
      const joined = value.filter((v) => typeof v === "string" && v.trim()).join(", ");
      if (joined) specs[name] = joined;
    }
  }
  return Object.keys(specs).length > 0 ? specs : null;
}

interface VtexProviderConfig {
  key: string;
  displayName: string;
  storeSlug: string;
  /**
   * Domínio que expõe o endpoint de busca do catálogo VTEX (`/api/catalog_system/...`).
   * Lojas que migraram o storefront para um frontend headless (ex: VTEX FastStore) muitas vezes
   * não proxeiam mais essa rota legada pelo domínio bonito — nesse caso use o domínio interno
   * `{account}.vtexcommercestable.com.br` aqui e o domínio bonito em `siteBaseUrl`.
   */
  apiBaseUrl: string;
  /** Domínio usado para montar o link público do produto (pode ser igual a apiBaseUrl). */
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
 * Factory para qualquer loja que rode na plataforma VTEX (comum entre varejistas brasileiros).
 * Usa o endpoint JSON público e não-autenticado de busca de catálogo — mais robusto que
 * scraping de HTML porque é dados estruturados, e ainda conta como "busca leve" (sem headless browser).
 */
export function createVtexProvider(config: VtexProviderConfig): PriceProvider {
  return {
    key: config.key,
    displayName: config.displayName,

    async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
      const url = `${config.apiBaseUrl}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}?_from=0&_to=${(opts?.limit ?? 20) - 1}`;

      try {
        const response = await fetch(url, {
          signal: opts?.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });

        // A API do catalog_system do VTEX responde 206 (Partial Content) em buscas paginadas — é sucesso, não erro.
        if (!response.ok && response.status !== 206) {
          console.warn(`[${config.key}] HTTP ${response.status} ao buscar "${query}"`);
          return [];
        }

        const products = (await response.json()) as VtexProduct[];
        const fetchedAt = new Date().toISOString();

        return products
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
              productUrl: `${config.siteBaseUrl}/${product.linkText}/p`,
              imageUrl: best.item.images?.[0]?.imageUrl ?? null,
              externalId: product.productId,
              rating: null,
              reviewsCount: null,
              specs: extractSpecs(product),
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
