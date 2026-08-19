import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments";
import { DELIVERY_FEE_CENTS } from "@/lib/constants";

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
});

const orderSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  email: z.string().email("E-mail inválido."),
  phone: z.string().optional(),
  street: z.string().min(2, "Informe a rua."),
  number: z.string().min(1, "Informe o número."),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Informe o bairro."),
  city: z.string().min(2, "Informe a cidade."),
  state: z.string().length(2, "UF inválida."),
  zip: z.string().min(8, "CEP inválido."),
  notes: z.string().optional(),
  items: z.array(cartItemSchema).min(1, "Carrinho vazio."),
});

/**
 * POST /api/orders
 * Cria o cliente + pedido e gera o pagamento no provedor (mock por ora).
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
  const totalCents = subtotalCents + DELIVERY_FEE_CENTS;

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

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      subtotalCents,
      deliveryFeeCents: DELIVERY_FEE_CENTS,
      totalCents,
      street: data.street,
      number: data.number,
      complement: data.complement ?? null,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zip: data.zip,
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
