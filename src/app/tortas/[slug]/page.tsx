import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";

export const dynamic = "force-dynamic";

export default async function TortaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });

  if (!product || !product.available) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-900">
          Início
        </Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="flex h-80 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-100 to-amber-100 text-[10rem] lg:h-[26rem]">
          <span aria-hidden>{product.emoji}</span>
        </div>

        <div className="flex flex-col gap-4">
          {product.category && (
            <span className="w-fit rounded-full bg-rose-600/10 px-3 py-1 text-sm font-medium text-rose-700">
              {product.category.name}
            </span>
          )}
          <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
            {product.name}
          </h1>
          <p className="text-lg leading-relaxed text-zinc-600">
            {product.description}
          </p>

          <div className="mt-2 flex items-center gap-4">
            <span className="text-3xl font-extrabold text-zinc-900">
              {formatBRL(product.priceCents)}
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Disponivel para encomenda
            </span>
          </div>

          <div className="mt-4">
            <AddToCartButton
              productId={product.id}
              slug={product.slug}
              name={product.name}
              emoji={product.emoji}
              priceCents={product.priceCents}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">Informações importantes</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Encomendas feitas até as 18h são entregues no dia seguinte.</li>
              <li>Entregamos em toda a cidade e região.</li>
              <li>Pagamento digital: Pix ou cartão.</li>
              <li>Produção acompanhada: você recebe atualizações por e-mail.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
