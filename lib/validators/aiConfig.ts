import { z } from "zod";

export const saveAiProviderConfigSchema = z.object({
  apiKey: z.string().trim().min(10, "Chave inválida"),
  model: z.string().trim().min(1).optional(),
  enableGroundingSearch: z.coerce.boolean().default(false),
});
