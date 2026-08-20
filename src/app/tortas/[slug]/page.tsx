import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { CartControls } from "@/components/cart/cart-controls";
import { TortaImage } from "@/components/torta-image";
import { tortaImageForSlug } from "@/lib/torta-images";

export const dynamic = "force-dynamic";

export default async function TortaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [product, orderedSlugs] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    }),
    prisma.product
      .findMany({
        where: { available: true },
        orderBy: { createdAt: "asc" },
        select: { slug: true },
      })
      .then((rows) => rows.map((r) => r.slug)),
  ]);

  if (!product || !product.available) notFound();

  const imageUrl = product.imageUrl ?? tortaImageForSlug(slug, orderedSlugs);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/" className="transition hover:text-ink">
          Início
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span>{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative h-80 overflow-hidden rounded-3xl border border-rule bg-paper-2 lg:h-[26rem]">
          <TortaImage
            src={imageUrl}
            alt={product.name}
            emoji={product.emoji}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            emojiClassName="text-[10rem]"
          />
        </div>

        <div className="flex flex-col gap-4">
          {product.category && (
            <span className="w-fit rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-deep">
              {product.category.name}
            </span>
          )}
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            {product.name}
          </h1>
          <p className="text-lg leading-relaxed text-muted">
            {product.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="text-3xl font-extrabold tabular-nums text-ink">
              {formatBRL(product.priceCents)}
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-green-700">
              <span
                className="h-2 w-2 rounded-full bg-green-600"
                aria-hidden
              />
              Disponível para encomenda
            </span>
          </div>

          <div className="mt-4">
            <CartControls
              productId={product.id}
              slug={product.slug}
              name={product.name}
              emoji={product.emoji}
              priceCents={product.priceCents}
              imageUrl={imageUrl}
              variant="hero"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-rule bg-paper-2 p-5 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-ink">Informações importantes</p>
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
