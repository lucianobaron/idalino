// Autenticação leve do painel administrativo.
//
// Sessão stateless por cookie HMAC (payload `exp=...&uid=...` assinado).
// O login valida e-mail + senha contra o modelo AdminUser (src/lib/admin-users.ts).
// Aviso: ainda é uma autenticação de nível dev — para produção, troque por
// algo mais robusto (Auth.js / NextAuth, SSO, etc.).

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "idalino_admin";
const SESSION_DAYS = 3;

function getSecret(): string {
  return process.env.ADMIN_SECRET ?? "idalino-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(adminUserId: string): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `exp=${expires}&uid=${adminUserId}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;

  const exp = Number(payload.match(/exp=(\d+)/)?.[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export interface CurrentAdmin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

/**
 * Retorna o usuário admin logado (a partir do uid gravado na sessão).
 * Tokens antigos (sem uid) verificam em isAdmin() mas retornam null aqui —
 * nesse caso o painel pede novo login.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!verifySessionToken(token)) return null;

  const uid = payload.match(/uid=([^&]+)/)?.[1];
  if (!uid) return null;

  const admin = await prisma.adminUser.findUnique({
    where: { id: uid },
    select: { id: true, name: true, email: true, role: true },
  });
  return admin;
}

/**
 * Requer sessão válida com o papel informado (para rotas de API).
 * Retorna o motivo da recusa: "unauthorized" (sem sessão) ou "forbidden"
 * (sessão válida, papel insuficiente), ou "ok".
 */
export async function checkAdminRole(
  role: AdminRole,
): Promise<"unauthorized" | "forbidden" | "ok"> {
  if (!(await isAdmin())) return "unauthorized";
  const current = await getCurrentAdmin();
  if (!current || current.role !== role) return "forbidden";
  return "ok";
}

/** Resposta padrão para rotas de API com papel insuficiente. */
export function roleDeniedResponse(
  result: "unauthorized" | "forbidden" | "ok",
): NextResponse | null {
  if (result === "ok") return null;
  return NextResponse.json(
    {
      error: result === "forbidden" ? "Sem permissão." : "Não autorizado.",
    },
    { status: result === "forbidden" ? 403 : 401 },
  );
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
