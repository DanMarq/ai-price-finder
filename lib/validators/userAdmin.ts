import { z } from "zod";

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Nome não pode ficar vazio").max(120),
  password: z
    .string()
    .trim()
    .min(6, "Senha precisa ter ao menos 6 caracteres")
    .optional()
    .or(z.literal("")),
});
