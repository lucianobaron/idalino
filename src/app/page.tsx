import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TortaCard } from "@/components/torta-card";
import { APP_TAGLINE } from "@/lib/constants";

// Página dinâmica: consulta o banco a cada acesso (sem cache de build)
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Escolha sua torta",
    text: "Navegue pela vitrine e escolha a torta perfeita para a ocasião.",
  },
  {
    title: "Encomende online",
    text: "Monte seu pedido no carrinho e preencha seus dados de entrega.",
  },
  {
    title: "Pague digital",
    text: "Pagamento rápido por Pix ou cartão, direto no site.",
  },
  {
    title: "Receba com carinho",
    text: "Acompanhamos a produção e entregamos fresquinha na sua porta.",
  },
];

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { available: true },
      orderBy: { createdAt: "asc" },
      include: { category: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      {/* Abertura (Catalogue) — sem hero de template: marca + tagline + convite */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:pt-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            {APP_TAGLINE}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Encomende até as 18h e receba amanhã. Pagamento digital, produção
            acompanhada e entrega programada.
          </p>
          <p className="mt-6 text-sm font-medium text-ink">
            {products.length}{" "}
            {products.length === 1 ? "torta no cardápio" : "tortas no cardápio"}
            {categories.length > 0 &&
              ` · ${categories.map((c) => c.name).join(", ")}`}
          </p>
        </div>
      </section>

      {/* Vitrine — o catálogo é a página */}
      <section id="tortas" className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            Nossas tortas
          </h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-rule bg-paper-2 px-3 py-1 text-sm text-muted"
                >
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <TortaCard
              key={product.id}
              id={product.id}
              slug={product.slug}
              name={product.name}
              description={product.description}
              priceCents={product.priceCents}
              emoji={product.emoji}
            />
          ))}
        </div>

        {products.length === 0 && (
          <p className="rounded-2xl border border-dashed border-rule p-10 text-center text-muted">
            Cardápio vazio. Rode o seed para popular:{" "}
            <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-sm">
              npx prisma db seed
            </code>
          </p>
        )}
      </section>

      {/* Como funciona — sequência de passos, sem cartões iguais */}
      <section
        id="como-funciona"
        className="border-t border-rule bg-paper-2 py-16"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              Como funciona
            </h2>
            <p className="mt-2 text-muted">
              Da encomenda à entrega em quatro passos.
            </p>
          </div>

          <ol className="mt-10 max-w-3xl divide-y divide-rule border-y border-rule">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-6 py-6">
                <span
                  className="font-display text-3xl font-semibold leading-none text-accent"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1 leading-relaxed text-muted">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-muted">
            Quer falar com a gente?{" "}
            <Link
              href="mailto:contato@idalino.com.br"
              className="font-medium text-accent underline underline-offset-2 transition hover:text-accent-deep"
            >
              contato@idalino.com.br
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
