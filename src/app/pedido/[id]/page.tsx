import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatKm } from "@/lib/format";
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

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "store" },
  });
  const storeAddress =
    settings && settings.street
      ? `${settings.street}${settings.number ? `, ${settings.number}` : ""}${
          settings.neighborhood ? ` — ${settings.neighborhood}` : ""
        }${settings.city ? `, ${settings.city}` : ""}${
          settings.state ? `/${settings.state}` : ""
        }`
      : null;

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Pedido</p>
          <h1 className="font-display text-3xl font-semibold text-ink">
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
            Pagamento pendente
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            {paymentInstructions ?? "Aguardando confirmação do pagamento."}
          </p>

          {pixCode && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Código Pix (copia e cola)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl bg-paper px-3 py-2.5 font-mono text-xs text-ink">
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
      <section className="mt-8 rounded-2xl border border-rule bg-paper-2 p-6">
        <h2 className="font-bold text-ink">Itens do pedido</h2>
        <ul className="mt-4 space-y-3">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted">
                {item.quantity}× {item.productName}
              </span>
              <span className="font-medium tabular-nums text-ink">
                {formatBRL(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-rule pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums text-ink">
              {formatBRL(order.subtotalCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Entrega</dt>
            <dd className="tabular-nums text-ink">
              {formatBRL(order.deliveryFeeCents)}
            </dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt className="text-ink">Total</dt>
            <dd className="tabular-nums text-ink">
              {formatBRL(order.totalCents)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Entrega / retirada */}
      <section className="mt-6 rounded-2xl border border-rule bg-paper-2 p-6 text-sm">
        <h2 className="font-bold text-ink">Entrega</h2>
        {order.deliveryType === "PICKUP" ? (
          <div className="mt-2 leading-relaxed text-muted">
            <p className="font-medium text-ink">Retirada na loja</p>
            {storeAddress ? (
              <p className="mt-1">{storeAddress}</p>
            ) : (
              <p className="mt-1">
                Você receberá as instruções de retirada em breve.
              </p>
            )}
            <p className="mt-1 text-xs text-faint">Sem taxa de entrega.</p>
          </div>
        ) : (
          <>
            <p className="mt-2 leading-relaxed text-muted">
              {order.street}, {order.number}
              {order.complement ? ` — ${order.complement}` : ""}
              <br />
              {order.neighborhood}, {order.city} — {order.state} · CEP{" "}
              {order.zip}
            </p>
            {order.deliveryDistanceKm !== null && (
              <p className="mt-2 text-xs text-faint">
                Distância estimada: ≈ {formatKm(order.deliveryDistanceKm)}
              </p>
            )}
          </>
        )}
        {order.notes && (
          <p className="mt-3 rounded-xl bg-paper-3 p-3 text-muted">
            <span className="font-semibold text-ink">Observações:</span>{" "}
            {order.notes}
          </p>
        )}
      </section>

      {/* Timeline de produção */}
      {order.events.length > 0 && (
        <section className="mt-6 rounded-2xl border border-rule bg-paper-2 p-6">
          <h2 className="font-bold text-ink">Acompanhamento</h2>
          <ol className="mt-4 space-y-3">
            {order.events.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                  aria-hidden
                />
                <div>
                  <p className="font-medium text-ink">
                    {ORDER_STATUS_LABELS[event.toStatus]}
                  </p>
                  <p className="text-xs text-faint">
                    {event.createdAt.toLocaleString("pt-BR")}
                    {event.note ? ` · ${event.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        Guarde o número do pedido para acompanhar.{" "}
        <Link
          href="/"
          className="font-medium text-accent underline underline-offset-2 transition hover:text-accent-deep"
        >
          Voltar à vitrine
        </Link>
      </p>
    </div>
  );
}
