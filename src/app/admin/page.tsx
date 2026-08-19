import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { formatBRL } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/order-status";
import { AdminHeader } from "@/components/admin/admin-header";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ordersToday, pending, inProduction, paid, ready, delivered, recentOrders] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count({ where: { status: "READY" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: true, items: true },
      }),
    ]);

  const stats = [
    { label: "Pedidos hoje", value: ordersToday, emoji: "📦" },
    { label: "Aguardando pagamento", value: pending, emoji: "⏳" },
    { label: "Em produção", value: inProduction, emoji: "👩‍🍳" },
    { label: "Pagos", value: paid, emoji: "✅" },
    { label: "Prontos p/ entrega", value: ready, emoji: "🛍️" },
    { label: "Entregues", value: delivered, emoji: "🎉" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 text-3xl font-bold text-zinc-900">Visão geral</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm text-zinc-500">
              <span className="mr-1" aria-hidden>
                {stat.emoji}
              </span>
              {stat.label}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-zinc-900">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-900">Últimos pedidos</h2>
          <Link
            href="/admin/pedidos"
            className="text-sm font-medium text-rose-700 hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    #{String(order.code).padStart(3, "0")}
                    <p className="text-xs font-normal text-zinc-400">
                      {order.createdAt.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {order.customer.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {order.items.reduce((sum, i) => sum + i.quantity, 0)} itens
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {formatBRL(order.totalCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-zinc-400"
                  >
                    Nenhum pedido ainda. As encomendas da vitrine aparecem
                    aqui.
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
