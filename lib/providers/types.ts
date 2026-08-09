export type AvailabilityRaw = "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";

export interface RawOffer {
  providerKey: string;
  storeSlug: string;
  storeName: string;
  title: string;
  price: number;
  shippingCost: number | null;
  availability: AvailabilityRaw;
  productUrl: string;
  imageUrl?: string | null;
  externalId?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  fetchedAt: string;
}

export interface ProviderSearchOptions {
  limit?: number;
  signal?: AbortSignal;
}

export interface PriceProvider {
  readonly key: string;
  readonly displayName: string;
  search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]>;
  /** Usado pelo fluxo "monitorar por URL". Opcional — nem todo provider sabe resolver uma URL específica. */
  fetchByUrl?(url: string, opts?: ProviderSearchOptions): Promise<RawOffer | null>;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Roda uma promise de provider com timeout próprio, sem deixar uma fonte lenta travar a busca inteira.
 * Nunca rejeita por timeout "estourado sem tratamento" — quem chama decide o que fazer com o erro.
 */
export async function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await factory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
