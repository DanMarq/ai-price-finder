import { prisma } from "@/lib/prisma";
import { getActiveProviders } from "@/lib/providers/registry";
import { createGeminiGroundingProvider } from "@/lib/providers/geminiGroundingProvider";
import { withTimeout, type PriceProvider, type RawOffer } from "@/lib/providers/types";
import { resolveGeminiConfig } from "@/lib/ai/resolveApiKey";
import { enrichOffersWithGemini } from "@/lib/ai/gemini";
import type { EnrichedGroup } from "@/lib/ai/schemas";
import { groupOffersHeuristically } from "./normalize";
import { getCachedSearch, setCachedSearch } from "./cache";
import { normalizeQuery, slugWithHash } from "@/lib/utils/slug";
import { totalPrice } from "@/lib/utils/money";

export interface OfferResult {
  id: string;
  storeSlug: string;
  storeName: string;
  title: string;
  price: number;
  shippingCost: number | null;
  totalPrice: number;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  productUrl: string;
  imageUrl: string | null;
  updatedAt: string;
}

export interface EnrichedProductResult {
  product: {
    id: string;
    slug: string;
    canonicalTitle: string;
    imageUrl: string | null;
    lowestPriceEver: number | null;
  };
  offers: OfferResult[];
}

export interface SearchProductsOptions {
  userId?: string;
  bypassCache?: boolean;
  enableAiEnrichment?: boolean;
  limit?: number;
}

export interface SearchProductsResult {
  query: string;
  products: EnrichedProductResult[];
  warnings: string[];
  tookMs: number;
}

async function loadProductResults(productIds: string[]): Promise<EnrichedProductResult[]> {
  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      offers: {
        where: { isActive: true },
        include: { store: true },
      },
    },
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  return productIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((product) => {
      const offers: OfferResult[] = product.offers
        .map((offer) => ({
          id: offer.id,
          storeSlug: offer.store.slug,
          storeName: offer.store.name,
          title: offer.title,
          price: Number(offer.price),
          shippingCost: offer.shippingCost === null ? null : Number(offer.shippingCost),
          totalPrice: totalPrice(offer.price.toString(), offer.shippingCost?.toString() ?? null),
          availability: offer.availability,
          productUrl: offer.productUrl,
          imageUrl: offer.imageUrl,
          updatedAt: offer.lastCheckedAt.toISOString(),
        }))
        .sort((a, b) => a.totalPrice - b.totalPrice);

      return {
        product: {
          id: product.id,
          slug: product.slug,
          canonicalTitle: product.canonicalTitle,
          imageUrl: product.imageUrl,
          lowestPriceEver: product.lowestPriceEver === null ? null : Number(product.lowestPriceEver),
        },
        offers,
      };
    });
}

export async function upsertOfferAndHistory(productId: string, storeId: string, offer: RawOffer) {
  const existing = await prisma.productOffer.findFirst({
    where: offer.externalId
      ? { storeId, externalId: offer.externalId }
      : { productId, storeId, title: offer.title },
  });

  const data = {
    title: offer.title,
    price: offer.price,
    shippingCost: offer.shippingCost,
    availability: offer.availability,
    productUrl: offer.productUrl,
    imageUrl: offer.imageUrl ?? null,
    externalId: offer.externalId ?? null,
    rating: offer.rating ?? null,
    reviewsCount: offer.reviewsCount ?? null,
    isActive: true,
    lastCheckedAt: new Date(),
  };

  const productOffer = existing
    ? await prisma.productOffer.update({ where: { id: existing.id }, data })
    : await prisma.productOffer.create({ data: { ...data, productId, storeId } });

  const lastHistory = await prisma.priceHistory.findFirst({
    where: { productOfferId: productOffer.id },
    orderBy: { recordedAt: "desc" },
  });
  const priceChanged = !lastHistory || Number(lastHistory.price) !== offer.price;

  if (priceChanged) {
    await prisma.priceHistory.create({
      data: {
        productOfferId: productOffer.id,
        price: offer.price,
        shippingCost: offer.shippingCost,
        availability: offer.availability,
      },
    });
  }

  return productOffer;
}

