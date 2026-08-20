// Seed do banco — dados iniciais de demonstração
// Execução: npx prisma db seed
// (usa JS puro para não depender de transpilador)

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

// Hash de senha scrypt ("salt:hash" em hex) — mantém em sincronia com
// hashPassword() em src/lib/admin-users.ts (o seed não importa TS).
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

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
    weightGrams: 1200,
    emoji: "🍫",
    categorySlug: "classicas",
  },
  {
    name: "Torta de Morango com Chantilly",
    slug: "morango-chantilly",
    description:
      "Morangos frescos selecionados sobre creme de chantilly leve e massa crocante.",
    priceCents: 7990,
    weightGrams: 1100,
    emoji: "🍓",
    categorySlug: "frutas",
  },
  {
    name: "Torta de Limão Merengue",
    slug: "limao-merengue",
    description:
      "Creme de limão-siciliano com merengue tostado na hora. Equilíbrio perfeito entre doce e azedo.",
    priceCents: 7490,
    weightGrams: 1000,
    emoji: "🍋",
    categorySlug: "frutas",
  },
  {
    name: "Red Velvet",
    slug: "red-velvet",
    description:
      "O clássico americano: massa vermelha aveludada com cream cheese frosting.",
    priceCents: 9490,
    weightGrams: 1300,
    emoji: "🔴",
    categorySlug: "especiais",
  },
  {
    name: "Torta de Maçã com Canela",
    slug: "maca-canela",
    description:
      "Maçãs caramelizadas com canela, receita de família com mais de 30 anos.",
    priceCents: 6990,
    weightGrams: 1150,
    emoji: "🍎",
    categorySlug: "classicas",
  },
  {
    name: "Floresta Negra",
    slug: "floresta-negra",
    description:
      "Chocolate, cerejas e chantilly: uma viagem direta para a Alemanha.",
    priceCents: 9990,
    weightGrams: 1250,
    emoji: "🍒",
    categorySlug: "especiais",
  },
];

const deliveryFeeRanges = [
  { minKm: 0, maxKm: 3, priceCents: 1000 },
  { minKm: 3, maxKm: 8, priceCents: 1500 },
  { minKm: 8, maxKm: 15, priceCents: 2000 },
  // Faixa aberta: "acima de 15 km"
  { minKm: 15, maxKm: null, priceCents: 2500 },
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

  // Faixas de entrega: popula apenas se a tabela estiver vazia, para não
  // sobrescrever as faixas configuradas pelo dono no painel (/admin/entregas).
  if ((await prisma.deliveryFeeRange.count()) === 0) {
    for (const range of deliveryFeeRanges) {
      await prisma.deliveryFeeRange.create({ data: range });
    }
  }

  // Admin inicial (dev): criado apenas se o e-mail ainda não existir — a
  // senha alterada na tela /admin/usuarios nunca é sobrescrita pelo seed.
  await prisma.adminUser.upsert({
    where: { email: "admin@idalino.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@idalino.local",
      passwordHash: hashPassword("idalino-admin"),
    },
  });

  const count = await prisma.product.count();
  const ranges = await prisma.deliveryFeeRange.count();
  const admins = await prisma.adminUser.count();
  console.log(`✅ Seed concluído: ${count} tortas, ${ranges} faixas de entrega, ${admins} admin(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
