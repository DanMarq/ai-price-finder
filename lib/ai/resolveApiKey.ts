import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { DEFAULT_GEMINI_MODEL } from "./gemini";

export interface ResolvedGeminiConfig {
  apiKey: string;
  model: string;
  enableGroundingSearch: boolean;
  source: "user" | "global";
}

/**
 * Prioriza a chave Gemini do próprio usuário (colada em /configuracoes/ia) sobre a chave
 * global do dono do deploy — assim visitantes anônimos ainda têm busca com IA funcionando.
 */
export async function resolveGeminiConfig(userId?: string): Promise<ResolvedGeminiConfig | null> {
  if (userId) {
    const config = await prisma.aiProviderConfig.findUnique({ where: { userId } });
    if (config?.encryptedApiKey) {
      return {
        apiKey: decrypt(config.encryptedApiKey),
        model: config.model ?? DEFAULT_GEMINI_MODEL,
        enableGroundingSearch: config.enableGroundingSearch,
        source: "user",
      };
    }
  }

  const globalKey = process.env.GEMINI_API_KEY;
  if (globalKey) {
    return {
      apiKey: globalKey,
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
      // Opt-in (desligado por padrão): faz o Gemini "pesquisar a web inteira" a cada busca,
      // reimplementando via LLM o que os providers estruturados (Mercado Livre, VTEX) já fazem
      // de forma mais rápida e barata. É a fonte mais lenta/cara de todas — cada busca paga o
      // custo de uma cascata de modelos inteira. Ligue com GEMINI_ENABLE_GROUNDING_SEARCH=true
      // só se quiser cobrir categorias sem nenhuma loja cadastrada, sabendo do custo extra.
      enableGroundingSearch: process.env.GEMINI_ENABLE_GROUNDING_SEARCH === "true",
      source: "global",
    };
  }

  return null;
}
