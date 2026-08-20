import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { formatBRL, formatKm } from "@/lib/format";
import { AdminHeader } from "@/components/admin/admin-header";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { DeleteDeliveryFeeButton } from "@/components/admin/delete-delivery-fee-button";

export const dynamic = "force-dynamic";

export default async function AdminEntregasPage() {
  await requireAdminRole("ADMIN");

  const [settings, ranges] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: "store" } }),
    prisma.deliveryFeeRange.findMany({ orderBy: { minKm: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Entregas
      </h1>
      <p className="mt-1 text-muted">
        Configure o ponto de saída da loja e o preço por faixa de distância
      </p>

      {/* Ponto de saída da loja */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold text-ink">
          Ponto de saída da loja
        </h2>
        <p className="mt-1 text-sm text-muted">
          O CEP da loja é a origem do cálculo de distância. Enquanto não for
          configurado, a entrega fica indisponível no checkout (a retirada na
          loja continua funcionando).
        </p>
        <div className="mt-4">
          <StoreSettingsForm
            initial={
              settings
                ? {
                    cep: settings.cep,
                    street: settings.street ?? "",
                    number: settings.number ?? "",
                    neighborhood: settings.neighborhood ?? "",
                    city: settings.city ?? "",
                    state: settings.state ?? "",
                  }
                : undefined
            }
          />
        </div>
      </section>

      {/* Faixas de entrega */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              Faixas de entrega
            </h2>
            <p className="mt-1 text-sm text-muted">
              A distância calculada se encaixa numa faixa e cobra o preço dela;
              distâncias fora de toda faixa não são entregues
            </p>
          </div>
          <Link
            href="/admin/entregas/novo"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
          >
            Nova faixa
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-rule bg-paper-2">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-rule text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3">Faixa de distância</th>
                <th className="px-4 py-3">Preço da entrega</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {ranges.map((range) => (
                <tr key={range.id} className="transition hover:bg-paper-3">
                  <td className="px-4 py-3 font-medium text-ink">
                    {formatKm(range.minKm)}
                    {range.maxKm !== null
                      ? ` até ${formatKm(range.maxKm)}`
                      : " ou mais"}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">
                    {formatBRL(range.priceCents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/entregas/${range.id}/editar`}
                        className="text-sm font-medium text-accent transition hover:text-accent-deep"
                      >
                        Editar
                      </Link>
                      <DeleteDeliveryFeeButton id={range.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {ranges.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-faint"
                  >
                    Nenhuma faixa cadastrada ainda — sem faixas, a entrega não é
                    oferecida.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
