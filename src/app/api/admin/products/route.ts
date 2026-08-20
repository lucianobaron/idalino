import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import { productInputSchema, uniqueSlug, normalizeImageUrl } from "@/lib/products-admin";

/**
 * POST /api/admin/products
 * Cria uma torta no cardápio (requer sessão de admin com papel ADMIN).
 */
export async function POST(request: Request) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const parsed = productInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const data = parsed.data;
  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: await uniqueSlug(data.name),
      description: data.description,
      priceCents: data.priceCents,
      weightGrams: data.weightGrams,
      imageUrl: normalizeImageUrl(data.imageUrl),
      available: data.available,
    },
  });

  return NextResponse.json({ product }, { status: 201 });
}
