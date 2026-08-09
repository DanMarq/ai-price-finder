import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo"),
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});
