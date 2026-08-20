"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { formatBRL, formatKm } from "@/lib/format";

type DeliveryType = "DELIVERY" | "PICKUP";

type QuoteState =
  | { status: "idle" | "loading" }
  | { status: "ok"; feeCents: number; distanceKm: number }
  | { status: "error"; message: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalCents, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("DELIVERY");
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, []);

  const deliveryFeeCents =
    deliveryType === "PICKUP" ? 0 : quote.status === "ok" ? quote.feeCents : null;
  const grandTotal = totalCents + (deliveryFeeCents ?? 0);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Nada para finalizar
        </h1>
        <p className="mt-2 text-muted">Seu carrinho está vazio.</p>
        <Link
          href="/#tortas"
          className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-white transition hover:bg-accent-deep"
        >
          Escolher tortas
        </Link>
      </div>
    );
  }

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cep = e.target.value;
    if (quoteTimer.current) clearTimeout(quoteTimer.current);

    const digits = cep.replace(/\D/g, "");
    if (digits.length < 8) {
      setQuote({ status: "idle" });
      return;
    }

    setQuote({ status: "loading" });
    quoteTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/delivery/quote?cep=${encodeURIComponent(cep)}`,
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setQuote({
            status: "error",
            message:
              data?.error ?? "Não foi possível calcular a entrega.",
          });
          return;
        }
        setQuote({
          status: "ok",
          feeCents: data.feeCents,
          distanceKm: data.distanceKm,
        });
      } catch {
        setQuote({
          status: "error",
          message: "Não foi possível calcular a entrega.",
        });
      }
    }, 500);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      deliveryType,
      notes: form.get("notes"),
      items,
    };

    if (deliveryType === "DELIVERY") {
      body.street = form.get("street");
      body.number = form.get("number");
      body.complement = form.get("complement");
      body.neighborhood = form.get("neighborhood");
      body.city = form.get("city");
      body.state = form.get("state");
      body.zip = form.get("zip");
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-ink">
        Finalizar encomenda
      </h1>

      <form
        onSubmit={handleSubmit}
        className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]"
      >
        <div className="space-y-8">
          <section className="rounded-2xl border border-rule bg-paper-2 p-6">
            <h2 className="font-bold text-ink">1. Seus dados</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted">
                  Nome completo *
                </span>
                <input name="name" required className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted">
                  E-mail *
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  className={inputClass}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-muted">
                  Telefone / WhatsApp
                </span>
                <input
                  name="phone"
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-rule bg-paper-2 p-6">
            <h2 className="font-bold text-ink">2. Como receber</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  deliveryType === "PICKUP"
                    ? "border-accent bg-accent/5"
                    : "border-rule bg-paper hover:bg-paper-3"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  value="PICKUP"
                  checked={deliveryType === "PICKUP"}
                  onChange={() => setDeliveryType("PICKUP")}
                  className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    Retirar na loja
                  </span>
                  <span className="block text-sm text-muted">
                    Sem taxa de entrega
                  </span>
                </span>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                  deliveryType === "DELIVERY"
                    ? "border-accent bg-accent/5"
                    : "border-rule bg-paper hover:bg-paper-3"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  value="DELIVERY"
                  checked={deliveryType === "DELIVERY"}
                  onChange={() => setDeliveryType("DELIVERY")}
                  className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block font-semibold text-ink">
                    Receber em casa
                  </span>
                  <span className="block text-sm text-muted">
                    Taxa calculada pela distância até a loja
                  </span>
                </span>
              </label>
            </div>

            {deliveryType === "DELIVERY" && (
              <div className="mt-5 border-t border-rule pt-5">
                <h3 className="font-bold text-ink">Endereço de entrega</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-6">
                  <label className="block sm:col-span-4">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Rua *
                    </span>
                    <input name="street" required className={inputClass} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Número *
                    </span>
                    <input name="number" required className={inputClass} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Complemento
                    </span>
                    <input
                      name="complement"
                      className={inputClass}
                      placeholder="Apto, bloco…"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Bairro *
                    </span>
                    <input
                      name="neighborhood"
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Cidade *
                    </span>
                    <input name="city" required className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      UF *
                    </span>
                    <input
                      name="state"
                      required
                      maxLength={2}
                      className={inputClass}
                      placeholder="SP"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      CEP *
                    </span>
                    <input
                      name="zip"
                      required
                      onChange={handleCepChange}
                      className={inputClass}
                      placeholder="00000-000"
                    />
                  </label>
                  <label className="block sm:col-span-6">
                    <span className="mb-1 block text-sm font-medium text-muted">
                      Observações (recheio extra, data especial, etc.)
                    </span>
                    <textarea name="notes" rows={3} className={inputClass} />
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-rule bg-paper-2 p-6">
          <h2 className="font-bold text-ink">Seu pedido</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-2">
                <span className="text-muted">
                  {item.quantity}× {item.name}
                </span>
                <span className="font-medium tabular-nums text-ink">
                  {formatBRL(item.priceCents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-rule pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium tabular-nums text-ink">
                {formatBRL(totalCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Entrega</dt>
              <dd className="text-right font-medium tabular-nums text-ink">
                {deliveryType === "PICKUP"
                  ? "Grátis"
                  : quote.status === "ok"
                    ? (
                        <>
                          {formatBRL(quote.feeCents)}
                          <span className="block text-xs font-normal text-faint">
                            ≈ {formatKm(quote.distanceKm)} da loja
                          </span>
                        </>
                      )
                    : quote.status === "loading"
                      ? "Calculando…"
                      : quote.status === "error"
                        ? (
                            <span className="text-red-700">
                              {quote.message}
                            </span>
                          )
                        : "Informe o CEP"}
              </dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt className="text-ink">Total</dt>
              <dd className="tabular-nums text-ink">
                {formatBRL(grandTotal)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 rounded-xl bg-paper-3 p-3 text-xs leading-relaxed text-muted">
            Pagamento simulado (mock) por enquanto. Nenhuma cobrança real será
            feita nesta versão de demonstração.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-full bg-accent py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
          >
            {submitting ? "Enviando…" : "Confirmar encomenda"}
          </button>
        </aside>
      </form>
    </div>
  );
}
