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
      // Liga a busca com IA (Gemini + Google Search) como fonte extra para todo mundo por
      // padrão — cobre categorias que nenhuma loja cadastrada vende (eletrônicos, alimentos,
      // etc). Custa cota extra da API Gemini; desligue com GEMINI_ENABLE_GROUNDING_SEARCH=false.
      enableGroundingSearch: process.env.GEMINI_ENABLE_GROUNDING_SEARCH !== "false",
      source: "global",
    };
  }

  return null;
}
