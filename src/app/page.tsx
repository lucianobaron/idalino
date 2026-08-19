import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TortaCard } from "@/components/torta-card";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

// Página dinâmica: consulta o banco a cada acesso (sem cache de build)
export const dynamic = "force-dynamic";

const STEPS = [
  {
    emoji: "🍰",
    title: "Escolha sua torta",
    text: "Navegue pela vitrine e escolha a torta perfeita para a ocasião.",
  },
  {
    emoji: "📝",
    title: "Encomende online",
    text: "Monte seu pedido no carrinho e preencha seus dados de entrega.",
  },
  {
    emoji: "💳",
    title: "Pague digital",
    text: "Pagamento rápido por Pix ou cartão, direto no site.",
  },
  {
    emoji: "🚚",
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
      {/* Hero */}
      <section className="bg-gradient-to-br from-rose-100 via-amber-50 to-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center">
          <p className="rounded-full bg-rose-600/10 px-4 py-1 text-sm font-semibold text-rose-700">
            Feito à mão, todos os dias
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-6xl">
            {APP_TAGLINE} <span className="text-rose-700">direto da fábrica</span>{" "}
            para a sua mesa
          </h1>
          <p className="max-w-xl text-lg text-zinc-600">
            Encomende hoje e receba amanhã. Pagamento digital, produção
            acompanhada e entrega programada.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#tortas"
              className="rounded-full bg-rose-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-rose-700"
            >
              Ver tortas
            </a>
            <a
              href="#como-funciona"
              className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Como funciona
            </a>
          </div>
        </div>
      </section>

      {/* Vitrine */}
      <section id="tortas" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-bold text-zinc-900">Nossas tortas</h2>
            <p className="mt-1 text-zinc-500">
              {products.length} opções feitas com ingredientes selecionados
            </p>
          </div>
          {categories.length > 0 && (
            <div className="hidden gap-2 sm:flex">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-600"
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
          <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            Cardápio vazio. Rode o seed para popular:{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
              npx prisma db seed
            </code>
          </p>
        )}
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            Como funciona
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-zinc-500">
            Da encomenda à entrega em quatro passos simples
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl" aria-hidden>
                    {step.emoji}
                  </span>
                  <span className="text-sm font-bold text-zinc-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-zinc-500">{step.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-zinc-600">
            Quer falar com a gente?{" "}
            <Link
              href="mailto:contato@idalino.com.br"
              className="font-medium text-rose-700 underline underline-offset-2"
            >
              contato@idalino.com.br
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
