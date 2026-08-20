"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botão que simula a aprovação do pagamento (equivale ao webhook do
 * gateway real). Ao aprovar, o pedido vai para "Pago" e entra na
 * fila de produção.
 */
export function SimulatePaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha ao simular pagamento.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="rounded-full bg-amber-600 px-6 py-3 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        {loading ? "Confirmando…" : "Simular pagamento aprovado"}
      </button>
      {error && (
        <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
