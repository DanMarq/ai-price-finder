"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { updateUserSchema } from "@/lib/validators/userAdmin";

export interface UserAdminActionState {
  ok: boolean;
  error?: string;
}

async function requireMasterSession() {
  const session = await auth();
  return session?.user?.role === "MASTER" ? session : null;
}

export async function updateUser(
  _prevState: UserAdminActionState,
  formData: FormData,
): Promise<UserAdminActionState> {
  const session = await requireMasterSession();
  if (!session) return { ok: false, error: "Acesso restrito a contas MASTER" };

  const parsed = updateUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { userId, name, password } = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<UserAdminActionState> {
  const session = await requireMasterSession();
  if (!session) return { ok: false, error: "Acesso restrito a contas MASTER" };
  if (session.user.id === userId) {
    return { ok: false, error: "Você não pode excluir a própria conta" };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/usuarios");
  return { ok: true };
}
