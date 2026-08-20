import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import { productInputSchema, uniqueSlug, normalizeImageUrl } from "@/lib/products-admin";
import { slugify } from "@/lib/slugify";

const updateSchema = productInputSchema.partial();

/**
 * PATCH /api/admin/products/[id]
 * Atualiza uma torta (requer sessão de admin com papel ADMIN).
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

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Torta não encontrada." }, { status: 404 });
  }

  const data = parsed.data;
  const update: Prisma.ProductUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
    ...(data.weightGrams !== undefined && { weightGrams: data.weightGrams }),
    ...(data.imageUrl !== undefined && {
      imageUrl: normalizeImageUrl(data.imageUrl),
    }),
    ...(data.available !== undefined && { available: data.available }),
  };
  if (data.name !== undefined && slugify(data.name) !== existing.slug) {
    update.slug = await uniqueSlug(data.name, existing.id);
  }

  const product = await prisma.product.update({ where: { id }, data: update });
  return NextResponse.json({ product });
}

/**
 * DELETE /api/admin/products/[id]
 * Exclui uma torta (requer sessão de admin com papel ADMIN).
 * Pedidos antigos preservam nome/preço (DEC-08 — snapshot nos itens do pedido).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Torta não encontrada." }, { status: 404 });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
