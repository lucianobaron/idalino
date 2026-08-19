"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { formatBRL } from "@/lib/format";
import { DELIVERY_FEE_CENTS } from "@/lib/constants";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalCents, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grandTotal = totalCents + DELIVERY_FEE_CENTS;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">
          Nada para finalizar
        </h1>
        <p className="mt-2 text-zinc-500">Seu carrinho está vazio.</p>
        <Link
          href="/#tortas"
          className="mt-6 inline-block rounded-full bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-700"
        >
          Escolher tortas
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          street: form.get("street"),
          number: form.get("number"),
          complement: form.get("complement"),
          neighborhood: form.get("neighborhood"),
          city: form.get("city"),
          state: form.get("state"),
          zip: form.get("zip"),
          notes: form.get("notes"),
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível criar o pedido.");
      }

      clear();
      router.push(`/pedido/${data.orderId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado ao enviar pedido.",
      );
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-zinc-900">Finalizar encomenda</h1>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-bold text-zinc-900">1. Seus dados</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Nome completo *
                </span>
                <input name="name" required className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  E-mail *
                </span>
                <input name="email" type="email" required className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Telefone / WhatsApp
                </span>
                <input name="phone" className={inputClass} placeholder="(11) 99999-9999" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-bold text-zinc-900">2. Endereço de entrega</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-6">
              <label className="block sm:col-span-4">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Rua *
                </span>
                <input name="street" required className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Número *
                </span>
                <input name="number" required className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Complemento
                </span>
                <input name="complement" className={inputClass} placeholder="Apto, bloco..." />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Bairro *
                </span>
                <input name="neighborhood" required className={inputClass} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Cidade *
                </span>
                <input name="city" required className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  UF *
                </span>
                <input name="state" required maxLength={2} className={inputClass} placeholder="SP" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  CEP *
                </span>
                <input name="zip" required className={inputClass} placeholder="00000-000" />
              </label>
              <label className="block sm:col-span-6">
                <span className="mb-1 block text-sm font-medium text-zinc-600">
                  Observações (recheio extra, data especial, etc.)
                </span>
                <textarea name="notes" rows={3} className={inputClass} />
              </label>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="font-bold text-zinc-900">Seu pedido</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-2">
                <span className="text-zinc-600">
                  {item.quantity}× {item.name}
                </span>
                <span className="font-medium">
                  {formatBRL(item.priceCents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Subtotal</dt>
              <dd className="font-medium">{formatBRL(totalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Entrega</dt>
              <dd className="font-medium">{formatBRL(DELIVERY_FEE_CENTS)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBRL(grandTotal)}</dd>
            </div>
          </dl>

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            💡 Pagamento simulado (mock) por enquanto. Nenhuma cobrança real
            será feita nesta versão de demonstração.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-full bg-rose-600 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Confirmar encomenda"}
          </button>
        </aside>
      </form>
    </div>
  );
}
