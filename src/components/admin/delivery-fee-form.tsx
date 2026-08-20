"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FeeDraft = {
  id?: string;
  minKm: number;
  maxKm: number | null;
  priceCents: number;
};

const inputClass =
  "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

/** Formulário de criar/editar faixa de entrega (min/max em km, preço em centavos). */
export function DeliveryFeeForm({ fee }: { fee?: FeeDraft }) {
  const router = useRouter();
  const editing = Boolean(fee?.id);

  const [minKm, setMinKm] = useState(
    fee ? String(fee.minKm).replace(".", ",") : "",
  );
  const [openEnded, setOpenEnded] = useState(
    fee ? fee.maxKm === null : false,
  );
  const [maxKm, setMaxKm] = useState(
    fee && fee.maxKm !== null ? String(fee.maxKm).replace(".", ",") : "",
  );
  const [price, setPrice] = useState(
    fee ? (fee.priceCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const min = Number(minKm.replace(",", "."));
    const max = openEnded ? null : Number(maxKm.replace(",", "."));
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);

    if (!Number.isFinite(min) || min < 0) {
      setError("Informe a distância mínima (km).");
      return;
    }
    if (!openEnded && (max === null || !Number.isFinite(max) || max <= min)) {
      setError(
        "O limite máximo deve ser maior que o mínimo (ou marque “faixa aberta”).",
      );
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Informe o preço da entrega (ex.: 15,00).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/admin/delivery-fees/${fee!.id}` : "/api/admin/delivery-fees",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minKm: min, maxKm: max, priceCents }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar a faixa.");
      }
      router.push("/admin/entregas");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-rule bg-paper-2 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            De (km) *
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={minKm}
            onChange={(e) => setMinKm(e.target.value)}
            required
            placeholder="Ex.: 0 ou 3,5"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">
            Até (km)
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={maxKm}
            onChange={(e) => setMaxKm(e.target.value)}
            disabled={openEnded}
            placeholder="Ex.: 3 ou 8"
            className={`${inputClass} disabled:opacity-50`}
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={openEnded}
          onChange={(e) => setOpenEnded(e.target.checked)}
          className="h-4 w-4 rounded accent-[var(--color-accent)]"
        />
        <span className="text-sm font-medium text-muted">
          Faixa aberta — vale para toda distância a partir do “De” (deve ser a
          última faixa)
        </span>
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">
          Preço da entrega (R$) *
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          placeholder="Ex.: 15,00"
          className={inputClass}
        />
      </label>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
        >
          {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar faixa"}
        </button>
        <Link
          href="/admin/entregas"
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
