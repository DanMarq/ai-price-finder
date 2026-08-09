import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AlertList } from "@/components/alerts/AlertList";
import type { AlertRowData } from "@/components/alerts/AlertRow";

export const metadata: Metadata = { title: "Meus alertas | BuscaPreço IA" };

export default async function AlertasPage() {
  const session = await auth();
  if (!session?.user?.id) return null; // middleware já redireciona para /login

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: session.user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  const rows: AlertRowData[] = alerts.map((alert) => ({
    id: alert.id,
    productSlug: alert.product.slug,
    productTitle: alert.product.canonicalTitle,
    productImageUrl: alert.product.imageUrl,
    targetPrice: alert.targetPrice ? Number(alert.targetPrice) : null,
    alertOnAnyDrop: alert.alertOnAnyDrop,
    status: alert.status,
    lastCheckedPrice: alert.lastCheckedPrice ? Number(alert.lastCheckedPrice) : null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Meus alertas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Verificamos os preços periodicamente e avisamos por e-mail quando cair.
      </p>
      <div className="mt-6">
        <AlertList alerts={rows} />
      </div>
    </div>
  );
}
