import { prisma } from "@/lib/prisma";
import { mercadoLivreProvider } from "./mercadoLivreProvider";
import { createVtexProvider } from "./vtexProvider";
import { createVtexIntelligentSearchProvider } from "./vtexIntelligentSearchProvider";
import type { PriceProvider } from "./types";

// Lojas VTEX conhecidas — para adicionar outra, basta uma nova entrada com o baseUrl da loja
// (o endpoint de busca do catálogo VTEX é padronizado, sem parsing extra).
const staticProviders: PriceProvider[] = [
  mercadoLivreProvider,
  createVtexProvider({
    key: "vtex:decathlon",
    displayName: "Decathlon",
    storeSlug: "decathlon",
    // decathlon.com.br migrou o storefront para um frontend headless (FastStore) que não
    // proxeia mais a API legada do catálogo — o endpoint só responde no domínio VTEX interno.
    apiBaseUrl: "https://decathlonstore.vtexcommercestable.com.br",
    siteBaseUrl: "https://www.decathlon.com.br",
  }),
  createVtexProvider({
    key: "vtex:reserva",
    displayName: "Reserva",
    storeSlug: "reserva",
    apiBaseUrl: "https://www.usereserva.com",
    siteBaseUrl: "https://www.usereserva.com",
  }),
  createVtexIntelligentSearchProvider({
    key: "vtex-is:pbkids",
    displayName: "PBKids",
    storeSlug: "pbkids",
    siteBaseUrl: "https://www.pbkids.com.br",
  }),
  // Carrefour: hipermercado — eletrônicos, eletrodomésticos, alimentos, casa, geral.
  createVtexProvider({
    key: "vtex:carrefour",
    displayName: "Carrefour",
    storeSlug: "carrefour",
    apiBaseUrl: "https://www.carrefour.com.br",
    siteBaseUrl: "https://www.carrefour.com.br",
  }),
  // C&A: moda popular, complementa a Reserva (mais premium).
  createVtexProvider({
    key: "vtex:cea",
    displayName: "C&A",
    storeSlug: "cea",
    apiBaseUrl: "https://www.cea.com.br",
    siteBaseUrl: "https://www.cea.com.br",
  }),
  // Pague Menos: farmácia — remédios, saúde, higiene, beleza.
  createVtexProvider({
    key: "vtex:paguemenos",
    displayName: "Pague Menos",
    storeSlug: "paguemenos",
    apiBaseUrl: "https://www.paguemenos.com.br",
    siteBaseUrl: "https://www.paguemenos.com.br",
  }),
  // Scraping HTML (Cheerio) para lojas sem API: use `createHtmlScraperProvider` de
  // "./htmlScraperProvider" com os seletores reais da loja escolhida. Não incluímos uma loja
  // pronta aqui de propósito — os seletores CSS de um site precisam ser inspecionados e
  // validados manualmente antes de confiar neles em produção (veja comentário no factory).
];

export function getAllProviders(): PriceProvider[] {
  return staticProviders;
}

/**
 * Só ativa providers cuja Store correspondente está marcada como `isActive` no banco —
 * permite ligar/desligar fontes sem deploy, via a tabela `Store` (populada pelo seed).
 */
export async function getActiveProviders(): Promise<PriceProvider[]> {
  const stores = await prisma.store.findMany({ where: { isActive: true } });
  const activeKeys = new Set(stores.map((s) => s.providerKey));
  return staticProviders.filter((p) => activeKeys.has(p.key));
}

export function getProviderByKey(key: string): PriceProvider | undefined {
  return staticProviders.find((p) => p.key === key);
}
