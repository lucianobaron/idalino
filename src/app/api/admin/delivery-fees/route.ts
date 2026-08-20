import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import {
  deliveryFeeRangeInputSchema,
  validateFeeRanges,
} from "@/lib/delivery-fees-admin";

/**
 * POST /api/admin/delivery-fees
 * Cria uma faixa de entrega (requer sessão de admin com papel ADMIN).
 * O conjunto (novo + existentes) é validado: sem sobreposição e com no máximo
 * uma faixa aberta, sempre por último.
 */
export async function POST(request: Request) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const parsed = deliveryFeeRangeInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.deliveryFeeRange.findMany();
  const invalid = validateFeeRanges([...existing, parsed.data]);
  if (invalid) {
    return NextResponse.json({ error: invalid }, { status: 400 });
  }

  const range = await prisma.deliveryFeeRange.create({ data: parsed.data });
  return NextResponse.json({ range }, { status: 201 });
}
