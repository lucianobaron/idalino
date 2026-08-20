import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { TortaForm } from "@/components/admin/torta-form";

export const dynamic = "force-dynamic";

export default async function EditarTortaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole("ADMIN");

  const { id } = await params;
  const torta = await prisma.product.findUnique({ where: { id } });
  if (!torta) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Editar torta
      </h1>
      <p className="mt-1 text-muted">{torta.name}</p>

      <div className="mt-6">
        <TortaForm
          torta={{
            id: torta.id,
            name: torta.name,
            description: torta.description,
            priceCents: torta.priceCents,
            weightGrams: torta.weightGrams,
            imageUrl: torta.imageUrl,
            available: torta.available,
          }}
        />
      </div>
    </div>
  );
}
