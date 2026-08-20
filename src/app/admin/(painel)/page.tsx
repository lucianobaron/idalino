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
    { label: "Pedidos hoje", value: ordersToday },
    { label: "Aguardando pagamento", value: pending },
    { label: "Em produção", value: inProduction },
    { label: "Pagos", value: paid },
    { label: "Prontos p/ entrega", value: ready },
    { label: "Entregues", value: delivered },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Visão geral
      </h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-rule bg-paper-2 p-5"
          >
            <p className="text-sm text-muted">{stat.label}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums text-ink">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-ink">
            Últimos pedidos
          </h2>
          <Link
            href="/admin/pedidos"
            className="text-sm font-medium text-accent transition hover:text-accent-deep"
          >
            Ver todos →
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-rule bg-paper-2">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-rule text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {recentOrders.map((order) => (
                <tr key={order.id} className="transition hover:bg-paper-3">
                  <td className="px-4 py-3 font-semibold text-ink">
                    #{String(order.code).padStart(3, "0")}
                    <p className="text-xs font-normal text-faint">
                      {order.createdAt.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.customer.name}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.items.reduce((sum, i) => sum + i.quantity, 0)} itens
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-ink">
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
                    className="px-4 py-10 text-center text-faint"
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
