import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { quoteDelivery } from "@/lib/delivery";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
});

const orderSchema = z
  .object({
    name: z.string().min(2, "Informe seu nome."),
    email: z.string().email("E-mail inválido."),
    phone: z.string().optional(),
    deliveryType: z.enum(["DELIVERY", "PICKUP"]).optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(cartItemSchema).min(1, "Carrinho vazio."),
  })
  .superRefine((data, ctx) => {
    // Endereço de entrega é obrigatório apenas quando a entrega é escolhida;
    // na retirada (PICKUP) os campos são ignorados e gravados como nulos.
    const deliveryType = data.deliveryType ?? "DELIVERY";
    if (deliveryType !== "DELIVERY") return;

    const required: [string, (v: string | undefined) => boolean, string][] = [
      ["street", (v) => (v ?? "").trim().length >= 2, "Informe a rua."],
      ["number", (v) => (v ?? "").trim().length >= 1, "Informe o número."],
      [
        "neighborhood",
        (v) => (v ?? "").trim().length >= 2,
        "Informe o bairro.",
      ],
      ["city", (v) => (v ?? "").trim().length >= 2, "Informe a cidade."],
      ["state", (v) => (v ?? "").trim().length === 2, "UF inválida."],
      ["zip", (v) => (v ?? "").replace(/\D/g, "").length >= 8, "CEP inválido."],
    ];

    for (const [field, isValid, message] of required) {
      if (!isValid(data[field as keyof typeof data] as string | undefined)) {
        ctx.addIssue({ code: "custom", path: [field], message });
      }
    }
  });

/**
 * POST /api/orders
 * Cria o cliente + pedido e gera o pagamento no provedor (mock por ora).
 * Na entrega (DELIVERY), a taxa é recalculada no servidor a partir do CEP e da
 * faixa de distância vigente (nunca confiar no preço enviado — DEC-06); na
 * retirada (PICKUP), a taxa é zero e o endereço é ignorado.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;
  const deliveryType = data.deliveryType ?? "DELIVERY";

  // Busca os produtos para validar preços (nunca confiar no preço enviado)
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, available: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  for (const item of data.items) {
    if (!productMap.has(item.productId)) {
      return NextResponse.json(
        { error: `Produto não disponível no pedido.` },
        { status: 400 },
      );
    }
  }

  const subtotalCents = data.items.reduce(
    (sum, item) => sum + (productMap.get(item.productId)!.priceCents * item.quantity),
    0,
  );

  // Taxa de entrega: recalculada no servidor (DEC-06)
  let deliveryFeeCents = 0;
  let deliveryDistanceKm: number | null = null;
  if (deliveryType === "DELIVERY") {
    const quote = await quoteDelivery(data.zip ?? "");
    if (!quote.ok) {
      const message =
        quote.reason === "origem-nao-configurada"
          ? "Entrega indisponível no momento."
          : quote.reason === "fora-da-cobertura"
            ? "Não realizamos entrega para este CEP."
            : "CEP inválido.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    deliveryFeeCents = quote.feeCents;
    deliveryDistanceKm = quote.distanceKm;
  }
  const totalCents = subtotalCents + deliveryFeeCents;

  // Cliente: procura por e-mail, senão cria
  const customer = await prisma.customer.upsert({
    where: { email: data.email },
    update: { name: data.name },
    create: {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
    },
  });

  const isDelivery = deliveryType === "DELIVERY";
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      deliveryType,
      subtotalCents,
      deliveryFeeCents,
      deliveryDistanceKm,
      totalCents,
      street: isDelivery ? data.street : null,
      number: isDelivery ? data.number : null,
      complement: isDelivery ? (data.complement ?? null) : null,
      neighborhood: isDelivery ? data.neighborhood : null,
      city: isDelivery ? data.city : null,
      state: isDelivery ? data.state : null,
      zip: isDelivery ? data.zip : null,
      notes: data.notes ?? null,
      items: {
        create: data.items.map((item) => {
          const product = productMap.get(item.productId)!;
          return {
            productId: product.id,
            productName: product.name,
            unitPriceCents: product.priceCents,
            quantity: item.quantity,
          };
        }),
      },
      events: {
        create: [{ toStatus: "PENDING_PAYMENT", note: "Pedido criado" }],
      },
    },
    include: { items: true },
  });

  // Cria o pagamento no provedor (mock: gera código Pix fake)
  const provider = getPaymentProvider();
  const payment = await provider.createPayment({
    amountCents: totalCents,
    description: `Pedido #${String(order.code).padStart(3, "0")} — ${data.name}`,
    customer: { name: data.name, email: data.email },
    orderId: order.id,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentId: payment.paymentId,
      paymentMethod: "MOCK",
    },
  });

  return NextResponse.json(
    {
      orderId: order.id,
      orderCode: order.code,
      payment: {
        paymentId: payment.paymentId,
        provider: payment.provider,
        status: payment.status,
        gatewayData: payment.gatewayData ?? null,
      },
    },
    { status: 201 },
  );
}
