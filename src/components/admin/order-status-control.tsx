"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "@/lib/order-status";

interface Props {
  orderId: string;
  currentStatus: OrderStatus;
}

/** Controles de transição de status do pedido (fluxo de produção) */
export function OrderStatusControl({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowed = ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];

  async function changeStatus(to: OrderStatus) {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha ao atualizar status.");
      }
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setBusy(null);
    }
  }

  if (allowed.length === 0) {
    return <p className="text-xs text-faint">Status final.</p>;
  }

  return (
    <div className="mt-3 rounded-xl bg-paper-3 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">
        Atualizar produção
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {allowed.map((to) => (
          <button
            key={to}
            type="button"
            onClick={() => changeStatus(to)}
            disabled={busy !== null}
            className="rounded-full border border-rule bg-paper-2 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {busy === to ? "…" : ORDER_STATUS_LABELS[to]}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anotação (opcional): ex. “pronta às 15h”"
        className="mt-2 w-full rounded-lg border border-rule bg-paper-2 px-3 py-1.5 text-xs text-ink outline-none transition placeholder:text-faint focus:border-accent"
      />
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
