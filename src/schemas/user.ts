import { z } from "zod";
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do usuário.")
  .max(100, "Use até 100 caracteres.");
export const createUserSchema = z
  .object({
    name: displayNameSchema,
    email: z
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    password: z
      .string()
      .min(12, "Use uma senha com pelo menos 12 caracteres.")
      .max(128),
  })
  .strict();
