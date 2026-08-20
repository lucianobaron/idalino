import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { DeliveryFeeForm } from "@/components/admin/delivery-fee-form";

export const dynamic = "force-dynamic";

export default async function EditarFaixaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole("ADMIN");

  const { id } = await params;
  const range = await prisma.deliveryFeeRange.findUnique({ where: { id } });
  if (!range) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Editar faixa de entrega
      </h1>
      <p className="mt-1 text-muted">
        Ajuste o intervalo de distância e o preço da entrega
      </p>

      <div className="mt-6">
        <DeliveryFeeForm
          fee={{
            id: range.id,
            minKm: range.minKm,
            maxKm: range.maxKm,
            priceCents: range.priceCents,
          }}
        />
      </div>
    </div>
  );
}
