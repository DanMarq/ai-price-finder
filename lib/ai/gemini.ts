import { GoogleGenAI, ApiError, Type, type Schema } from "@google/genai";
import { withTimeout, type RawOffer } from "@/lib/providers/types";
import { enrichmentResultSchema, type EnrichedGroup } from "./schemas";

/**
 * Cascata de modelos de texto do Gemini (Google AI Studio), do mais capaz/atual para o mais
 * simples. Quando um modelo esgota cota (429) ou tem uma instabilidade pontual (503), tentamos
 * o próximo automaticamente — ver `withGeminiModelFallback`. A família 2.x (gemini-2.5-flash,
 * gemini-2.5-flash-lite, gemini-2.0-flash-001) foi desativada pelo Google em 2026 (retornam 404,
 * "no longer available") e por isso NÃO está mais nesta lista — mantê-la só desperdiça uma
 * tentativa (e tempo) garantidamente fadada ao erro em toda busca. Ajuste esta lista conforme o
 * Google lança/aposenta modelos; `withGeminiModelFallback` também limita o tempo total gasto
 * tentando modelos (`budgetMs`), então uma lista longa não trava a busca mesmo se a cota estiver
 * esgotada em vários modelos ao mesmo tempo (comum em contas free tier sob uso intenso).
 */
export const GEMINI_MODEL_CASCADE = [
  "gemini-flash-latest", // alias sempre atualizado para o flash recomendado no momento
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-flash-lite-latest", // alias sempre atualizado para o flash-lite recomendado
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
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

/** Tempo total (não por tentativa) que a cascata pode gastar antes de desistir de tentar mais modelos. */
const DEFAULT_FALLBACK_BUDGET_MS = 8000;

/**
 * Roda `attempt` para cada modelo da cascata (começando pelo preferido, se informado) até um
 * funcionar. Só desiste na hora se o erro for de chave (não adianta trocar de modelo); qualquer
 * outro erro (cota, modelo indisponível, instabilidade, resposta malformada) passa para o
 * próximo modelo da lista — mas só enquanto ainda houver orçamento de tempo (`budgetMs`, medido
 * desde a primeira tentativa). Cada tentativa individual também é limitada ao tempo restante do
 * orçamento (via `withTimeout`, com `signal` passado pro `attempt`) — sem isso, uma ÚNICA
 * chamada lenta/pendurada (ex: Gemini demorando ~20s pra responder um 503) já consumia o
 * orçamento inteiro sem nunca ser interrompida, porque o corte só era checado *entre* tentativas.
 */
export async function withGeminiModelFallback<T>(
  preferredModel: string | undefined,
  attempt: (model: string, signal: AbortSignal) => Promise<T>,
  opts: { budgetMs?: number } = {},
): Promise<T> {
  const budgetMs = opts.budgetMs ?? DEFAULT_FALLBACK_BUDGET_MS;
  const attempts = modelAttemptOrder(preferredModel);
  const start = Date.now();
  let lastError: unknown;
  const failures: string[] = [];

  for (let i = 0; i < attempts.length; i++) {
    const remainingMs = budgetMs - (Date.now() - start);
    if (i > 0 && remainingMs <= 0) {
      failures.push(`orçamento de ${budgetMs}ms esgotado (${attempts.length - i} modelo(s) não tentado(s))`);
      break;
    }

    const model = attempts[i];
    try {
      const result = await withTimeout((signal) => attempt(model, signal), Math.max(remainingMs, 1000));
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

Responda apenas com o JSON estruturado pedido.`
}

export async function enrichOffersWithGemini(
  apiKey: string,
  preferredModel: string,
  input: { query: string; offers: RawOffer[] },
): Promise<EnrichedGroup[]> {
  if (input.offers.length === 0) return []

  const ai = new GoogleGenAI({ apiKey })

  return withGeminiModelFallback(
    preferredModel,
    async (model, signal) => {
      const response = await ai.models.generateContent({
        model,
        contents: buildPrompt(input.query, input.offers),
        config: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          abortSignal: signal,
        },
      })

      const text = response.text;
      if (!text) throw new Error("Gemini retornou resposta vazia");

      const parsed = enrichmentResultSchema.parse(JSON.parse(text));

      const maxIndex = input.offers.length - 1;
      return parsed.groups.map((group) => ({
        ...group,
        matchedOfferIndexes: group.matchedOfferIndexes.filter((i) => i >= 0 && i <= maxIndex),
      }));
    },
    // Passo barato (só título+preço+loja), mas ainda assim não pode competir com o tempo dos
    // outros providers na mesma busca — 6s de orçamento, cai pro agrupamento heurístico depois disso.
    { budgetMs: 6000 },
  )
}

/** Chamada mínima para validar uma chave Gemini antes de salvá-la — também passa pela cascata. */
export async function testGeminiApiKey(apiKey: string, preferredModel = DEFAULT_GEMINI_MODEL): Promise<boolean> {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await withGeminiModelFallback(preferredModel, (model, signal) =>
      ai.models.generateContent({ model, contents: "Responda apenas com: ok", config: { abortSignal: signal } }),
    );
    return true
  } catch {
    return false
  }
}