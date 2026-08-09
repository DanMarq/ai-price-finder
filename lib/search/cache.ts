import { prisma } from "@/lib/prisma";
import { normalizeQuery, queryHash } from "@/lib/utils/slug";

const CACHE_TTL_MS = 20 * 60 * 1000;

export async function getCachedSearch(query: string): Promise<string[] | null> {
  const hash = queryHash(query);
  const cached = await prisma.searchCache.findUnique({ where: { queryHash: hash } });
  if (!cached || cached.expiresAt < new Date()) return null;
  return cached.resultProductIds;
}

export async function setCachedSearch(query: string, productIds: string[]): Promise<void> {
  const hash = queryHash(query);
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  await prisma.searchCache.upsert({
    where: { queryHash: hash },
    create: {
      queryHash: hash,
      query: normalizeQuery(query),
      resultProductIds: productIds,
      expiresAt,
    },
    update: {
      resultProductIds: productIds,
      expiresAt,
    },
  });
}
