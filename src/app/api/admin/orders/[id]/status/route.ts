import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { canTransition, ORDER_STATUS_TRANSITIONS } from "@/lib/order-status";

const statusSchema = z.object({
  status: z.enum(["PAID", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELED"]),
  note: z.string().max(500).optional(),
});

/**
 * POST /api/admin/orders/[id]/status
 * Atualiza o status de produção de um pedido (requer sessão de admin).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const to = parsed.data.status;
  if (!canTransition(order.status, to)) {
    return NextResponse.json(
      {
        error: `Transição inválida: ${order.status} → ${to}.`,
        allowed: ORDER_STATUS_TRANSITIONS[order.status],
      },
      { status: 400 },
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: to,
      events: {
        create: [
          {
            fromStatus: order.status,
            toStatus: to,
            note: parsed.data.note ?? null,
          },
        ],
      },
    },
    include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  return NextResponse.json({ order: updated });
}
