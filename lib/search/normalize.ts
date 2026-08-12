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
      // Números curtos (ex: "13", "15" num modelo de iPhone) quase nunca são ruído — costumam
      // ser exatamente o que distingue duas variantes do "mesmo" produto. Só filtra palavras
      // curtas não-numéricas; números passam de qualquer tamanho.
      .filter((token) => (token.length > 2 || /^[0-9]+$/.test(token)) && !STOPWORDS.has(token)),
  );
}

/** Quantos termos com significado a busca tem — usado para decidir se ela parece genérica. */
export function countSignificantTokens(query: string): number {
  return tokenize(query).size;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function distinguishingNumbers(tokens: Set<string>): string[] {
  return [...tokens].filter((t) => /^[0-9]+$/.test(t));
}

/**
 * Verdadeiro quando os dois títulos têm números "distintivos" (tamanho/capacidade/modelo) e
 * eles não coincidem em nenhum — ex: "iPhone 13 Pro" vs "iPhone 15 Pro". Nesse caso os títulos
 * NUNCA devem ser considerados o mesmo produto, mesmo que o resto do texto seja bem parecido.
 */
function hasConflictingNumbers(a: Set<string>, b: Set<string>): boolean {
  const numsA = distinguishingNumbers(a);
  const numsB = distinguishingNumbers(b);
  if (numsA.length === 0 || numsB.length === 0) return false;
  return !numsA.some((n) => numsB.includes(n));
}

const SIMILARITY_THRESHOLD = 0.5;

/** Similaridade de título (0-1) baseada em overlap de tokens — usada para casar ofertas sem IA. */
export function titleSimilarity(a: string, b: string): number {
  return jaccardSimilarity(tokenize(a), tokenize(b));
}

/** Mesma regra usada no agrupamento heurístico (Jaccard + guarda de números) — ver comentário ali. */
function titlesMatch(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (hasConflictingNumbers(tokensA, tokensB)) return false;
  return jaccardSimilarity(tokensA, tokensB) >= SIMILARITY_THRESHOLD;
}

/**
 * Acha, entre produtos JÁ PERSISTIDOS de buscas anteriores, um cujo título bate com o do grupo
 * recém-formado. Sem isso, o mesmo produto físico encontrado em buscas diferentes (dias
 * diferentes, frase um pouco diferente) nunca convergia pro mesmo registro — cada busca só
 * comparava ofertas coletadas NAQUELA chamada, então duas lojas raramente caíam juntas no
 * mesmo produto a menos que aparecessem na mesma busca.
 */
export function findSimilarExistingProduct(
  canonicalTitle: string,
  existingProducts: { id: string; slug: string; canonicalTitle: string }[],
): { id: string; slug: string } | null {
  let best: { id: string; slug: string; score: number } | null = null;

  for (const candidate of existingProducts) {
    if (!titlesMatch(canonicalTitle, candidate.canonicalTitle)) continue;
    const score = titleSimilarity(canonicalTitle, candidate.canonicalTitle);
    if (!best || score > best.score) {
      best = { id: candidate.id, slug: candidate.slug, score };
    }
  }

  return best ? { id: best.id, slug: best.slug } : null;
}

/**
 * Fração dos tokens da busca que aparecem no título (por igualdade OU um sendo substring do
 * outro — cobre plural/singular como "fralda"/"fraldas" e fragmentos de marca como
 * "8bit" dentro de "8bitdo"). Assimétrico de propósito: o título costuma ser bem mais longo e
 * descritivo que a busca, então o que importa é "a busca está contida no título", não o quão
 * parecidos os dois textos são no geral (por isso não é a mesma métrica do `titleSimilarity`).
 */
function queryCoverage(query: string, title: string): number {
  const queryTokens = [...tokenize(query)];
  if (queryTokens.length === 0) return 1; // busca só com stopwords/tokens curtos: não há o que filtrar

  const titleTokens = [...tokenize(title)];
  const matched = queryTokens.filter((qt) =>
    titleTokens.some((tt) => tt === qt || tt.includes(qt) || qt.includes(tt)),
  ).length;
  return matched / queryTokens.length;
}

const QUERY_RELEVANCE_THRESHOLD = 0.5;

/**
 * Remove ofertas que não têm nada a ver com o que foi buscado. Os catálogos de VTEX/Mercado
 * Livre fazem busca textual "solta" (fuzzy/por token) e, quando não há match exato, frequentemente
 * devolvem itens só remotamente relacionados (ex: buscar "controle 8bit do ultimate 2" pode trazer
 * lixadeira, jogo, pista de carrinho — cada um bate com um token isolado da busca em algum lugar
 * do catálogo). O agrupamento (por IA ou heurístico) nunca filtrava isso — só agrupava ofertas
 * parecidas ENTRE SI, sem nunca comparar com a busca original. Roda antes de qualquer
 * agrupamento, então filtra igual independente de a IA estar disponível ou não.
 */
export function filterByQueryRelevance<T extends { title: string }>(query: string, offers: T[]): T[] {
  return offers.filter((offer) => queryCoverage(query, offer.title) >= QUERY_RELEVANCE_THRESHOLD);
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
      const similar =
        !hasConflictingNumbers(tokensByIndex[i], tokensByIndex[j]) &&
        jaccardSimilarity(tokensByIndex[i], tokensByIndex[j]) >= SIMILARITY_THRESHOLD;
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
