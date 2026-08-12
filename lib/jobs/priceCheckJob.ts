import { prisma } from "@/lib/prisma";
import { getProviderByKey } from "@/lib/providers/registry";
import { withTimeout } from "@/lib/providers/types";
import { titleSimilarity } from "@/lib/search/normalize";
import { upsertOfferAndHistory } from "@/lib/search/orchestrator";
import { sendEmail } from "@/lib/email/resend";
import { priceDropEmailHtml, priceDropEmailSubject } from "@/lib/email/templates/priceDropEmail";

const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MATCH_THRESHOLD = 0.4;

export interface PriceCheckJobResult {
  processed: number;
  emailsSent: number;
  errors: string[];
}

export async function runPriceCheckJob(opts: { timeBudgetMs: number }): Promise<PriceCheckJobResult> {
  const start = Date.now();
  const result: PriceCheckJobResult = { processed: 0, emailsSent: 0, errors: [] };

  // Antes só reprocessava produtos com alerta de preço ativo — a maioria não tem, então nunca
  // ganhava um 2º ponto de PriceHistory e o gráfico ficava sempre vazio. Agora cobre TODOS os
  // produtos com oferta ativa, priorizando quem está há mais tempo sem checar — o orçamento de
  // tempo abaixo garante que uma execução não trava, só processa o quanto couber e continua de
  // onde parou na próxima (o cron já roda 1x/dia, ver vercel.json).
  const staleOffers = await prisma.productOffer.groupBy({
    by: ["productId"],
    where: { isActive: true },
    _min: { lastCheckedAt: true },
    orderBy: { _min: { lastCheckedAt: "asc" } },
  });
  const candidateProductIds = staleOffers.map((o) => o.productId);

  for (const productId of candidateProductIds) {
    if (Date.now() - start > opts.timeBudgetMs) {
      result.errors.push(`Orçamento de tempo esgotado; ${candidateProductIds.length - result.processed} produto(s) ficaram para a próxima execução`);
      break;
    }

    try {
      await refreshProductOffers(productId);
      result.processed++;
    } catch (error) {
      result.errors.push(`${productId}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      continue;
    }

    result.emailsSent += await notifyAlertsForProduct(productId);
  }

  return result;
}

async function refreshProductOffers(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { offers: { where: { isActive: true }, include: { store: true } } },
  });
  if (!product) return;

  const storesByProviderKey = new Map(product.offers.map((o) => [o.store.providerKey, o.store]));

  for (const store of storesByProviderKey.values()) {
    const provider = getProviderByKey(store.providerKey);
    if (!provider) continue;

    const offersForStore = product.offers.filter((o) => o.storeId === store.id);
    if (offersForStore.length === 0) continue;

    let rawOffers;
    try {
      rawOffers = await withTimeout((signal) =>
        provider.search(product.canonicalTitle, { signal, limit: 5 }),
      );
    } catch {
      continue;
    }

    for (const existingOffer of offersForStore) {
      const match =
        (existingOffer.externalId &&
          rawOffers.find((r) => r.externalId === existingOffer.externalId)) ||
        rawOffers.find((r) => titleSimilarity(r.title, existingOffer.title) >= MATCH_THRESHOLD);

      if (match) {
        await upsertOfferAndHistory(product.id, store.id, match);
      }
    }
  }

  const cheapest = await prisma.productOffer.aggregate({
    where: { productId: product.id, isActive: true },
    _min: { price: true },
  });

  if (cheapest._min.price !== null) {
    const cheapestNum = Number(cheapest._min.price);
    if (product.lowestPriceEver === null || cheapestNum < Number(product.lowestPriceEver)) {
      await prisma.product.update({ where: { id: product.id }, data: { lowestPriceEver: cheapestNum } });
    }
  }
}

async function notifyAlertsForProduct(productId: string): Promise<number> {
  const alerts = await prisma.priceAlert.findMany({
    where: { productId, status: "ACTIVE" },
    include: { user: true },
  });
  if (alerts.length === 0) return 0;

  const cheapestOffer = await prisma.productOffer.findFirst({
    where: { productId, isActive: true },
    orderBy: { price: "asc" },
    include: { store: true, product: true },
  });
  if (!cheapestOffer) return 0;

  const currentPrice = Number(cheapestOffer.price);
  let emailsSent = 0;

  for (const alert of alerts) {
    const previousPrice = alert.lastCheckedPrice ? Number(alert.lastCheckedPrice) : null;
    const droppedFromLast = previousPrice !== null && currentPrice < previousPrice;
    const hitTarget = alert.targetPrice !== null && currentPrice <= Number(alert.targetPrice);
    const shouldNotify = (alert.alertOnAnyDrop && droppedFromLast) || hitTarget;
    const cooldownActive = Boolean(
      alert.lastNotifiedAt && Date.now() - alert.lastNotifiedAt.getTime() < NOTIFICATION_COOLDOWN_MS,
    );

    if (shouldNotify && !cooldownActive && alert.user.email) {
      const emailInput = {
        userName: alert.user.name,
        productTitle: cheapestOffer.product.canonicalTitle,
        productUrl: cheapestOffer.productUrl,
        storeName: cheapestOffer.store.name,
        newPrice: currentPrice,
        previousPrice,
        targetPrice: alert.targetPrice ? Number(alert.targetPrice) : null,
      };

      const sent = await sendEmail({
        to: alert.user.email,
        subject: priceDropEmailSubject(emailInput),
        html: priceDropEmailHtml(emailInput),
      });

      if (sent) {
        emailsSent++;
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { lastNotifiedAt: new Date(), lastCheckedPrice: currentPrice },
        });
        continue;
      }
    }

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { lastCheckedPrice: currentPrice },
    });
  }

  return emailsSent;
}
