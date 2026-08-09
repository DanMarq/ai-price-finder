import { z } from "zod";

export const createAlertSchema = z
  .object({
    productId: z.string().min(1),
    targetPrice: z.coerce.number().positive().optional(),
    alertOnAnyDrop: z.coerce.boolean().default(false),
  })
  .refine((data) => data.alertOnAnyDrop || data.targetPrice !== undefined, {
    message: "Informe um preço-alvo ou escolha avisar em qualquer queda",
  })