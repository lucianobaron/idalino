"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botão de excluir usuário admin com confirmação (proteções no servidor). */
export function DeleteAdminUserButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Excluir o usuário "${name}"?`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao excluir o usuário.");
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
