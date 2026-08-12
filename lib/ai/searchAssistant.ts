import { GoogleGenAI, Type, type Schema } from "@google/genai"
import type { EnrichedProductResult } from "@/lib/search/orchestrator"
import { countSignificantTokens } from "@/lib/search/normalize"
import { withGeminiModelFallback, FALLBACK_GEMINI_MODEL } from "./gemini"
import { searchRefinementSchema, type SearchRefinement } from "./schemas"

const MIN_PRODUCTS_FOR_REFINEMENT = 5
const MIN_PRICE_SPREAD_RATIO = 2
const MAX_SIGNIFICANT_QUERY_TOKENS = 2

/**
 * Só vale perguntar algo quando a busca já parece genérica: poucos termos com significado E
 * muitos produtos bem diferentes de preço entre si (sinal de "categoria ampla", não "modelo
 * específico"). Isso evita repetir a crítica de sites como o Buscapé, que perguntam algo mesmo
 * quando a busca já foi específica (ex: perguntar tamanho quando o usuário já buscou "fraldas G").
 */
export function isGenericSearch(query: string, products: EnrichedProductResult[]): boolean {
  if (countSignificantTokens(query) > MAX_SIGNIFICANT_QUERY_TOKENS) return false
  if (products.length < MIN_PRODUCTS_FOR_REFINEMENT) return false

  const prices = products
    .map((p) => p.offers[0]?.totalPrice)
    .filter((price): price is number => typeof price === "number" && price > 0)
  if (prices.length < MIN_PRODUCTS_FOR_REFINEMENT) return false

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return max / min >= MIN_PRICE_SPREAD_RATIO
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    question: {
      type: Type.STRING,
      description: "Uma pergunta curta em português pra ajudar a refinar essa busca genérica",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 a 5 respostas rápidas curtas (1-3 palavras cada) pra essa pergunta",
    },
  },
  required: ["question", "options"],
}

function buildPrompt(query: string, products: EnrichedProductResult[]): string {
  const sample = products
    .slice(0, 15)
    .map((p) => `- ${p.product.canonicalTitle} — R$ ${(p.offers[0]?.totalPrice ?? 0).toFixed(2)}`)
    .join("\n")

  return `Um usuário buscou "${query}" e encontrou ${products.length} produtos bem diferentes entre si:
${sample}

Sua tarefa: olhando pro que REALMENTE varia nesses resultados (marca? tipo/categoria? faixa de
preço? alguma outra característica visível nos títulos?), escreva UMA pergunta curta pra ajudar
a pessoa a refinar a busca, com 2 a 5 opções de resposta rápida (bem curtas, 1-3 palavras cada,
ex: nomes de marca reais que aparecem na lista, ou faixas de preço reais como "até R$50").

Regras importantes:
- NUNCA pergunte sobre algo que já está claramente resolvido na busca (ex: não pergunte
  tamanho/modelo se a busca já especifica um).
- As opções devem refletir o que REALMENTE aparece nos resultados acima, não genéricas.
- Se preço for a dimensão que mais varia, pergunte sobre faixa de preço.

Responda apenas com o JSON estruturado pedido.`
}

/**
 * Card de refinamento pra buscas genéricas — nunca busca nada na web, só interpreta os
 * produtos que a própria busca já trouxe (mesmo espírito do assistente de produto: leve,
 * sob demanda, sem custar cota em toda busca já que só dispara quando `isGenericSearch` é true).
 */
export async function getSearchRefinement(
  apiKey: string,
  query: string,
  products: EnrichedProductResult[],
): Promise<SearchRefinement | null> {
  const ai = new GoogleGenAI({ apiKey })

  try {
    return await withGeminiModelFallback(
      FALLBACK_GEMINI_MODEL,
      async (model, signal) => {
        const response = await ai.models.generateContent({
          model,
          contents: buildPrompt(query, products),
          config: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, abortSignal: signal },
        })

        const text = response.text
        if (!text) throw new Error("Gemini retornou resposta vazia")
        return searchRefinementSchema.parse(JSON.parse(text))
      },
      { budgetMs: 4000 },
    )
  } catch (error) {
    console.warn(`[search_assistant] falha ao gerar refinamento para "${query}":`, error)
    return null
  }
}