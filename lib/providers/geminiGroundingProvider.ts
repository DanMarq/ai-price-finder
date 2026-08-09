import { GoogleGenAI } from "@google/genai";
import { groundingResultSchema } from "@/lib/ai/schemas";
import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types";

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
 * Provider opt-in (via AiProviderConfig.enableGroundingSearch): usa o próprio Gemini com a
 * ferramenta de busca do Google para achar preços na web. Complementa os providers estruturados
 * (Mercado Livre, VTEX) — nunca é a única fonte, e qualquer falha/parsing inválido vira [] em vez
 * de derrubar a busca. Consome cota extra da API Gemini, por isso é desligado por padrão.
 */
export function createGeminiGroundingProvider(apiKey: string, model: string): PriceProvider {
  return {
    key: "gemini_grounding",
    displayName: "Busca com IA (Gemini)",

    async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents: `Pesquise na web preços atuais para "${query}" em lojas online confiáveis do Brasil.
Responda SOMENTE com um bloco JSON no formato:
{"offers": [{"storeName": "...", "title": "...", "price": 0.00, "productUrl": "https://...", "shippingCost": null, "availability": "IN_STOCK"}]}
Inclua no máximo ${opts?.limit ?? 10} ofertas, só de lojas reais com URL de produto válida.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        const text = response.text;
        if (!text) return [];

        const json = extractJson(text);
        if (!json) return [];

        const parsed = groundingResultSchema.safeParse(json);
        if (!parsed.success) return [];

        const fetchedAt = new Date().toISOString();
        return parsed.data.offers.map((offer) => ({
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
        console.warn(`[gemini_grounding] falha ao buscar "${query}":`, error);
        return [];
      }
    },
  };
}
