import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { getPaymentProvider } from "@/lib/payments";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/order-status";
import { SimulatePaymentButton } from "@/components/simulate-payment-button";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) notFound();

  const provider = getPaymentProvider();
  const paymentInfo =
    order.paymentId && order.status === "PENDING_PAYMENT" && provider.getInfo
      ? await provider.getInfo(order.paymentId)
      : null;

  const pixCode = paymentInfo?.gatewayData?.pixCode ?? null;
  const paymentInstructions =
    paymentInfo?.gatewayData?.instructions ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Pedido</p>
          <h1 className="text-3xl font-bold text-zinc-900">
            #{String(order.code).padStart(3, "0")}
          </h1>
        </div>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Pagamento pendente — seção mock */}
      {order.status === "PENDING_PAYMENT" && (
        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="flex items-center gap-2 font-bold text-amber-900">
            <span aria-hidden>💳</span> Pagamento pendente
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            {paymentInstructions ??
              "Aguardando confirmação do pagamento."}
          </p>

          {pixCode && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Código Pix (copia e cola)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-white px-3 py-2.5 text-xs text-zinc-700">
                  {pixCode}
                </code>
                <CopyButton text={pixCode} />
              </div>
            </div>
          )}

          <div className="mt-5">
            <SimulatePaymentButton orderId={order.id} />
          </div>
        </section>
      )}

      {/* Itens */}
      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-bold text-zinc-900">Itens do pedido</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-700">
                {item.quantity}× {item.productName}
              </span>
              <span className="font-medium text-zinc-900">
                {formatBRL(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-zinc-200 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Subtotal</dt>
            <dd>{formatBRL(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Entrega</dt>
            <dd>{formatBRL(order.deliveryFeeCents)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd>{formatBRL(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {/* Entrega */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 text-sm">
        <h2 className="font-bold text-zinc-900">Entrega</h2>
        <p className="mt-2 text-zinc-600">
          {order.street}, {order.number}
          {order.complement ? ` — ${order.complement}` : ""}
          <br />
          {order.neighborhood}, {order.city} — {order.state} · CEP{" "}
          {order.zip}
        </p>
        {order.notes && (
          <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-zinc-600">
            <span className="font-semibold text-zinc-800">Observações:</span>{" "}
            {order.notes}
          </p>
        )}
      </section>

      {/* Timeline de produção */}
      {order.events.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="font-bold text-zinc-900">Acompanhamento</h2>
          <ol className="mt-4 space-y-3">
            {order.events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                <div>
                  <p className="font-medium text-zinc-800">
                    {ORDER_STATUS_LABELS[event.toStatus]}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {event.createdAt.toLocaleString("pt-BR")}
                    {event.note ? ` · ${event.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-zinc-500">
        Guarde o número do pedido para acompanhar.{" "}
        <Link href="/" className="font-medium text-rose-700 hover:underline">
          Voltar à vitrine
        </Link>
      </p>
    </div>
  );
}
