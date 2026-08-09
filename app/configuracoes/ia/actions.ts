"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { testGeminiApiKey, DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";
import { saveAiProviderConfigSchema } from "@/lib/validators/aiConfig";

export interface AiConfigActionState {
  ok: boolean;
  error?: string;
}

export async function saveAiProviderConfig(
  _prevState: AiConfigActionState,
  formData: FormData,
): Promise<AiConfigActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Você precisa entrar para configurar sua chave" };
  }

  const parsed = saveAiProviderConfigSchema.safeParse({
    apiKey: formData.get("apiKey"),
    model: formData.get("model") || undefined,
    enableGroundingSearch: formData.get("enableGroundingSearch") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { apiKey, model, enableGroundingSearch } = parsed.data;
  const resolvedModel = model ?? DEFAULT_GEMINI_MODEL;

  const isValid = await testGeminiApiKey(apiKey, resolvedModel);
  if (!isValid) {
    return { ok: false, error: "Não foi possível validar essa chave com o Google AI Studio" };
  }

  await prisma.aiProviderConfig.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      encryptedApiKey: encrypt(apiKey),
      model: resolvedModel,
      enableGroundingSearch,
    },
    update: {
      encryptedApiKey: encrypt(apiKey),
      model: resolvedModel,
      enableGroundingSearch,
    },
  });

  revalidatePath("/configuracoes/ia");
  return { ok: true };
}

export async function removeAiProviderConfig(): Promise<AiConfigActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Você precisa entrar" };
  }

  await prisma.aiProviderConfig.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/configuracoes/ia");
  return { ok: true };
}
