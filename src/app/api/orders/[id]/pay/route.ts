import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";

/**
 * POST /api/orders/[id]/pay
 * Simula o webhook de confirmação de pagamento do gateway:
 * aprova o pagamento no provedor mock e, se aprovado, move o pedido
 * para "PAID" e registra o evento de produção.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json({
      status: order.status,
      message: "Pedido já não está aguardando pagamento.",
    });
  }

  const provider = getPaymentProvider();

  // Aprovação manual existe apenas no mock (simula o webhook real)
  if (typeof provider.approve === "function" && order.paymentId) {
    await provider.approve(order.paymentId);
  }

  const paymentStatus = order.paymentId
    ? await provider.getStatus(order.paymentId)
    : "rejected";

  if (paymentStatus !== "approved") {
    return NextResponse.json(
      { error: "Pagamento não aprovado." },
      { status: 402 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      events: {
        create: [
          {
            fromStatus: "PENDING_PAYMENT",
            toStatus: "PAID",
            note: "Pagamento aprovado (mock)",
          },
        ],
      },
    },
  });

  return NextResponse.json({ status: updated.status });
}
