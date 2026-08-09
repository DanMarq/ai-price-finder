"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function assertOwnership(alertId: string, userId: string) {
  const alert = await prisma.priceAlert.findUnique({ where: { id: alertId } });
  if (!alert || alert.userId !== userId) {
    throw new Error("Alerta não encontrado");
  }
  return alert;
}

export async function pauseAlert(alertId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  await assertOwnership(alertId, session.user.id);
  await prisma.priceAlert.update({ where: { id: alertId }, data: { status: "PAUSED" } });
  revalidatePath("/alertas");
}

export async function resumeAlert(alertId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  await assertOwnership(alertId, session.user.id);
  await prisma.priceAlert.update({ where: { id: alertId }, data: { status: "ACTIVE" } });
  revalidatePath("/alertas");
}

export async function deleteAlert(alertId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  await assertOwnership(alertId, session.user.id);
  await prisma.priceAlert.delete({ where: { id: alertId } });
  revalidatePath("/alertas");
}
