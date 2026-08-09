import { formatBRL } from "@/lib/utils/money";

export interface PriceDropEmailInput {
  userName: string | null;
  productTitle: string;
  productUrl: string;
  storeName: string;
  newPrice: number;
  previousPrice: number | null;
  targetPrice: number | null;
}

export function priceDropEmailSubject(input: PriceDropEmailInput): string {
  return `Baixou! ${input.productTitle} agora está ${formatBRL(input.newPrice)}`;
}

export function priceDropEmailHtml(input: PriceDropEmailInput): string {
  const greeting = input.userName ? `Olá, ${input.userName}!` : "Olá!";
  const comparison = input.previousPrice
    ? `<p style="color:#475569;font-size:14px;">Preço anterior: <s>${formatBRL(input.previousPrice)}</s></p>`
    : "";
  const targetLine = input.targetPrice
    ? `<p style="color:#475569;font-size:14px;">Seu preço-alvo era ${formatBRL(input.targetPrice)}.</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h1 style="font-size:18px;color:#0f172a;">${greeting}</h1>
      <p style="font-size:16px;color:#0f172a;">O preço de <strong>${input.productTitle}</strong> caiu na ${input.storeName}:</p>
      <p style="font-size:28px;font-weight:bold;color:#16a34a;margin:8px 0;">${formatBRL(input.newPrice)}</p>
      ${comparison}
      ${targetLine}
      <a href="${input.productUrl}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;margin-top:16px;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
        Ver oferta
      </a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
        Você está recebendo este e-mail porque criou um alerta de preço no BuscaPreço IA.
      </p>
    </div>
  `;
}
