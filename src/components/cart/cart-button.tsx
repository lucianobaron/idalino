"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

/** Botão do carrinho na navegação, com contador de itens */
export function CartButton() {
  const { itemCount } = useCart();

  return (
    <Link
      href="/carrinho"
      className="relative inline-flex items-center gap-2 rounded-full border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
    >
      Carrinho
      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold tabular-nums text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
