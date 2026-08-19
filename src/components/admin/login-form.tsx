"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Falha no login.");
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
    >
      <p className="text-4xl text-center" aria-hidden>
        🔐
      </p>
      <h1 className="mt-3 text-center text-2xl font-bold text-zinc-900">
        Painel Idalino
      </h1>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Acesso restrito à fábrica
      </p>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-medium text-zinc-600">
          Senha
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
        />
      </label>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-rose-600 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Senha padrão de desenvolvimento:{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5">idalino-admin</code>{" "}
        (altere em .env)
      </p>
    </form>
  );
}
