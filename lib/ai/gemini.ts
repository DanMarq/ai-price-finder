import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { RawOffer } from "@/lib/providers/types";
import { enrichmentResultSchema, type EnrichedGroup } from "./schemas";

// Usamos os aliases "-latest" do Google AI Studio em vez de fixar uma versão (ex: "gemini-2.5-flash")
// porque versões específicas vão sendo desativadas para novas chaves com o tempo; o alias sempre
// aponta para o modelo flash atual recomendado, evitando quebrar quando isso acontecer de novo.
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
export const FALLBACK_GEMINI_MODEL = "gemini-flash-lite-latest";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          canonicalTitle: {
            type: Type.STRING,
            description: "Título normalizado e limpo do produto, sem nome da loja",
          },
          brand: { type: Type.STRING, nullable: true },
          category: { type: Type.STRING, nullable: true },
          matchedOfferIndexes: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Índices (do array de ofertas recebido) que são exatamente este produto",
          },
          rankScore: {
            type: Type.NUMBER,
            description: "0 a 100, quão relevante/confiável é este grupo para a busca do usuário",
          },
        },
        required: ["canonicalTitle", "matchedOfferIndexes", "rankScore"],
      },
    },
  },
  required: ["groups"],
};

function buildPrompt(query: string, offers: RawOffer[]): string {
  const offersList = offers
    .map(
      (offer, index) =>
        `${index}: "${offer.title}" — R$ ${offer.price.toFixed(2)} em ${offer.storeName}`,
    )
    .join("\n");

  return `Um usuário buscou por: "${query}".

Abaixo estão ofertas brutas coletadas de várias lojas para essa busca. Sua tarefa:
1. Agrupar ofertas que são exatamente o mesmo produto (mesma variante: mesma capacidade, cor, modelo).
2. NÃO agrupar produtos diferentes/parecidos (ex: modelos diferentes, capacidades diferentes) mesmo que o título seja parecido.
3. Ignorar completamente ofertas irrelevantes que não correspondem ao que foi buscado (acessórios quando o usuário buscou o produto principal, produtos de categoria totalmente diferente, etc) — não as inclua em nenhum grupo.
4. Para cada grupo, gerar um "canonicalTitle" limpo (sem nome de loja, sem excesso de palavras-chave de SEO).
5. Atribuir um rankScore (0-100) de relevância/confiança do grupo para a busca.

Ofertas (índice: título — preço em loja):
${offersList}

Responda apenas com o JSON estruturado pedido.`;
}

export async function enrichOffersWithGemini(
  apiKey: string,
  model: string,
  input: { query: string; offers: RawOffer[] },
): Promise<EnrichedGroup[]> {
  if (input.offers.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: buildPrompt(input.query, input.offers),
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini retornou resposta vazia");

  const parsed = enrichmentResultSchema.parse(JSON.parse(text));

  const maxIndex = input.offers.length - 1;
  return parsed.groups.map((group) => ({
    ...group,
    matchedOfferIndexes: group.matchedOfferIndexes.filter((i) => i >= 0 && i <= maxIndex),
  }));
}

/** Chamada mínima para validar uma chave Gemini antes de salvá-la. */
export async function testGeminiApiKey(apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: "Responda apenas com: ok",
    });
    return Boolean(response.text);
  } catch {
    return false;
  }
}
