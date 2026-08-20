import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { formatBRL, formatGrams } from "@/lib/format";
import { AdminHeader } from "@/components/admin/admin-header";
import { TortaImage } from "@/components/torta-image";
import { DeleteTortaButton } from "@/components/admin/delete-torta-button";

export const dynamic = "force-dynamic";

export default async function AdminTortasPage() {
  await requireAdminRole("ADMIN");

  const products = await prisma.product.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminHeader />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Tortas
          </h1>
          <p className="mt-1 text-muted">
            Gerencie o cardápio: crie, edite e exclua tortas
          </p>
        </div>
        <Link
          href="/admin/tortas/novo"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
        >
          Nova torta
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-rule bg-paper-2">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-rule text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-3">Torta</th>
              <th className="px-4 py-3">Peso</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {products.map((product) => (
              <tr key={product.id} className="transition hover:bg-paper-3">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-rule bg-paper">
                      <TortaImage
                        src={product.imageUrl}
                        alt=""
                        emoji={product.emoji}
                        sizes="48px"
                        unoptimized
                        className="object-cover"
                        emojiClassName="text-2xl"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{product.name}</p>
                      <p className="text-xs text-faint">
                        {product.category?.name ?? "Sem categoria"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {product.weightGrams ? formatGrams(product.weightGrams) : "—"}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-ink">
                  {formatBRL(product.priceCents)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      product.available
                        ? "bg-green-100 text-green-800"
                        : "bg-paper-3 text-faint"
                    }`}
                  >
                    {product.available ? "Disponível" : "Indisponível"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/tortas/${product.id}/editar`}
                      className="text-sm font-medium text-accent transition hover:text-accent-deep"
                    >
                      Editar
                    </Link>
                    <DeleteTortaButton
                      id={product.id}
                      name={product.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-faint"
                >
                  Nenhuma torta cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
