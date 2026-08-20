"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ADMIN_ROLE_LABELS } from "@/lib/admin-users";

type AdminUserDraft = {
  id?: string;
  name: string;
  email: string;
  role?: "ADMIN" | "TEAM";
};

const inputClass =
  "w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/25";

/** Formulário de criar/editar usuário admin (senha obrigatória só ao criar). */
export function AdminUserForm({ adminUser }: { adminUser?: AdminUserDraft }) {
  const router = useRouter();
  const editing = Boolean(adminUser?.id);

  const [name, setName] = useState(adminUser?.name ?? "");
  const [email, setEmail] = useState(adminUser?.email ?? "");
  const [role, setRole] = useState<"ADMIN" | "TEAM">(
    adminUser?.role ?? "TEAM",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body: Record<string, string> = {
      name: name.trim(),
      email: email.trim(),
      role,
    };
    // Na edição, senha em branco = mantém a atual (não envia o campo)
    if (!editing || password !== "") {
      body.password = password;
    }

    try {
      const res = await fetch(
        editing ? `/api/admin/users/${adminUser!.id}` : "/api/admin/users",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar o usuário.");
      }
      router.push("/admin/usuarios");
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
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-muted">Nome</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="Ex.: Maria da Silva"
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={120}
          placeholder="maria@loja.com"
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">Papel</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "TEAM")}
          className={inputClass}
        >
          <option value="TEAM">{ADMIN_ROLE_LABELS.TEAM} — só visão geral e pedidos</option>
          <option value="ADMIN">{ADMIN_ROLE_LABELS.ADMIN} — acesso total</option>
        </select>
        <span className="mt-1 block text-xs text-faint">
          {editing
            ? "Admin: tudo (tortas, entregas, usuários). Equipe: só visão geral e pedidos."
            : "Novo usuário nasce como Equipe por padrão (menor privilégio)."}
        </span>
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-muted">
          Senha {editing ? "" : "*"}
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!editing}
          minLength={8}
          autoComplete="new-password"
          placeholder={
            editing ? "Deixe em branco para manter a atual" : "Mínimo 8 caracteres"
          }
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
          {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar usuário"}
        </button>
        <Link
          href="/admin/usuarios"
          className="text-sm font-medium text-muted transition hover:text-ink"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
