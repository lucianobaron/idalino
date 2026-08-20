import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

// Validação de tortas no painel admin (DEC-16: toda entrada é validada no servidor)

const imageUrlSchema = z
  .string()
  .trim()
  .max(500, "URL de imagem muito longa.")
  .refine(
    (value) =>
      value === "" || value.startsWith("/") || /^https?:\/\/\S+$/i.test(value),
    "Imagem: informe uma URL (https://…) ou um caminho local (ex.: /tortas/cenoura.jpg).",
  );

export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome da torta.")
    .max(80, "Nome muito longo (máx. 80 caracteres)."),
  description: z
    .string()
    .trim()
    .min(2, "Informe a descrição.")
    .max(1000, "Descrição muito longa (máx. 1000 caracteres)."),
  priceCents: z
    .number()
    .int("Preço inválido.")
    .positive("Preço deve ser maior que zero.")
    .max(100_000_000, "Preço muito alto."),
  weightGrams: z
    .number()
    .int("Peso inválido.")
    .positive("Informe o peso em gramas.")
    .max(100_000, "Peso muito alto."),
  imageUrl: imageUrlSchema,
  available: z.boolean(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/**
 * Normaliza o caminho da imagem: remove um "/public/" inicial digitado por
 * engano (arquivos de public/ são servidos na raiz, ex.: "/tortas/x.jpg").
 */
export function normalizeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\/public\//, "/");
}

/** Garante um slug único a partir do nome (ex.: "Torta de Maçã" → "torta-de-maca"). */
export async function uniqueSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 2;
  for (;;) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
}
