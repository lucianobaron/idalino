"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botão de excluir torta com confirmação (requer sessão de admin no servidor). */
export function DeleteTortaButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Excluir a torta "${name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao excluir a torta.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setDeleting(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-red-700">{error}</span>}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-sm font-medium text-red-700 transition hover:text-red-900 disabled:opacity-50"
      >
        {deleting ? "Excluindo…" : "Excluir"}
      </button>
    </span>
  );
}
