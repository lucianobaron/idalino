import { redirect } from "next/navigation";
import type { AdminRole } from "@prisma/client";
import { getCurrentAdmin, isAdmin } from "@/lib/auth";

/** Exige sessão de admin; redireciona para o login se ausente. */
export async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}

/**
 * Exige sessão de admin com o papel informado (páginas).
 * Sem sessão → login; sessão sem usuário identificado (token antigo) ou com
 * papel insuficiente → visão geral (/admin).
 */
export async function requireAdminRole(role: AdminRole) {
  await requireAdmin();
  const current = await getCurrentAdmin();
  if (!current || current.role !== role) {
    redirect("/admin");
  }
}
