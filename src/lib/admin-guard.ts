import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

/** Exige sessão de admin; redireciona para o login se ausente. */
export async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
}
