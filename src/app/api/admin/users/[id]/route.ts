import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, getCurrentAdmin, roleDeniedResponse } from "@/lib/auth";
import {
  adminUserUpdateSchema,
  hashPassword,
  normalizeEmail,
} from "@/lib/admin-users";

/**
 * PATCH /api/admin/users/[id]
 * Atualiza nome/e-mail/senha/papel de um usuário (requer papel ADMIN).
 * A senha é opcional na edição: ausente = mantém a atual.
 * Proteções de papel: ninguém altera o próprio papel; o painel nunca fica
 * sem ao menos um ADMIN.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const { id } = await params;
  const parsed = adminUserUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const current = await getCurrentAdmin();
  const data = parsed.data;
  const update: Prisma.AdminUserUpdateInput = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.email !== undefined) {
    const email = normalizeEmail(data.email);
    const taken = await prisma.adminUser.findUnique({ where: { email } });
    if (taken && taken.id !== id) {
      return NextResponse.json(
        { error: "Já existe um usuário com este e-mail." },
        { status: 400 },
      );
    }
    update.email = email;
  }
  if (data.password !== undefined) {
    update.passwordHash = hashPassword(data.password);
  }
  if (data.role !== undefined) {
    if (current?.id === id) {
      return NextResponse.json(
        { error: "Você não pode alterar o próprio papel." },
        { status: 400 },
      );
    }
    if (existing.role === "ADMIN" && data.role === "TEAM") {
      const adminCount = await prisma.adminUser.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Não é possível deixar o painel sem nenhum admin." },
          { status: 400 },
        );
      }
    }
    update.role = data.role;
  }

  const admin = await prisma.adminUser.update({
    where: { id },
    data: update,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ admin });
}

/**
 * DELETE /api/admin/users/[id]
 * Exclui um usuário admin (requer papel ADMIN).
 * Proteções: não exclui a si mesmo nem o último usuário admin.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: "Usuário não encontrado." },
      { status: 404 },
    );
  }

  const current = await getCurrentAdmin();
  if (current?.id === id) {
    return NextResponse.json(
      { error: "Você não pode excluir o próprio usuário." },
      { status: 400 },
    );
  }

  const total = await prisma.adminUser.count();
  if (total <= 1) {
    return NextResponse.json(
      { error: "Não é possível excluir o último usuário admin." },
      { status: 400 },
    );
  }

  await prisma.adminUser.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
