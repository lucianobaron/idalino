import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { TortaForm } from "@/components/admin/torta-form";

export const dynamic = "force-dynamic";

export default async function NovaTortaPage() {
  await requireAdminRole("ADMIN");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Nova torta
      </h1>
      <p className="mt-1 text-muted">Cadastre uma torta no cardápio</p>

      <div className="mt-6">
        <TortaForm />
      </div>
    </div>
  );
}
