"use client";

import { useCart } from "./cart/cart-context";
import { formatBRL } from "@/lib/format";
import type { CartItem } from "@/lib/types";

interface Props {
  productId: string;
  slug: string;
  name: string;
  emoji: string;
  priceCents: number;
}

/** Botão "Adicionar ao carrinho" da página de detalhe */
export function AddToCartButton({
  productId,
  slug,
  name,
  emoji,
  priceCents,
}: Props) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => addItem({ productId, slug, name, emoji, priceCents, quantity: 1 })}
      className="rounded-full bg-rose-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-rose-700 active:scale-95"
    >
      Adicionar ao carrinho — {formatBRL(priceCents)}
    </button>
  );
}
