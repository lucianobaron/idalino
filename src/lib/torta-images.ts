// Arte de exibição da vitrine: fotos ilustrativas de tortas.
// Enquanto não há fotos reais, as fotos são atribuídas **por ordem** de exibição:
// o produto na posição i da listagem recebe TORTA_IMAGES[i % 6]. Com 6 produtos
// e 6 fotos, cada foto aparece exatamente uma vez, sem tentar corresponder ao
// sabor. A mesma regra vale na página de detalhe, que usa a posição do produto
// na mesma listagem (createdAt asc).

export const TORTA_IMAGES = [
  "/tortas/cenoura.jpg",
  "/tortas/chocolate.jpg",
  "/tortas/limao.jpg",
  "/tortas/maracuja.jpg",
  "/tortas/morango.jpg",
  "/tortas/redvelvet.jpg",
] as const;

/**
 * Foto ilustrativa do produto pela posição na listagem (ordem de exibição).
 * Slug fora da lista (não deveria ocorrer) cai na primeira foto.
 */
export function tortaImageForSlug(
  slug: string,
  orderedSlugs: readonly string[],
): string {
  const index = orderedSlugs.indexOf(slug);
  return TORTA_IMAGES[(index < 0 ? 0 : index) % TORTA_IMAGES.length];
}
