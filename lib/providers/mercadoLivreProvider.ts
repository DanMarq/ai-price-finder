import { getMercadoLivreAccessToken } from "@/lib/integrations/mercadoLivre";
import type { PriceProvider, ProviderSearchOptions, RawOffer } from "./types";

const SITE_ID = "MLB"; // Brasil

interface MlSearchResult {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  thumbnail: string;
  permalink: string;
  available_quantity: number;
  seller?: { nickname?: string };
  shipping?: { free_shipping?: boolean };
}

interface MlSearchResponse {
  results: MlSearchResult[];
}

/**
 * Desde 2026 o Mercado Livre passou a exigir Bearer token (OAuth app) até para busca de
 * catálogo — o endpoint público sem autenticação retorna 403. O token vem de uma integração
 * OAuth conectada uma única vez em /api/integrations/mercado-livre/authorize e renovada
 * automaticamente (ver lib/integrations/mercadoLivre.ts). Sem integração conectada, o provider
 * não faz a chamada de rede e simplesmente não contribui candidatos — a busca continua
 * funcionando com os demais providers (VTEX, IA).
 */
export const mercadoLivreProvider: PriceProvider = {
  key: "mercado_livre",
  displayName: "Mercado Livre",

  async search(query: string, opts?: ProviderSearchOptions): Promise<RawOffer[]> {
    const token = await getMercadoLivreAccessToken();
    if (!token) {
      console.warn("[mercado_livre] integração não conectada, pulando (veja /api/integrations/mercado-livre/authorize)");
      return [];
    }

    const url = new URL(`https://api.mercadolibre.com/sites/${SITE_ID}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(opts?.limit ?? 20));

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: opts?.signal,
      });

      if (!response.ok) {
        console.warn(`[mercado_livre] HTTP ${response.status} ao buscar "${query}"`);
        return [];
      }

      const data = (await response.json()) as MlSearchResponse;
      const fetchedAt = new Date().toISOString();

      return data.results.map((item) => ({
        providerKey: "mercado_livre",
        storeSlug: "mercado-livre",
        storeName: "Mercado Livre",
        title: item.title,
        price: item.price,
        shippingCost: item.shipping?.free_shipping ? 0 : null,
        availability: item.available_quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        productUrl: item.permalink,
        imageUrl: item.thumbnail,
        externalId: item.id,
        rating: null,
        reviewsCount: null,
        fetchedAt,
      }));
    } catch (error) {
      console.warn(`[mercado_livre] falha ao buscar "${query}":`, error);
      return [];
    }
  },
};
