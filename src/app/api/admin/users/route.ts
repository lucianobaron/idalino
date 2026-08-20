import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import {
  adminUserCreateSchema,
  hashPassword,
  normalizeEmail,
} from "@/lib/admin-users";

/**
 * POST /api/admin/users
 * Cria um usuário admin (requer sessão de admin com papel ADMIN).
 */
export async function POST(request: Request) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const parsed = adminUserCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um usuário com este e-mail." },
      { status: 400 },
    );
  }

  const admin = await prisma.adminUser.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ admin }, { status: 201 });
}
