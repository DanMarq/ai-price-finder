import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getActiveProviders } from "@/lib/providers/registry"
import { createGeminiGroundingProvider } from "@/lib/providers/geminiGroundingProvider"
import { withTimeout, type RawOffer } from "@/lib/providers/types"
import { resolveGeminiConfig } from "@/lib/ai/resolveApiKey"
import { isMercadoLivreConnected } from "@/lib/integrations/mercadoLivre"
import { enrichOffersWithGemini } from "@/lib/ai/gemini"
import type { EnrichedGroup } from "@/lib/ai/schemas"
import { filterByQueryRelevance, findSimilarExistingProduct, groupOffersHeuristically } from "./normalize"
import { getCachedSearch, setCachedSearch } from "./cache"
import { normalizeQuery, slugWithHash } from "@/lib/utils/slug"
import { totalPrice } from "@/lib/utils/money"

export interface OfferResult {
  id: string
  storeSlug: string
  storeName: string
  title: string
  price: number
  shippingCost: number | null
  totalPrice: number
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  productUrl: string
  imageUrl: string | null
  updatedAt: string
}

export interface EnrichedProductResult {
  product: {
    id: string
    slug: string
    canonicalTitle: string
    imageUrl: string | null
    lowestPriceEver: number | null
  };
  offers: OfferResult[]
}

export interface SearchProductsOptions {
  userId?: string
  bypassCache?: boolean
  enableAiEnrichment?: boolean
  limit?: number
}

export interface SearchProductsResult {
  query: string
  products: EnrichedProductResult[]
  warnings: string[]
  tookMs: number
}

async function loadProductResults(productIds: string[]): Promise<EnrichedProductResult[]> {
  if (productIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      offers: {
        where: { isActive: true },
        include: { store: true },
      },
    },
  })

  const byId = new Map(products.map((p) => [p.id, p]))

  return productIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    // Um produto sem nenhuma oferta ativa não é um resultado de busca válido — só existe assim
    // quando a gravação das ofertas falhou em algum momento (ver histórico de dados anterior a
    // esta correção). Não faz sentido mostrar "nenhuma oferta ativa" num card de resultado.
    .filter((product) => product.offers.length > 0)
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
        .sort((a, b) => a.totalPrice - b.totalPrice)

      return {
        product: {
          id: product.id,
          slug: product.slug,
          canonicalTitle: product.canonicalTitle,
          imageUrl: product.imageUrl,
          lowestPriceEver: product.lowestPriceEver === null ? null : Number(product.lowestPriceEver),
        },
        offers,
      }
    })
}

export async function upsertOfferAndHistory(productId: string, storeId: string, offer: RawOffer) {
  const existing = await prisma.productOffer.findFirst({
    where: offer.externalId
      ? { storeId, externalId: offer.externalId }
      : { productId, storeId, title: offer.title },
  })

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
    specs: offer.specs ?? Prisma.JsonNull,
    isActive: true,
    lastCheckedAt: new Date(),
  };

  const productOffer = existing
    ? await prisma.productOffer.update({ where: { id: existing.id }, data })
    : await prisma.productOffer.create({ data: { ...data, productId, storeId } })

  const lastHistory = await prisma.priceHistory.findFirst({
    where: { productOfferId: productOffer.id },
    orderBy: { recordedAt: "desc" },
  });
  const priceChanged = !lastHistory || Number(lastHistory.price) !== offer.price

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

  return productOffer
}

