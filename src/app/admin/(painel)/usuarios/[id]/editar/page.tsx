import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminRole } from "@/lib/admin-guard";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminUserForm } from "@/components/admin/admin-user-form";

export const dynamic = "force-dynamic";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminRole("ADMIN");

  const { id } = await params;
  const adminUser = await prisma.adminUser.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!adminUser) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminHeader />

      <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
        Editar usuário
      </h1>
      <p className="mt-1 text-muted">
        Ajuste o nome, o e-mail ou a senha do acesso
      </p>

      <div className="mt-6">
        <AdminUserForm adminUser={adminUser} />
      </div>
    </div>
  );
}
