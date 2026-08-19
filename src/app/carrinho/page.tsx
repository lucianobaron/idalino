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
        <p className="text-6xl" aria-hidden>
          🛒
        </p>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">
          Seu carrinho está vazio
        </h1>
        <p className="mt-2 text-zinc-500">
          Que tal escolher uma torta deliciosa?
        </p>
        <Link
          href="/#tortas"
          className="mt-6 inline-block rounded-full bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-700"
        >
          Ver tortas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">Seu carrinho</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 text-4xl">
                {item.emoji}
              </span>
              <div className="flex-1">
                <Link
                  href={`/tortas/${item.slug}`}
                  className="font-semibold text-zinc-900 hover:text-rose-700"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-zinc-500">
                  {formatBRL(item.priceCents)} cada
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  aria-label="Diminuir quantidade"
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>

              <span className="w-24 text-right font-bold text-zinc-900">
                {formatBRL(item.priceCents * item.quantity)}
              </span>

              <button
                type="button"
                onClick={() => removeItem(item.productId)}
                className="text-zinc-400 transition hover:text-rose-600"
                aria-label={`Remover ${item.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="font-bold text-zinc-900">Resumo</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-medium">{formatBRL(totalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Entrega</dt>
              <dd className="font-medium">{formatBRL(DELIVERY_FEE_CENTS)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBRL(totalCents + DELIVERY_FEE_CENTS)}</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="mt-6 block w-full rounded-full bg-rose-600 py-3 text-center font-semibold text-white transition hover:bg-rose-700"
          >
            Finalizar encomenda
          </Link>
          <Link
            href="/#tortas"
            className="mt-3 block text-center text-sm text-zinc-500 hover:text-zinc-900"
          >
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
