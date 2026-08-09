import type { Metadata } from "next";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "Conta | BuscaPreço IA" };

export default async function ContaPage() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Conta</h1>
      <Card className="mt-6 p-6">
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Nome</dt>
            <dd className="font-medium text-foreground">{session.user.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="font-medium text-foreground">{session.user.email}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}
