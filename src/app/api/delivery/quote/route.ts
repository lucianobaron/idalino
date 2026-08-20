import { NextResponse } from "next/server";
import { quoteDelivery } from "@/lib/delivery";

/**
 * GET /api/delivery/quote?cep=01310-100
 * Cotação da taxa de entrega para um CEP (prévia no checkout).
 * O valor oficial é sempre recalculado no servidor ao criar o pedido (DEC-06).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cep = url.searchParams.get("cep") ?? "";

  const quote = await quoteDelivery(cep);
  if (!quote.ok) {
    const message =
      quote.reason === "origem-nao-configurada"
        ? "Entrega indisponível no momento."
        : quote.reason === "fora-da-cobertura"
          ? "Não realizamos entrega para este CEP."
          : "CEP inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    distanceKm: quote.distanceKm,
    feeCents: quote.feeCents,
  });
}
