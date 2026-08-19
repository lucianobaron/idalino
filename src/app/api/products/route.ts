import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products
 * Lista os produtos disponíveis (JSON, útil para integrações).
 */
export async function GET() {
  const products = await prisma.product.findMany({
    where: { available: true },
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceCents: p.priceCents,
      emoji: p.emoji,
      imageUrl: p.imageUrl,
      category: p.category?.name ?? null,
    })),
  );
}