async function persistGroups(offers: RawOffer[], groups: EnrichedGroup[]): Promise<string[]> {
  const productIds: string[] = [];
  const storeCache = new Map<string, Awaited<ReturnType<typeof prisma.store.upsert>>>();

  async function getOrCreateStore(offer: RawOffer) {
    const cached = storeCache.get(offer.storeSlug);
    if (cached) return cached;

    const store = await prisma.store.upsert({
      where: { slug: offer.storeSlug },
      create: {
        slug: offer.storeSlug,
        name: offer.storeName,
        providerKey: offer.providerKey,
        websiteUrl: safeOrigin(offer.productUrl),
        isActive: true,
      },
      update: {},
    });
    storeCache.set(offer.storeSlug, store);
    return store;
  }

  for (const group of groups) {
    if (group.matchedOfferIndexes.length === 0) continue;

    const matchedOffers = group.matchedOfferIndexes
      .map((i) => offers[i])
      .filter((o): o is RawOffer => Boolean(o));
    if (matchedOffers.length === 0) continue;

    const slug = slugWithHash(group.canonicalTitle);
    const cheapestPrice = Math.min(...matchedOffers.map((o) => o.price));

    const product = await prisma.product.upsert({
      where: { slug },
      create: {
        slug,
        canonicalTitle: group.canonicalTitle,
        brand: group.brand,
        category: group.category,
        imageUrl: matchedOffers.find((o) => o.imageUrl)?.imageUrl ?? null,
        lowestPriceEver: cheapestPrice,
      },
      update: {
        canonicalTitle: group.canonicalTitle,
        brand: group.brand ?? undefined,
        category: group.category ?? undefined,
      },
    });

    if (product.lowestPriceEver === null || cheapestPrice < Number(product.lowestPriceEver)) {
      await prisma.product.update({
        where: { id: product.id },
        data: { lowestPriceEver: cheapestPrice },
      });
    }

    await Promise.all(
      matchedOffers.map(async (offer) => {
        const store = await getOrCreateStore(offer);
        await upsertOfferAndHistory(product.id, store.id, offer);
      }),
    );

    productIds.push(product.id);
  }

  return productIds;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

async function logSearch(userId: string | undefined, query: string, resultsCount: number) {
  try {
    await prisma.searchLog.create({ data: { userId: userId ?? null, query, resultsCount } });
  } catch (error) {
    console.warn("[search] falha ao registrar log de busca:", error);
  }
}

export async function searchProducts(
  query: string,
  opts: SearchProductsOptions = {},
): Promise<SearchProductsResult> {
  const start = Date.now();
  const warnings: string[] = [];
  const normalizedQuery = normalizeQuery(query);
  const result = await runSearch(normalizedQuery, warnings, start, opts);
  await logSearch(opts.userId, normalizedQuery, result.products.length);
  return result;
}

async function runSearch(
  normalizedQuery: string,
  warnings: string[],
  start: number,
  opts: SearchProductsOptions,
): Promise<SearchProductsResult> {
  if (!opts.bypassCache) {
    const cachedIds = await getCachedSearch(normalizedQuery);
    if (cachedIds) {
      const products = await loadProductResults(cachedIds);
      return { query: normalizedQuery, products, warnings, tookMs: Date.now() - start };
    }
  }

  const geminiConfig = await resolveGeminiConfig(opts.userId);

  const providers: PriceProvider[] = await getActiveProviders();
  if (geminiConfig?.enableGroundingSearch) {
    providers.push(createGeminiGroundingProvider(geminiConfig.apiKey, geminiConfig.model));
  }

  const settled = await Promise.allSettled(
    providers.map((provider) =>
      withTimeout((signal) => provider.search(normalizedQuery, { signal, limit: opts.limit ?? 20 })),
    ),
  );

  const rawOffers: RawOffer[] = [];
  settled.forEach((result, index) => {
    const provider = providers[index];
    if (result.status === "fulfilled") {
      rawOffers.push(...result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : "falha desconhecida";
      warnings.push(`${provider.displayName}: ${reason}`);
    }
  });

  if (rawOffers.length === 0) {
    warnings.push("Nenhuma fonte retornou resultados para essa busca.");
    return { query: normalizedQuery, products: [], warnings, tookMs: Date.now() - start };
  }

  const enableAi = opts.enableAiEnrichment !== false;
  let groups: EnrichedGroup[];

  if (enableAi && geminiConfig) {
    // enrichOffersWithGemini já tenta vários modelos internamente (ver lib/ai/gemini.ts) —
    // só cai pro agrupamento heurístico se a cascata inteira falhar.
    try {
      const aiGroups = await enrichOffersWithGemini(geminiConfig.apiKey, geminiConfig.model, {
        query: normalizedQuery,
        offers: rawOffers,
      });
      if (aiGroups.length === 0) throw new Error("IA não retornou grupos");
      groups = aiGroups;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "erro desconhecido";
      warnings.push(`Enriquecimento com IA indisponível, usando agrupamento sem IA: ${reason}`);
      groups = groupOffersHeuristically(rawOffers);
    }
  } else {
    groups = groupOffersHeuristically(rawOffers);
  }

  const productIds = await persistGroups(rawOffers, groups);
  await setCachedSearch(normalizedQuery, productIds);

  const products = await loadProductResults(productIds);
  products.sort((a, b) => {
    const cheapestA = a.offers[0]?.totalPrice ?? Infinity;
    const cheapestB = b.offers[0]?.totalPrice ?? Infinity;
    return cheapestA - cheapestB;
  });

  return { query: normalizedQuery, products, warnings, tookMs: Date.now() - start };
}
