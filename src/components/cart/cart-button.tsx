"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart-context";

/** Botão do carrinho na navegação, com contador de itens e bump ao adicionar (DEC-23) */
export function CartButton() {
  const { itemCount } = useCart();
  const [bumpKey, setBumpKey] = useState(0);
  const firstRender = useRef(true);

  // Bump da badge sempre que o número de itens muda (adição, remoção, ajuste
  // de quantidade). A primeira renderização (hidratação do localStorage) não
  // anima: não é uma ação do usuário.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setBumpKey((k) => k + 1);
  }, [itemCount]);

  return (
    <Link
      href="/carrinho"
      className="relative inline-flex items-center gap-2 rounded-full border border-rule bg-paper-2 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
    >
      Carrinho
      {itemCount > 0 && (
        <span
          key={bumpKey}
          className={`absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold tabular-nums text-white ${
            bumpKey > 0 ? "cart-badge-bump" : ""
          }`}
        >
          {itemCount}
        </span>
      )}
    </Link>
  );
}
