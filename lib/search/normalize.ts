import type { RawOffer } from "@/lib/providers/types";
import type { EnrichedGroup } from "@/lib/ai/schemas";
import { normalizeQuery } from "@/lib/utils/slug";

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "com",
  "para",
  "e",
  "a",
  "o",
  "em",
  "un",
  "un.",
  "unidade",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    normalizeQuery(title)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.5;

/** Similaridade de título (0-1) baseada em overlap de tokens — usada para casar ofertas sem IA. */
export function titleSimilarity(a: string, b: string): number {
  return jaccardSimilarity(tokenize(a), tokenize(b));
}

/**
 * Fallback sem IA e sem rede: agrupa ofertas por similaridade de título (Jaccard sobre tokens)
 * ou mesmo `externalId`. Usado sempre que o enriquecimento com Gemini falha/está indisponível —
 * garante que a busca nunca dependa só da IA.
 */
export function groupOffersHeuristically(offers: RawOffer[]): EnrichedGroup[] {
  const tokensByIndex = offers.map((offer) => tokenize(offer.title));
  const assigned = new Array(offers.length).fill(false);
  const clusters: number[][] = [];

  for (let i = 0; i < offers.length; i++) {
    if (assigned[i]) continue;
    const cluster = [i];
    assigned[i] = true;

    for (let j = i + 1; j < offers.length; j++) {
      if (assigned[j]) continue;
      const sameExternalId =
        offers[i].externalId && offers[i].externalId === offers[j].externalId;
      const similar = jaccardSimilarity(tokensByIndex[i], tokensByIndex[j]) >= SIMILARITY_THRESHOLD;
      if (sameExternalId || similar) {
        cluster.push(j);
        assigned[j] = true;
      }
    }

    clusters.push(cluster);
  }

  return clusters.map((offerIndexes) => {
    const titles = offerIndexes.map((idx) => offers[idx].title);
    const canonicalTitle = titles.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest,
    );

    return {
      canonicalTitle,
      brand: null,
      category: null,
      matchedOfferIndexes: offerIndexes,
      rankScore: Math.min(100, offerIndexes.length * 25),
    };
  });
}
