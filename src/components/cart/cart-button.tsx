"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

/** Botão do carrinho na navegação, com contador de itens */
export function CartButton() {
  const { itemCount } = useCart();

  return (
    <Link
      href="/carrinho"
      className="relative inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      <span aria-hidden>🛒</span>
      <span>Carrinho</span>
      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
