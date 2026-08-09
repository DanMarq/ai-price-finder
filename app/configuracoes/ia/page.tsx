import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decrypt, maskSecret } from "@/lib/crypto";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/gemini";
import { AiProviderForm } from "@/components/settings/AiProviderForm";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Provedor de IA | BuscaPreço IA" };

export default async function ConfiguracoesIaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const config = await prisma.aiProviderConfig.findUnique({ where: { userId: session.user.id } });

  const maskedKey = config?.encryptedApiKey ? maskSecret(decrypt(config.encryptedApiKey)) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Provedor de IA</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use sua própria chave do Gemini (Google AI Studio) para as buscas com IA — ela tem
        prioridade sobre a chave padrão do sistema.
      </p>

      <Card className="mt-6 p-6">
        <AiProviderForm
          hasKey={Boolean(config?.encryptedApiKey)}
          maskedKey={maskedKey}
          model={config?.model ?? DEFAULT_GEMINI_MODEL}
          enableGroundingSearch={config?.enableGroundingSearch ?? false}
          defaultModel={DEFAULT_GEMINI_MODEL}
        />
      </Card>
    </div>
  );
}
