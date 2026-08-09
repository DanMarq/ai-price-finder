import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  const resend = getClient();
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resend || !from) {
    console.warn("[email] RESEND_API_KEY/RESEND_FROM_EMAIL não configurados, e-mail não enviado");
    return false;
  }

  try {
    const result = await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html });
    return !result.error;
  } catch (error) {
    console.warn("[email] falha ao enviar e-mail:", error);
    return false;
  }
}
