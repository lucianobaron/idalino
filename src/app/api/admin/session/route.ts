import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * GET /api/admin/session
 * Nome e papel do admin logado (cabeçalho do painel).
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({ name: admin.name, role: admin.role });
}
