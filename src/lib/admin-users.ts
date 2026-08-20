import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";

// Usuários admin: validação (Zod) e hash de senha (scrypt do Node — sem
// dependência externa; DEC-16). A sessão continua o cookie HMAC de auth.ts,
// agora vinculado ao usuário logado.

export const adminUserCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome.")
    .max(80, "Nome muito longo (máx. 80 caracteres)."),
  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(120, "E-mail muito longo."),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .max(100, "Senha muito longa (máx. 100 caracteres)."),
  // Papel default TEAM (menor privilégio); ADMIN só quando o dono escolher
  role: z.enum(["ADMIN", "TEAM"]).default("TEAM"),
});

export const adminUserUpdateSchema = adminUserCreateSchema.partial();

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;

/** Rótulo pt-BR do papel (exibição no painel). */
export const ADMIN_ROLE_LABELS: Record<"ADMIN" | "TEAM", string> = {
  ADMIN: "Admin",
  TEAM: "Equipe",
};

/** Normaliza o e-mail para armazenamento (minúsculas, sem espaços). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Gera o hash scrypt da senha no formato "salt:hash" (hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Compara a senha com o hash armazenado com tempo constante. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
