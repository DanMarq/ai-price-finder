import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserCard } from "@/components/admin/UserCard";

export const metadata: Metadata = { title: "Usuários | BuscaPreço IA" };

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user?.role !== "MASTER") notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { searchLogs: true, priceAlerts: true } },
      searchLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Usuários</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {users.length} usuário{users.length === 1 ? "" : "s"} cadastrado{users.length === 1 ? "" : "s"} · visível
        apenas para contas MASTER.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {users.map((user) => (
          <UserCard
            key={user.id}
            id={user.id}
            name={user.name}
            email={user.email}
            role={user.role}
            createdAtLabel={formatDate(user.createdAt)}
            searchCount={user._count.searchLogs}
            alertCount={user._count.priceAlerts}
            isSelf={user.id === session.user.id}
            recentSearches={user.searchLogs.map((log) => ({
              id: log.id,
              query: log.query,
              resultsCount: log.resultsCount,
              createdAtLabel: formatDate(log.createdAt),
            }))}
          />
        ))}
      </div>
    </div>
  );
}
