import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminUserForm } from "@/components/admin/admin-user-form";

export const dynamic = "force-dynamic";

export default async function NovoUsuarioPage() {
  await requireAdminRole("ADMIN");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Novo usuário
      </h1>
      <p className="mt-1 text-muted">
        Crie um acesso ao painel de administração
      </p>

      <div className="mt-6">
        <AdminUserForm />
      </div>
    </div>
  );
}
