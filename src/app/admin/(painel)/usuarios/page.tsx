import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { getCurrentAdmin } from "@/lib/auth";
import { ADMIN_ROLE_LABELS } from "@/lib/admin-users";
import { AdminHeader } from "@/components/admin/admin-header";
import { DeleteAdminUserButton } from "@/components/admin/delete-admin-user-button";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  await requireAdminRole("ADMIN");

  const [users, current] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    getCurrentAdmin(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminHeader />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            Usuários
          </h1>
          <p className="mt-1 text-muted">
            Quem tem acesso ao painel: crie, edite e exclua usuários
          </p>
        </div>
        <Link
          href="/admin/usuarios/novo"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep"
        >
          Novo usuário
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-rule bg-paper-2">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-rule text-xs uppercase tracking-wide text-faint">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {users.map((user) => {
              const isSelf = current?.id === user.id;
              return (
                <tr key={user.id} className="transition hover:bg-paper-3">
                  <td className="px-4 py-3 font-medium text-ink">
                    {user.name}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        Você
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        user.role === "ADMIN"
                          ? "bg-accent/10 text-accent"
                          : "bg-paper-3 text-faint"
                      }`}
                    >
                      {ADMIN_ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/admin/usuarios/${user.id}/editar`}
                        className="text-sm font-medium text-accent transition hover:text-accent-deep"
                      >
                        Editar
                      </Link>
                      {!isSelf && (
                        <DeleteAdminUserButton id={user.id} name={user.name} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-faint">
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
