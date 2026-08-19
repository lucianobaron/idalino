// Seed do banco — dados iniciais de demonstração
// Execução: npx prisma db seed
// (usa JS puro para não depender de transpilador)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Clássicas", slug: "classicas" },
  { name: "Frutas", slug: "frutas" },
  { name: "Especiais", slug: "especiais" },
];

const products = [
  {
    name: "Torta de Chocolate Belga",
    slug: "chocolate-belga",
    description:
      "Camadas generosas de ganache de chocolate belga 70% com massa amanteigada. A queridinha da casa.",
    priceCents: 8990,
    emoji: "🍫",
    categorySlug: "classicas",
  },
  {
    name: "Torta de Morango com Chantilly",
    slug: "morango-chantilly",
    description:
      "Morangos frescos selecionados sobre creme de chantilly leve e massa crocante.",
    priceCents: 7990,
    emoji: "🍓",
    categorySlug: "frutas",
  },
  {
    name: "Torta de Limão Merengue",
    slug: "limao-merengue",
    description:
      "Creme de limão-siciliano com merengue tostado na hora. Equilíbrio perfeito entre doce e azedo.",
    priceCents: 7490,
    emoji: "🍋",
    categorySlug: "frutas",
  },
  {
    name: "Red Velvet",
    slug: "red-velvet",
    description:
      "O clássico americano: massa vermelha aveludada com cream cheese frosting.",
    priceCents: 9490,
    emoji: "🔴",
    categorySlug: "especiais",
  },
  {
    name: "Torta de Maçã com Canela",
    slug: "maca-canela",
    description:
      "Maçãs caramelizadas com canela, receita de família com mais de 30 anos.",
    priceCents: 6990,
    emoji: "🍎",
    categorySlug: "classicas",
  },
  {
    name: "Floresta Negra",
    slug: "floresta-negra",
    description:
      "Chocolate, cerejas e chantilly: uma viagem direta para a Alemanha.",
    priceCents: 9990,
    emoji: "🍒",
    categorySlug: "especiais",
  },
];

async function main() {
  console.log("🌱 Populando o banco do Idalino...");

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUnique({
      where: { slug: product.categorySlug },
    });
    const data = { ...product };
    delete data.categorySlug; // campo auxiliar do seed, não existe no modelo Product
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...data, categoryId: category?.id ?? null },
      create: { ...data, categoryId: category?.id ?? null },
    });
  }

  const count = await prisma.product.count();
  console.log(`✅ Seed concluído: ${count} tortas no cardápio.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
