import { GoogleGenAI, Type, type Schema } from "@google/genai"
import { prisma } from "@/lib/prisma"
import { pickBestSpecs, type ProductDetail } from "@/lib/products/getProductDetail"
import { withGeminiModelFallback, FALLBACK_GEMINI_MODEL } from "./gemini"
import { productInsightSchema, type ProductInsight } from "./schemas"

/** Depois desse tempo, gera uma dica nova em vez de reusar a do cache. */
const INSIGHT_TTL_MS = 12 * 60 * 60 * 1000

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tip: {
      type: Type.STRING,
      description: "Dica curta (1-2 frases, em português) para quem está avaliando comprar este produto agora",
    },
    priceAssessment: {
      type: Type.STRING,
      enum: ["GOOD_DEAL", "TYPICAL", "ABOVE_AVERAGE", "INSUFFICIENT_DATA"],
      description: "Como o preço mais barato atual se compara ao histórico desse produto",
    },
    specHighlight: {
      type: Type.STRING,
      nullable: true,
      description:
        "1-2 frases destacando as specs da ficha técnica mais relevantes pra quem buscou esse produto. Null se não houver ficha técnica.",
    },
  },
  required: ["tip", "priceAssessment"],
}

function buildPrompt(input: {
  title: string
  cheapestPrice: number
  storesCount: number
  lowestPriceEver: number | null
  historyMin: number | null
  historyMax: number | null
  specs: Record<string, string> | null
}): string {
  const historyLine =
    input.historyMin !== null && input.historyMax !== null
      ? `Histórico de preço (últimos 90 dias): entre R$ ${input.historyMin.toFixed(2)} e R$ ${input.historyMax.toFixed(2)}.`
      : "Sem histórico de preço suficiente ainda."

  const specsLine = input.specs
    ? `Ficha técnica:\n${Object.entries(input.specs)
        .map(([label, value]) => `- ${label}: ${value}`)
        .join("\n")}`
    : "Sem ficha técnica coletada."

  return `Produto: "${input.title}".
Preço mais barato agora: R$ ${input.cheapestPrice.toFixed(2)}, em ${input.storesCount} loja(s) monitorada(s).
Menor preço já visto: ${input.lowestPriceEver !== null ? `R$ ${input.lowestPriceEver.toFixed(2)}` : "sem registro"}.
${historyLine}

${specsLine}

Você é um assistente de compras. Em português, escreva:
1. Uma dica curta e prática (1-2 frases) para quem está decidindo comprar agora — ex: sobre o
   momento do preço, ou algo útil a checar antes de comprar (frete, disponibilidade). Não invente
   dados que não foram passados aqui.
2. Uma avaliação de preço: GOOD_DEAL (preço bom vs. histórico), TYPICAL (dentro do normal),
   ABOVE_AVERAGE (mais caro que o normal), ou INSUFFICIENT_DATA (se não houver histórico
   suficiente para avaliar).
3. Se houver ficha técnica: 1-2 frases (specHighlight) destacando o que mais importa nela pra
   quem busca "${input.title}" (ex: compatibilidade, dimensões, o que vem incluso). Se não
   houver ficha técnica, responda null nesse campo — não invente specs.

Responda apenas com o JSON estruturado pedido.`
}

/**
 * Gera (ou reusa do cache) uma dica curta + validação de preço para UM produto já carregado —
 * nunca busca nada na web, só interpreta os dados que a própria busca já coletou. É o
 * substituto leve do antigo "gemini_grounding" ligado em toda busca: uma chamada pequena,
 * sob demanda, na página do produto, em vez de custar cota da API a cada busca de catálogo.
 */
export async function getProductInsight(
  apiKey: string,
  product: ProductDetail,
): Promise<ProductInsight | null> {
  const cached = await prisma.productInsight.findUnique({ where: { productId: product.id } })
  if (cached && Date.now() - cached.generatedAt.getTime() < INSIGHT_TTL_MS) {
    return { tip: cached.tip, priceAssessment: cached.priceAssessment, specHighlight: cached.specHighlight }
  }

  if (product.offers.length === 0) return cachedToInsight(cached)

  const ai = new GoogleGenAI({ apiKey })
  const cheapestPrice = product.offers[0].totalPrice
  const historyPrices = product.offers.flatMap((offer) => offer.history.map((h) => h.price))
  const specs = pickBestSpecs(product.offers)?.specs ?? null

  try {
    const result = await withGeminiModelFallback(
      FALLBACK_GEMINI_MODEL, // tarefa simples e pequena — o modelo lite já basta, mais rápido e barato
      async (model, signal) => {
        const response = await ai.models.generateContent({
          model,
          contents: buildPrompt({
            title: product.canonicalTitle,
            cheapestPrice,
            storesCount: product.offers.length,
            lowestPriceEver: product.lowestPriceEver,
            historyMin: historyPrices.length ? Math.min(...historyPrices) : null,
            historyMax: historyPrices.length ? Math.max(...historyPrices) : null,
            specs,
          }),
          config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, abortSignal: signal },
        })

        const text = response.text
        if (!text) throw new Error("Gemini retornou resposta vazia")
        return productInsightSchema.parse(JSON.parse(text))
      },
      { budgetMs: 4000 },
    )

    await prisma.productInsight.upsert({
      where: { productId: product.id },
      create: { productId: product.id, ...result },
      update: { ...result, generatedAt: new Date() },
    })

    return result
  } catch (error) {
    console.warn(`[product_assistant] falha ao gerar dica para "${product.canonicalTitle}":`, error)
    // Prefere uma dica antiga (ainda que fora do TTL) a não mostrar nada, já que uma falha
    // pontual (cota, instabilidade) não invalida uma dica gerada horas atrás.
    return cachedToInsight(cached)
  }
}

function cachedToInsight(cached: { tip: string; priceAssessment: ProductInsight["priceAssessment"]; specHighlight: string | null } | null): ProductInsight | null {
  return cached ? { tip: cached.tip, priceAssessment: cached.priceAssessment, specHighlight: cached.specHighlight } : null
}