async function persistGroups(offers: RawOffer[], groups: EnrichedGroup[]): Promise<string[]> {
  // Cacheia a PROMISE (não o valor resolvido) — assim, se dois grupos concorrentes referenciam a
  // mesma loja antes do primeiro upsert terminar, ambos reusam a mesma chamada em vez de disparar
  // upserts redundantes para a mesma linha.
  const storeCache = new Map<string, ReturnType<typeof prisma.store.upsert>>()

  function getOrCreateStore(offer: RawOffer) {
    const cached = storeCache.get(offer.storeSlug)
    if (cached) return cached;

    const promise = prisma.store.upsert({
      where: { slug: offer.storeSlug },
      create: {
        slug: offer.storeSlug,
        name: offer.storeName,
        providerKey: offer.providerKey,
        websiteUrl: safeOrigin(offer.productUrl),
        isActive: true,
      },
      update: {},
    })
    storeCache.set(offer.storeSlug, promise)
    return promise
  }

  // Produtos já persistidos de buscas anteriores — usado pra tentar casar o grupo recém-formado
  // com um produto existente (mesmo item físico, frase de título diferente) em vez de criar um
  // registro novo só porque esta busca gerou um canonicalTitle levemente diferente do de uma
  // busca passada. Sem isso, o mesmo produto achado em lojas diferentes em dias diferentes
  // nunca convergia — cada busca só comparava ofertas coletadas NELA MESMA. ~500-1000 produtos
  // hoje: cabe inteiro em memória sem precisar de índice de texto no Postgres.
  const existingProducts = await prisma.product.findMany({
    select: { id: true, slug: true, canonicalTitle: true },
  });

  // Grupos são persistidos em paralelo (não um `for...of` sequencial) — com dezenas de grupos
  // por busca, gravar um de cada vez multiplicava a latência de rede até o Postgres (Supabase)
  // pelo número de grupos, virando o maior gargalo da busca depois que a cascata do Gemini
  // ganhou um teto de tempo. O pool de conexões (ver lib/prisma.ts) limita a concorrência real.
  const productIds = await Promise.all(
    groups.map(async (group): Promise<string | null> => {
      if (group.matchedOfferIndexes.length === 0) return null

      const matchedOffers = group.matchedOfferIndexes
        .map((i) => offers[i])
        .filter((o): o is RawOffer => Boolean(o));
      if (matchedOffers.length === 0) return null;

      const cheapestPrice = Math.min(...matchedOffers.map((o) => o.price))
      const similarExisting = findSimilarExistingProduct(group.canonicalTitle, existingProducts);

      const product = similarExisting
        ? await prisma.product.update({
            where: { id: similarExisting.id },
            data: {
              canonicalTitle: group.canonicalTitle,
              brand: group.brand ?? undefined,
              category: group.category ?? undefined,
            },
          })
        : await prisma.product.upsert({
            where: { slug: slugWithHash(group.canonicalTitle) },
            create: {
              slug: slugWithHash(group.canonicalTitle),
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
          })

      if (product.lowestPriceEver === null || cheapestPrice < Number(product.lowestPriceEver)) {
        await prisma.product.update({
          where: { id: product.id },
          data: { lowestPriceEver: cheapestPrice },
        })
      }

      await Promise.all(
        matchedOffers.map(async (offer) => {
          const store = await getOrCreateStore(offer);
          await upsertOfferAndHistory(product.id, store.id, offer);
        }),
      );

      return product.id;
    }),
  );

  return productIds.filter((id): id is string => Boolean(id));
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

  const [geminiConfig, providers, mercadoLivreConnected] = await Promise.all([
    resolveGeminiConfig(opts.userId),
    getActiveProviders(),
    isMercadoLivreConnected(),
  ]);

  // Sem isso, um Mercado Livre desconectado só aparecia como um warn no log do servidor — o
  // usuário via a fonte simplesmente desaparecer dos resultados, sem entender por quê.
  if (!mercadoLivreConnected && providers.some((provider) => provider.key === "mercado_livre")) {
    warnings.push(
      "Mercado Livre não conectado — reconecte em /api/integrations/mercado-livre/authorize.",
    );
  }

  if (geminiConfig?.enableGroundingSearch) {
    providers.push(createGeminiGroundingProvider(geminiConfig.apiKey, geminiConfig.model))
  }

  const settled = await Promise.allSettled(
    providers.map((provider) =>
      withTimeout((signal) => provider.search(normalizedQuery, { signal, limit: opts.limit ?? 20 })),
    ),
  );

  const rawOffers: RawOffer[] = [];
  settled.forEach((result, index) => {
    const provider = providers[index]
    if (result.status === "fulfilled") {
      rawOffers.push(...result.value)
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : "falha desconhecida"
      warnings.push(`${provider.displayName}: ${reason}`);
    }
  })

  if (rawOffers.length === 0) {
    warnings.push("Nenhuma fonte retornou resultados para essa busca.");
    return { query: normalizedQuery, products: [], warnings, tookMs: Date.now() - start }
  }

  // Catálogos VTEX/Mercado Livre fazem busca textual "solta" e frequentemente devolvem itens só
  // remotamente relacionados quando não há match exato (cada um batendo com um token isolado da
  // busca). O agrupamento (por IA ou heurístico) só junta ofertas parecidas ENTRE SI — nunca
  // comparava com a busca original. Filtra aqui, antes de qualquer agrupamento, pra valer
  // independente de a IA estar disponível ou não, e reduz o que é enviado pra IA também.
  const relevantOffers = filterByQueryRelevance(normalizedQuery, rawOffers);
  if (relevantOffers.length === 0) {
    warnings.push("Nenhum resultado relevante encontrado para essa busca.");
    return { query: normalizedQuery, products: [], warnings, tookMs: Date.now() - start };
  }

  const enableAi = opts.enableAiEnrichment !== false
  let groups: EnrichedGroup[]

  if (enableAi && geminiConfig) {
    // enrichOffersWithGemini já tenta vários modelos internamente (ver lib/ai/gemini.ts) —
    // só cai pro agrupamento heurístico se a cascata inteira falhar.
    try {
      const aiGroups = await enrichOffersWithGemini(geminiConfig.apiKey, geminiConfig.model, {
        query: normalizedQuery,
        offers: relevantOffers,
      });
      if (aiGroups.length === 0) throw new Error("IA não retornou grupos");
      groups = aiGroups;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "erro desconhecido";
      warnings.push(`Enriquecimento com IA indisponível, usando agrupamento sem IA: ${reason}`);
      groups = groupOffersHeuristically(relevantOffers);
    }
  } else {
    groups = groupOffersHeuristically(relevantOffers);
  }

  const productIds = await persistGroups(relevantOffers, groups)
  await setCachedSearch(normalizedQuery, productIds)

  const products = await loadProductResults(productIds)
  products.sort((a, b) => {
    const cheapestA = a.offers[0]?.totalPrice ?? Infinity
    const cheapestB = b.offers[0]?.totalPrice ?? Infinity
    return cheapestA - cheapestB;
  })

  return { query: normalizedQuery, products, warnings, tookMs: Date.now() - start }
}