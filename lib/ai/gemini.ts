import { GoogleGenAI, ApiError, Type, type Schema } from "@google/genai";
import type { RawOffer } from "@/lib/providers/types";
import { enrichmentResultSchema, type EnrichedGroup } from "./schemas";

/**
 * Cascata de modelos de texto do Gemini (Google AI Studio), do mais capaz/atual para o mais
 * simples. Quando um modelo esgota cota (429), fica indisponível para novas chaves (404) ou
 * tem uma instabilidade pontual (503), tentamos o próximo automaticamente — ver
 * `withGeminiModelFallback`. Contas diferentes têm acesso a modelos diferentes (contas mais
 * antigas ainda enxergam a família 2.x, por exemplo), por isso a lista cobre várias gerações
 * em vez de travar numa só. Ajuste esta lista conforme o Google lança/aposenta modelos.
 */
export const GEMINI_MODEL_CASCADE = [
  "gemini-flash-latest", // alias sempre atualizado para o flash recomendado no momento
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.6-flash",
  "gemini-2.5-flash", // contas mais antigas ainda têm acesso
  "gemini-flash-lite-latest", // alias sempre atualizado para o flash-lite recomendado
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite", // contas mais antigas ainda têm acesso
  "gemini-2.0-flash-001",
] as const;

export const DEFAULT_GEMINI_MODEL: string = GEMINI_MODEL_CASCADE[0];
// Mantido para quem já salvou esse valor como `model` em AiProviderConfig antes desta mudança.
export const FALLBACK_GEMINI_MODEL = "gemini-flash-lite-latest";

/** Erros de chave (inválida/sem permissão) não melhoram trocando de modelo — falham na hora. */
function isKeyLevelError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403);
}

function modelAttemptOrder(preferredModel?: string): string[] {
  const cascade = GEMINI_MODEL_CASCADE.filter((m) => m !== preferredModel);
  return preferredModel ? [preferredModel, ...cascade] : [...GEMINI_MODEL_CASCADE];
}

/**
 * Roda `attempt` para cada modelo da cascata (começando pelo preferido, se informado) até um
 * funcionar. Só desiste na hora se o erro for de chave (não adianta trocar de modelo); qualquer
 * outro erro (cota, modelo indisponível, instabilidade, resposta malformada) passa para o
 * próximo modelo da lista.
 */
export async function withGeminiModelFallback<T>(
  preferredModel: string | undefined,
  attempt: (model: string) => Promise<T>,
): Promise<T> {
  const attempts = modelAttemptOrder(preferredModel);
  let lastError: unknown;
  const failures: string[] = [];

  for (const model of attempts) {
    try {
      const result = await attempt(model);
      // Um resumo (não um log por tentativa) evita inundar o console quando vários modelos
      // seguidos estão com cota esgotada — comum em contas free tier sob uso intenso.
      if (failures.length > 0) {
        console.warn(`[gemini] usou "${model}" após falha em: ${failures.join(", ")}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (isKeyLevelError(error)) throw error;
      const status = error instanceof ApiError ? error.status : undefined;
      failures.push(`${model}${status ? ` (${status})` : ""}`);
    }
  }

  console.warn(`[gemini] cascata inteira falhou: ${failures.join(", ")}`);
  throw lastError instanceof Error ? lastError : new Error("Todos os modelos Gemini da cascata falharam");
}

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
  preferredModel: string,
  input: { query: string; offers: RawOffer[] },
): Promise<EnrichedGroup[]> {
  if (input.offers.length === 0) return [];

  const ai = new GoogleGenAI({ apiKey });

  return withGeminiModelFallback(preferredModel, async (model) => {
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
  });
}

/** Chamada mínima para validar uma chave Gemini antes de salvá-la — também passa pela cascata. */
export async function testGeminiApiKey(apiKey: string, preferredModel = DEFAULT_GEMINI_MODEL): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await withGeminiModelFallback(preferredModel, (model) =>
      ai.models.generateContent({ model, contents: "Responda apenas com: ok" }),
    );
    return true;
  } catch {
    return false;
  }
}