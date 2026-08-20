import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { DeliveryFeeForm } from "@/components/admin/delivery-fee-form";

export const dynamic = "force-dynamic";

export default async function NovaFaixaPage() {
  await requireAdminRole("ADMIN");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Nova faixa de entrega
      </h1>
      <p className="mt-1 text-muted">
        Defina o intervalo de distância e o preço da entrega
      </p>

      <div className="mt-6">
        <DeliveryFeeForm />
      </div>
    </div>
  );
}
