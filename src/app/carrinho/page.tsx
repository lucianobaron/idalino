"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { formatBRL } from "@/lib/format";
import { DELIVERY_FEE_CENTS } from "@/lib/constants";

export default function CartPage() {
  const { items, totalCents, setQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Seu carrinho está vazio
        </h1>
        <p className="mt-2 text-muted">
          Que tal escolher uma torta deliciosa?
        </p>
        <Link
          href="/#tortas"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-white transition hover:bg-accent-deep"
        >
          Ver tortas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">
        Seu carrinho
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-2xl border border-rule bg-paper-2 p-4"
            >
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-paper-3 text-4xl">
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/tortas/${item.slug}`}
                  className="font-semibold text-ink transition hover:text-accent"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-muted">
                  {formatBRL(item.priceCents)} cada
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-ink transition hover:border-accent"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium tabular-nums text-ink">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-rule text-ink transition hover:border-accent"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>

              <span className="w-24 text-right font-bold tabular-nums text-ink">
                {formatBRL(item.priceCents * item.quantity)}
              </span>

              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-faint transition hover:text-accent"
                aria-label={`Remover ${item.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-rule bg-paper-2 p-6">
          <h2 className="font-bold text-ink">Resumo</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium tabular-nums">{formatBRL(totalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Entrega</dt>
              <dd className="font-medium tabular-nums">
                {formatBRL(DELIVERY_FEE_CENTS)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-rule pt-3 text-base font-bold">
              <dt className="text-ink">Total</dt>
              <dd className="tabular-nums text-ink">
                {formatBRL(totalCents + DELIVERY_FEE_CENTS)}
              </dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="mt-6 block w-full rounded-full bg-accent py-3 text-center font-semibold text-white transition hover:bg-accent-deep"
          >
            Finalizar encomenda
          </Link>
          <Link
            href="/#tortas"
            className="mt-3 block text-center text-sm text-muted transition hover:text-ink"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
