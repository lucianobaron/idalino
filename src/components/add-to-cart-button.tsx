"use client";

import { useCart } from "./cart/cart-context";

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
      onClick={() =>
        addItem({ productId, slug, name, emoji, priceCents, quantity: 1 })
      }
      className="whitespace-nowrap rounded-full bg-accent px-8 py-3 text-base font-semibold text-white transition hover:bg-accent-deep"
    >
      Adicionar ao carrinho
    </button>
  );
}
