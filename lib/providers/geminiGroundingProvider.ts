import { GoogleGenAI } from "@google/genai"
import { withGeminiModelFallback } from "@/lib/ai/gemini"
import { groundingResultSchema } from "@/lib/ai/schemas"
import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types"

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Provider opt-in (via AiProviderConfig.enableGroundingSearch ou GEMINI_ENABLE_GROUNDING_SEARCH):
 * usa o próprio Gemini com a ferramenta de busca do Google para achar preços na web. Complementa
 * os providers estruturados (Mercado Livre, VTEX) — nunca é a única fonte, e qualquer
 * falha/parsing inválido vira [] em vez de derrubar a busca. Tenta vários modelos da cascata
 * (ver lib/ai/gemini.ts) antes de desistir, já que cota estourada é comum nesse tipo de chamada.
 */
export function createGeminiGroundingProvider(apiKey: string, preferredModel: string): PriceProvider {
  return {
    key: "gemini_grounding",
    displayName: "Busca com IA (Gemini)",

    async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
      const ai = new GoogleGenAI({ apiKey });

      try {
        const offers = await withGeminiModelFallback(preferredModel, async (model, cascadeSignal) => {
          // Combina o abort do orquestrador (timeout do provider como um todo) com o da própria
          // cascata (timeout por tentativa de modelo) — qualquer um dos dois cancela a chamada.
          const signal = opts?.signal ? AbortSignal.any([opts.signal, cascadeSignal]) : cascadeSignal;

          const response = await ai.models.generateContent({
            model,
            contents: `Pesquise na web preços atuais para "${query}" em lojas online confiáveis do Brasil.
Responda SOMENTE com um bloco JSON no formato:
{"offers": [{"storeName": "...", "title": "...", "price": 0.00, "productUrl": "https://...", "shippingCost": null, "availability": "IN_STOCK"}]}
Inclua no máximo ${opts?.limit ?? 10} ofertas, só de lojas reais com URL de produto válida.`,
            config: {
              tools: [{ googleSearch: {} }],
              abortSignal: signal,
            },
          });

          const text = response.text;
          if (!text) throw new Error("Gemini retornou resposta vazia");

          const json = extractJson(text);
          if (!json) throw new Error("Gemini não retornou um JSON válido");

          const parsed = groundingResultSchema.safeParse(json);
          if (!parsed.success) throw new Error("JSON da IA não bateu com o schema esperado");

          return parsed.data.offers;
        });

        const fetchedAt = new Date().toISOString();
        return offers.map((offer) => ({
          providerKey: "gemini_grounding",
          storeSlug: "web",
          storeName: offer.storeName,
          title: offer.title,
          price: offer.price,
          shippingCost: offer.shippingCost ?? null,
          availability: offer.availability ?? "UNKNOWN",
          productUrl: offer.productUrl,
          imageUrl: null,
          externalId: null,
          rating: null,
          reviewsCount: null,
          fetchedAt,
        }));
      } catch (error) {
        console.warn(`[gemini_grounding] falha ao buscar "${query}":`, error)
        return [];
      }
    },
  }
}