"use client";

import { useCart } from "./cart-context";
import type { CartItem } from "@/lib/types";

interface CartControlsProps {
  productId: string;
  slug: string;
  name: string;
  emoji: string;
  priceCents: number;
  /** Foto resolvida na adição (mesma regra da vitrine — snapshot no item) */
  imageUrl?: string;
  /** "card" = compacto (vitrine) · "hero" = maior (página de detalhe) */
  variant?: "card" | "hero";
}

function CartItemStepper({
  item,
  name,
  variant,
}: {
  item: CartItem;
  name: string;
  variant: "card" | "hero";
}) {
  const { setQuantity, removeItem } = useCart();
  const size = variant === "hero" ? "h-10 w-10 text-lg" : "h-7 w-7 text-sm";
  const stepBtn = `inline-flex items-center justify-center rounded-full border border-rule bg-paper-2 text-ink transition hover:border-accent hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink ${size}`;
  const trashBtn = `inline-flex items-center justify-center rounded-full border border-rule bg-paper-2 text-muted transition hover:border-red-300 hover:text-red-600 ${size}`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setQuantity(item.productId, item.quantity - 1)}
        disabled={item.quantity <= 1}
        aria-label={`Diminuir quantidade de ${name}`}
        className={stepBtn}
      >
        <span aria-hidden>−</span>
      </button>
      <span
        aria-live="polite"
        className={`text-center font-semibold tabular-nums text-ink ${
          variant === "hero" ? "min-w-8 text-lg" : "min-w-6 text-sm"
        }`}
      >
        {item.quantity}
      </span>
      <button
        type="button"
        onClick={() => setQuantity(item.productId, item.quantity + 1)}
        aria-label={`Aumentar quantidade de ${name}`}
        className={stepBtn}
      >
        <span aria-hidden>+</span>
      </button>
      <button
        type="button"
        onClick={() => removeItem(item.productId)}
        aria-label={`Excluir ${name} do carrinho`}
        className={trashBtn}
      >
        {/* Lixeira — ícone inline, herda currentColor */}
        <svg
          aria-hidden
          width={variant === "hero" ? 18 : 14}
          height={variant === "hero" ? 18 : 14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" x2="10" y1="11" y2="17" />
          <line x1="14" x2="14" y1="11" y2="17" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Controles de carrinho padrão de mercado (DEC-24): fora do carrinho mostra o
 * botão "Adicionar"; dentro, um stepper persistente "− quantidade +" com
 * botão de excluir (lixeira). O estado vem do carrinho (DEC-13), então a
 * vitrine e o detalhe refletem a mesma quantidade em qualquer ponto.
 */
export function CartControls({
  productId,
  slug,
  name,
  emoji,
  priceCents,
  imageUrl,
  variant = "card",
}: CartControlsProps) {
  const { items, addItem } = useCart();
  const item = items.find((i) => i.productId === productId);
  const addBtn =
    variant === "hero"
      ? "whitespace-nowrap rounded-full bg-accent px-8 py-3 text-base font-semibold text-white transition hover:bg-accent-deep"
      : "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-deep";

  if (item) {
    return <CartItemStepper item={item} name={name} variant={variant} />;
  }

  return (
    <button
      type="button"
      onClick={() =>
        addItem({ productId, slug, name, emoji, priceCents, quantity: 1, imageUrl })
      }
      className={addBtn}
    >
      {variant === "hero" ? "Adicionar ao carrinho" : "Adicionar"}
    </button>
  );
}
