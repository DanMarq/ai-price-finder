import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

const PROVIDER = "mercado_livre";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const AUTHORIZE_URL = "https://auth.mercadolivre.com.br/authorization";
// Renova um pouco antes do vencimento real para nunca usar um token borderline.
const REFRESH_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface MlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export function getMercadoLivreRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL não configurada");
  return `${base}/api/integrations/mercado-livre/callback`;
}

/** URL para onde o dono do deploy deve ser redirecionado para autorizar o app (fluxo manual, único). */
export function buildMercadoLivreAuthorizeUrl(): string {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
  if (!clientId) throw new Error("MERCADO_LIVRE_CLIENT_ID não configurado");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getMercadoLivreRedirectUri());
  return url.toString();
}

async function persistTokens(data: MlTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + data.expires_in * 1000 - REFRESH_SAFETY_MARGIN_MS);

  await prisma.integrationToken.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      encryptedAccessToken: encrypt(data.access_token),
      encryptedRefreshToken: encrypt(data.refresh_token),
      expiresAt,
    },
    update: {
      encryptedAccessToken: encrypt(data.access_token),
      encryptedRefreshToken: encrypt(data.refresh_token),
      expiresAt,
    },
  });
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("MERCADO_LIVRE_CLIENT_ID/MERCADO_LIVRE_CLIENT_SECRET não configurados");
  }
  return { clientId, clientSecret };
}

/** Troca o `code` do callback OAuth pelo primeiro par access_token/refresh_token. */
export async function exchangeCodeForToken(code: string): Promise<void> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getMercadoLivreRedirectUri(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao trocar code por token (HTTP ${response.status}): ${await response.text()}`);
  }

  await persistTokens((await response.json()) as MlTokenResponse);
}

/** O refresh_token do Mercado Livre é de uso único — cada renovação já grava o novo par. */
async function refreshAccessToken(refreshTokenValue: string): Promise<string> {
  const { clientId, clientSecret } = getClientCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenValue,
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao renovar token (HTTP ${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as MlTokenResponse;
  await persistTokens(data);
  return data.access_token;
}

/**
 * Checagem rápida (sem chamar a API do ML) usada pelo orquestrador de busca para avisar o
 * usuário quando a fonte Mercado Livre está fora do ar por falta de conexão, em vez de ela
 * simplesmente desaparecer dos resultados sem explicação.
 */
export async function isMercadoLivreConnected(): Promise<boolean> {
  const record = await prisma.integrationToken.findUnique({ where: { provider: PROVIDER } });
  return Boolean(record);
}

/**
 * Retorna um access_token válido do Mercado Livre, renovando automaticamente via refresh_token
 * quando necessário. Retorna null se a integração nunca foi conectada (ver rota /authorize) —
 * nesse caso o provider correspondente simplesmente não contribui candidatos para a busca.
 */
export async function getMercadoLivreAccessToken(): Promise<string | null> {
  const record = await prisma.integrationToken.findUnique({ where: { provider: PROVIDER } });
  if (!record) return null;

  if (record.expiresAt > new Date()) {
    return decrypt(record.encryptedAccessToken);
  }

  try {
    return await refreshAccessToken(decrypt(record.encryptedRefreshToken));
  } catch (error) {
    console.warn("[mercado_livre] falha ao renovar token:", error);
    return null;
  }
}
