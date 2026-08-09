import * as cheerio from "cheerio";
import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types";

interface HtmlScraperConfig {
  key: string;
  displayName: string;
  storeSlug: string;
  buildSearchUrl: (query: string) => string;
  selectors: {
    item: string;
    title: string;
    price: string;
    link: string;
    image?: string;
  };
  parsePrice: (raw: string) => number | null;
  /** Se o link do seletor for relativo, prefixo para montar a URL absoluta. */
  baseUrl?: string;
}

/**
 * Factory de scraping leve (fetch + Cheerio), SEM headless browser.
 * É frágil por natureza: quebra quando a loja muda o layout/seletores, e pode ser bloqueado
 * por proteção anti-bot em produção. Trate qualquer falha como "essa fonte não trouxe nada agora" —
 * nunca deixe isso derrubar a busca inteira. Valide manualmente os seletores antes de confiar
 * numa loja nova em produção. Não usar para lojas cujos Termos de Uso proíbam scraping (ex: Amazon).
 */
export function createHtmlScraperProvider(config: HtmlScraperConfig): PriceProvider {
  return {
    key: config.key,
    displayName: config.displayName,

    async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
      const url = config.buildSearchUrl(query);

      try {
        const response = await fetch(url, {
          signal: opts?.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });

        if (!response.ok) {
          console.warn(`[${config.key}] HTTP ${response.status} ao buscar "${query}"`);
          return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const fetchedAt = new Date().toISOString();
        const offers: RawOffer[] = [];
        const limit = opts?.limit ?? 20;

        $(config.selectors.item).each((_, el) => {
          if (offers.length >= limit) return;

          const $el = $(el);
          const title = $el.find(config.selectors.title).first().text().trim();
          const priceRaw = $el.find(config.selectors.price).first().text().trim();
          const price = config.parsePrice(priceRaw);
          let href = $el.find(config.selectors.link).first().attr("href");
          const imageUrl = config.selectors.image
            ? $el.find(config.selectors.image).first().attr("src") ?? null
            : null;

          if (!title || price === null || !href) return;

          if (href.startsWith("/") && config.baseUrl) {
            href = `${config.baseUrl}${href}`;
          }

          offers.push({
            providerKey: config.key,
            storeSlug: config.storeSlug,
            storeName: config.displayName,
            title,
            price,
            shippingCost: null,
            availability: "UNKNOWN",
            productUrl: href,
            imageUrl,
            externalId: null,
            rating: null,
            reviewsCount: null,
            fetchedAt,
          });
        });

        return offers;
      } catch (error) {
        console.warn(`[${config.key}] falha ao buscar "${query}":`, error);
        return [];
      }
    },
  };
}
