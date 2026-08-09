"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAlertSchema } from "@/lib/validators/alert";

export interface AlertActionState {
  ok: boolean;
  error?: string;
}

export async function createOrUpdateAlert(
  _prevState: AlertActionState,
  formData: FormData,
): Promise<AlertActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Você precisa entrar para criar um alerta" };
  }

  const parsed = createAlertSchema.safeParse({
    productId: formData.get("productId"),
    targetPrice: formData.get("targetPrice") || undefined,
    alertOnAnyDrop: formData.get("alertOnAnyDrop") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { productId, targetPrice, alertOnAnyDrop } = parsed.data;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return { ok: false, error: "Produto não encontrado" };
  }

  await prisma.priceAlert.upsert({
    where: { userId_productId: { userId: session.user.id, productId } },
    create: {
      userId: session.user.id,
      productId,
      targetPrice: targetPrice ?? null,
      alertOnAnyDrop,
      status: "ACTIVE",
    },
    update: {
      targetPrice: targetPrice ?? null,
      alertOnAnyDrop,
      status: "ACTIVE",
    },
  });

  revalidatePath(`/produto/${product.slug}`);
  revalidatePath("/alertas");

  return { ok: true };
}
