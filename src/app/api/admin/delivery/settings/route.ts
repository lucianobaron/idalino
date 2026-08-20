import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminRole, roleDeniedResponse } from "@/lib/auth";
import { storeSettingsInputSchema } from "@/lib/delivery-fees-admin";
import { normalizeCep, resolveCepCoordinates } from "@/lib/delivery";

/**
 * PATCH /api/admin/delivery/settings
 * Salva o ponto de saída da loja (CEP + endereço de exibição), linha única
 * (requer sessão de admin com papel ADMIN).
 * As coordenadas do CEP são resolvidas no momento do salvamento — a entrega
 * fica indisponível enquanto o CEP da loja não for configurado.
 */
export async function PATCH(request: Request) {
  const denied = roleDeniedResponse(await checkAdminRole("ADMIN"));
  if (denied) return denied;

  const parsed = storeSettingsInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const cep = normalizeCep(parsed.data.cep);
  if (!cep) {
    return NextResponse.json(
      { error: "CEP inválido (8 dígitos)." },
      { status: 400 },
    );
  }

  const coords = await resolveCepCoordinates(cep);
  if (!coords) {
    return NextResponse.json(
      { error: "Não foi possível localizar este CEP." },
      { status: 400 },
    );
  }

  const data = {
    cep,
    lat: coords.lat,
    lng: coords.lng,
    street: parsed.data.street || null,
    number: parsed.data.number || null,
    neighborhood: parsed.data.neighborhood || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
  };

  const settings = await prisma.storeSettings.upsert({
    where: { id: "store" },
    update: data,
    create: { id: "store", ...data },
  });

  return NextResponse.json({ settings });
}
