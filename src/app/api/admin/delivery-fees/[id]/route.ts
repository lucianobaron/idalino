import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import {
  deliveryFeeRangeInputSchema,
  validateFeeRanges,
} from "@/lib/delivery-fees-admin";

const updateSchema = deliveryFeeRangeInputSchema.partial();

/**
 * PATCH /api/admin/delivery-fees/[id]
 * Atualiza uma faixa de entrega (requer sessão de admin com papel ADMIN).
 * O conjunto (atualizada + demais) é validado após a mesclagem dos campos.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.deliveryFeeRange.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Faixa de entrega não encontrada." },
      { status: 404 },
    );
  }

  const data = parsed.data;
  const merged = {
    minKm: data.minKm ?? existing.minKm,
    maxKm: data.maxKm !== undefined ? data.maxKm : existing.maxKm,
    priceCents: data.priceCents ?? existing.priceCents,
  };

  const others = await prisma.deliveryFeeRange.findMany({
    where: { id: { not: id } },
  });
  const invalid = validateFeeRanges([...others, merged]);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const range = await prisma.deliveryFeeRange.update({
    where: { id },
    data: merged,
  });
  return NextResponse.json({ range });
}

/**
 * DELETE /api/admin/delivery-fees/[id]
 * Exclui uma faixa de entrega (requer sessão de admin com papel ADMIN).
 * Pedidos antigos preservam a taxa cobrada (snapshot em deliveryFeeCents).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.deliveryFeeRange.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Faixa de entrega não encontrada." },
      { status: 404 },
    );
  }

  await prisma.deliveryFeeRange.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
