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
 * Roda uma promise de provider com timeout próprio, sem deixar uma fonte lenta travar a busca
 * inteira. Aborta o `signal` (para quem honra) E corre uma race contra um timer que rejeita —
 * assim uma fonte que ignore o `AbortSignal` (ex: uma chamada de SDK que não recebe o signal)
 * ainda não consegue travar a busca além de `timeoutMs`.
 */
export async function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`timeout após ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([factory(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}
