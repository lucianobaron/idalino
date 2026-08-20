"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

const inputClass =
  "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
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
      className="w-full max-w-sm rounded-2xl border border-rule bg-paper-2 p-8"
    >
      <div className="flex flex-col items-center gap-3">
        <Logo size={56} />
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">
            Painel de administração
          </h1>
          <p className="mt-1 text-sm text-muted">Acesso restrito à fábrica</p>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-1 block text-sm font-medium text-muted">E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="voce@loja.com"
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">Senha</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputClass}
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
        className="mt-6 w-full rounded-full bg-accent py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
