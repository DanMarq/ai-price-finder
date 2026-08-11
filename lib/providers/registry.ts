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
  // Americanas: marketplace generalista enorme (eletrônicos, casa, brinquedos, de tudo) —
  // junto com o Carrefour, é a fonte mais "genérica" hoje além do Mercado Livre.
  createVtexProvider({
    key: "vtex:americanas",
    displayName: "Americanas",
    storeSlug: "americanas",
    apiBaseUrl: "https://www.americanas.com.br",
    siteBaseUrl: "https://www.americanas.com.br",
  }),
  // Droga São Paulo: farmácia, segunda opção além da Pague Menos.
  createVtexProvider({
    key: "vtex:drogariasaopaulo",
    displayName: "Droga São Paulo",
    storeSlug: "drogariasaopaulo",
    apiBaseUrl: "https://www.drogariasaopaulo.com.br",
    siteBaseUrl: "https://www.drogariasaopaulo.com.br",
  }),
  // Tok&Stok: móveis e decoração.
  createVtexProvider({
    key: "vtex:tokstok",
    displayName: "Tok&Stok",
    storeSlug: "tokstok",
    apiBaseUrl: "https://www.tokstok.com.br",
    siteBaseUrl: "https://www.tokstok.com.br",
  }),
  // Cobasi: pet shop — ração, produtos para animais.
  createVtexProvider({
    key: "vtex:cobasi",
    displayName: "Cobasi",
    storeSlug: "cobasi",
    apiBaseUrl: "https://www.cobasi.com.br",
    siteBaseUrl: "https://www.cobasi.com.br",
  }),
  // Zona Sul: supermercado — alimentos, mercearia, bebidas.
  createVtexProvider({
    key: "vtex:zonasul",
    displayName: "Zona Sul",
    storeSlug: "zonasul",
    apiBaseUrl: "https://www.zonasul.com.br",
    siteBaseUrl: "https://www.zonasul.com.br",
  }),
  // Polishop: eletrônicos de consumo, bem-estar, utilidades — endpoint testado manualmente
  // antes de adicionar (ver processo abaixo).
  createVtexProvider({
    key: "vtex:polishop",
    displayName: "Polishop",
    storeSlug: "polishop",
    apiBaseUrl: "https://www.polishop.com.br",
    siteBaseUrl: "https://www.polishop.com.br",
  }),
  // Scraping HTML (Cheerio) para lojas sem API: use `createHtmlScraperProvider` de
  // "./htmlScraperProvider" com os seletores reais da loja escolhida. Não incluímos uma loja
  // pronta aqui de propósito — os seletores CSS de um site precisam ser inspecionados e
  // validados manualmente antes de confiar neles em produção (veja comentário no factory).
  //
  // Sobre marketplaces grandes (Shopee, Amazon, Magazine Luiza, Netshoes, Centauro, Casas
  // Bahia, Extra, Kabum, Ponto Frio...): testamos (curl real, ago/2026) os endpoints de catálogo
  // dessas lojas e todos retornam 403 (bloqueio de bot/WAF pra IP de datacenter) ou migraram pra
  // front-end 100% client-side-rendered sem API pública acessível por fetch simples (o caso da
  // Shopee — SPA, exige navegador real, e scraping agressivo lá viola os Termos de Uso). Não é
  // algo que se resolve com mais código nesta modalidade leve (fetch + Cheerio, sem browser) —
  // exigiria um serviço à parte de scraping com browser headless + proxies residenciais (custo
  // recorrente, mais fragilidade, risco de ToS). Ver conversa/decisão antes de investir nisso.
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
