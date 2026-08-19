import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, ADMIN_COOKIE_NAME } from "@/lib/auth";

/**
 * POST /api/admin/login
 * Recebe { password } e emite o cookie de sessão do admin.
 */
export async function POST(request: Request) {
  let body: { password?: string } = {};
  try {
    body = await request.json();
  } catch {
    // corpo ausente → senha vazia, será rejeitada abaixo
  }

  const expected = process.env.ADMIN_PASSWORD ?? "idalino-admin";
  if (body.password !== expected) {
    return NextResponse.json(
      { error: "Senha incorreta." },
      { status: 401 },
    );
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    // Em produção (HTTPS) defina COOKIE_SECURE=true no ambiente
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 3, // 3 dias
  });

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/admin/logout
 * Remove o cookie de sessão.
 */
export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
