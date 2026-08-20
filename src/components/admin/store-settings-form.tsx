"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SettingsDraft = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

const inputClass =
  "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

/** Formulário do ponto de saída da loja (CEP é a origem do cálculo de distância). */
export function StoreSettingsForm({ initial }: { initial?: SettingsDraft }) {
  const router = useRouter();
  const [cep, setCep] = useState(initial?.cep ?? "");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [number, setNumber] = useState(initial?.number ?? "");
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const res = await fetch("/api/admin/delivery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep, street, number, neighborhood, city, state }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar o ponto de saída.");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-rule bg-paper-2 p-6"
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-muted">
            CEP da loja *
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            required
            maxLength={10}
            placeholder="00000-000"
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-4">
          <span className="mb-1 block text-sm font-medium text-muted">
            Rua (exibida na retirada)
          </span>
          <input
            type="text"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-muted">
            Número
          </span>
          <input
            type="text"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            maxLength={20}
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-muted">
            Bairro
          </span>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-muted">
            Cidade
          </span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={80}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">UF</span>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="SP"
            className={inputClass}
          />
        </label>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-faint">
        Apenas o CEP é obrigatório — ele é a origem do cálculo de distância. O
        endereço completo aparece na página do pedido quando o cliente escolhe
        retirar na loja.
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Ponto de saída salvo.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar ponto de saída"}
        </button>
      </div>
    </form>
  );
}
