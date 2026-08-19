import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { formatBRL } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/order-status";
import { AdminHeader } from "@/components/admin/admin-header";
import { OrderStatusControl } from "@/components/admin/order-status-control";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdmin();

  const orders = await prisma.order.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      customer: true,
      items: true,
      events: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 text-3xl font-bold text-zinc-900">Pedidos</h1>
      <p className="mt-1 text-zinc-500">
        Gerencie o fluxo de produção: pago → em produção → pronto → entregue
      </p>

      <div className="mt-6 space-y-4">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-zinc-900">
                    #{String(order.code).padStart(3, "0")}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {order.customer.name} · {order.customer.email}
                  {order.customer.phone ? ` · ${order.customer.phone}` : ""}
                </p>
                <p className="text-xs text-zinc-400">
                  {order.createdAt.toLocaleString("pt-BR")} ·{" "}
                  {order.street}, {order.number} — {order.neighborhood},{" "}
                  {order.city}/{order.state}
                  {order.notes ? ` · Obs: ${order.notes}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-zinc-900">
                  {formatBRL(order.totalCents)}
                </p>
                <p className="text-xs text-zinc-400">
                  {order.paymentMethod} ·{" "}
                  {order.paymentId ? order.paymentId.slice(0, 14) : "sem pagamento"}
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.quantity}× {item.productName}
                  </span>
                  <span>{formatBRL(item.unitPriceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>

            {order.events.length > 0 && (
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Histórico recente
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                  {order.events.map((event) => (
                    <li key={event.id}>
                      {ORDER_STATUS_LABELS[event.toStatus]}
                      {event.note ? ` — ${event.note}` : ""} ·{" "}
                      {event.createdAt.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <OrderStatusControl
              orderId={order.id}
              currentStatus={order.status}
            />
          </article>
        ))}

        {orders.length === 0 && (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            Nenhum pedido registrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
