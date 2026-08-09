import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL é obrigatória"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET é obrigatória"),
  MERCADO_LIVRE_CLIENT_ID: z.string().optional(),
  MERCADO_LIVRE_CLIENT_SECRET: z.string().optional(),
  ADMIN_SETUP_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  GEMINI_ENABLE_GROUNDING_SEARCH: z.string().optional(),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY deve ter 64 caracteres hex (openssl rand -hex 32)"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  CRON_SECRET: z.string().min(1, "CRON_SECRET é obrigatória"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas/faltando:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
