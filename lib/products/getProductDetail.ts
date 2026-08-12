import { prisma } from "@/lib/prisma";
import { totalPrice } from "@/lib/utils/money";

export interface ProductDetailOffer {
  id: string;
  storeSlug: string;
  storeName: string;
  title: string;
  price: number;
  shippingCost: number | null;
  totalPrice: number;
  availability: string;
  productUrl: string;
  imageUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  specs: Record<string, string> | null;
  updatedAt: string;
  history: { price: number; recordedAt: string }[];
}

export interface ProductDetail {
  id: string;
  slug: string;
  canonicalTitle: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  lowestPriceEver: number | null;
  offers: ProductDetailOffer[];
}

const HISTORY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Cada loja descreve o produto com um conjunto diferente de campos — em vez de misturar specs
 * de lojas distintas (risco de conflito, ex: "Cor" diferente por variante), usa só a ficha da
 * oferta com mais campos preenchidos. Compartilhado entre a UI (TechSpecsCard) e o assistente
 * de IA (productAssistant.ts), que também precisa saber quais specs destacar.
 */
export function pickBestSpecs(offers: ProductDetailOffer[]): { specs: Record<string, string>; storeName: string } | null {
  let best: { specs: Record<string, string>; storeName: string } | null = null;

  for (const offer of offers) {
    if (!offer.specs) continue;
    const count = Object.keys(offer.specs).length;
    if (count === 0) continue;
    if (!best || count > Object.keys(best.specs).length) {
      best = { specs: offer.specs, storeName: offer.storeName };
    }
  }

  return best;
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      offers: {
        where: { isActive: true },
        include: {
          store: true,
          history: {
            orderBy: { recordedAt: "asc" },
            where: { recordedAt: { gte: new Date(Date.now() - HISTORY_WINDOW_MS) } },
          },
        },
      },
    },
  });

  if (!product) return null;

  const offers = product.offers
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
      rating: offer.rating,
      reviewsCount: offer.reviewsCount,
      specs: (offer.specs as Record<string, string> | null) ?? null,
      updatedAt: offer.lastCheckedAt.toISOString(),
      history: offer.history.map((h) => ({ price: Number(h.price), recordedAt: h.recordedAt.toISOString() })),
    }))
    .sort((a, b) => a.totalPrice - b.totalPrice);

  return {
    id: product.id,
    slug: product.slug,
    canonicalTitle: product.canonicalTitle,
    brand: product.brand,
    category: product.category,
    imageUrl: product.imageUrl,
    lowestPriceEver: product.lowestPriceEver === null ? null : Number(product.lowestPriceEver),
    offers,
  };
}
