import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { normalizeEmail, verifyPassword } from "@/lib/admin-users";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

/**
 * POST /api/admin/login
 * Recebe { email, password } e emite o cookie de sessão do admin.
 */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Mensagem única para não revelar se o e-mail existe (DEC-16)
  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createSessionToken(admin.id), {
    httpOnly: true,
    sameSite: "lax",
    // Em produção (HTTPS) defina COOKIE_SECURE=true no ambiente
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    // Sem maxAge/expires: cookie de sessão — morre ao fechar o navegador,
    // então /admin volta a exigir login na próxima abertura (decisão do dono).
    // O token mantém um teto de 3 dias (exp) como limite máximo no servidor.
  });

  return NextResponse.json({ ok: true, name: admin.name });
}

/**
 * DELETE /api/admin/login
 * Remove o cookie de sessão.
 */
export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
